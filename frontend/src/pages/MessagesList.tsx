import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useParams } from "react-router-dom";
import { ROUTES, route } from "@/constants/routes";
import { getConversations } from "@/api/socialApi";
import type { Conversation } from "@/types/api";
import { CONV_PREVIEW_EVENT, type ConvPreviewDetail } from "@/constants/events";
import { Avatar } from "@/ui/avatar";
import { Badge, Skeleton } from "@/ui/badge";
import { EmptyState } from "@/ui/empty-state";
import { timeAgo } from "@/api/format";
import { cn } from "@/lib/utils";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

/*
  Two panes from 890px (sidebar + thread), single pane on mobile where
  selecting a conversation navigates to /messages/:id as its own screen.
  Sidebar rows stay in sync while a thread is open via CONV_PREVIEW_EVENT
  dispatches from the thread (Messenger-style).
*/

export default function MessagesList() {
  const { id } = useParams();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useDocumentTitle("Tin nhắn · TROSV");

  useEffect(() => {
    let active = true;
    getConversations()
      .then((rows) => {
        if (active) setConvs(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  /* Thread -> sidebar preview sync while the thread is open. */
  useEffect(() => {
    function onPreview(e: Event): void {
      const detail = (e as CustomEvent<ConvPreviewDetail>).detail;
      setConvs((rows) =>
        rows.map((c): Conversation =>
          c.id === detail.conversationId
            ? {
                ...c,
                last_message: {
                  ...c.last_message,
                  body: detail.lastMessage ?? c.last_message?.body ?? null,
                  created_at: detail.lastMessageAt ?? c.last_message?.created_at ?? "",
                },
                unread_count:
                  detail.unreadDelta != null
                    ? Math.max(0, (c.unread_count ?? 0) + detail.unreadDelta)
                    : (c.unread_count ?? 0),
              }
            : c
        )
      );
    }
    window.addEventListener(CONV_PREVIEW_EVENT, onPreview);
    return () => { window.removeEventListener(CONV_PREVIEW_EVENT, onPreview); };
  }, []);

  const isThreadOpen = id != null;

  const sidebar = useMemo(
    () => (
      <div
        className={cn(
          "min-w-0 flex-1 md:max-w-[340px] md:flex-none",
          isThreadOpen && "hidden md:block"
        )}
      >
        {loading ? (
          <div className="flex flex-col gap-2 p-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : convs.length === 0 ? (
          <EmptyState
            title="Chưa có cuộc trò chuyện nào"
            description="Mở một tin đăng và nhấn Nhắn tin cho chủ nhà để bắt đầu."
            action={
              <Link
                to={ROUTES.ROOMS}
                className="rounded-xl border border-ink px-4 py-2 text-sm font-medium hover:bg-ivory"
              >
                Tìm phòng
              </Link>
            }
            className="py-10"
          />
        ) : (
          <ul className="flex flex-col overflow-y-auto">
            {convs.map((c) => {
              const other = c.other_user?.name ?? "Người dùng";
              return (
                <li key={c.id} className="border-b border-line last:border-b-0">
                  <Link
                    to={route(ROUTES.CONVERSATION, { id: c.id })}
                    data-testid={`conversation-${c.id}`}
                    className={cn(
                      "flex items-center gap-3 p-4 transition-colors hover:bg-ivory focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-clay",
                      (isThreadOpen && c.id === Number(id)) && "bg-ivory"
                    )}
                  >
                    <Avatar name={other} size={40} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{other}</p>
                      <p className="truncate text-sm text-muted">
                        {c.listing?.title ?? "Hội thoại trực tiếp"}
                      </p>
                      <p className="truncate text-sm text-ink-2">
                        {c.last_message?.body ?? ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-muted tabular-nums">
                        {c.last_message?.created_at ? timeAgo(c.last_message.created_at) : ""}
                      </span>
                      {c.unread_count && c.unread_count > 0 ? (
                        <Badge>{c.unread_count}</Badge>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    ),
    [convs, loading, id, isThreadOpen]
  );

  return (
    <div className="flex h-[calc(100vh-var(--nav-h))] min-h-0">
      {sidebar}
      {/* Thread pane on desktop; on mobile the /messages/:id route renders
          inside the same Outlet region when a conversation is selected. */}
      <div
        className={cn(
          "min-w-0 flex-1 border-l border-line",
          !isThreadOpen && "hidden md:block"
        )}
      >
        <Outlet />
      </div>
    </div>
  );
}
