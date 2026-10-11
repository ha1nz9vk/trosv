import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { aiChat } from "@/api/aiApi";
import type { AiChatTurn } from "@/types/api";
import { AI_CHAT_OPEN_EVENT } from "@/constants/events";
import { Button } from "@/ui/button";
import { cn } from "@/lib/utils";
import { Bot, X, Send } from "lucide-react";

/*
  Floating AI chat: site-wide widget listening for AI_CHAT_OPEN_EVENT
  (Home tiles dispatch it). POST /ai/chat with rolling history; handles
  ~30s latency (spinner in the thread) and 503 (friendly note).
*/

const WELCOME: AiChatTurn = {
  role: "assistant",
  content:
    "Chào bạn. Mình là trợ lý AI của TROSV. Bạn hỏi mình về giá phòng, khu vực, hay phong trọ nhé.",
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
      const { reply } = await aiChat(text, next.filter((t) => t !== WELCOME));
      setTurns((cur) => [...cur, { role: "assistant", content: reply ?? "" }]);
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

  /* Hidden on auth screens to keep them focused. */
  const pathHidden = ["/login", "/register"].includes(location.pathname);
  if (pathHidden) return null;

  return (
    <div className={cn("fixed bottom-20 right-4 z-40 lg:bottom-6")}>
      {open ? (
        <div
          role="dialog"
          aria-label="Trợ lý AI"
          className="flex h-[28rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border border-line bg-white"
        >
          <div className="flex items-center justify-between border-b border-line bg-ivory px-4 py-3">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Bot className="size-4" aria-hidden /> Trợ lý AI
            </p>
            <button
              type="button"
              onClick={() => { setOpen(false); }}
              aria-label="Đóng trò chuyện"
              className="rounded-lg p-1 hover:bg-line"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
            {turns.map((t, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  t.role === "user"
                    ? "self-end bg-ink text-cream"
                    : "self-start bg-ivory text-ink"
                )}
              >
                {t.content}
              </div>
            ))}
            {busy ? (
              <p className="self-start px-2 text-xs italic text-muted" aria-live="polite">
                Trợ lý AI đang trả lời…
              </p>
            ) : null}
          </div>
          <form
            className="flex items-end gap-2 border-t border-line p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={draft}
              onChange={(e) => { setDraft(e.target.value.slice(0, 1000)); }}
              aria-label="Hỏi trợ lý AI"
              placeholder="Nhập câu hỏi"
              className="h-10 flex-1 rounded-xl border border-line-strong bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
            />
            <Button type="submit" size="sm" variant="ink" className="h-10 px-3" disabled={busy}>
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
          className="flex size-14 items-center justify-center rounded-full border border-ink bg-ink text-white transition-colors hover:bg-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2"
        >
          <Bot className="size-6" aria-hidden />
        </button>
      )}
    </div>
  );
}
