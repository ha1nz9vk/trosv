import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES, route } from "@/constants/routes";
import { getListings, getCities, getSchools } from "@/api/listingApi";
import type { Listing, City, School } from "@/types/api";
import { Button } from "@/ui/button";
import { Skeleton, Tag } from "@/ui/badge";
import { ErrorState } from "@/ui/empty-state";
import {
  SearchEmptyIllustration,
  HousePlaceholder,
} from "@/ui/icons";
import { Rating } from "@/ui/badge";
import { Search as SearchIcon } from "lucide-react";

/**
 * Home: left-aligned photo hero (Zillow pattern) with the search box
 * overlaid on the left, quick pills, "Mới đăng" horizontally scrolling
 * row with real data, three equal "Cách TROSV hoạt động" cards, AI
 * features strip, school + city link lists (hairline rows), landlord band.
 */

function formatPriceShort(vnd: number): string {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(vnd / 1_000_000)}tr`;
}

function ListingCardSkeleton() {
  return <Skeleton className="h-72 w-64 flex-none rounded-2xl" />;
}

function HeroSearch({ cities }: { cities: City[] }) {
  /** Autocomplete over cities, wards, schools, queried live. */
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = q.trim() ? { q: q.trim() } : {};
    void navigate({ pathname: ROUTES.ROOMS, search: new URLSearchParams(params).toString() });
  }

  return (
    <form onSubmit={submit} className="w-full max-w-xl">
      {/* Single white search box (Zillow pattern): the clay magnifier
          inside is the screen's one main action. */}
      <div className="relative">
        <div className="flex h-[72px] items-center gap-2 rounded-xl border border-line-strong bg-white p-2 pl-5">
          <SearchIcon
            className="size-5 flex-none text-muted"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Nhập trường, phường hoặc tên đường"
            aria-label="Tìm phòng"
            value={q}
            onChange={(e) => { setQ(e.target.value); }}
            className="h-full min-w-0 flex-1 border-0! bg-transparent text-base text-ink placeholder:text-muted focus:outline-none"
          />
          <button
            type="submit"
            aria-label="Tìm phòng"
            className="flex size-14 flex-none items-center justify-center rounded-full bg-clay text-black transition-colors hover:bg-clay-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
          >
            <SearchIcon className="size-6" aria-hidden />
          </button>
        </div>
        {q.length > 1 && cities.length > 0 ? (
          <div className="absolute left-0 right-0 top-[80px] z-10 rounded-xl border border-line bg-white p-2 shadow-md">
            {cities
              .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
              .slice(0, 5)
              .map((c) => (
                <Link
                  key={c.id}
                  to={`${ROUTES.ROOMS}?city_id=${c.id}`}
                  className="block rounded-lg px-3 py-2 text-sm text-ink hover:bg-ivory"
                  onClick={() => { setQ(""); }}
                >
                  {c.name}
                </Link>
              ))}
          </div>
        ) : null}
      </div>
    </form>
  );
}

export default function Home() {
  useDocumentTitle("Trang chủ · TROSV");
  const [newest, setNewest] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cities, setCities] = useState<City[]>([]);
  const [schools, setSchools] = useState<School[]>([]);

  useEffect(() => {
    getListings({ per_page: 8, sort: "newest" })
      .then((res) => { setNewest(res.data); })
      .catch((err: unknown) => { setError(String(err)); })
      .finally(() => { setLoading(false); });
    getCities().then(setCities).catch(() => {
      });
    getSchools().then(setSchools).catch(() => {
      });
  }, []);

  return (
    <div className="flex flex-col">
      {/* Hero: full-bleed band (Zillow pattern, min 408px desktop):
          giant stacked headline in cream with the single search box. */}
      <section className="relative flex min-h-[480px] items-center overflow-hidden bg-ink md:min-h-[408px]">
        <img
          src="/art/hero-art.svg"
          alt=""
          width={2100}
          height={623}
          fetchPriority="high"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(e) => {
            (e.currentTarget).style.display = "none";
          }}
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 md:py-12">
          <h1 className="max-w-2xl text-[36px] font-black leading-[1.1] tracking-tight text-white md:text-6xl">
            Phòng trọ. Căn hộ.
            <br />
            Gần trường.
          </h1>
          <HeroSearch cities={cities} />
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl px-5">
        {/* Quick pills */}
        <div className="flex flex-wrap gap-2 py-8">
          {["Phòng trọ", "Căn hộ", "Nhà nguyên căn", "Dưới 2 triệu"].map((label) => (
            <Link
              key={label}
              to={
                label === "Dưới 2 triệu"
                  ? `${ROUTES.ROOMS}?price_max=2000000`
                  : `${ROUTES.ROOMS}?type=${
                      label === "Phòng trọ" ? "room" : label === "Căn hộ" ? "apartment" : "house"
                    }`
              }
              className="inline-flex h-10 items-center rounded-full border border-line-strong bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Mới đăng: horizontally scrolling row with real data */}
        <section className="pb-12">
          <h2 className="mb-4 text-2xl">Mới đăng</h2>
          {loading ? (
            <div className="flex gap-4 overflow-hidden">
              <ListingCardSkeleton />
              <ListingCardSkeleton />
              <ListingCardSkeleton />
              <ListingCardSkeleton />
            </div>
          ) : error ? (
            <ErrorState message="Không tải được phòng mới đăng. Bạn thử lại sau ít phút nhé." />
          ) : newest.length === 0 ? (
            <SearchEmptyIllustration className="max-w-xs self-center" />
          ) : (
            <div className="-mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-4">
              {newest.map((l) => (
                <Link
                  key={l.id}
                  to={route(ROUTES.ROOM_DETAIL, { id: l.id })}
                  className="group w-64 flex-none snap-start rounded-2xl border border-line bg-white transition-colors hover:border-line-strong"
                >
                  <div className="relative aspect-3/2 overflow-hidden rounded-t-2xl bg-oat">
                    {l.cover_image ? (
                      <img
                        src={l.cover_image}
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
                      <Tag>{l.type === "room" ? "Phòng trọ" : l.type === "apartment" ? "Căn hộ" : "Nhà nguyên căn"}</Tag>
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="text-lg font-semibold tabular-nums">
                      {formatPriceShort(l.price)}
                      <small className="ml-1 text-sm font-normal text-muted">/tháng</small>
                    </p>
                    <p className="text-sm text-ink-2">
                      {l.area_m2 != null ? `${l.area_m2} m² · ` : ""}
                      {l.ward?.name ?? ""}
                    </p>
                    <p className="text-sm text-ink-2">{l.address}</p>
                    <Rating value={l.avg_rating} count={l.reviews_count} className="mt-1" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* School + city link lists, hairline-divided rows. Hidden when
            the reference data fails so no empty headings show. */}
        {schools.length > 0 || cities.length > 0 ? (
          <section className="grid gap-8 pb-16 md:grid-cols-2">
            {schools.length > 0 ? (
              <div>
                <h2 className="mb-4 text-2xl">Tìm theo trường</h2>
                <ul className="flex flex-col">
                  {schools.slice(0, 5).map((s) => (
                    <li key={s.id} className="border-b border-line last:border-b-0">
                      <Link
                        to={`${ROUTES.ROOMS}?school_id=${s.id}`}
                        className="flex items-center justify-between py-3 text-sm font-medium text-ink transition-colors hover:text-ink-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
                      >
                        <span>{s.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {cities.length > 0 ? (
              <div>
                <h2 className="mb-4 text-2xl">Tìm theo thành phố</h2>
                <ul className="flex flex-col">
                  {cities.slice(0, 5).map((c) => (
                    <li key={c.id} className="border-b border-line last:border-b-0">
                      <Link
                        to={`${ROUTES.ROOMS}?city_id=${c.id}`}
                        className="flex items-center justify-between py-3 text-sm font-medium text-ink transition-colors hover:text-ink-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
                      >
                        <span>{c.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* Landlord band */}
        <section className="mb-12 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line bg-ivory p-8">
          <div>
            <h2 className="text-2xl">Bạn có phòng cho thuê?</h2>
            <p className="text-muted paragraph">
              Đăng tin miễn phí và nhận tin nhắn trực tiếp từ sinh viên.
            </p>
          </div>
          <Button asChild>
            <Link to={ROUTES.REGISTER}>Đăng tin</Link>
          </Button>
        </section>
      </div>
    </div>
  );
}

function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = "TROSV - Tìm trọ sinh viên";
    };
  }, [title]);
}
