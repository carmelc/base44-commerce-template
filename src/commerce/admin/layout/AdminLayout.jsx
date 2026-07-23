import React, { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import StoreAdminBot from "../bot/StoreAdminBot";

/** Shell: fixed sidebar (desktop) / sheet (mobile), topbar, scrollable main. */
export default function AdminLayout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [botOpen, setBotOpen] = useState(false);
  const openBot = () => {
    setMobileOpen(false);
    setBotOpen(true);
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r bg-background lg:block">
        <Sidebar onOpenBot={openBot} />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <Sidebar onNavigate={() => setMobileOpen(false)} onOpenBot={openBot} />
        </SheetContent>
      </Sheet>
      <StoreAdminBot open={botOpen} onOpenChange={setBotOpen} />
      <div className="flex min-h-screen flex-col lg:pl-60">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
