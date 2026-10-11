import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES, route } from "@/constants/routes";
import { useListingSearch } from "@/hooks/useListingSearch";
import type { Listing } from "@/types/api";
import { Input } from "@/ui/input";
import { Button } from "@/ui/button";
import { Chip, Skeleton, Tag, Rating } from "@/ui/badge";
import { ErrorState, EmptyState } from "@/ui/empty-state";
import { SearchEmptyIllustration, HousePlaceholder } from "@/ui/icons";
import { ListingMap } from "@/ui/ListingMap";
import { Popover, PopoverTrigger, PopoverContent } from "@/ui/popover";
import { Heart, X, Map as MapIcon, List as ListIcon, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { addFavorite, removeFavorite } from "@/api/socialApi";
import { toast } from "@/ui/toast";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/*
  Search ("Phòng trọ gần trường"): the centrepiece. Sticky filter bar,
  split list | map from 1024px, List/Map toggle below. Every filter lives
  in the query string. Filters collapse into a bottom sheet on mobile.
*/

const TYPE_OPTIONS = [
  { value: "room", label: "Phòng trọ" },
  { value: "apartment", label: "Căn hộ" },
  { value: "house", label: "Nhà nguyên căn" },
] as const;

const SORT_OPTIONS = [
  { value: "newest", label: "Mới nhất" },
  { value: "price_asc", label: "Giá thấp trước" },
  { value: "price_desc", label: "Giá cao trước" },
  { value: "rating", label: "Đánh giá cao trước" },
] as const;

const RADIUS_OPTIONS = [
  { value: "1", label: "Trong 1 km" },
  { value: "2", label: "Trong 2 km" },
  { value: "3", label: "Trong 3 km" },
  { value: "5", label: "Trong 5 km" },
] as const;

function formatPriceShort(vnd: number): string {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(vnd / 1_000_000)}tr`;
}

interface ListingCardProps {
  listing: Listing;
  onHover: (id: number | null) => void;
  onFavToggle: (l: Listing) => void;
}

function ListingCard({ listing, onHover, onFavToggle }: ListingCardProps) {
  const { user } = useAuth();
  const isFav = listing.is_favorited === true;
  return (
    <Link
      to={route(ROUTES.ROOM_DETAIL, { id: listing.id })}
      onMouseEnter={() => { onHover(listing.id); }}
      onMouseLeave={() => { onHover(null); }}
      data-testid={`listing-card-${listing.id}`}
      className={cn(
        "group block rounded-2xl border bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay",
        "border-line hover:border-line-strong"
      )}
    >
      <div className="relative aspect-3/2 overflow-hidden rounded-t-2xl bg-oat">
        {listing.cover_image ? (
          <img
            src={listing.cover_image}
            alt=""
            loading="lazy"
            decoding="async"
            width={640}
            height={427}
            className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-[1.03]"
          />
        ) : (
          <HousePlaceholder />
        )}
        <span className="absolute left-2 top-2">
          <Tag>
            {listing.type === "room"
              ? "Phòng trọ"
              : listing.type === "apartment"
                ? "Căn hộ"
                : "Nhà nguyên căn"}
          </Tag>
        </span>
        {user?.role === "student" ? (
          <button
            type="button"
            aria-label={isFav ? "Bỏ lưu phòng" : "Lưu phòng"}
            aria-pressed={isFav}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFavToggle(listing);
            }}
            className={cn(
              "absolute right-2 top-2 flex size-9 items-center justify-center rounded-full bg-cream transition-transform duration-150",
              isFav && "scale-105"
            )}
          >
            <Heart
              className={cn("size-4", isFav ? "fill-clay stroke-clay" : "stroke-ink")}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
      <div className="p-3">
        <p className="text-lg font-semibold tabular-nums text-ink">
          {formatPriceShort(listing.price)}
          <small className="ml-1 text-sm font-normal text-muted">/tháng</small>
        </p>
        <p className="text-sm text-ink-2">
          {listing.type === "room"
            ? "Phòng trọ"
            : listing.type === "apartment"
              ? "Căn hộ"
              : "Nhà nguyên căn"}
          {listing.area_m2 != null ? ` · ${listing.area_m2} m²` : ""}
          {listing.distance_km != null
            ? ` · ${listing.distance_km.toFixed(1)} km tới trường`
            : ""}
        </p>
        <p className="text-sm text-ink-2">
          {listing.address}
          {listing.ward ? `, ${listing.ward.name}` : ""}
        </p>
        <Rating value={listing.avg_rating} count={listing.reviews_count} className="mt-1" />
      </div>
    </Link>
  );
}

export default function Search() {
  const navigate = useNavigate();
  useDocumentTitle("Tìm phòng · TROSV");
  const search = useListingSearch();
  const [showMap, setShowMap] = useState(
    () => new URLSearchParams(window.location.search).get("view") === "map"
  );
  const [hoveredListing, setHoveredListing] = useState<number | null>(null);
  const { user } = useAuth();

  /* Active filter chips derive from the current filter state. */
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (search.filters.q) {
      chips.push({
        key: "q",
        label: `"${search.filters.q}"`,
        onRemove: () => { search.setFilter("q", ""); },
      });
    }
    if (search.filters.type) {
      const t = TYPE_OPTIONS.find((o) => o.value === search.filters.type);
      if (t) {
        chips.push({ key: "type", label: t.label, onRemove: () => { search.setFilter("type", ""); } });
      }
    }
    if (search.filters.city_id) {
      const c = search.cities.find((x) => String(x.id) === search.filters.city_id);
      if (c) {
        chips.push({
          key: "city_id",
          label: c.name,
          onRemove: () => { search.setCity(""); },
        });
      }
    }
    if (search.filters.price_min || search.filters.price_max) {
      chips.push({
        key: "price",
        label: `${search.filters.price_min ? formatPriceShort(Number(search.filters.price_min)) : "0"} - ${
          search.filters.price_max ? formatPriceShort(Number(search.filters.price_max)) : "∞"
        }`,
        onRemove: () => {
          search.setFilter("price_min", "");
          search.setFilter("price_max", "");
        },
      });
    }
    for (const id of search.filters.amenity_ids) {
      const a = search.amenities.find((x) => x.id === id);
      if (a?.name) {
        chips.push({
          key: `amenity_${id}`,
          label: a.name,
          onRemove: () => { search.toggleAmenity(id); },
        });
      }
    }
    if (search.filters.school_id) {
      const s = search.schools.find((x) => String(x.id) === search.filters.school_id);
      if (s) {
        chips.push({ key: "school_id", label: s.name, onRemove: () => { search.setFilter("school_id", ""); } });
      }
    }
    return chips;
  }, [search]);

  async function toggleFavorite(listing: Listing): Promise<void> {
    if (!user || user.role !== "student") return;
    const wasFav = listing.is_favorited === true;
    /* Optimistic flip with rollback + toast on failure. */
    search.setListings((rows) =>
      rows.map((r) =>
        r.id === listing.id ? { ...r, is_favorited: !wasFav } : r
      )
    );
    try {
      if (wasFav) {
        await removeFavorite(listing.id);
        toast("Đã bỏ lưu phòng.");
      } else {
        await addFavorite(listing.id);
        toast("Đã lưu phòng.");
      }
    } catch {
      search.setListings((rows) =>
        rows.map((r) =>
          r.id === listing.id ? { ...r, is_favorited: wasFav } : r
        )
      );
      toast("Không cập nhật được yêu thích. Bạn thử lại nhé.");
    }
  }

  const onHover = useCallback((id: number | null) => { setHoveredListing(id); }, []);

  const totalCount = search.meta?.total ?? search.listings.length;

  /* List heading per the skeleton: "Phòng trọ tại <area>" + count. */
  const areaName = (() => {
    const ward = search.wards.find((x) => String(x.id) === search.filters.ward_id);
    if (ward) return ward.name;
    const school = search.schools.find((x) => String(x.id) === search.filters.school_id);
    if (school) return school.name;
    const city = search.cities.find((x) => String(x.id) === search.filters.city_id);
    if (city) return city.name;
    const q = search.filters.q.trim();
    if (q) return q;
    return null;
  })();

  /* "Lưu tìm kiếm" persists the full filter set (the URL only carries
     q/type) for a future saved-searches UI. */
  function saveSearch(): void {
    const params = new URLSearchParams();
    const f = search.filters;
    if (f.q.trim()) params.set("q", f.q.trim());
    if (f.type) params.set("type", f.type);
    if (f.city_id) params.set("city_id", f.city_id);
    if (f.ward_id) params.set("ward_id", f.ward_id);
    if (f.school_id) params.set("school_id", f.school_id);
    if (f.max_km) params.set("max_km", f.max_km);
    if (f.price_min) params.set("price_min", f.price_min);
    if (f.price_max) params.set("price_max", f.price_max);
    for (const id of f.amenity_ids) params.append("amenity_ids[]", String(id));
    try {
      const raw = localStorage.getItem("trosv.savedSearches");
      const saved = raw ? (JSON.parse(raw) as { label: string; query: string }[]) : [];
      saved.unshift({ label: areaName ?? "Phòng trọ gần trường", query: params.toString() });
      localStorage.setItem("trosv.savedSearches", JSON.stringify(saved.slice(0, 20)));
      toast("Đã lưu tìm kiếm.");
    } catch {
      toast("Không lưu được tìm kiếm. Bạn thử lại nhé.");
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-var(--nav-h))] flex-col">
      {/* Sticky filter bar (55px): area input + pill buttons + save. */}
      <div className="sticky top-14 z-20 flex h-[55px] items-center gap-2 overflow-x-auto border-b border-line bg-cream px-4 min-[890px]:top-[72px] lg:z-10">
        <Input
          value={search.filters.q}
          onChange={(e) => { search.setFilter("q", e.target.value); }}
          placeholder="Khu vực"
          aria-label="Tìm theo khu vực"
          className="h-10 min-w-52 max-w-80"
        />
        <FilterPill
          label="Loại tin"
          active={search.filters.type !== ""}
          onClear={() => { search.setFilter("type", ""); }}
        >
          <div className="flex flex-col gap-1" role="group" aria-label="Loại tin">
            {[{ value: "", label: "Tất cả" }, ...TYPE_OPTIONS].map((o) => (
              <button
                key={o.value || "all"}
                type="button"
                onClick={() => { search.setFilter("type", o.value); }}
                aria-pressed={search.filters.type === o.value}
                className={cn(
                  "rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay",
                  search.filters.type === o.value && "bg-ivory font-medium"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </FilterPill>
        <FilterPill
          label="Giá"
          active={search.filters.price_min !== "" || search.filters.price_max !== ""}
          onClear={() => {
            search.setFilter("price_min", "");
            search.setFilter("price_max", "");
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <span className="flex flex-col gap-1 text-xs font-medium text-ink-2">
              Giá từ
              <Input
                type="number"
                value={search.filters.price_min}
                onChange={(e) => { search.setFilter("price_min", e.target.value); }}
                placeholder="1.000.000"
                aria-label="Giá tối thiểu (VND)"
                className="h-10"
              />
            </span>
            <span className="flex flex-col gap-1 text-xs font-medium text-ink-2">
              Giá đến
              <Input
                type="number"
                value={search.filters.price_max}
                onChange={(e) => { search.setFilter("price_max", e.target.value); }}
                placeholder="3.000.000"
                aria-label="Giá tối đa (VND)"
                className="h-10"
              />
            </span>
          </div>
        </FilterPill>
        <FilterPill
          label="Gần trường"
          active={search.filters.school_id !== "" || search.filters.max_km !== ""}
          onClear={() => {
            search.setFilter("school_id", "");
            search.setFilter("max_km", "");
          }}
        >
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
              Trường
              <select
                id="filter-school"
                value={search.filters.school_id}
                onChange={(e) => { search.setFilter("school_id", e.target.value); }}
                className="h-10 rounded-xl border border-line-strong bg-white px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
              >
                <option value="">
                  {search.filters.ward_id ? "Chọn trường trong phường này" : "Chọn trường"}
                </option>
                {search.schools
                  .filter((s) =>
                    search.filters.ward_id !== ""
                      ? String(s.ward?.id) === search.filters.ward_id
                      : search.filters.city_id === "" ||
                        String(s.city?.id ?? s.city_id ?? "") === search.filters.city_id
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            {search.filters.school_id !== "" ? (
              <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
                Bán kính
                <select
                  id="filter-radius"
                  value={search.filters.max_km}
                  onChange={(e) => { search.setFilter("max_km", e.target.value); }}
                  className="h-10 rounded-xl border border-line-strong bg-white px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
                >
                  <option value="">Mọi khoảng cách</option>
                  {RADIUS_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </FilterPill>
        <FilterPill
          label="Tiện ích"
          active={search.filters.amenity_ids.length > 0}
          onClear={() => {
            for (const id of search.filters.amenity_ids) search.toggleAmenity(id);
          }}
        >
          <div className="flex flex-wrap gap-2">
            {search.amenities.map((a) => (
              <Chip
                key={a.id}
                on={search.filters.amenity_ids.includes(a.id)}
                onClick={() => { search.toggleAmenity(a.id); }}
                className="h-9 px-3 text-xs"
              >
                {a.name ?? `Tiện ích ${a.id}`}
              </Chip>
            ))}
          </div>
        </FilterPill>
        <FilterPill
          label="Bộ lọc"
          active={search.filters.city_id !== "" || search.filters.ward_id !== ""}
          onClear={() => { search.setCity(""); }}
        >
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
              Tỉnh/TP
              <select
                id="filter-city"
                value={search.filters.city_id}
                onChange={(e) => { search.setCity(e.target.value); }}
                className="h-10 rounded-xl border border-line-strong bg-white px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
              >
                <option value="">Tất cả</option>
                {search.cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">
              Phường
              <select
                id="filter-ward"
                value={search.filters.ward_id}
                onChange={(e) => { search.setWard(e.target.value); }}
                disabled={search.filters.city_id === ""}
                className="h-10 rounded-xl border border-line-strong bg-white px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay disabled:opacity-50"
              >
                <option value="">
                  {search.filters.city_id === "" ? "Chọn Tỉnh/TP trước" : "Tất cả"}
                </option>
                {search.wards
                  .filter(
                    (w) =>
                      search.filters.city_id === "" ||
                      String(w.city?.id ?? w.city_id ?? "") === search.filters.city_id
                  )
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              onClick={search.resetFilters}
              className="mt-1 self-start text-sm font-medium text-muted underline hover:text-ink"
            >
              Đặt lại
            </button>
          </div>
        </FilterPill>
        <button
          type="button"
          onClick={saveSearch}
          className="ml-auto h-10 flex-none rounded-full px-4 text-sm font-medium text-ink-2 transition-colors hover:bg-ivory hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
        >
          Lưu tìm kiếm
        </button>
        <button
          type="button"
          onClick={() => { setShowMap((v) => !v); }}
          className="flex h-10 flex-none items-center gap-2 rounded-full border border-ink bg-ink px-4 text-sm font-bold text-white lg:hidden"
          aria-pressed={showMap}
        >
          {showMap ? (
            <>
              <ListIcon className="size-4" aria-hidden /> Danh sách
            </>
          ) : (
            <>
              <MapIcon className="size-4" aria-hidden /> Bản đồ
            </>
          )}
        </button>
      </div>

      {/* List head: heading + count + sort, then active filter chips. */}
      <div className="px-4 pt-4 lg:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-xl font-extrabold">
            {areaName ? `Phòng trọ tại ${areaName}` : "Phòng trọ gần trường"}
          </h1>
          <p aria-live="polite" className="text-sm font-bold text-ink tabular-nums">
            {totalCount} phòng
          </p>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Tùy chọn sắp xếp"
                className="ml-auto flex h-10 items-center gap-1 px-2 text-sm font-medium text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
              >
                Sắp xếp:{" "}
                {SORT_OPTIONS.find((o) => o.value === search.filters.sort)?.label ??
                  "Mới nhất"}
                <ChevronDown className="size-4" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2">
              <div className="flex flex-col gap-1" role="group" aria-label="Sắp xếp">
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { search.setFilter("sort", o.value); }}
                    aria-pressed={search.filters.sort === o.value}
                    className={cn(
                      "rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay",
                      search.filters.sort === o.value && "bg-ivory font-medium"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        {activeChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 pt-3">
            {activeChips.map((c) => (
              <span
                key={c.key}
                className="inline-flex h-8 items-center gap-1 rounded-full bg-ivory px-3 text-xs font-medium text-ink"
              >
                {c.label}
                <button
                  type="button"
                  onClick={c.onRemove}
                  aria-label={`Bỏ lọc ${c.label}`}
                  className="flex size-5 items-center justify-center rounded-full hover:bg-line"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* Split: map | list on desktop (Zillow puts the map left). Mobile:
          one pane at a time. */}
      <div
        className={cn(
          "flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,56%)]",
          showMap && "map-view"
        )}
        data-view={showMap ? "map" : "list"}
      >
        {!showMap ? (
          <div className="px-4 pb-16 lg:order-2 lg:grid lg:grid-cols-2 lg:gap-4 lg:px-6">
            {search.loading ? (
              <div className="col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Skeleton className="h-72" />
                <Skeleton className="h-72" />
                <Skeleton className="h-72" />
                <Skeleton className="h-72" />
              </div>
            ) : search.error ? (
              <div className="col-span-2">
                <ErrorState message={search.error} />
              </div>
            ) : search.listings.length === 0 ? (
              <div className="col-span-2">
                <EmptyState
                  illustration={<SearchEmptyIllustration />}
                  title="Chưa có phòng nào khớp bộ lọc"
                  description="Thử nới khoảng giá hoặc chọn trường khác để xem thêm phòng."
                  action={
                    <Button variant="outline" onClick={search.resetFilters}>
                      Xóa bộ lọc
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="col-span-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {search.listings.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    onHover={onHover}
                    onFavToggle={(l) => { void toggleFavorite(l); }}
                  />
                ))}
              </div>
            )}
            {/* Pagination */}
            {search.meta != null && (search.meta.last_page ?? 0) > 1 ? (
              <div className="col-span-2 mt-8 flex items-center justify-center gap-2">
                {Array.from({ length: search.meta.last_page ?? 0 }, (_, i) => i + 1)
                  .slice(Math.max(0, (search.page || 1) - 2), Math.max(0, (search.page || 1) - 2) + 5)
                  .map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { search.setPage(p); }}
                      aria-current={p === search.page ? "page" : undefined}
                      className={cn(
                        "size-10 rounded-full text-sm font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay",
                        p === search.page
                          ? "bg-ink text-white font-bold"
                          : "border border-line-strong text-ink hover:bg-ivory"
                      )}
                    >
                      {p}
                    </button>
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {showMap ? (
          <div className="h-[calc(100vh-var(--nav-h)-55px)] lg:order-1 lg:h-auto">
            <ListingMap
              listings={search.listings}
              selectedId={hoveredListing}
              onSelect={(id) => {
                void navigate(route(ROUTES.ROOM_DETAIL, { id }));
              }}
              onHover={onHover}
              ariaLabel="Bản đồ phòng trọ"
            />
          </div>
        ) : (
          <div className="hidden lg:order-1 lg:block">
            <div className="sticky top-[calc(var(--nav-h)+55px)] h-[calc(100vh-var(--nav-h)-55px)]">
              <ListingMap
                listings={search.listings}
                selectedId={hoveredListing}
                onSelect={(id) => {
                  void navigate(route(ROUTES.ROOM_DETAIL, { id }));
                }}
                onHover={onHover}
                ariaLabel="Bản đồ phòng trọ"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Pill button opening a filter popover (skeleton .bar pattern). Active
   pills render ink; the popover holds a clear action when active. */
function FilterPill({
  label,
  active,
  onClear,
  children,
}: {
  label: string;
  active: boolean;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "h-10 flex-none rounded-xl border px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay",
            active
              ? "border-clay bg-clay-tint text-ink"
              : "border-line-strong bg-white text-ink hover:bg-ivory"
          )}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent>
        {children}
        {active ? (
          <button
            type="button"
            onClick={onClear}
            className="mt-3 text-sm font-medium text-muted underline hover:text-ink"
          >
            Xóa lọc này
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

/* Document title is set inside Search via the shared hook. */
