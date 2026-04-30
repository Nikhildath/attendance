import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { cn } from "@/lib/utils";
import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Camera, CalendarDays, User, LayoutGrid } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-40">
        <div className="absolute -top-[10%] -right-[5%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute top-[20%] -left-[10%] w-[30%] h-[30%] rounded-full bg-primary-glow/5 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[50%] h-[50%] rounded-full bg-primary/3 blur-[150px]" />
      </div>

      <div className={cn("hidden md:block relative z-40")}>
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0">
            <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} />
          </div>
        </div>
      )}
      <div className={cn("transition-[padding] duration-300 relative z-10 min-h-screen", collapsed ? "md:pl-[72px]" : "md:pl-64")}>
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="p-3 md:p-8 pb-24 md:pb-8 animate-in fade-in duration-700">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className={cn(
        "fixed bottom-0 left-0 right-0 z-40 h-16 border-t bg-background/80 backdrop-blur-lg md:hidden transition-transform duration-300",
        mobileOpen ? "translate-y-full" : "translate-y-0"
      )}>
        <div className="grid h-full grid-cols-5 items-center">
          <MobileNavLink to="/" icon={Home} label="Home" />
          <MobileNavLink to="/reports" icon={LayoutGrid} label="Reports" />
          <div className="flex flex-col items-center justify-center -translate-y-5">
            <Link 
              to="/attendance" 
              className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/40 active:scale-90 transition-transform border-4 border-background"
            >
              <Camera className="h-6 w-6" />
            </Link>
          </div>
          <MobileNavLink to="/calendar" icon={CalendarDays} label="Calendar" />
          <MobileNavLink to="/settings" icon={User} label="Profile" />
        </div>
      </nav>
    </div>
  );
}

function MobileNavLink({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  const { location } = useRouterState();
  const active = location.pathname === to;

  return (
    <Link 
      to={to} 
      className={cn(
        "flex flex-col items-center gap-1 transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
    </Link>
  );
}
