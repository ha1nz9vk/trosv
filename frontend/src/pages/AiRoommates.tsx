import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES, route } from "@/constants/routes";
import { aiRoommates } from "@/api/aiApi";
import { errStatus } from "@/api/axiosClient";
import type { AiRoommate } from "@/types/api";
import { Button } from "@/ui/button";
import { Avatar } from "@/ui/avatar";
import { Tag } from "@/ui/badge";
import { EmptyState } from "@/ui/empty-state";
import { AiUnavailableIllustration } from "@/ui/icons";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { startDirectConversation } from "@/api/socialApi";

export default function AiRoommates() {
  useDocumentTitle("Gợi ý bạn cùng phòng · TROSV");
  const navigate = useNavigate();
  const [rows, setRows] = useState<AiRoommate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<"unavailable" | "profile" | null>(null);

  useEffect(() => {
    aiRoommates()
      .then(setRows)
      .catch((err: unknown) => {
        if (errStatus(err) === 503) setErrorState("unavailable");
          else setErrorState("profile");
      })
      .finally(() => { setLoading(false); });
  }, []);

  async function messageUser(userId: number | undefined): Promise<void> {
    if (userId == null) return;
    try {
      const conv = await startDirectConversation(userId);
      void navigate(route(ROUTES.CONVERSATION, { id: conv.id }));
    } catch {
      /* stay put; toast via optimistic-less failure path */
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-5 pb-16">
      <h1 className="text-3xl">Bạn cùng phòng</h1>
      <p className="mt-2 max-w-prose font-serif text-lg text-ink-2 paragraph">
        Trợ lý AI đề xuất sinh viên có sở thích gần giống bạn nhất, dựa trên hồ sơ của hai bên.
      </p>

      {loading ? (
        <div className="mt-8 flex flex-col items-center gap-3" aria-live="polite">
          <div className="size-8 animate-spin rounded-full border-2 border-clay border-t-transparent" aria-hidden />
          <p className="text-sm text-muted">Trợ lý AI đang tìm bạn cùng phòng phù hợp…</p>
        </div>
      ) : errorState === "unavailable" ? (
        <EmptyState
          illustration={<AiUnavailableIllustration />}
          title="Trợ lý AI đang bận"
          description="Bạn thử lại sau ít phút nhé."
          action={<Button variant="outline" onClick={() => { location.reload(); }}>Thử lại</Button>}
          className="pt-10"
        />
      ) : errorState === "profile" ? (
        <EmptyState
          title="Hồ sơ chưa đủ thông tin"
          description="Bổ sung sở thích và bật tìm bạn cùng phòng trong hồ sơ để nhận gợi ý."
          action={<Button asChild variant="outline"><a href={ROUTES.PROFILE}>Mở hồ sơ</a></Button>}
          className="pt-10"
        />
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          title="Chưa có gợi ý nào"
          description="Hồ sơ của bạn hoặc của người khác chưa đủ dữ liệu để ghép cặp."
          className="pt-10"
        />
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {rows.map((r, i) => (
            <div key={r.user_id ?? i} className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center gap-3">
                <Avatar name={r.name ?? "Bạn"} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{r.name}</p>
                  <p className="text-sm text-muted">{r.school ?? "Chưa rõ trường"}</p>
                </div>
                <span className="rounded-full bg-ivory px-2.5 py-1 text-sm font-semibold tabular-nums text-ink">
                  {(typeof r.score === "number" ? r.score : Number(r.score ?? 0)).toFixed(0)}/100
                </span>
              </div>
              <p className="mt-3 font-serif text-ink-2 paragraph">{r.reason ?? ""}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(r.interests_shared ?? []).map((x) => (
                  <Tag key={x} variant="oat">{x}</Tag>
                ))}
                {(r.interests ?? [])
                  .filter((x) => !(r.interests_shared ?? []).includes(x))
                  .map((x) => (
                    <Tag key={x} variant="outline">{x}</Tag>
                  ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button size="sm" variant="outline" onClick={() => void messageUser(r.user_id)}>
                  Nhắn tin
                </Button>
              </div>
            </div>
          ))}
          <p className="col-span-full text-xs text-muted">Gợi ý tham khảo do AI tạo ra</p>
        </div>
      )}
    </div>
  );
}
