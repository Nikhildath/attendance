import { Bell, Search, Moon, Sun, Menu, Building2, ChevronDown, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Avatar2D } from "@/components/common/Avatar2D";
import { useBranch } from "@/lib/branch-context";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { theme, toggle } = useTheme();
  const { current, setCurrent, all, loading: branchLoading } = useBranch();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const { profile, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-20 flex h-20 items-center gap-4 border-b border-border/50 bg-background/60 px-4 backdrop-blur-xl md:px-8">
      <Button variant="ghost" size="icon" className="md:hidden hover:bg-primary/10 hover:text-primary transition-colors" onClick={onMenu}>
        <Menu className="h-6 w-6" />
      </Button>

      {/* Branch switcher */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={branchLoading || !current}
          className="flex items-center gap-3 rounded-[1.25rem] border border-border/50 bg-card/50 px-4 py-2.5 text-sm font-bold shadow-sm transition-all hover:border-primary/30 hover:bg-card hover:shadow-elegant disabled:opacity-50 group"
        >
          <div className="p-1.5 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col items-start leading-tight">
            <span className="hidden sm:inline">
              {branchLoading ? "Loading..." : current?.name || "Select Branch"}
            </span>
            {current && (
              <span className="text-[10px] text-muted-foreground hidden md:inline font-medium">{current.city} · {current.country}</span>
            )}
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
        </button>
        {open && (
          <div className="absolute left-0 top-full z-50 mt-3 w-80 overflow-hidden rounded-[1.5rem] border border-border/50 bg-popover/95 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="border-b border-border/50 p-4 bg-muted/30">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Global Branches</div>
            </div>
            <ul className="max-h-[400px] overflow-y-auto p-2 scrollbar-none">
              {all.map((b) => (
                <li key={b.id} className="mb-1 last:mb-0">
                  <button
                    onClick={() => { setCurrent(b.id); setOpen(false); }}
                    className={cn(
                      "flex w-full items-start gap-4 rounded-xl p-3 text-left transition-all hover:bg-primary/5 group",
                      b.id === current?.id && "bg-primary/10 border border-primary/20"
                    )}
                  >
                    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors", b.id === current?.id ? "bg-primary text-white" : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary")}>
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">{b.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{b.city}, {b.country}</div>
                      <div className="mt-1 flex items-center gap-2">
                         <span className="h-1.5 w-1.5 rounded-full bg-success" />
                         <span className="text-[10px] font-bold text-muted-foreground/70 uppercase">{b.employees_count || 0} active staff</span>
                      </div>
                    </div>
                    {b.id === current?.id && <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)] mt-2" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="relative hidden flex-1 max-w-lg md:block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <input
          placeholder="Search workforce data…"
          className="h-11 w-full rounded-[1.25rem] border border-border/50 bg-muted/40 pl-11 pr-4 text-sm font-medium outline-none transition-all focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/5"
        />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1 bg-muted/30 rounded-full p-1 border border-border/50">
          <Button variant="ghost" size="icon" onClick={toggle} className="h-9 w-9 rounded-full hover:bg-background hover:shadow-sm" aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-background hover:shadow-sm relative">
            <Bell className="h-4 w-4" />
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background animate-pulse" />
          </Button>
        </div>

        <div className="flex items-center gap-3 rounded-full border border-border/50 bg-card/80 py-1.5 pl-1.5 pr-4 shadow-sm hover:shadow-md transition-shadow cursor-default">
          <div className="ring-2 ring-primary/20 rounded-full overflow-hidden">
            <Avatar2D name={profile?.name ?? "Guest"} size={36} />
          </div>
          <div className="hidden text-left leading-none sm:block">
            <div className="text-[13px] font-black tracking-tight">{profile?.name ?? "Guest User"}</div>
            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{profile?.role ?? "Visitor"}</div>
          </div>
        </div>

        <Button 
          variant="ghost" 
          size="icon" 
          onClick={signOut} 
          className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors" 
          aria-label="Log out"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
