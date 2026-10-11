import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ROUTES, route } from "@/constants/routes";
import {
  useConversationData,
} from "@/hooks/useConversationData";
import { useConversationRealtime } from "@/hooks/useConversationRealtime";
import { useConversationMessages } from "@/hooks/useConversationMessages";
import { useMessageMenu } from "@/hooks/useMessageMenu";
import { useStickToBottom } from "@/hooks/useStickToBottom";
import { CONV_PREVIEW_EVENT, type ConvPreviewDetail } from "@/constants/events";
import type { Message } from "@/types/api";
import { getEcho } from "@/api/echo";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/badge";
import { EmptyState } from "@/ui/empty-state";
import { toast } from "@/ui/toast";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useAuth } from "@/context/AuthContext";
import { GateScreen, MessagesGateIllustration } from "@/pages/gates";
import { Footer } from "@/ui/shell";
import {
  Paperclip,
  ArrowDown,
  MoreVertical,
  ChevronDown,
} from "lucide-react";

const MESSAGE_MAX = 1000;
const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😠"] as const;

function dayKey(iso: string): string {
  return new Date(iso).toDateString();
}

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-2" aria-hidden={false}>
      <div className="h-px flex-1 bg-line" />
      <span className="text-xs text-muted">{label}</span>
      <div className="h-px flex-1 bg-line" />
    </div>
  );
}

function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Hôm nay";
  if (d.toDateString() === yesterday.toDateString()) return "Hôm qua";
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface BubbleProps {
  msg: Message;
  isMine: boolean;
  grouped: boolean;
  onReact: (m: Message, emoji: string) => void;
  menu: ReturnType<typeof useMessageMenu>;
  onUnsend: (m: Message) => void;
  onDeleteSelf: (m: Message) => void;
}

function Bubble({
  msg,
  isMine,
  grouped,
  onReact,
  menu,
  onUnsend,
  onDeleteSelf,
}: BubbleProps) {
  if (msg.is_unsent) {
    return (
      <p
        className={cn(
          "rounded-xl px-3 py-2 text-sm italic text-muted",
          isMine ? "self-end bg-ivory" : "self-start bg-ivory"
        )}
      >
        Tin nhắn đã được thu hồi
      </p>
    );
  }
  const reactions = Object.values(msg.reactions ?? {});
  const menuOpen = menu.menuFor === msg.id;

  return (
    <div
      className={cn(
        "chat-bubble-wrap group relative flex max-w-[75%] flex-col",
        isMine ? "self-end items-end" : "self-start items-start"
      )}
    >
      {isMine && msg.attachment_url ? (
        <a
          href={msg.attachment_url}
          target="_blank"
          rel="noopener noreferrer"
          className="overflow-hidden rounded-xl border border-line"
        >
          {msg.attachment_name?.match(/\.(jpg|jpeg|png)$/i) ? (
            <img src={msg.attachment_url} alt={msg.attachment_name} className="max-h-60" />
          ) : (
            <span className="flex items-center gap-2 bg-white px-3 py-2 text-sm">{msg.attachment_name}</span>
          )}
        </a>
      ) : !isMine && msg.attachment_url ? (
        <a
          href={msg.attachment_url}
          target="_blank"
          rel="noopener noreferrer"
          className="overflow-hidden rounded-xl border border-line"
        >
          {msg.attachment_name?.match(/\.(jpg|jpeg|png)$/i) ? (
            <img src={msg.attachment_url} alt={msg.attachment_name} className="max-h-60" />
          ) : (
            <span className="flex items-center gap-2 bg-white px-3 py-2 text-sm">{msg.attachment_name}</span>
          )}
        </a>
      ) : null}
      {msg.body ? (
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed whitespace-pre-wrap",
            grouped && (isMine ? "rounded-tr-md" : "rounded-tl-md"),
            isMine ? "bg-ink text-cream" : "bg-ivory text-ink"
          )}
        >
          {msg.body}
          {reactions.length > 0 ? (
            <span
              className={cn(
                "absolute -bottom-2 flex gap-0.5 rounded-full border border-line bg-white px-1.5 text-xs",
                isMine ? "right-2" : "left-2"
              )}
            >
              {reactions.slice(0, 3).map((emoji, i) => (
                <span key={i}>{emoji}</span>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}
      {isMine && msg.seen_at ? (
        <span className="mt-0.5 text-[11px] text-muted">Đã xem</span>
      ) : null}

      {/* Message menu trigger + floating menu (custom, keyboard operable) */}
      <button
        type="button"
        aria-label="Tùy chọn tin nhắn"
        aria-expanded={menuOpen}
        onClick={(e) => {
          e.stopPropagation();
          menu.openMenuFor(msg, e.currentTarget);
        }}
        className="absolute -top-2 flex size-6 items-center justify-center rounded-full bg-white/90 opacity-0 text-ink-2 transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay group-hover:opacity-100"
        style={isMine ? { left: -30 } : { right: -30 }}
      >
        <MoreVertical className="size-3.5" aria-hidden />
      </button>
      {menuOpen ? (
        <div
          role="menu"
          className={cn(
            "absolute z-20 w-44 rounded-xl border border-line bg-white p-1 shadow-md",
            menu.menuUp ? "bottom-full mb-2" : "top-full mt-2",
            isMine ? "right-0" : "left-0"
          )}
        >
          <div className="flex justify-between gap-1 px-1 py-1.5" role="group" aria-label="Reactions">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                role="menuitem"
                className="rounded-full p-1 text-base transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
                onClick={() => {
                  onReact(msg, e);
                  menu.setMenuFor(null);
                }}
              >
                {e}
              </button>
            ))}
          </div>
          {isMine ? (
            <button
              type="button"
              role="menuitem"
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-ivory"
              onClick={() => {
                onUnsend(msg);
                menu.setMenuFor(null);
              }}
            >
              Thu hồi
            </button>
          ) : null}
          <button
            type="button"
            role="menuitem"
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink hover:bg-ivory"
            onClick={() => {
              onDeleteSelf(msg);
              menu.setMenuFor(null);
            }}
          >
            Xóa chỉ ở phía mình
          </button>
        </div>
      ) : null}
    </div>
  );
}

interface ThreadProps {
  id: string;
}

function Thread({ id }: ThreadProps) {
  const navigate = useNavigate();
  const data = useConversationData(id);
  const realtime = useConversationRealtime(
    id,
    data.setMessages,
    data.lastIdRef,
    (msg) => {
      window.dispatchEvent(
        new CustomEvent<ConvPreviewDetail>(CONV_PREVIEW_EVENT, {
          detail: {
            conversationId: Number(id),
            lastMessage: msg.body ?? msg.attachment_name ?? "",
            lastMessageAt: msg.created_at,
          },
        })
      );
    }
  );
  const actions = useConversationMessages(id, data.setMessages, data.lastIdRef);
  /* The thread element's ref is owned here (not by a hook) so attaching
     it and passing it down never touches a hook-returned ref in render. */
  const threadRef = useRef<HTMLDivElement>(null);
  const stick = useStickToBottom(threadRef, data.messages, data.loaded);
  const menu = useMessageMenu(threadRef);

  const [draft, setDraft] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<File | null>(null);

  useDocumentTitle(
    data.conversation
      ? `${data.conversation.other_user?.name ?? "Tin nhắn"} · TROSV`
      : "Tin nhắn · TROSV"
  );

  /* Whisper typing while the composer has text. */
  useEffect(() => {
    const e = getEcho();
    const chan = e?.private(`conversation.${id}`);
    if (!chan) return;
     
    const ch = chan as unknown as { whisper: (ev: string, data: unknown) => void };
    ch.whisper("typing", { user_id: -1 });
  }, [draft, id]);

  const grouped = useMemo(() => data.messages, [data.messages]);

  if (!data.loaded) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-14" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (!data.conversation) {
    return (
      <EmptyState
        title="Không tìm thấy hội thoại"
        description="Hội thoại này không tồn tại hoặc bạn không có quyền xem."
        action={
          <Button variant="outline" asChild>
            <Link to={ROUTES.MESSAGES}>Về tin nhắn</Link>
          </Button>
        }
        className="min-h-[50vh]"
      />
    );
  }

  const other = data.conversation.other_user?.name ?? "Người dùng";

  async function send(): Promise<void> {
    const text = draft.trim();
    if (!text && !attachment) return;
    if (text.length > MESSAGE_MAX) {
      toast(`Tin nhắn tối đa ${MESSAGE_MAX} ký tự.`);
      return;
    }
    const msg = await actions.send(text, attachment);
    if (msg) {
      setDraft("");
      setAttachment(null);
      setAtBottom(true);
      window.dispatchEvent(
        new CustomEvent<ConvPreviewDetail>(CONV_PREVIEW_EVENT, {
          detail: {
            conversationId: Number(id),
            lastMessage: msg.body ?? msg.attachment_name ?? "",
            lastMessageAt: msg.created_at,
            unreadDelta: 0,
          },
        })
      );
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Listing context header */}
      <div className="flex items-center gap-3 border-b border-line p-3">
        <button
          type="button"
          onClick={() => { void navigate(ROUTES.MESSAGES); }}
          className="rounded-lg p-2 text-ink-2 md:hidden"
          aria-label="Về danh sách tin nhắn"
        >
          <ChevronDown className="size-4 rotate-90" aria-hidden />
        </button>
        {data.conversation.listing?.cover_image ? (
          <img
            src={data.conversation.listing.cover_image}
            alt=""
            width={56}
            height={37}
            className="aspect-3/2 w-14 rounded-lg object-cover"
          />
        ) : (
          <Avatar name={other} size={40} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{other}</p>
          {data.conversation.listing ? (
            <Link
              to={route(ROUTES.ROOM_DETAIL, { id: data.conversation.listing.id })}
              className="truncate text-sm text-muted hover:underline"
            >
              {data.conversation.listing.title}
            </Link>
          ) : null}
        </div>
      </div>

      {/* Messages: day separators + grouped bubbles */}
      <div
        ref={threadRef}
        onScroll={() => { setAtBottom(stick.handleScroll()); }}
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-4"
        data-testid="thread"
      >
        {grouped.map((m, i) => {
          const prev = grouped[i - 1];
          const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
          const groupedWithPrev =
            !newDay &&
            prev.is_mine === m.is_mine &&
            // Same 3-minute window groups bubbles (Messenger style).
            new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 180000;
          return (
            <div key={m.id} className="flex flex-col">
              {newDay ? <DaySeparator label={formatDayLabel(m.created_at)} /> : null}
              <div className={cn("flex", groupedWithPrev ? "mt-0.5" : "mt-2")}>
                <Bubble
                  msg={m}
                  isMine={m.is_mine === true}
                  grouped={groupedWithPrev}
                                    onReact={(mm, e) => void actions.react(mm, e, m.sender_id)}
                  menu={menu}
                  onUnsend={(mm) => void actions.remove(mm, "unsent")}
                  onDeleteSelf={(mm) => void actions.remove(mm, "self")}
                />
              </div>
            </div>
          );
        })}
        {realtime.otherTyping ? (
          <p className="self-start text-xs italic text-muted" aria-live="polite">
            Đang soạn…
          </p>
        ) : null}
      </div>

      {/* Scroll-to-latest */}
      {!atBottom ? (
        <button
          type="button"
          onClick={() => {
            stick.scrollToBottom();
          }}
          aria-label="Xuống tin nhắn mới nhất"
          className="self-center rounded-full border border-line bg-white p-2 shadow-none"
        >
          <ArrowDown className="size-4" aria-hidden />
        </button>
      ) : null}

      {/* Composer: auto-growing textarea + attachment */}
      <form
        className="flex items-end gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          ref={fileRef}
          type="file"
          className="sr-only"
          accept=".pdf,.jpg,.jpeg,.png,.docx"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              if (f.size > 5 * 1024 * 1024) {
                toast("Tệp đính kèm tối đa 5 MB.");
                e.target.value = "";
                return;
              }
              setAttachment(f);
            }
          }}
        />
        <button
          type="button"
          aria-label="Đính kèm tệp"
          onClick={() => fileRef.current?.click()}
          className="flex size-10 items-center justify-center rounded-xl text-ink-2 hover:bg-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
        >
          <Paperclip className="size-4" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          {attachment ? (
            <p className="mb-1 text-xs text-muted">
              {attachment.name}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => { setAttachment(null); }}
              >
                Bỏ
              </button>
            </p>
          ) : null}
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value.slice(0, MESSAGE_MAX));
              realtime.setOtherTyping(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            aria-label="Tin nhắn"
            placeholder="Nhập tin nhắn"
            rows={1}
            className="max-h-40 w-full resize-none rounded-xl border border-line-strong bg-white p-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay"
          />
        </div>
        <Button type="submit" loading={actions.sending} className="h-10">
          Gửi
        </Button>
      </form>
      {actions.error ? (
        <p role="alert" className="px-3 pb-2 text-xs text-destructive">
          {actions.error}
        </p>
      ) : null}
    </div>
  );
}

export default function ConversationDetail() {
  const { id } = useParams();
  const { user, loading } = useAuth();
  useDocumentTitle("Tin nhắn · TROSV");
  if (loading) return null;
  /* Logged-out guests see the messages gate (SPEC), not a login
     redirect — the route is intentionally left outside ProtectedRoute. */
  if (!user) {
    return (
      <div className="flex min-h-[calc(100svh-var(--nav-h))] flex-col bg-white">
        <GateScreen
          testId="messages-gate"
          title="Trung tâm tin nhắn"
          description="Mọi cuộc trò chuyện với chủ nhà và sinh viên đều ở đây để bạn không bỏ lỡ tin nào. Đăng nhập để bắt đầu nhắn tin."
          illustration={<MessagesGateIllustration />}
        />
        <div className="mt-auto">
          <Footer />
        </div>
      </div>
    );
  }
  if (id == null) return null;
  return <Thread id={id} />;
}
