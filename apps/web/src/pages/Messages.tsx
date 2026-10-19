import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { GateScreen, MessagesGateIllustration } from "@/components/gates";
import { Footer } from "@/components/shell";
import MessagesList from "@/pages/MessagesList";

function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

export default function Messages() {
  const { user, loading } = useAuth();
  useDocumentTitle("Tin nhắn · TROSV");

  if (loading) return null;
  if (!user) {
    return (
      <div className="flex flex-1 flex-col bg-card">
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
  return <MessagesList />;
}
