import { useEffect, useState } from "react";
import { exportToCSV } from "@/lib/csv-utils";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { Download, Filter } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Attendly" },
      { name: "description", content: "Visual monthly calendar with color-coded attendance, leaves and holidays." },
    ],
  }),
  component: CalendarPage,
});

function CalendarPage() {
  const { profile } = useAuth();
  const [holidays, setHolidays] = useState<{ date: string; localName: string }[]>([]);
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, leave: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(undefined);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (profile?.role === "Admin") {
      supabase.from("profiles").select("id, name").then(({ data }) => {
        if (data) setUsers(data);
      });
    }
  }, [profile]);

  useEffect(() => {
    if (profile && !selectedUserId) {
        setSelectedUserId(profile.id);
    }
  }, [profile]);

  const today = new Date();
  const upcoming = holidays
    .filter((h) => new Date(h.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    .slice(0, 6);

  useEffect(() => {
    const targetId = selectedUserId || profile?.id;
    if (!targetId) return;

    async function loadStats() {
      setLoading(true);
      const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString();

      const { data: att } = await supabase
        .from("attendance")
        .select("status")
        .eq("user_id", targetId)
        .gte("created_at", start)
        .lt("created_at", end);

      const { data: lvs } = await supabase
        .from("leaves")
        .select("status")
        .eq("user_id", targetId)
        .eq("status", "Approved")
        .gte("from_date", start.split('T')[0])
        .lte("to_date", end.split('T')[0]);

      if (att) {
        setStats({
          present: att.filter(a => a.status === 'present').length,
          absent: att.filter(a => a.status === 'absent').length,
          late: att.filter(a => a.status === 'late').length,
          leave: lvs?.length || 0
        });
      }
      setLoading(false);
    }
    loadStats();
  }, [profile, selectedUserId]);

  const handleExport = () => {
    const data = [
      { Category: "Present", Days: stats.present },
      { Category: "Absent", Days: stats.absent },
      { Category: "Late", Days: stats.late },
      { Category: "On Leave", Days: stats.leave },
      { Category: "Holidays", Days: holidays.filter(h => new Date(h.date).getMonth() === today.getMonth()).length },
    ];
    exportToCSV(data, "attendance_summary");
  };

  return (
    <div>
      <PageHeader
        title="Attendance Calendar"
        subtitle="Color-coded view of your attendance, leaves and public holidays"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {profile?.role === "Admin" && (
              <select 
                value={selectedUserId} 
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="h-10 rounded-xl border bg-card px-4 py-2 text-sm font-black uppercase tracking-widest shadow-sm focus:ring-2 ring-primary/20 transition-all"
              >
                <option value={profile.id}>My Calendar</option>
                {users.filter(u => u.id !== profile.id).map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            )}

            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border bg-card px-4 py-2 text-sm font-black uppercase tracking-widest shadow-sm focus:ring-2 ring-primary/20 transition-all"
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="leave">On Leave</option>
              <option value="holiday">Holidays</option>
            </select>

            <button 
              onClick={handleExport}
              className="inline-flex h-10 items-center gap-2 rounded-xl gradient-primary px-4 py-2 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-elegant transition-all active:scale-95"
            >
              <Download className="h-4 w-4" /> Export
            </button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <MonthCalendar 
          onHolidaysChange={setHolidays} 
          userId={selectedUserId}
          statusFilter={statusFilter}
        />

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">This Month</h3>
            <div className="mt-4 space-y-4">
              <Row dotClass="bg-success" label="Present" value={`${stats.present} days`} />
              <Row dotClass="bg-destructive" label="Absent" value={`${stats.absent} days`} />
              <Row dotClass="bg-warning" label="Late" value={`${stats.late} days`} />
              <Row dotClass="bg-info" label="On Leave" value={`${stats.leave} days`} />
              <Row dotClass="bg-holiday" label="Holidays" value={`${holidays.filter(h => new Date(h.date).getMonth() === today.getMonth()).length} this month`} />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Upcoming Holidays</h3>
            <p className="text-[11px] text-muted-foreground">Live from Nager.Date</p>
            {upcoming.length === 0 ? (
              <p className="mt-4 text-xs text-muted-foreground">No upcoming holidays found.</p>
            ) : (
              <ul className="mt-4 space-y-3 text-sm">
                {upcoming.map((h) => {
                  const d = new Date(h.date);
                  const month = d.toLocaleString("en-US", { month: "short" });
                  return (
                    <li key={h.date} className="flex items-center gap-3 rounded-lg border bg-background/40 p-3">
                      <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-holiday/15 text-holiday">
                        <span className="text-[10px] uppercase">{month}</span>
                        <span className="text-sm font-bold leading-none">{d.getDate()}</span>
                      </div>
                      <span className="text-sm font-medium">{h.localName}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Row({ dotClass, label, value }: { dotClass: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className={`h-2 w-2 rounded-full ${dotClass}`} />
        {label}
      </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
