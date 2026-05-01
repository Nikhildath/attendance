import { Bell, Search, Moon, Sun, Menu, Building2, ChevronDown, LogOut } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useTheme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Avatar2D } from "@/components/common/Avatar2D";
import { useBranch } from "@/lib/branch-context";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";

type NotificationItem = {
  id: string;
  title: string;
  body: string;
  time: string;
  priority?: number;
};

function formatNotificationTime(value?: string | null) {
  if (!value) return "Now";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) return "Now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { theme, toggle } = useTheme();
  const { current, setCurrent, all, loading: branchLoading } = useBranch();
  const [open, setOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  useEffect(() => {
    const fetchResults = async () => {
      if (search.length < 2) {
        setResults([]);
        return;
      }
      setIsSearching(true);
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .ilike("name", `%${search}%`)
        .limit(5);
      setResults(data || []);
      setIsSearching(false);
    };

    const timer = setTimeout(fetchResults, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setResults([]);
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) setNotificationOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (!profile?.id) return;

    let alive = true;

    const loadNotifications = async () => {
      const next: NotificationItem[] = [];
      const today = new Date().toISOString().split("T")[0];
      const isAdminOrManager = profile.role === "Admin" || profile.role === "Manager";

      const [
        myLeavesResult,
        myAttendanceResult,
        myFinancialRequestsResult,
        myCompOffResult,
        myPayslipsResult,
        pendingLeavesResult,
        holidayResult,
      ] = await Promise.all([
        supabase
          .from("leaves")
          .select("id,status,type,created_at,from_date,to_date")
          .eq("user_id", profile.id)
          .neq("status", "Pending")
          .order("created_at", { ascending: false })
          .limit(3),
        supabase
          .from("attendance")
          .select("id,check_in,check_out,created_at,status")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("financial_requests")
          .select("id,kind,amount,status,created_at")
          .eq("user_id", profile.id)
          .neq("status", "Pending")
          .order("created_at", { ascending: false })
          .limit(2),
        supabase
          .from("comp_off_requests")
          .select("id,worked_on,status,created_at")
          .eq("user_id", profile.id)
          .neq("status", "Pending")
          .order("created_at", { ascending: false })
          .limit(2),
        supabase
          .from("payslips")
          .select("id,month,status,created_at,net_payable")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(1),
        isAdminOrManager
          ? supabase
              .from("leaves")
              .select("id", { count: "exact", head: true })
              .eq("status", "Pending")
          : Promise.resolve({ count: 0 } as any),
        current?.id
          ? supabase
              .from("company_holidays")
              .select("name,date")
              .eq("date", today)
              .or(`branch_id.is.null,branch_id.eq.${current.id}`)
              .limit(1)
          : Promise.resolve({ data: [] } as any),
      ]);

      if (!profile.face_registered) {
        next.push({
          id: "face-registration",
          title: "Face registration pending",
          body: "Register your face before marking attendance on web punch.",
          time: "Now",
          priority: 3,
        });
      }

      if (!profile.branch_id) {
        next.push({
          id: "branch-missing",
          title: "No branch assigned",
          body: "Assign a branch to enable accurate geo and field tracking.",
          time: "Now",
          priority: 3,
        });
      }

      if ((pendingLeavesResult.count || 0) > 0) {
          next.push({
            id: "pending-leaves",
            title: "Pending leave approvals",
            body: `${pendingLeavesResult.count} leave request${pendingLeavesResult.count === 1 ? "" : "s"} waiting for review.`,
            time: "Today",
            priority: 3,
          });
      }

      const holidayData = holidayResult.data;
      if (holidayData?.[0]) {
          next.push({
            id: "holiday-today",
            title: `Holiday: ${holidayData[0].name}`,
            body: "Attendance today will be recorded with holiday context.",
            time: "Today",
            priority: 2,
          });
      }

      if ((current?.active_staff_count || 0) === 0 && isAdminOrManager) {
        next.push({
          id: "no-active-staff",
          title: "No active staff in branch",
          body: current ? `${current.name} has no active tracked staff right now.` : "No branch activity detected right now.",
          time: "Live",
          priority: 2,
        });
      }

      myLeavesResult.data?.forEach((leave: any) => {
        next.push({
          id: `leave-${leave.id}`,
          title: `${leave.type} leave ${String(leave.status).toLowerCase()}`,
          body: `${leave.from_date} to ${leave.to_date}`,
          time: formatNotificationTime(leave.created_at),
          priority: leave.status === "Approved" ? 2 : 1,
        });
      });

      const latestAttendance = myAttendanceResult.data?.[0];
      if (latestAttendance?.check_in) {
        next.push({
          id: `attendance-${latestAttendance.id}`,
          title: latestAttendance.check_out ? "Attendance completed" : "Attendance marked",
          body: latestAttendance.check_out ? "Your check-in and check-out are recorded." : "Your latest attendance punch has been recorded.",
          time: formatNotificationTime(latestAttendance.check_out || latestAttendance.check_in || latestAttendance.created_at),
          priority: 1,
        });
      }

      myFinancialRequestsResult.data?.forEach((item: any) => {
        next.push({
          id: `financial-${item.id}`,
          title: `${item.kind} request ${String(item.status).toLowerCase()}`,
          body: `Amount: ${item.amount}`,
          time: formatNotificationTime(item.created_at),
          priority: item.status === "Approved" ? 2 : 1,
        });
      });

      myCompOffResult.data?.forEach((item: any) => {
        next.push({
          id: `comp-off-${item.id}`,
          title: `Comp-off ${String(item.status).toLowerCase()}`,
          body: `Worked on ${item.worked_on}`,
          time: formatNotificationTime(item.created_at),
          priority: item.status === "Approved" ? 2 : 1,
        });
      });

      myPayslipsResult.data?.forEach((slip: any) => {
        next.push({
          id: `payslip-${slip.id}`,
          title: `Payslip ${String(slip.status).toLowerCase()}`,
          body: `${slip.month} · Net pay ${slip.net_payable ?? 0}`,
          time: formatNotificationTime(slip.created_at),
          priority: slip.status === "Paid" ? 2 : 1,
        });
      });

      if (alive) {
        setNotifications(
          next
            .sort((a, b) => (b.priority || 0) - (a.priority || 0))
            .slice(0, 10)
        );
      }
    };

    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 30_000);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
    };
  }, [profile?.id, profile?.role, profile?.face_registered, profile?.branch_id, current?.id, current?.name, current?.active_staff_count]);

  return (
    <header className="sticky top-0 z-20 flex h-16 md:h-20 items-center gap-2 md:gap-4 border-b border-border/50 bg-background/60 px-3 md:px-8 backdrop-blur-xl">
      <Button variant="ghost" size="icon" className="md:hidden hover:bg-primary/10 hover:text-primary transition-colors" onClick={onMenu}>
        <Menu className="h-6 w-6" />
      </Button>

      {/* Branch switcher */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={branchLoading || !current}
          className="flex items-center gap-2 md:gap-3 rounded-xl md:rounded-[1.25rem] border border-border/50 bg-card/50 px-2.5 py-2 md:px-4 md:py-2.5 text-xs md:text-sm font-bold shadow-sm transition-all hover:border-primary/30 hover:bg-card hover:shadow-elegant disabled:opacity-50 group"
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
                         <span className="text-[10px] font-bold text-muted-foreground/70 uppercase">{b.active_staff_count || 0} active staff</span>
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

      <div ref={searchRef} className="relative hidden flex-1 max-w-lg md:block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search workforce data…"
          className="h-11 w-full rounded-[1.25rem] border border-border/50 bg-muted/40 pl-11 pr-4 text-sm font-medium outline-none transition-all focus:border-primary/50 focus:bg-background focus:ring-4 focus:ring-primary/5"
        />
        
        {results.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-[1.5rem] border border-border/50 bg-popover/95 backdrop-blur-xl shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200">
             <div className="p-2">
                {results.map((p) => (
                  <button 
                    key={p.id}
                    onClick={() => {
                        const name = p.name;
                        setSearch("");
                        setResults([]);
                        navigate({ 
                            to: "/team", 
                            search: { q: name } as any 
                        });
                    }}
                    className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-primary/5 transition-colors group"
                  >
                    <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-primary/10">
                       <Avatar2D name={p.name} size={32} src={p.avatar_url} />
                    </div>
                    <div className="flex-1 min-w-0">
                       <div className="text-[13px] font-bold truncate group-hover:text-primary transition-colors">{p.name}</div>
                       <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{p.role} · {p.department || "No Dept"}</div>
                    </div>
                  </button>
                ))}
             </div>
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1 md:gap-3">
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full md:hidden hover:bg-background">
          <Search className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1 bg-muted/30 rounded-full p-1 border border-border/50">
          <Button variant="ghost" size="icon" onClick={toggle} className="h-9 w-9 rounded-full hover:bg-background hover:shadow-sm" aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <div ref={notificationRef} className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNotificationOpen((value) => !value)}
              className="h-9 w-9 rounded-full hover:bg-background hover:shadow-sm relative"
            >
              <Bell className="h-4 w-4" />
              {notifications.length > 0 && (
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background animate-pulse" />
              )}
            </Button>
            {notificationOpen && (
              <div className="fixed sm:absolute inset-x-4 sm:inset-auto sm:right-0 top-[72px] sm:top-full z-[100] mt-3 sm:w-80 overflow-hidden rounded-[1.8rem] border border-border/50 bg-popover/95 backdrop-blur-xl shadow-2xl animate-in fade-in zoom-in-95 duration-200 origin-top-right">
                <div className="border-b border-border/50 p-4 bg-muted/30">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Notifications</div>
                </div>
                <div className="max-h-[360px] overflow-y-auto p-2">
                  {notifications.length === 0 ? (
                    <div className="rounded-2xl p-8 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                        <Bell className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                      <div className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground">No new alerts</div>
                    </div>
                  ) : notifications.map((item) => (
                    <div key={item.id} className="group relative mb-1 rounded-2xl p-4 text-left transition-all hover:bg-primary/5 active:scale-[0.98]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-black leading-tight group-hover:text-primary transition-colors truncate">{item.title}</div>
                          <div className="mt-1 text-[11px] font-medium text-muted-foreground/80 line-clamp-2 leading-relaxed">{item.body}</div>
                          <div className="mt-2 text-[9px] font-black uppercase tracking-wider text-muted-foreground/40">{item.time}</div>
                        </div>
                        <div className="h-2 w-2 mt-1.5 rounded-full bg-primary/40 shadow-[0_0_8px_var(--color-primary)]" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 rounded-full border border-border/50 bg-card/80 p-1 md:py-1.5 md:pl-1.5 md:pr-4 shadow-sm hover:shadow-md transition-shadow cursor-default">
          <div className="ring-2 ring-primary/20 rounded-full overflow-hidden">
            <Avatar2D name={profile?.name ?? "Guest"} size={36} src={profile?.avatar_url} />
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
