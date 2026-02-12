import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";

const AppLayout = () => (
  <div className="flex min-h-screen w-full bg-background">
    <AppSidebar />
    <main className="flex-1 overflow-auto">
      <Outlet />
    </main>
  </div>
);

export default AppLayout;
