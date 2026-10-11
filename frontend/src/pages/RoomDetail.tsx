import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ROUTES, route } from "@/constants/routes";
import { useRoomDetail } from "@/hooks/useRoomDetail";
import { aiPriceAdvice } from "@/api/aiApi";
import type { AiPriceAdvice } from "@/types/api";
import { addFavorite, removeFavorite, startConversation } from "@/api/socialApi";
import { Button } from "@/ui/button";
import { Skeleton, Tag, Rating } from "@/ui/badge";
import { ErrorState } from "@/ui/empty-state";
import { HousePlaceholder } from "@/ui/icons";
import { toast } from "@/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
} from "lucide-react";
import type { Listing } from "@/types/api";

/*
  Detail ("Chi tiết phòng"): photo mosaic 1 large + 4 with a lightbox
  (←/→/Esc, counter, focus trap), sticky contact card (bottom bar on
  mobile), facts in an oat card with hairline rows, description,
  amenities, AI price panel (clay tint), ratings + reviews gated by
  can_review, copy-link share with toast.
*/

function formatPriceShort(vnd: number): string {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(vnd / 1_000_000)}tr`;
}

function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

/* ---------- Lightbox ---------- */

function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: { id: number; url: string }[];
  index: number;
  onClose: () => void;
  onNavigate: (next: number) => void;
}) {
  const total = images.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onNavigate((index - 1 + total) % total);
      if (e.key === "ArrowRight") onNavigate((index + 1) % total);
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); };
  }, [index, total, onClose, onNavigate]);

  /* Focus trap: focus the dialog on mount, restore on unmount. */
  const ref = useCallback((node: HTMLDivElement | null) => {
    node?.focus();
  }, []);

  const current = images[index];
  if (!current) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Ảnh ${index + 1} trên ${total}`}
      ref={ref}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 p-4 focus:outline-none"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng"
        className="absolute right-4 top-4 rounded-full p-2 text-cream hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
      >
        <X className="size-6" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => { onNavigate((index - 1 + total) % total); }}
        aria-label="Ảnh trước"
        className="absolute left-4 rounded-full bg-cream/90 p-2 text-ink hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
      >
        <ChevronLeft className="size-6" aria-hidden />
      </button>
      <img
        src={current.url}
        alt=""
        className="max-h-[85vh] max-w-full rounded-xl object-contain"
        width={1600}
        height={1067}
      />
      <button
        type="button"
        onClick={() => { onNavigate((index + 1) % total); }}
        aria-label="Ảnh sau"
        className="absolute right-4 rounded-full bg-cream/90 p-2 text-ink hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
      >
        <ChevronRight className="size-6" aria-hidden />
      </button>
      <p aria-live="polite" className="absolute bottom-4 text-sm tabular-nums text-cream">
        {index + 1} / {total}
      </p>
    </div>
  );
}

/* ---------- Contact card ---------- */

function ContactCard({
  listing,
  onFavToggle,
  isFav,
  onShare,
}: {
  listing: Listing;
  onFavToggle: () => void;
  isFav: boolean;
  onShare: () => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  /* landlord.phone is null for guests (contract). */
  const phone = listing.landlord?.phone ?? null;

  async function contactLandlord(): Promise<void> {
    if (!user) {
      void navigate(ROUTES.LOGIN);
      return;
    }
    try {
      const conv = await startConversation(listing.id);
      void navigate(route(ROUTES.CONVERSATION, { id: conv.id }));
    } catch {
      toast("Không mở được hội thoại. Bạn thử lại nhé.");
    }
  }

  return (
    <aside
      data-testid="contact-card"
      className="sticky top-[calc(var(--nav-h)+16px)] flex flex-col gap-3 rounded-3xl border border-line-strong bg-white p-6 lg:bottom-6"
    >
      <p className="text-3xl font-semibold tabular-nums text-ink">
        {formatPriceShort(listing.price)}
        <small className="ml-1 text-sm font-normal text-muted">/tháng</small>
      </p>
      <p className="text-sm text-muted">
        Chủ nhà: {listing.landlord?.name ?? "Chưa rõ"}
      </p>
      <Button variant="clay" className="w-full" onClick={() => void contactLandlord()}>
        Nhắn tin cho chủ nhà
      </Button>
      {user?.role === "student" ? (
        <Button variant="ghost" className="w-full" onClick={onFavToggle}>
          <Heart className={cn("size-4", isFav && "fill-clay stroke-clay")} aria-hidden />
          {isFav ? "Bỏ lưu phòng" : "Lưu phòng"}
        </Button>
      ) : null}
      {user?.role !== "student" && phone == null ? (
        <p className="text-xs text-muted">Đăng nhập để xem số điện thoại</p>
      ) : phone ? (
        <p className="text-sm text-ink-2">{phone}</p>
      ) : null}
      <ShareButton onCopy={onShare} />
    </aside>
  );
}

function ShareButton({ onCopy }: { onCopy: () => void }) {
  return (
    <Button variant="ghost" className="w-full" onClick={onCopy}>
      Chia sẻ liên kết
    </Button>
  );
}

/* ---------- Page ---------- */

export default function RoomDetail() {
  const { id: rawId } = useParams();
  const id = Number(rawId);
  const detail = useRoomDetail(id);
  const { user } = useAuth();

  const [lightboxAt, setLightboxAt] = useState<number | null>(null);
  const [advice, setAdvice] = useState<AiPriceAdvice | null>(null);
  const [adviceBusy, setAdviceBusy] = useState(false);
  const [adviceError, setAdviceError] = useState("");

  useDocumentTitle(
    detail.listing ? `${detail.listing.title} · TROSV` : "Chi tiết phòng · TROSV"
  );

  const images = detail.listing?.images ?? [];
  const cover = detail.listing?.cover_image ?? images[0]?.url ?? null;
  const isFav = detail.listing?.is_favorited === true;

  async function askAi(): Promise<void> {
    setAdviceBusy(true);
    setAdviceError("");
    try {
      setAdvice(await aiPriceAdvice(id));
    } catch {
      setAdviceError("Trợ lý AI đang bận. Bạn thử lại sau ít phút nhé.");
    } finally {
      setAdviceBusy(false);
    }
  }

  async function toggleFav(): Promise<void> {
    const listing = detail.listing;
    if (!listing || !user || user.role !== "student") return;
    const next = !isFav;
    /* Optimistic + rollback. */
    detail.setListing((l) =>
      l ? { ...l, is_favorited: next } : l
    );
    try {
      if (next) {
        await addFavorite(listing.id);
        toast("Đã lưu phòng.");
      } else {
        await removeFavorite(listing.id);
        toast("Đã bỏ lưu phòng.");
      }
    } catch {
      detail.setListing((l) =>
        l ? { ...l, is_favorited: !next } : l
      );
      toast("Không cập nhật được yêu thích. Bạn thử lại nhé.");
    }
  }

  /** Copy-link share with toast; reachable from the contact card menu. */
  function copyLink(): void {
    void navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        toast("Đã sao chép liên kết.");
      })
      .catch(() => {
        toast("Không sao chép được liên kết.");
      });
  }

  if (detail.loading) {
    return (
      <div className="mx-auto max-w-6xl p-4 lg:p-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="mt-4 aspect-3/2 w-full rounded-3xl lg:aspect-[16/10]" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (detail.error) {
    return (
      <ErrorState
        message={detail.error}
        action={
          <Button asChild variant="outline">
            <Link to={ROUTES.ROOMS}>Về danh sách phòng</Link>
          </Button>
        }
        className="min-h-[60vh]"
      />
    );
  }

  const listing = detail.listing;
  if (!listing) return null;

  const facts: { label: string; value: React.ReactNode }[] = [
    {
      label: "Mỗi tháng",
      value: formatPriceShort(listing.price),
    },
    {
      label: "Diện tích",
      value: listing.area_m2 != null ? `${listing.area_m2} m²` : "Chưa rõ",
    },
    {
      label: "Tới trường",
      value:
        listing.distance_km != null
          ? `${listing.distance_km.toFixed(1)} km`
          : "Không rõ",
    },
    {
      label: "Trạng thái",
      value:
        listing.status === "available" ? (
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-olive" aria-hidden />
            Còn trống
          </span>
        ) : listing.status === "rented" ? (
          "Đã thuê"
        ) : (
          "Ẩn"
        ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl p-4 lg:p-6">
      <p>
        <Link to={ROUTES.ROOMS} className="text-sm text-muted hover:underline">
          ← Quay lại kết quả
        </Link>
      </p>

      {/* Photo mosaic: 1 large + 4, lightbox on click. */}
      <div className="mt-4 grid gap-2 overflow-hidden rounded-3xl md:grid-cols-[2fr_1fr_1fr] md:grid-rows-2 md:[&>*:first-child]:col-span-1 md:[&>*:first-child]:row-span-2">
        {(cover ? [{ url: cover, id: 0 }, ...images.slice(0, 4)] : images.slice(0, 5)).map(
          (img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              onClick={() => { setLightboxAt(i); }}
              aria-label={`Xem ảnh ${i + 1}`}
              className="relative aspect-3/2 overflow-hidden bg-oat md:aspect-auto"
            >
              {img.url ? (
                <img
                  src={img.url}
                  alt=""
                  width={640}
                  height={427}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-200 ease-out hover:scale-[1.02]"
                />
              ) : (
                <HousePlaceholder />
              )}
            </button>
          )
        )}
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-8">
          <section>
            <h1 className="text-3xl">{listing.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {listing.address}
              {listing.ward ? `, ${listing.ward.name}` : ""}
            </p>
            {/* Facts: oat card with hairline rows. */}
            <dl className="mt-6 divide-y divide-line rounded-3xl border border-line bg-oat p-6">
              {facts.map((f) => (
                <div key={f.label} className="flex items-center justify-between py-2 first:pt-0 last:pb-0">
                  <dt className="text-sm text-muted">{f.label}</dt>
                  <dd className="text-xl font-semibold tabular-nums text-ink">{f.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {listing.description ? (
            <section>
              <h2 className="mb-2 text-2xl">Mô tả</h2>
              <p className="font-serif text-lg leading-relaxed text-ink-2 paragraph">
                {listing.description}
              </p>
            </section>
          ) : null}

          {listing.amenities && listing.amenities.length > 0 ? (
            <section>
              <h2 className="mb-3 text-2xl">Tiện ích</h2>
              <div className="flex flex-wrap gap-2">
                {listing.amenities.map((a) => (
                  <Tag key={a.id} variant="oat" className="px-3 py-1.5">
                    {a.name ?? `Tiện ích ${a.id}`}
                  </Tag>
                ))}
              </div>
            </section>
          ) : null}

          {/* AI price advice: clay-tint panel — the one clay element of
              this section. */}
          <section>
            <h2 className="mb-3 text-2xl">Tư vấn giá</h2>
            {user?.role !== "student" ? (
              <p className="text-sm text-muted">
                Đăng nhập bằng tài khoản sinh viên để xem tư vấn giá từ trợ lý AI.
              </p>
            ) : advice ? (
              <div data-testid="ai-price" className="rounded-2xl bg-clay-tint p-6">
                <p className="font-semibold text-ink">
                  Giá hợp lý: {formatPriceShort(advice.fair_min ?? 0)}–
                  {formatPriceShort(advice.fair_max ?? 0)}/tháng
                </p>
                <p className="mt-1 font-serif text-ink-2 paragraph">
                  {advice.tips?.[0] ?? advice.message ?? ""}
                </p>
                <p className="mt-3 text-xs text-muted">
                  Gợi ý tham khảo do AI tạo ra
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-3">
                {adviceError ? <p className="text-sm text-destructive">{adviceError}</p> : null}
                <Button variant="outline" loading={adviceBusy} onClick={() => void askAi()}>
                  Hỏi giá phòng này
                </Button>
              </div>
            )}
          </section>

          {/* Ratings + reviews, gated by can_review for the form. */}
          <section>
            <h2 className="mb-2 text-2xl">Đánh giá</h2>
            <p className="text-sm text-muted">
              {listing.ratings?.listing_avg != null
                ? `Phòng ${listing.ratings.listing_avg.toFixed(1)}`
                : null}{" "}
              {listing.ratings?.landlord_avg != null
                ? `· Chủ nhà ${listing.ratings.landlord_avg.toFixed(1)}`
                : ""}{" "}
              {listing.ratings?.area_avg != null
                ? `· Khu vực ${listing.ratings.area_avg.toFixed(1)}`
                : ""}
            </p>
            {detail.reviews.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Chưa có đánh giá nào.</p>
            ) : (
              detail.reviews.map((r) => (
                <div key={r.id} className="border-t border-line py-4 first:border-t-0">
                  <p className="font-medium text-ink">{r.student?.name ?? r.user_name ?? "Người dùng"}</p>
                  <Rating
                    value={r.listing_rating ?? r.rating}
                    className="mt-1"
                  />
                  {r.comment ? (
                    <p className="mt-1 text-sm text-ink-2 paragraph">{r.comment}</p>
                  ) : null}
                </div>
              ))
            )}
            {listing.can_review && user?.role === "student" ? (
              <Button variant="outline" className="mt-4" asChild>
                <Link to={`${ROUTES.ROOM_DETAIL}?review=1`}>Viết đánh giá</Link>
              </Button>
            ) : null}
          </section>
        </div>

        <ContactCard listing={listing} onFavToggle={() => void toggleFav()} isFav={isFav} onShare={copyLink} />
      </div>

      {/* Mobile bottom bar with price + CTA */}
      <div className="fixed bottom-14 left-0 right-0 z-20 flex items-center justify-between gap-3 border-t border-line bg-white px-4 py-3 lg:hidden">
        <p className="text-xl font-semibold tabular-nums">
          {formatPriceShort(listing.price)}
          <small className="ml-1 text-xs font-normal text-muted">/tháng</small>
        </p>
        <Button
          variant="clay"
          onClick={() => {
            const el = document.querySelector<HTMLButtonElement>('[data-testid="contact-card"] button');
            el?.click();
          }}
        >
          Nhắn tin
        </Button>
      </div>

      {lightboxAt != null && images.length > 0 ? (
        <Lightbox
          images={images}
          index={lightboxAt}
          onClose={() => { setLightboxAt(null); }}
          onNavigate={setLightboxAt}
        />
      ) : null}
    </div>
  );
}
