import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { Outlet } from "react-router-dom";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

const AppLayout = () => {
  useRealtimeNotifications();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar with notification bell */}
        <header className="flex items-center justify-end px-6 py-3 border-b border-border/40 bg-background/80 backdrop-blur-sm shrink-0">
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
