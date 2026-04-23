import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarCheck, CalendarX, Clock, Plane, CalendarDays, Camera, Bell, ArrowRight } from "lucide-react";
import { HeroBanner } from "@/components/common/Illustrations";
import { StatCard } from "@/components/common/StatCard";
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

  useEffect(() => {
    if (!profile?.id) return;

    async function loadStats() {
      // Fetch attendance counts
      const { data: att } = await supabase
        .from("attendance")
        .select("status, check_in")
        .eq("user_id", profile?.id);

      // Fetch leaves
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

        // Simple recent activity mapping
        setRecentActivity(att.slice(0, 5).map((a, i) => ({
          id: i,
          action: a.status === 'present' ? "Checked in" : `Marked ${a.status}`,
          time: new Date(a.check_in || "").toLocaleString(),
          status: a.status as any
        })));
      }
    }

    loadStats();
  }, [profile]);

  return (
    <div className="space-y-6">
      <HeroBanner name={profile?.name || "User"} />

      <div className="flex flex-wrap items-center gap-4 rounded-[2rem] border border-border/50 bg-card/60 backdrop-blur-sm p-6 shadow-sm group transition-all hover:shadow-elegant">
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
          className="ml-auto inline-flex items-center gap-2 rounded-2xl gradient-primary px-8 py-4 text-sm font-black text-primary-foreground shadow-elegant transition-all hover:-translate-y-1 hover:brightness-110 active:scale-95"
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
        <div className="lg:col-span-2 rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm p-8 shadow-sm">
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
          <WeeklyTrendChart data={[]} />
        </div>

        <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm p-8 shadow-sm">
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
        <div className="lg:col-span-2 rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm p-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-black tracking-tight">Recent Activity</h2>
            <Link to="/attendance" className="text-xs font-black text-primary uppercase tracking-[0.15em] hover:underline underline-offset-4">View History</Link>
          </div>
          <ol className="relative space-y-6 border-l-2 border-border/30 pl-6 ml-2">
            {recentActivity.length === 0 ? (
              <p translate="no" className="text-xs font-bold text-muted-foreground uppercase tracking-widest py-10 text-center">No recent records</p>
            ) : recentActivity.map((a) => {
              const meta = statusMeta[a.status] || statusMeta.none;
              return (
                <li key={a.id} className="relative group/item">
                  <span className={cn("absolute -left-[33px] top-1.5 h-4 w-4 rounded-full border-4 border-card bg-card transition-transform group-hover/item:scale-125", meta.dot)} />
                  <div className="flex items-center justify-between">
                    <div className="text-[15px] font-black tracking-tight">{a.action}</div>
                    <span className={cn("rounded-full border border-border/50 px-3 py-1 text-[10px] font-black uppercase tracking-widest", meta.color)}>{meta.label}</span>
                  </div>
                  <div className="text-xs font-bold text-muted-foreground/60 mt-1">{a.time}</div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="rounded-[2rem] overflow-hidden border border-border/50 shadow-sm">
          <MonthCalendar compact />
        </div>
      </div>
    </div>
  );
}
