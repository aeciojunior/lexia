import { AppSidebar } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { Outlet } from "react-router-dom";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

const AppLayout = () => {
  useRealtimeNotifications();

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar with notification bell */}
        <header className="shrink-0 border-b border-border/40 bg-background/80 px-4 py-3 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-end">
            <NotificationBell />
          </div>
        </header>
        <main className="app-main-content flex-1 overflow-auto px-3 py-4 sm:px-4 sm:py-5 lg:px-6 lg:py-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
