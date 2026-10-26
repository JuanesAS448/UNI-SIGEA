import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { Bell, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppLayout() {
  return (
    <div className="flex h-screen min-w-0 overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-16 shrink-0 items-center justify-end border-b border-border bg-card px-4 sm:px-6 lg:h-[72px] lg:px-8">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <MessageSquare className="h-[18px] w-[18px]" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
            </Button>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
