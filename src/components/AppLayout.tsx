import { useState } from "react";
import { AppSidebar, MobileMenuButton } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { LexLogo } from "@/components/lexia/LexLogo";
import { Outlet } from "react-router-dom";
import { useRealtimeNotifications } from "@/hooks/useRealtimeNotifications";

const AppLayout = () => {
  useRealtimeNotifications();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar mobileOpen={mobileNavOpen} onMobileOpenChange={setMobileNavOpen} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="app-topbar shrink-0 sticky top-0 z-40 border-b border-border/50 bg-background/85 backdrop-blur-md px-3 py-2.5 sm:px-5 lg:px-6">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 md:hidden">
              <MobileMenuButton onClick={() => setMobileNavOpen(true)} />
              <LexLogo size="sm" className="scale-90 origin-left" />
            </div>
            <div className="hidden md:block flex-1" aria-hidden />
            <div className="flex items-center gap-2 ml-auto">
              <NotificationBell />
            </div>
          </div>
        </header>

        <main className="app-main-content flex-1 overflow-auto">
          <div className="page-shell mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 sm:py-6 lg:px-6 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
