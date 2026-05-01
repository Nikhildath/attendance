import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarCheck, CalendarX, Clock, Plane, CalendarDays, Camera, Bell, ArrowRight, Wallet, Megaphone, PartyPopper, Pin, Info, AlertTriangle, AlertCircle } from "lucide-react";
import { HeroBanner } from "@/components/common/Illustrations";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { WeeklyTrendChart } from "@/components/charts/Charts";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { statusMeta } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Attendly" },
      { name: "description", content: "Overview of your attendance, leaves, trends and recent activity." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { profile } = useAuth();
  const [stats, setStats] = useState({
    workingDays: 0,
    present: 0,
    absent: 0,
    leaves: 0,
    late: 0,
    lastCheckIn: "Not yet",
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [celebration, setCelebration] = useState<{ type: 'birthday' | 'anniversary', years?: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;

    async function loadDashboard() {
      setLoading(true);
      
      // Fetch all attendance for this user
      const { data: att } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", profile?.id);

      // Fetch leaves for this user
      const { data: lvs } = await supabase
        .from("leaves")
        .select("status")
        .eq("user_id", profile?.id)
        .eq("status", "Approved");

      if (att) {
        const counts = {
          present: att.filter(a => a.status === 'present').length,
          absent: att.filter(a => a.status === 'absent').length,
          late: att.filter(a => a.status === 'late').length,
        };
        
        const last = att.filter(a => a.check_in).sort((a,b) => new Date(b.check_in!).getTime() - new Date(a.check_in!).getTime())[0];

        setStats({
          workingDays: att.length,
          present: counts.present,
          absent: counts.absent,
          leaves: lvs?.length || 0,
          late: counts.late,
          lastCheckIn: last?.check_in ? new Date(last.check_in).toLocaleString() : "Not yet recorded",
        });

        // Simple recent activity mapping — sort by check_in date
        setRecentActivity(att
          .filter(a => a.check_in)
          .sort((a,b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime())
          .slice(0, 5)
          .map((a) => ({
            id: a.id,
            action: a.status === 'present' ? "Checked in" : `Marked ${a.status}`,
            time: new Date(a.check_in).toLocaleString(),
            status: a.status as any
          })));

        // Weekly Trend (Last 7 Days) — group by check_in date, not created_at
        const weekly = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toLocaleDateString('en-US', { weekday: 'short' });
            const dayAtt = att.filter(a => a.check_in && new Date(a.check_in).toDateString() === d.toDateString());
            weekly.push({
                day: dateStr,
                present: dayAtt.filter(a => a.status === 'present').length,
                late: dayAtt.filter(a => a.status === 'late').length,
                absent: dayAtt.filter(a => a.status === 'absent').length
            });
        }
        setWeeklyData(weekly);

        // Fetch Announcements
        const { data: ann } = await supabase
          .from("announcements")
          .select("*")
          .eq("is_active", true)
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
          .order("is_pinned", { ascending: false })
          .order("created_at", { ascending: false });
        if (ann) setAnnouncements(ann);

        // Check for Celebrations
        if (profile?.dob || profile?.joining_date) {
          const now = new Date();
          const todayM = now.getMonth() + 1; // 1-indexed for string comparison
          const todayD = now.getDate();

          if (profile.dob) {
            const [y, m, d] = profile.dob.split('-').map(Number);
            if (m === todayM && d === todayD) {
              setCelebration({ type: 'birthday' });
            }
          }

          if (profile.joining_date) {
            const [y, m, d] = profile.joining_date.split('-').map(Number);
            if (m === todayM && d === todayD && y < now.getFullYear()) {
              setCelebration({ type: 'anniversary', years: now.getFullYear() - y });
            }
          }
        }
      }
      setLoading(false);
    }

    loadDashboard();
  }, [profile]);

  const attendanceRate = stats.workingDays > 0 
    ? ((stats.present + stats.late) / stats.workingDays) * 100 
    : 0;

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Announcements Bar */}
      {announcements.length > 0 && (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className={cn(
              "relative overflow-hidden rounded-[1.8rem] border p-5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500 glass",
              a.type === 'critical' ? "border-destructive/30 bg-destructive/5" :
              a.type === 'warning' ? "border-warning/30 bg-warning/5" :
              a.type === 'success' ? "border-success/30 bg-success/5" :
              "border-primary/20 bg-primary/5"
            )}>
              <div className="flex items-start gap-4">
                <div className={cn(
                  "mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  a.type === 'critical' ? "bg-destructive/20 text-destructive" :
                  a.type === 'warning' ? "bg-warning/20 text-warning" :
                  a.type === 'success' ? "bg-success/20 text-success" :
                  "bg-primary/20 text-primary"
                )}>
                  {a.type === 'critical' ? <AlertCircle className="h-5 w-5" /> :
                   a.type === 'warning' ? <AlertTriangle className="h-5 w-5" /> :
                   a.type === 'success' ? <Megaphone className="h-5 w-5" /> :
                   <Info className="h-5 w-5" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black uppercase tracking-wider">{a.title}</h4>
                    {a.is_pinned && <Pin className="h-3 w-3 fill-current opacity-70" />}
                  </div>
                  <p className="mt-1 text-sm font-medium opacity-80">{a.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Celebration Card */}
      {celebration && (
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#6366f1] via-[#a855f7] to-[#ec4899] p-8 text-white shadow-elegant animate-bounce-subtle">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex items-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
              <PartyPopper className="h-10 w-10 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">
                {celebration.type === 'birthday' ? "Happy Birthday! 🎂" : `Happy ${celebration.years} Year Anniversary! 🎉`}
              </h2>
              <p className="text-sm font-bold opacity-90 uppercase tracking-widest mt-1">
                {celebration.type === 'birthday' ? "We hope you have a fantastic day ahead!" : "Thank you for being an amazing part of our team!"}
              </p>
            </div>
          </div>
        </div>
      )}

      <HeroBanner name={profile?.name || "User"} attendanceRate={attendanceRate} />

      {/* Quick Actions for Mobile */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground/70">Quick Access</h3>
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          <QuickActionLink to="/attendance" icon={Camera} label="Punch" color="bg-primary/10 text-primary" />
          <QuickActionLink to="/leaves" icon={Plane} label="Leaves" color="bg-info/10 text-info" />
          <QuickActionLink to="/calendar" icon={CalendarDays} label="Calendar" color="bg-success/10 text-success" />
          <QuickActionLink to="/payroll" icon={Wallet} label="Payroll" color="bg-warning/10 text-warning-foreground" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-[2rem] border border-border/50 bg-card/60 backdrop-blur-sm p-4 md:p-6 shadow-sm group transition-all hover:shadow-elegant">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 group-hover:scale-110 transition-transform">
            <Camera className="h-7 w-7" />
          </div>
          <div>
            <div className="text-base font-black tracking-tight">Ready to start your day?</div>
            <div className="text-xs font-bold text-muted-foreground/70 uppercase tracking-wider">Last check-in: {stats.lastCheckIn}</div>
          </div>
        </div>
        <Link
          to="/attendance"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl gradient-primary px-6 md:px-8 py-3 md:py-4 text-sm font-black text-primary-foreground shadow-elegant transition-all hover:-translate-y-1 hover:brightness-110 active:scale-95"
        >
          Mark Attendance
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Working Days" value={stats.workingDays} icon={CalendarDays} tone="default" />
        <StatCard label="Days Present" value={stats.present} icon={CalendarCheck} tone="success" />
        <StatCard label="Absences" value={stats.absent} icon={CalendarX} tone="destructive" />
        <StatCard label="Leaves Taken" value={stats.leaves} icon={Plane} tone="info" />
        <StatCard label="Late Count" value={stats.late} icon={Clock} tone="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm p-5 md:p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black tracking-tight">Attendance Trend</h2>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Last 7 working days</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-success shadow-[0_0_8px_var(--color-success)]" />Present</span>
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-warning shadow-[0_0_8px_var(--color-warning)]" />Late</span>
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-destructive shadow-[0_0_8px_var(--color-destructive)]" />Absent</span>
            </div>
          </div>
          <WeeklyTrendChart data={weeklyData} />
        </div>

        <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm p-5 md:p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-black tracking-tight">Notifications</h2>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-dashed border-border/50 bg-muted/20 p-10 text-center">
              <p translate="no" className="text-xs font-bold text-muted-foreground/60 uppercase tracking-[0.2em]">No new alerts</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm p-5 md:p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-black tracking-tight">Recent Activity</h2>
            <Link to="/attendance" className="text-xs font-black text-primary uppercase tracking-[0.15em] hover:underline underline-offset-4">View History</Link>
          </div>
          <div className="space-y-4">
            {recentActivity.length === 0 ? (
              <div className="text-center py-10 border border-dashed rounded-2xl border-border/50">
                <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">No recent records</p>
              </div>
            ) : recentActivity.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-2xl bg-muted/20 p-4 transition-all hover:bg-muted/30">
                <div className="flex items-center gap-4">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", 
                    a.status === 'present' ? "bg-success/10 text-success" : 
                    a.status === 'late' ? "bg-warning/10 text-warning-foreground" : 
                    "bg-destructive/10 text-destructive")}>
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-black">{a.action}</div>
                    <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{a.time}</div>
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] overflow-hidden border border-border/50 shadow-sm">
          <MonthCalendar compact />
        </div>
      </div>
    </div>
  );
}

function QuickActionLink({ to, icon: Icon, label, color }: { to: string; icon: any; label: string; color: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2 min-w-[72px] group">
      <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl border border-border/30 backdrop-blur-sm shadow-sm transition-all group-active:scale-90 group-hover:shadow-md", color)}>
        <Icon className="h-6 w-6" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/80">{label}</span>
    </Link>
  );
}
