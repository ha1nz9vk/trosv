import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Autoscroll for chat threads: follow new content only when the user is
 * already at (or near) the bottom, so reading history is not yanked down
 * while new messages arrive. The ref is owned by the rendering component
 * (passed in) and never returned from this hook, so no hook-returned ref
 * is ever touched in render (react-hooks/refs).
 */
export function useStickToBottom(
  threadRef: RefObject<HTMLDivElement>,
  messages: unknown,
  loaded: boolean
): {
  handleScroll: () => boolean;
  scrollToBottom: () => void;
} {

  useEffect(() => {
    const el = threadRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (nearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, loaded, threadRef]);

  function handleScroll(): boolean {
    const el = threadRef.current;
    if (!el) return false;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  function scrollToBottom(): void {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }

  return {
    handleScroll,
    scrollToBottom,
  };
}
