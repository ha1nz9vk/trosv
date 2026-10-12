<?php

namespace App\Http\Controllers;

use App\Http\Requests\ListingBrowseRequest;
use App\Http\Requests\ReviewStoreRequest;
use App\Http\Resources\ListingDetailResource;
use App\Http\Resources\ListingSummaryResource;
use App\Http\Resources\ReviewResource;
use App\Models\Listing;
use App\Models\Review;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Public listing browse (API_CONTRACT §4 - "Duyệt tin đăng").
 */
class ListingController extends Controller
{
    public const PER_PAGE_DEFAULT = 12;

    public const PER_PAGE_MAX = 50;

    public function index(ListingBrowseRequest $request): JsonResponse
    {
        $validated = $request->validated();

        // Validation (422 with Vietnamese messages, per API_CONTRACT §1)
        // lives in ListingBrowseRequest.

        // max_km and sort=distance require school_id.
        if (
            (isset($validated['max_km']) || ($validated['sort'] ?? null) === 'distance')
            && empty($validated['school_id'])
        ) {
            return response()->json([
                'message' => 'Cần cung cấp school_id khi dùng max_km hoặc sort=distance.',
                'errors' => ['school_id' => ['Cần cung cấp school_id khi dùng max_km hoặc sort=distance.']],
            ], 422);
        }

        $perPage = $validated['per_page'] ?? self::PER_PAGE_DEFAULT;

        // ---------------------------------------------------------------
        // Base query: only available listings
        // ---------------------------------------------------------------
        $query = Listing::query()
            ->where('status', Listing::STATUS_AVAILABLE)
            ->with(['ward.city', 'coverImage'])
            ->withCount('reviews')
            ->withAvg('reviews', 'listing_rating');

        // ---------------------------------------------------------------
        // Filters
        // ---------------------------------------------------------------
        if (! empty($validated['q'])) {
            $q = $validated['q'];
            // ILIKE: PostgreSQL case-insensitive search (ERD §4).
            $query->where(function ($query) use ($q) {
                $query->where('title', 'ilike', "%{$q}%")
                    ->orWhere('address', 'ilike', "%{$q}%");
            });
        }

        if (isset($validated['price_min'])) {
            $query->where('price', '>=', $validated['price_min']);
        }

        if (isset($validated['price_max'])) {
            $query->where('price', '<=', $validated['price_max']);
        }

        if (! empty($validated['ward_id'])) {
            $query->where('ward_id', $validated['ward_id']);
        }

        // City filter: listing's ward belongs to the selected provincial unit.
        if (! empty($validated['city_id'])) {
            $query->whereHas('ward', fn ($q) => $q->where('city_id', $validated['city_id']));
        }

        if (! empty($validated['type'])) {
            $query->where('type', $validated['type']);
        }

        // Listing must have ALL requested amenities.
        foreach ($validated['amenity_ids'] ?? [] as $amenityId) {
            $query->whereHas('amenities', fn ($q) => $q->where('amenities.id', $amenityId));
        }

        // ---------------------------------------------------------------
        // Distance (only when school_id is present)
        // ---------------------------------------------------------------
        if (! empty($validated['school_id'])) {
            $school = DB::table('schools')->find($validated['school_id']);

            if ($school && $school->latitude !== null && $school->longitude !== null) {
                $maxKm = isset($validated['max_km']) ? (float) $validated['max_km'] : null;
                $query->nearby((float) $school->latitude, (float) $school->longitude, $maxKm);
            }
        }

        // ---------------------------------------------------------------
        // Sorting
        // ---------------------------------------------------------------
        match ($validated['sort'] ?? 'newest') {
            'price_asc' => $query->orderBy('price'),
            'price_desc' => $query->orderBy('price', 'desc'),
            'distance' => $query->orderBy('distance_km'),
            // Single subquery with NULLS LAST in PostgreSQL replaces redundant double subquery scan.
            'rating' => $query->orderByRaw(
                '(SELECT AVG(listing_rating) FROM reviews WHERE reviews.listing_id = listings.id) DESC NULLS LAST'
            ),
            default => $query->orderBy('id', 'desc'), // newest
        };

        // Deterministic tiebreaker for stable pagination.
        $query->orderBy('id', 'desc');

        // ---------------------------------------------------------------
        // Pagination + single favorited-ids pre-fetch
        // ---------------------------------------------------------------
        $page = $query->paginate($perPage);

        $favoritedIds = $this->favoritedListingIds($request, $page->getCollection());
        $request->attributes->set('favorited_listing_ids', $favoritedIds);

        return response()->json([
            'data' => ListingSummaryResource::collection($page->getCollection())->resolve($request),
            'meta' => [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => (int) $perPage,
                'total' => $page->total(),
            ],
        ]);
    }

    /**
     * Ids of listings on this page favorited by the current (student) user -
     * exactly ONE query. Guests and landlords get an empty set.
     */
    private function favoritedListingIds(Request $request, $listings): array
    {
        $user = $request->user('sanctum');

        if (! $user || $user->role !== User::ROLE_STUDENT || $listings->isEmpty()) {
            return [];
        }

        return $user->favorites()
            ->whereIn('listings.id', $listings->modelKeys())
            ->pluck('listings.id')
            ->all();
    }

    /**
     * GET /api/listings/{id} - public detail. Hidden listings 404 for
     * everyone except the owner; rented listings stay visible.
     */
    public function show(Request $request, Listing $listing): JsonResponse
    {
        $user = $request->user('sanctum');

        // Hidden listings: 404 unless the viewer is the owner landlord.
        if ($listing->status === Listing::STATUS_HIDDEN
            && (! $user || $user->id !== $listing->user_id)) {
            abort(404);
        }

        $listing->load(['ward.city', 'coverImage', 'images', 'amenities', 'landlord'])
            ->loadCount('reviews')
            ->loadAvg('reviews', 'listing_rating');

        // Personalize is_favorited when a logged-in student is viewing.
        $favorited = $user && $user->role === User::ROLE_STUDENT
            ? $user->favorites()->where('listings.id', $listing->id)->exists()
            : false;
        $request->attributes->set('favorited_listing_ids', $favorited ? [$listing->id] : []);

        return response()->json([
            'data' => (new ListingDetailResource($listing))->resolve($request),
        ]);
    }

    /**
     * GET /api/listings/{id}/reviews - public, newest first, paginated.
     */
    public function reviews(Request $request, Listing $listing): JsonResponse
    {
        $page = $listing->reviews()
            ->with('student:id,name')
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        $request->attributes->set('review_pagination', $page);

        return $this->paginated($page, ReviewResource::class, $request);
    }

    /**
     * POST /api/listings/{id}/reviews - students only. Requires an existing
     * conversation about this listing; one review per student per listing.
     */
    public function storeReview(ReviewStoreRequest $request, Listing $listing): JsonResponse
    {
        $user = $request->user();

        $data = $request->validated();

        // ERD §4: only students who already have a conversation may review.
        // 403 with the contract's specific message (API_CONTRACT §4).
        // ReviewPolicy::create supplies the decision; abort keeps the
        // contract message in the 403 body.
        abort_unless($user->can('review', $listing), 403, 'Bạn cần nhắn tin với chủ nhà trước khi đánh giá.');

        // One review per student per listing (unique constraint, ERD §3).
        // create-or-catch: a true double-submit race would otherwise crash
        // on the unique constraint (500); the loser still gets the same 422.
        try {
            $review = Review::create([
                'listing_id' => $listing->id,
                'student_id' => $user->id,
                ...$data,
            ]);
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages([
                'listing_id' => ['Bạn đã đánh giá tin này rồi.'],
            ]);
        }

        return response()->json(['data' => (new ReviewResource($review->load('student')))->resolve($request)], 201);
    }
}
