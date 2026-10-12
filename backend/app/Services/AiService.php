<?php

namespace App\Services;

use App\Models\Amenity;
use App\Models\City;
use App\Models\Listing;
use App\Models\School;
use App\Models\User;
use App\Models\Ward;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * AI feature layer (docs/AI_CONTRACT.md): prepares ALL data the AI service
 * needs (it has no database and never receives names, emails or phones),
 * calls AiClient and sanitizes the response. Controllers only map
 * HTTP in/out; all 422 semantics live here as ValidationException so the
 * rendered JSON is identical to the previous inline implementation.
 */
class AiService
{
    public function __construct(private readonly AiClient $ai) {}

    /**
     * Roommate matching: profile must be complete and looking_for_roommate
     * set, otherwise 422. Candidates: other students with intersecting
     * budgets, max 20. Response rows get name/school/phone re-attached by
     * Backend (AI only ever sees the anonymous profile shape).
     *
     * @return list<array<string, mixed>>
     */
    public function roommates(User $me): array
    {
        if (! $this->profileComplete($me)) {
            throw ValidationException::withMessages([
                'profile' => ['Hãy hoàn thiện hồ sơ và bật tìm bạn cùng phòng.'],
            ]);
        }

        $candidates = User::query()
            ->where('role', User::ROLE_STUDENT)
            ->where('looking_for_roommate', true)
            ->where('id', '!=', $me->id)
            ->where('budget_min', '<=', $me->budget_max)
            ->where('budget_max', '>=', $me->budget_min)
            ->with('school:id,name')
            ->limit(20)
            ->get();

        // The requester comes from the auth guard without eager loads.
        $me->load('school:id,name');
        $myInterests = $this->interestList($me->interests);

        if ($candidates->isEmpty()) {
            return [];
        }

        $response = $this->ai->post('/roommates', [
            'requester' => $this->candidatePayload($me),
            'candidates' => $candidates->map(fn (User $u) => $this->candidatePayload($u))->all(),
            'limit' => 5,
        ], ['results']);

        // Keep only ids that are actually in the candidate set (contract §4),
        // cap at 5 and re-attach the personal fields Backend owns.
        $byId = $candidates->keyBy('id');
        $results = [];
        foreach ($response['results'] as $row) {
            $candidate = $byId->get($row['id'] ?? null);
            if ($candidate === null || count($results) >= 5) {
                continue;
            }

            $results[] = [
                'user_id' => $candidate->id,
                'name' => $candidate->name,
                'school' => $candidate->school?->name,
                'phone' => $candidate->phone,
                'interests' => $this->interestList($candidate->interests),
                'interests_shared' => array_values(
                    array_intersect($myInterests, $this->interestList($candidate->interests))
                ),
                'score' => is_numeric($row['score'] ?? null) ? (int) $row['score'] : 0,
                'reason' => is_string($row['reason'] ?? null) ? $row['reason'] : '',
            ];
        }

        // Ưu tiên ứng viên trùng nhiều sở thích nhất với người yêu cầu;
        // hòa nhau thì theo score của AI, rồi theo id để ổn định.
        usort($results, fn (array $a, array $b) => count($b['interests_shared']) <=> count($a['interests_shared'])
            ?: $b['score'] <=> $a['score']
            ?: $a['user_id'] <=> $b['user_id']);

        return $results;
    }

    /**
     * Price advice: comparable listings = same ward + type, area within 40%,
     * available or rented, excluding the listing itself. Backend computes
     * the stats; fewer than 3 comparables → 422.
     *
     * @return array<string, mixed>
     */
    public function priceAdvice(int $listingId): array
    {
        /** @var Listing $listing */
        $listing = Listing::query()
            ->visible()
            ->with(['amenities', 'ward'])
            ->findOrFail($listingId);

        $minArea = (float) $listing->area_m2 * 0.6;
        $maxArea = (float) $listing->area_m2 * 1.4;

        $comparables = Listing::query()
            ->visible()
            ->where('id', '!=', $listing->id)
            ->where('ward_id', $listing->ward_id)
            ->where('type', $listing->type)
            ->whereBetween('area_m2', [$minArea, $maxArea])
            ->pluck('price')
            ->all();

        if (count($comparables) < 3) {
            throw ValidationException::withMessages([
                'listing_id' => ['Chưa đủ tin tương tự để so sánh giá.'],
            ]);
        }

        sort($comparables);
        $count = count($comparables);
        $stats = [
            'count' => $count,
            'min' => (int) $comparables[0],
            'median' => (int) round($this->median($comparables)),
            'max' => (int) $comparables[$count - 1],
        ];

        $response = $this->ai->post('/price-advice', [
            'listing' => [
                'type' => $listing->type,
                'price' => (int) $listing->price,
                'area_m2' => (float) $listing->area_m2,
                'ward' => $listing->ward?->name,
                'amenities' => $listing->amenities->pluck('name')->values()->all(),
            ],
            'stats' => $stats,
        ], ['verdict', 'fair_min', 'fair_max', 'tips', 'message']);

        return [
            'listing_price' => (int) $listing->price,
            'verdict' => $response['verdict'],
            'fair_min' => (int) $response['fair_min'],
            'fair_max' => (int) $response['fair_max'],
            'tips' => array_values(array_filter((array) $response['tips'], 'is_string')),
            'message' => $response['message'],
            'stats' => $stats,
        ];
    }

    /**
     * Area suggestions: budget/school fall back to the profile. Per-ward
     * stats computed in PHP; AI ranks and returns reasons; Backend
     * re-attaches names and stats.
     *
     * @param  array<string, mixed>  $data  validated request data
     * @return list<array<string, mixed>>
     */
    public function areaSuggestions(User $me, array $data): array
    {
        $budgetMin = $data['budget_min'] ?? $me->budget_min;
        $budgetMax = $data['budget_max'] ?? $me->budget_max;
        $schoolId = $data['school_id'] ?? $me->school_id;

        if ($budgetMin === null && $budgetMax === null) {
            throw ValidationException::withMessages([
                'budget_min' => ['Hãy cung cấp ngân sách hoặc hoàn thiện hồ sơ.'],
            ]);
        }

        $budgetMin ??= 0;
        $budgetMax ??= PHP_INT_MAX;

        $school = $schoolId !== null ? School::find($schoolId) : null;

        $wards = Ward::query()
            ->whereHas('listings', fn ($q) => $q->visible()
                ->whereBetween('price', [$budgetMin, $budgetMax]))
            ->with(['listings' => fn ($q) => $q->visible()
                ->whereBetween('price', [$budgetMin, $budgetMax])
                ->withAvg('reviews', 'listing_rating')])
            ->get();

        $areas = $wards->map(function (Ward $ward) use ($school) {
            $listings = $ward->listings;
            $prices = $listings->pluck('price')->map(fn ($p) => (float) $p)->sort()->values();
            $ratings = $listings->pluck('reviews_avg_listing_rating')->filter()->map(fn ($r) => (float) $r);

            return [
                'ward_id' => $ward->id,
                'name' => $ward->name,
                'listings_count' => $listings->count(),
                'avg_price' => $prices->isEmpty() ? null : (int) round($prices->avg()),
                'avg_rating' => $ratings->isEmpty() ? null : round($ratings->avg(), 1),
                'distance_to_school_km' => ($school !== null && $school->latitude !== null
                    && $school->longitude !== null && $ward->latitude !== null && $ward->longitude !== null)
                    ? $this->haversineKm(
                        (float) $school->latitude,
                        (float) $school->longitude,
                        (float) $ward->latitude,
                        (float) $ward->longitude
                    )
                    : null,
            ];
        })->values()->all();

        if ($areas === []) {
            return [];
        }

        $response = $this->ai->post('/areas', [
            'preferences' => [
                'budget_min' => (int) $budgetMin,
                'budget_max' => (int) $budgetMax,
                'priorities' => $data['priorities'] ?? [],
            ],
            // Names go through: ward names are not personal data and the
            // AI contract includes them in the request (docs/AI_CONTRACT §4).
            'areas' => $areas,
            'limit' => 3,
        ], ['results']);

        // Re-attach name + stats for the wards the AI kept.
        $byId = collect($areas)->keyBy('ward_id');
        $results = [];
        foreach ($response['results'] as $row) {
            $area = $byId->get($row['ward_id'] ?? null);
            if ($area === null || count($results) >= 3) {
                continue;
            }

            $results[] = [
                'ward_id' => $area['ward_id'],
                'name' => $area['name'],
                'reason' => is_string($row['reason'] ?? null) ? $row['reason'] : '',
                'stats' => [
                    'listings_count' => $area['listings_count'],
                    'avg_price' => $area['avg_price'],
                    'avg_rating' => $area['avg_rating'],
                    'distance_to_school_km' => $area['distance_to_school_km'],
                ],
            ];
        }

        return $results;
    }

    /**
     * Chatbot proxy with optional listing context or secure room recommendation.
     *
     * @param  array<string, mixed>  $data  validated request data
     * @param  User|null  $user  authenticated user
     * @return array<string, mixed>
     */
    public function chat(array $data, ?User $user = null): array
    {
        $listingPayload = null;
        if (! empty($data['listing_id'])) {
            $listing = Listing::query()
                ->visible()
                ->with(['amenities', 'ward'])
                ->find($data['listing_id']);

            if ($listing !== null) {
                $listingPayload = [
                    'title' => $listing->title,
                    'price' => (int) $listing->price,
                    'area_m2' => (float) $listing->area_m2,
                    'address' => $listing->address,
                    'ward' => $listing->ward?->name,
                    'amenities' => $listing->amenities->pluck('name')->values()->all(),
                    'description' => $listing->description,
                ];
            }
        }

        $message = (string) ($data['message'] ?? '');
        $history = $data['history'] ?? [];
        $candidateListings = null;
        $needsLocation = false;

        // If user is not asking about a specific listing, check for room finding intent
        if ($listingPayload === null && $this->hasRoomSearchIntent($message, $history)) {
            $locationAnchor = $this->resolveLocationAnchor($data, $user);

            if ($locationAnchor === null) {
                // Security check: user wants rooms, but no school/city/district information is known.
                // Do NOT query the listings table indiscriminately or scrape rooms in DB.
                // Ask user to provide location information first.
                $needsLocation = true;
            } else {
                $candidateListings = $this->findCandidateListings($locationAnchor, $message, $history, $user);
            }
        }

        $response = $this->ai->post('/chat', [
            'message' => $data['message'],
            'history' => array_map(
                fn (array $turn) => ['role' => $turn['role'], 'content' => $turn['content']],
                array_slice($data['history'] ?? [], -10),
            ),
            'listing' => $listingPayload,
            'candidate_listings' => $candidateListings,
            'needs_location' => $needsLocation,
        ], ['reply']);

        return [
            'reply' => $response['reply'],
            'listings' => $candidateListings ?? [],
        ];
    }

    /**
     * Check if message or conversation history indicates an intent to find/search for rooms.
     *
     * @param  array<int, array{role: string, content: string}>  $history
     */
    private function hasRoomSearchIntent(string $message, array $history = []): bool
    {
        if ($this->matchesRoomSearchKeywords($message)) {
            return true;
        }

        // If user is answering a previous prompt from the assistant (multi-turn follow-up)
        if (! empty($history)) {
            $lastTurns = array_slice($history, -3);
            foreach ($lastTurns as $turn) {
                $content = (string) ($turn['content'] ?? '');
                if ($turn['role'] === 'user' && $this->matchesRoomSearchKeywords($content)) {
                    return true;
                }
                if ($turn['role'] === 'assistant' && (
                    str_contains($content, 'thành phố') ||
                    str_contains($content, 'trường đại học') ||
                    str_contains($content, 'ngân sách') ||
                    str_contains($content, 'tìm phòng') ||
                    str_contains($content, 'phù hợp nhất cho bạn')
                )) {
                    return true;
                }
            }
        }

        return false;
    }

    private function matchesRoomSearchKeywords(string $text): bool
    {
        $normalized = mb_strtolower($text, 'UTF-8');
        $stripped = $this->stripAccents($normalized);

        $phrases = [
            'tìm phòng', 'kiếm phòng', 'thuê phòng', 'tìm trọ', 'kiếm trọ', 'thuê trọ',
            'cần thuê', 'muốn thuê', 'gợi ý phòng', 'có phòng nào', 'tìm nhà trọ',
            'muốn tìm phòng', 'tìm chỗ ở', 'có phòng trọ nào', 'xem phòng', 'phòng trọ gần',
            'phòng trọ ở', 'phòng trọ giá', 'phòng ở', 'trọ ở', 'trọ gần', 'phòng giá',
            'tim phong', 'kiem phong', 'thue phong', 'tim tro', 'kiem tro', 'thue tro',
            'can thue', 'muon thue', 'goi y phong', 'co phong nao', 'tim nha tro',
            'muon tim phong', 'tim cho o', 'co phong tro nao', 'xem phong', 'phong tro gan',
            'phong tro o', 'phong tro gia', 'phong o', 'tro o', 'tro gan', 'phong gia',
            // English phrases
            'find room', 'find me a room', 'find a room', 'looking for a room', 'look for a room',
            'search room', 'search for a room', 'rent room', 'rent a room', 'need a room',
            'want a room', 'recommend room', 'recommend a room', 'give me a room',
            'any room', 'student room', 'rooms available', 'room for rent',
        ];

        foreach ($phrases as $phrase) {
            if (str_contains($normalized, $phrase) || str_contains($stripped, $phrase)) {
                return true;
            }
        }

        return (bool) (
            preg_match('/(tìm|kiếm|thuê|gợi ý|có phòng|muốn tìm)\b.*?\b(phòng|trọ|nhà)/iu', $text) ||
            preg_match('/(tim|kiem|thue|goi y|co phong|muon tim)\b.*?\b(phong|tro|nha)/i', $stripped) ||
            preg_match('/(find|search|rent|need|looking for|want|recommend|give)\b.*?\b(room|apartment|flat|place|house|accommodation)/i', $text)
        );
    }

    private function stripAccents(string $str): string
    {
        $accents = [
            'à' => 'a', 'á' => 'a', 'ả' => 'a', 'ã' => 'a', 'ạ' => 'a', 'ă' => 'a', 'ằ' => 'a', 'ắ' => 'a', 'ẳ' => 'a', 'ẵ' => 'a', 'ặ' => 'a',
            'â' => 'a', 'ầ' => 'a', 'ấ' => 'a', 'ẩ' => 'a', 'ẫ' => 'a', 'ậ' => 'a',
            'è' => 'e', 'é' => 'e', 'ẻ' => 'e', 'ẽ' => 'e', 'ẹ' => 'e', 'ê' => 'e', 'ề' => 'e', 'ế' => 'e', 'ể' => 'e', 'ễ' => 'e', 'ệ' => 'e',
            'ì' => 'i', 'í' => 'i', 'ỉ' => 'i', 'ĩ' => 'i', 'ị' => 'i',
            'ò' => 'o', 'ó' => 'o', 'ỏ' => 'o', 'õ' => 'o', 'ọ' => 'o', 'ô' => 'o', 'ồ' => 'o', 'ố' => 'o', 'ổ' => 'o', 'ỗ' => 'o', 'ộ' => 'o',
            'ơ' => 'o', 'ờ' => 'o', 'ớ' => 'o', 'ở' => 'o', 'ỡ' => 'o', 'ợ' => 'o',
            'ù' => 'u', 'ú' => 'u', 'ủ' => 'u', 'ũ' => 'u', 'ụ' => 'u', 'ư' => 'u', 'ừ' => 'u', 'ứ' => 'u', 'ử' => 'u', 'ữ' => 'u', 'ự' => 'u',
            'ỳ' => 'y', 'ý' => 'y', 'ỷ' => 'y', 'ỹ' => 'y', 'ỵ' => 'y',
            'đ' => 'd',
        ];

        return strtr(mb_strtolower($str, 'UTF-8'), $accents);
    }

    /**
     * Determine location anchor from request data, message text, conversation history, or user student profile.
     *
     * @param  array<string, mixed>  $data
     * @return array{type: string, model?: mixed, name?: string, city_id?: int}|null
     */
    private function resolveLocationAnchor(array $data, ?User $user): ?array
    {
        // 1. Explicit school_id in request
        if (! empty($data['school_id'])) {
            $school = School::with('city')->find($data['school_id']);
            if ($school) {
                return ['type' => 'school', 'model' => $school];
            }
        }

        // 2. Explicit city_id in request
        if (! empty($data['city_id'])) {
            $city = City::find($data['city_id']);
            if ($city) {
                return ['type' => 'city', 'model' => $city];
            }
        }

        $message = (string) ($data['message'] ?? '');
        $combined = $message;
        if (! empty($data['history'])) {
            foreach (array_reverse(array_slice($data['history'], -3)) as $turn) {
                if ($turn['role'] === 'user') {
                    $combined .= ' '.($turn['content'] ?? '');
                }
            }
        }

        $normalized = mb_strtolower($combined, 'UTF-8');
        $stripped = $this->stripAccents($normalized);

        // 3. Match against known universities / schools
        $schools = School::with('city')->get();
        foreach ($schools as $school) {
            if (preg_match('/\(([^)]+)\)/', $school->name, $matches)) {
                $acronym = mb_strtolower(trim($matches[1]), 'UTF-8');
                if (preg_match('/\b'.preg_quote($acronym, '/').'\b/iu', $normalized) ||
                    preg_match('/\b'.preg_quote($this->stripAccents($acronym), '/').'\b/i', $stripped)) {
                    return ['type' => 'school', 'model' => $school];
                }
                // Check first word of acronym if multi-word (e.g. "FPT" from "FPT DN")
                $parts = explode(' ', $acronym);
                if (count($parts) > 1 && mb_strlen($parts[0]) >= 3) {
                    if (preg_match('/\b'.preg_quote($parts[0], '/').'\b/iu', $normalized)) {
                        return ['type' => 'school', 'model' => $school];
                    }
                }
            }

            $cleanName = preg_replace('/^(đh|đhqg|học viện|đại học|dh|dhqg|hoc vien|dai hoc)\s+/iu', '', $school->name);
            $cleanName = preg_replace('/\s*\([^)]*\)/', '', (string) $cleanName);
            $cleanName = trim(mb_strtolower((string) $cleanName, 'UTF-8'));
            $cleanStripped = $this->stripAccents($cleanName);

            if (! empty($cleanName) && mb_strlen($cleanName) >= 4) {
                if (str_contains($normalized, $cleanName) || str_contains($stripped, $cleanStripped)) {
                    return ['type' => 'school', 'model' => $school];
                }
            }
        }

        // 4. Match student's own school if they ask "gần trường mình/em/tôi" or "near my school"
        if ($user !== null && $user->school_id && $user->school) {
            if (preg_match('/(gần trường|trường mình|trường em|trường tôi|quanh trường|near my (school|university))/iu', $normalized) ||
                preg_match('/(gan truong|truong minh|truong em|truong toi|quanh truong)/i', $stripped)) {
                return ['type' => 'school', 'model' => $user->school];
            }
        }

        // 5. Match cities (Vietnamese accented, unaccented, English aliases)
        $cities = City::all();
        $cityAliases = [
            'tp.hcm' => 'TP.HCM', 'tphcm' => 'TP.HCM', 'hồ chí minh' => 'TP.HCM', 'ho chi minh' => 'TP.HCM',
            'sài gòn' => 'TP.HCM', 'sai gon' => 'TP.HCM', 'saigon' => 'TP.HCM', 'hcmc' => 'TP.HCM', 'hcm' => 'TP.HCM',
            'hà nội' => 'Hà Nội', 'ha noi' => 'Hà Nội', 'hn' => 'Hà Nội', 'hanoi' => 'Hà Nội',
            'đà nẵng' => 'Đà Nẵng', 'da nang' => 'Đà Nẵng', 'đn' => 'Đà Nẵng', 'dn' => 'Đà Nẵng', 'danang' => 'Đà Nẵng',
        ];
        foreach ($cityAliases as $alias => $canonical) {
            if (str_contains($normalized, $alias) || str_contains($stripped, $alias)) {
                $c = $cities->first(fn ($item) => mb_strtolower($item->name, 'UTF-8') === mb_strtolower($canonical, 'UTF-8'));
                if ($c) {
                    return ['type' => 'city', 'model' => $c];
                }
            }
        }
        foreach ($cities as $c) {
            $cNorm = mb_strtolower($c->name, 'UTF-8');
            if (str_contains($normalized, $cNorm) || str_contains($stripped, $this->stripAccents($cNorm))) {
                return ['type' => 'city', 'model' => $c];
            }
        }

        // 6. Match prominent districts to cities
        $districtMap = [
            'TP.HCM' => [
                'quận 1', 'quan 1', 'q1', 'q.1', 'district 1', 'quận 2', 'quan 2', 'q2', 'q.2', 'district 2',
                'quận 3', 'quan 3', 'q3', 'q.3', 'district 3', 'quận 4', 'quan 4', 'q4', 'q.4', 'district 4',
                'quận 5', 'quan 5', 'q5', 'q.5', 'district 5', 'quận 6', 'quan 6', 'q6', 'q.6', 'district 6',
                'quận 7', 'quan 7', 'q7', 'q.7', 'district 7', 'quận 8', 'quan 8', 'q8', 'q.8', 'district 8',
                'quận 9', 'quan 9', 'q9', 'q.9', 'district 9', 'quận 10', 'quan 10', 'q10', 'q.10', 'district 10',
                'quận 11', 'quan 11', 'q11', 'q.11', 'district 11', 'quận 12', 'quan 12', 'q12', 'q.12', 'district 12',
                'bình thạnh', 'binh thanh', 'thủ đức', 'thu duc', 'gò vấp', 'go vap', 'tân bình', 'tan binh',
                'tân phú', 'tan phu', 'phú nhuận', 'phu nhuan', 'bình tân', 'binh tan', 'nhà bè', 'nha be', 'hóc môn', 'hoc mon',
            ],
            'Hà Nội' => [
                'cầu giấy', 'cau giay', 'đống đa', 'dong da', 'ba đình', 'ba dinh', 'hai bà trưng', 'hai ba trung',
                'hoàng mai', 'hoang mai', 'thanh xuân', 'thanh xuan', 'hà đông', 'ha dong', 'tây hồ', 'tay ho',
                'bắc từ liêm', 'bac tu liem', 'nam từ liêm', 'nam tu liem', 'long biên', 'long bien',
            ],
            'Đà Nẵng' => [
                'hải châu', 'hai chau', 'thanh khê', 'thanh khe', 'sơn trà', 'son tra',
                'ngũ hành sơn', 'ngu hanh son', 'liên chiểu', 'lien chieu', 'cẩm lệ', 'cam le',
            ],
        ];

        foreach ($districtMap as $cityName => $distList) {
            foreach ($distList as $dist) {
                if (preg_match('/\b'.preg_quote($dist, '/').'\b/iu', $normalized) ||
                    preg_match('/\b'.preg_quote($dist, '/').'\b/i', $stripped)) {
                    $city = $cities->first(fn ($item) => mb_strtolower($item->name, 'UTF-8') === mb_strtolower($cityName, 'UTF-8'));

                    return [
                        'type' => 'district',
                        'name' => $dist,
                        'city_id' => $city?->id,
                        'model' => $city,
                    ];
                }
            }
        }

        // Generic district/ward regex fallback
        if (preg_match('/\b((quận|quan|huyện|huyen|phường|phuong)\s*[0-9a-zà-ỹ\s]+)/iu', $combined, $dMatches)) {
            $districtName = trim($dMatches[1]);

            return ['type' => 'district', 'name' => $districtName];
        }

        // 7. If student has a registered school in profile and no conflicting location mentioned,
        // use student's school as anchor
        if ($user !== null && $user->school_id && $user->school) {
            return ['type' => 'school', 'model' => $user->school];
        }

        return null;
    }

    /**
     * Securely query a small set of matching candidate listings based on location anchor,
     * budget, room type, and amenities.
     *
     * @param  array{type: string, model?: mixed, name?: string, city_id?: int}  $anchor
     * @param  array<int, array{role: string, content: string}>  $history
     * @return list<array<string, mixed>>
     */
    private function findCandidateListings(array $anchor, string $message, array $history, ?User $user): array
    {
        $combined = $message;
        foreach (array_reverse(array_slice($history, -3)) as $turn) {
            if ($turn['role'] === 'user') {
                $combined .= ' '.($turn['content'] ?? '');
            }
        }

        $normalized = mb_strtolower($combined, 'UTF-8');
        $stripped = $this->stripAccents($normalized);

        $baseQuery = Listing::query()
            ->select('listings.*')
            ->visible()
            ->where('status', Listing::STATUS_AVAILABLE);

        if ($anchor['type'] === 'school') {
            /** @var School $school */
            $school = $anchor['model'];
            if ($school->latitude !== null && $school->longitude !== null) {
                $baseQuery->nearby((float) $school->latitude, (float) $school->longitude, 12.0)
                    ->orderBy('distance_km');
            } elseif ($school->city_id !== null) {
                $baseQuery->whereHas('ward', fn ($q) => $q->where('city_id', $school->city_id));
            }
        } elseif ($anchor['type'] === 'city') {
            /** @var City $city */
            $city = $anchor['model'];
            $baseQuery->whereHas('ward', fn ($q) => $q->where('city_id', $city->id));
        } elseif ($anchor['type'] === 'district') {
            $distName = $anchor['name'];
            $cityId = $anchor['city_id'] ?? null;
            if ($cityId !== null) {
                $baseQuery->whereHas('ward', fn ($q) => $q->where('city_id', $cityId));
            } else {
                $baseQuery->where(function ($q) use ($distName) {
                    $q->where('address', 'ilike', "%{$distName}%")
                        ->orWhereHas('ward', fn ($w) => $w->where('name', 'ilike', "%{$distName}%"));
                });
            }
        }

        // Clone query for applying strict filters
        $filteredQuery = clone $baseQuery;

        // Budget filters (Vietnamese + English)
        if (preg_match('/(dưới|duoi|under|below|<)\s*([0-9]+(?:[.,][0-9]+)?)\s*(triệu|tr|m|million)?/iu', $normalized, $bMatch)) {
            $val = (float) str_replace(',', '.', $bMatch[2]);
            $filteredQuery->where('price', '<=', (int) ($val * 1_000_000));
        } elseif (preg_match('/(?:tầm|khoảng|tam|khoang|about|around)\s*([0-9]+(?:[.,][0-9]+)?)\s*(triệu|tr|m|million)?/iu', $normalized, $bMatch)) {
            $val = (float) str_replace(',', '.', $bMatch[1]);
            $min = (int) (($val - 0.5) * 1_000_000);
            $max = (int) (($val + 0.5) * 1_000_000);
            $filteredQuery->whereBetween('price', [max(0, $min), $max]);
        } elseif (preg_match('/(từ|tu|between|from)\s*([0-9]+(?:[.,][0-9]+)?)\s*(?:đến|-|den|to|and)\s*([0-9]+(?:[.,][0-9]+)?)\s*(triệu|tr|m|million)?/iu', $normalized, $bMatch)) {
            $minVal = (float) str_replace(',', '.', $bMatch[2]);
            $maxVal = (float) str_replace(',', '.', $bMatch[3]);
            $filteredQuery->whereBetween('price', [(int) ($minVal * 1_000_000), (int) ($maxVal * 1_000_000)]);
        } elseif ($user !== null && $user->budget_max) {
            $filteredQuery->where('price', '<=', (int) $user->budget_max);
        }

        // Room type filters
        if (str_contains($normalized, 'căn hộ') || str_contains($stripped, 'can ho') || str_contains($normalized, 'chung cư') || str_contains($stripped, 'chung cu') || str_contains($normalized, 'apartment')) {
            $filteredQuery->where('type', Listing::TYPE_APARTMENT);
        } elseif (str_contains($normalized, 'nguyên căn') || str_contains($stripped, 'nguyen can') || str_contains($normalized, 'nhà riêng') || str_contains($stripped, 'nha rieng') || str_contains($normalized, 'house')) {
            $filteredQuery->where('type', Listing::TYPE_HOUSE);
        } elseif (str_contains($normalized, 'phòng trọ') || str_contains($stripped, 'phong tro') || str_contains($normalized, 'phòng đơn') || str_contains($stripped, 'phong don') || str_contains($normalized, 'single room')) {
            $filteredQuery->where('type', Listing::TYPE_ROOM);
        }

        // Amenities filters
        if (str_contains($normalized, 'máy lạnh') || str_contains($stripped, 'may lanh') || str_contains($normalized, 'điều hòa') || str_contains($stripped, 'dieu hoa') || str_contains($normalized, 'ac') || str_contains($normalized, 'air condition')) {
            $filteredQuery->whereHas('amenities', fn ($q) => $q->where('name', 'ilike', '%máy lạnh%'));
        }
        if (str_contains($normalized, 'máy giặt') || str_contains($stripped, 'may giat') || str_contains($normalized, 'washing machine')) {
            $filteredQuery->whereHas('amenities', fn ($q) => $q->where('name', 'ilike', '%máy giặt%'));
        }
        if (str_contains($normalized, 'ban công') || str_contains($stripped, 'ban cong') || str_contains($normalized, 'balcony')) {
            $filteredQuery->whereHas('amenities', fn ($q) => $q->where('name', 'ilike', '%ban công%'));
        }
        if (str_contains($normalized, 'gác') || str_contains($stripped, 'gac') || str_contains($normalized, 'mezzanine') || str_contains($normalized, 'loft')) {
            $filteredQuery->whereHas('amenities', fn ($q) => $q->where('name', 'ilike', '%gác%'));
        }

        $candidates = $filteredQuery
            ->with(['ward.city', 'amenities', 'coverImage'])
            ->limit(4)
            ->get();

        // Fallback: if strict filters returned 0 candidates, fallback to base location candidates
        if ($candidates->isEmpty()) {
            $candidates = $baseQuery
                ->with(['ward.city', 'amenities', 'coverImage'])
                ->limit(4)
                ->get();
        }

        return $candidates->map(function (Listing $l) {
            $cover = $l->coverImage->first();
            $coverUrl = $cover ? Storage::disk('public')->url($cover->path) : null;

            return [
                'id' => $l->id,
                'title' => $l->title,
                'price' => (int) $l->price,
                'area_m2' => $l->area_m2 !== null ? (float) $l->area_m2 : null,
                'address' => $l->address,
                'ward' => $l->ward?->name,
                'city' => $l->ward?->city?->name,
                'amenities' => $l->amenities->pluck('name')->values()->all(),
                'distance_km' => isset($l->distance_km) ? round((float) $l->distance_km, 1) : null,
                'cover_image' => $coverUrl,
            ];
        })->values()->all();
    }

    /**
     * Listing description generator (landlord). ids become names; missing
     * title becomes "Nhà cho thuê".
     *
     * @param  array<string, mixed>  $data  validated request data
     * @return array<string, mixed>
     */
    public function description(array $data): array
    {
        $ward = isset($data['ward_id'])
            ? Ward::find($data['ward_id'])?->name
            : null;
        $amenities = isset($data['amenity_ids'])
            ? Amenity::whereIn('id', $data['amenity_ids'])->pluck('name')->values()->all()
            : null;

        $response = $this->ai->post('/description', [
            'title' => $data['title'] ?? 'Nhà cho thuê',
            'type' => $data['type'] ?? null,
            'price' => $data['price'] ?? null,
            'area_m2' => $data['area_m2'] ?? null,
            'address' => $data['address'] ?? null,
            'ward' => $ward,
            'amenities' => $amenities,
        ], ['description']);

        return ['description' => $response['description']];
    }

    // ------------------------------------------------------------------

    /** The AI contract profile shape - no name, email or phone here. */
    private function candidatePayload(User $user): array
    {
        return [
            'id' => $user->id,
            'budget_min' => (int) $user->budget_min,
            'budget_max' => (int) $user->budget_max,
            'sleep_schedule' => $user->sleep_schedule,
            'cleanliness' => $user->cleanliness !== null ? (int) $user->cleanliness : null,
            'smoking' => (bool) $user->smoking,
            'personality' => $user->personality,
            'interests' => $this->interestList($user->interests),
        ];
    }

    /** "music, gym" -> ["music", "gym"] (null -> []).
     * @return list<string>
     */
    private function interestList(?string $csv): array
    {
        return $csv !== null
            ? array_values(array_filter(array_map('trim', explode(',', $csv))))
            : [];
    }

    private function profileComplete(User $user): bool
    {
        return $user->school_id !== null
            && $user->budget_min !== null
            && $user->budget_max !== null
            && $user->sleep_schedule !== null
            && $user->cleanliness !== null
            && $user->smoking !== null
            && $user->personality !== null
            && $user->looking_for_roommate === true;
    }

    /** @param  list<int|float>  $values  sorted ascending */
    private function median(array $values): float
    {
        $count = count($values);
        $middle = intdiv($count, 2);

        return $count % 2 === 1
            ? (float) $values[$middle]
            : ($values[$middle - 1] + $values[$middle]) / 2;
    }

    private function haversineKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6371.0;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        return round($earthRadius * 2 * asin(min(1.0, sqrt($a))), 2);
    }
}
