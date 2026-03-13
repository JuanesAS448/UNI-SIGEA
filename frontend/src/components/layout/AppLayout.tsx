import { Outlet } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { Bell, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-[80px] items-center justify-end border-b-2 border-border bg-card px-6 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <MessageSquare className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
            </Button>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="container max-w-7xl py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
