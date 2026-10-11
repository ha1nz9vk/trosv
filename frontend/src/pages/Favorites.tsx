import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES, route } from "@/constants/routes";
import { getFavorites, removeFavorite } from "@/api/socialApi";
import type { Favorite } from "@/types/api";
import { useAuth } from "@/context/AuthContext";
import { GateScreen, FavoritesGateIllustration } from "@/pages/gates";
import { Footer } from "@/ui/shell";
import { Button } from "@/ui/button";
import { Skeleton, Tag, Rating } from "@/ui/badge";
import { EmptyState, ErrorState } from "@/ui/empty-state";
import { FavoriteEmptyIllustration, HousePlaceholder } from "@/ui/icons";
import { toast } from "@/ui/toast";

function formatPriceShort(vnd: number): string {
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(vnd / 1_000_000)}tr`;
}

function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

export default function Favorites() {
  const { user, loading: authLoading } = useAuth();
  useDocumentTitle("Yêu thích · TROSV");

  const [rows, setRows] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || user.role !== "student") return;
    getFavorites()
      .then((res) => { setRows(res.data); })
      .catch((err: unknown) => { setError(String(err)); })
      .finally(() => { setLoading(false); });
  }, [user]);

  if (authLoading) return null;
  if (!user) {
    return (
      <div className="flex min-h-[calc(100svh-var(--nav-h))] flex-col bg-white">
        <div className="flex flex-1 flex-col">
          <GateScreen
            testId="favorites-gate"
            title="Lưu phòng bạn thích"
            description="Yêu thích giúp bạn sắp xếp và so sánh các phòng đang quan tâm. Đăng nhập để xem lại phòng đã lưu và tiếp tục theo dõi."
            illustration={<FavoritesGateIllustration />}
          />
        </div>
        <Footer />
      </div>
    );
  }
  if (user.role !== "student") {
    /* Landlords land here via the rail favorites icon; the icon is swapped
       in the shell, but a direct URL still lands here. */
    return (
      <EmptyState
        title="Chức năng này dành cho sinh viên"
        description="Bạn là chủ nhà. Về Quản lý tin đăng."
        action={
          <Button asChild>
            <Link to={ROUTES.LANDLORD}>Quản lý tin đăng</Link>
          </Button>
        }
        className="min-h-[60vh]"
      />
    );
  }

  async function remove(listingId: number): Promise<void> {
    try {
      await removeFavorite(listingId);
      setRows((r) => r.filter((x) => x.listing?.id !== listingId));
      toast("Đã bỏ lưu phòng.");
    } catch {
      toast("Không bỏ lưu được phòng. Bạn thử lại nhé.");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} className="min-h-[60vh]" />;
  }

  const listings = rows
    .map((r) => r.listing)
    .filter((l): l is NonNullable<typeof l> => l != null);

  if (listings.length === 0) {
    return (
      <EmptyState
        illustration={<FavoriteEmptyIllustration />}
        title="Bạn chưa lưu phòng nào"
        description="Nhấn vào trái tim ở mỗi phòng để lưu lại và so sánh sau."
        action={
          <Button asChild>
            <Link to={ROUTES.ROOMS}>Tìm phòng</Link>
          </Button>
        }
        className="min-h-[60vh]"
      />
    );
  }

  return (
    <>
      <div className="mx-auto max-w-6xl p-5 pb-16">
      <h1 className="text-3xl">Phòng đã lưu</h1>
      <p aria-live="polite" className="mt-1 text-sm text-muted tabular-nums">
        {listings.length} phòng
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((l) => (
          <div
            key={l.id}
            className="rounded-2xl border border-line bg-white transition-colors hover:border-line-strong"
          >
            <Link to={route(ROUTES.ROOM_DETAIL, { id: l.id })} className="group block">
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
                  <Tag>
                    {l.type === "room" ? "Phòng trọ" : l.type === "apartment" ? "Căn hộ" : "Nhà nguyên căn"}
                  </Tag>
                </span>
              </div>
              <div className="p-3">
                <p className="text-lg font-semibold tabular-nums">
                  {formatPriceShort(l.price)}
                  <small className="ml-1 text-sm font-normal text-muted">/tháng</small>
                </p>
                <p className="text-sm text-ink-2">
                  {l.address}
                  {l.ward ? `, ${l.ward.name}` : ""}
                </p>
                <Rating value={l.avg_rating} count={l.reviews_count} className="mt-1" />
              </div>
            </Link>
            <div className="border-t border-line p-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => void remove(l.id)}
              >
                Bỏ lưu
              </Button>
            </div>
          </div>
        ))}
      </div>
      </div>
      <Footer />
    </>
  );
}
