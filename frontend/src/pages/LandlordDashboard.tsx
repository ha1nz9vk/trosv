import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ROUTES, route } from "@/constants/routes";
import { getMyListings, deleteListing } from "@/api/landlordApi";
import type { Listing } from "@/types/api";
import { Button } from "@/ui/button";
import { Chip, Skeleton, Rating } from "@/ui/badge";
import { EmptyState, ErrorState } from "@/ui/empty-state";
import { HousePlaceholder } from "@/ui/icons";
import { toast } from "@/ui/toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/ui/dialog";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { formatVnd } from "@/api/format";

const STATUS_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "available", label: "Còn trống" },
  { value: "rented", label: "Đã thuê" },
  { value: "hidden", label: "Ẩn" },
] as const;


const STATUS_LABEL: Record<string, string> = {
  available: "Còn trống",
  rented: "Đã thuê",
  hidden: "Ẩn",
};

export default function LandlordDashboard() {
  useDocumentTitle("Quản lý tin đăng · TROSV");
  const navigate = useNavigate();
  const [rows, setRows] = useState<Listing[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Listing | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  // Render-phase reset (see useConversationData): refetch on status
  // change without a synchronous setState inside the effect body.
  const [prevStatus, setPrevStatus] = useState(status);
  if (prevStatus !== status) {
    setPrevStatus(status);
    setLoading(true);
  }

  useEffect(() => {
    let active = true;
    getMyListings(1, status)
      .then((res) => {
        if (active) setRows(res.data);
      })
      .catch((err: unknown) => {
        if (active) setError(String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status]);

  async function doDelete(): Promise<void> {
    if (!confirmDelete) return;
    setBusyDelete(true);
    try {
      await deleteListing(confirmDelete.id);
      setRows((r) => r.filter((x) => x.id !== confirmDelete.id));
      toast("Đã xóa tin đăng.");
      setConfirmDelete(null);
    } catch {
      toast("Không xóa được tin. Bạn thử lại nhé.");
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-5 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">Quản lý tin đăng</h1>
          <p aria-live="polite" className="mt-1 text-sm text-muted tabular-nums">
            {rows.length} tin
          </p>
        </div>
        <Button asChild variant="clay">
          <Link to={ROUTES.LANDLORD_NEW}>Đăng tin mới</Link>
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <Chip key={s.value} on={status === s.value} onClick={() => { setStatus(s.value); }}>
            {s.label}
          </Chip>
        ))}
      </div>

      {loading ? (
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : error ? (
        <ErrorState message="Không tải được tin đăng." />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Chưa có tin đăng nào"
          description="Đăng tin đầu tiên để sinh viên tìm thấy phòng của bạn."
          action={
            <Button asChild>
              <Link to={ROUTES.LANDLORD_NEW}>Đăng tin</Link>
            </Button>
          }
          className="pt-10"
        />
      ) : (
        /* Rows: oat card with hairline-separated label/value rows. */
        <div className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-oat">
          {rows.map((l) => (
            <div key={l.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="relative aspect-3/2 w-full overflow-hidden rounded-xl bg-oat sm:w-40">
                {l.cover_image ? (
                  <img src={l.cover_image} alt="" width={320} height={213} loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <HousePlaceholder />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-semibold text-ink">
                  <span
                    className={cnDot(l.status)}
                    aria-label={l.status ? STATUS_LABEL[l.status] ?? l.status : undefined}
                  />
                  <span className="truncate">{l.title}</span>
                </p>
                <p className="mt-0.5 tabular-nums text-ink">
                  {formatVnd(l.price)}/tháng
                  {l.area_m2 != null ? ` · ${l.area_m2} m²` : ""}
                </p>
                <p className="text-sm text-muted">{l.address}</p>
                <Rating value={l.avg_rating} count={l.reviews_count} className="mt-1" />
              </div>
              <div className="flex flex-none gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { void navigate(route(ROUTES.LANDLORD_EDIT, { id: l.id })); }}
                >
                  Sửa
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setConfirmDelete(l); }}>
                  Xóa
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={confirmDelete != null} onOpenChange={(o) => { if (!o) setConfirmDelete(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa tin đăng?</DialogTitle>
            <DialogDescription>
              Tin "{confirmDelete?.title}" sẽ bị xóa vĩnh viễn. Không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setConfirmDelete(null); }}>
              Giữ lại
            </Button>
            <Button variant="ink" loading={busyDelete} onClick={() => { void doDelete(); }}>
              Xóa tin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cnDot(status: string | undefined): string {
  if (status === "available") return "inline-block size-2 rounded-full bg-olive";
  if (status === "rented") return "inline-block size-2 rounded-full bg-line-strong";
  if (status === "hidden") return "inline-block size-2 rounded-full bg-muted";
  return "inline-block size-2 rounded-full bg-line";
}
