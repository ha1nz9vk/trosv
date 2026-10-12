import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { aiChat } from "@/api/aiApi";
import type { AiChatTurn } from "@/types/api";
import { AI_CHAT_OPEN_EVENT } from "@/constants/events";
import { formatPriceShort } from "@/api/format";
import { Button } from "@/ui/button";
import { cn } from "@/lib/utils";
import { Bot, X, Send, Home, ExternalLink } from "lucide-react";

/*
  Floating AI chat: site-wide widget listening for AI_CHAT_OPEN_EVENT
  (Home tiles dispatch it). POST /ai/chat with rolling history; handles
  room recommendations with clickable preview cards; handles ~30s latency.
*/

const WELCOME: AiChatTurn = {
  role: "assistant",
  content:
    "Chào bạn. Mình là trợ lý AI của TROSV. Bạn có thể hỏi mình về giá phòng, kinh nghiệm thuê trọ hoặc nhờ mình gợi ý phòng trọ phù hợp nhé!",
};

export function AiChatWidget() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<AiChatTurn[]>([WELCOME]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function openChat(): void {
      setOpen(true);
    }
    window.addEventListener(AI_CHAT_OPEN_EVENT, openChat);
    return () => { window.removeEventListener(AI_CHAT_OPEN_EVENT, openChat); };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, busy]);

  async function send(): Promise<void> {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    const next: AiChatTurn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setBusy(true);
    try {
      const res = await aiChat(text, next.filter((t) => t !== WELCOME));
      setTurns((cur) => [
        ...cur,
        {
          role: "assistant",
          content: res.reply ?? "",
          listings: res.listings ?? [],
        },
      ]);
    } catch {
      setTurns((cur) => [
        ...cur,
        {
          role: "assistant",
          content: "Trợ lý AI đang bận. Bạn thử lại sau ít phút nhé.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  /* Hidden on messages (avoids blocking chat input/send), auth, and landlord screens */
  const isMessagesPage = location.pathname.startsWith("/messages");
  const isAuthPage = location.pathname.startsWith("/login") || location.pathname.startsWith("/register");
  const isLandlordPage = location.pathname.startsWith("/landlord");
  if (isMessagesPage || isAuthPage || isLandlordPage) return null;

  const isRoomDetail = /^\/rooms\/\d+/.test(location.pathname);

  return (
    <div className={cn("fixed right-4 z-40 lg:bottom-6", isRoomDetail ? "bottom-32" : "bottom-20")}>
      {open ? (
        <div
          role="dialog"
          aria-label="Trợ lý AI"
          className="flex h-[30rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-pop animate-scale-in"
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-plate px-4 py-3 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-white/15 text-white">
                <Bot className="size-4.5" aria-hidden />
              </div>
              <div>
                <p className="font-semibold text-sm leading-tight">Trợ lý AI TROSV</p>
                <p className="text-[11px] text-white/80 leading-tight">Hỏi về giá phòng & khu vực</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setOpen(false); }}
              aria-label="Đóng trò chuyện"
              className="rounded-lg p-1.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>

          {/* Conversation history */}
          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto bg-paper/40 p-3.5">
            {turns.map((t, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[88%] px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
                  t.role === "user"
                    ? "self-end rounded-2xl rounded-br-xs bg-plate text-white shadow-xs"
                    : "self-start rounded-2xl rounded-bl-xs bg-card text-ink border border-line shadow-xs"
                )}
              >
                <div>{t.content}</div>
                {t.listings && t.listings.length > 0 ? (
                  <div className="mt-2.5 flex flex-col gap-2 pt-2 border-t border-line/60">
                    <p className="text-[10px] font-semibold text-muted uppercase tracking-wider">
                      Phòng gợi ý ({t.listings.length})
                    </p>
                    {t.listings.map((l) => (
                      <Link
                        key={l.id}
                        to={`/rooms/${l.id}`}
                        onClick={() => { setOpen(false); }}
                        className="group flex items-center gap-2.5 rounded-xl border border-line bg-paper/60 p-2 text-left transition-all hover:border-plate hover:bg-card hover:shadow-xs active:scale-[0.99]"
                      >
                        <div className="relative size-12 shrink-0 overflow-hidden rounded-lg bg-paper border border-line/40">
                          {l.cover_image ? (
                            <img
                              src={l.cover_image}
                              alt={l.title}
                              className="size-full object-cover transition-transform group-hover:scale-105"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-muted">
                              <Home className="size-5" aria-hidden />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 font-medium text-xs text-ink group-hover:text-plate transition-colors">
                            {l.title}
                          </p>
                          <div className="mt-0.5 flex items-center gap-1 text-[11px]">
                            <span className="font-semibold text-plate">
                              {formatPriceShort(l.price)}/tháng
                            </span>
                            {l.area_m2 ? (
                              <span className="text-muted">· {l.area_m2}m²</span>
                            ) : null}
                            {l.distance_km != null ? (
                              <span className="text-muted">· {l.distance_km}km</span>
                            ) : null}
                          </div>
                          <p className="line-clamp-1 text-[10px] text-muted">
                            {l.ward ? `${l.ward}, ` : ""}{l.city || l.address}
                          </p>
                        </div>
                        <ExternalLink className="size-3.5 shrink-0 text-muted transition-colors group-hover:text-plate" aria-hidden />
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {busy ? (
              <div className="self-start rounded-2xl rounded-bl-xs bg-card px-3.5 py-2 text-xs text-muted border border-line" aria-live="polite">
                Trợ lý AI đang tìm câu trả lời…
              </div>
            ) : null}
          </div>

          {/* Input composer */}
          <form
            className="flex items-center gap-2 border-t border-line bg-card p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={draft}
              onChange={(e) => { setDraft(e.target.value.slice(0, 1000)); }}
              aria-label="Hỏi trợ lý AI"
              placeholder="Nhập câu hỏi..."
              className="h-10 flex-1 rounded-xl border border-line-strong bg-card text-ink px-3.5 text-sm placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plate"
            />
            <Button
              type="submit"
              size="sm"
              variant="primary"
              className="h-10 px-3.5"
              disabled={busy || !draft.trim()}
            >
              <Send className="size-4" aria-hidden />
              <span className="sr-only">Gửi</span>
            </Button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => { setOpen(true); }}
          aria-label="Mở trợ lý AI"
          className="group relative flex size-13 items-center justify-center rounded-full bg-plate text-white shadow-lg transition-all hover:bg-plate-hover hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plate focus-visible:ring-offset-2"
        >
          <Bot className="size-6 transition-transform group-hover:rotate-6" aria-hidden />
          <span className="absolute -top-0.5 -right-0.5 flex size-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-flyer opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-flyer border-2 border-white" />
          </span>
        </button>
      )}
    </div>
  );
}
