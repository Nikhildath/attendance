import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { CalendarRange, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/shifts")({
  head: () => ({
    meta: [
      { title: "Shifts — Attendly" },
      { name: "description", content: "Fixed, rotational and open shifts with a 7-day shift scheduler." },
    ],
  }),
  component: ShiftsPage,
});

const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function ShiftsPage() {
  const [filter, setFilter] = useState<"all" | "fixed" | "rotational" | "open">("all");
  const [shifts, setShifts] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const { data: s } = await supabase.from("shifts").select("*").order("name");
    const { data: sch } = await supabase.from("shift_schedule").select("*");
    const { data: m } = await supabase.from("profiles").select("*");

    if (s) setShifts(s);
    if (sch) setSchedule(sch);
    if (m) setMembers(m);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const visibleShifts = shifts.filter((s) => filter === "all" || s.type === filter);

  return (
    <div>
      <PageHeader
        title="Shift Management"
        subtitle="Fixed, rotational and open (flexi) shifts with a weekly scheduler"
        actions={
          <button className="inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant">
            <Plus className="h-4 w-4" /> New Shift
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all","fixed","rotational","open"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors",
            filter === f ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-accent"
          )}>{f}</button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-10 text-center text-muted-foreground text-xs">Loading shifts...</div>
        ) : visibleShifts.map((s) => (
          <div key={s.id} className="rounded-xl border bg-card p-5 shadow-card transition-transform hover:-translate-y-0.5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{s.type}</div>
                <div className="mt-1 text-lg font-bold">{s.name}</div>
              </div>
              <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", s.color)}>Active</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-2xl font-bold tabular-nums">
              <span>{s.start_time}</span>
              <span className="text-muted-foreground">→</span>
              <span>{s.end_time}</span>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">Break: {s.break_minutes} min</div>
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="flex items-center justify-between border-b p-5">
          <div>
            <h2 className="text-lg font-semibold">Weekly Schedule</h2>
            <p className="text-xs text-muted-foreground">Dynamic roster management</p>
          </div>
          <CalendarRange className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Employee</th>
                {days.map((d) => <th key={d} className="px-3 py-3 text-center">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="py-20 text-center text-muted-foreground text-xs">Loading roster...</td></tr>
              ) : members.map((m) => {
                const sched = schedule.find((s) => s.user_id === m.id);
                return (
                  <tr key={m.id} className="border-t hover:bg-accent/20">
                    <td className="px-5 py-3 font-medium">{m.name}<div className="text-xs text-muted-foreground">{m.role}</div></td>
                    {days.map((d, i) => {
                      const dayKey = d.toLowerCase();
                      const shiftId = sched?.[dayKey];
                      const sh = shiftId ? shifts.find((s) => s.id === shiftId) : null;
                      return (
                        <td key={i} className="px-2 py-2 text-center">
                          {sh ? (
                            <div className={cn("mx-auto inline-flex flex-col items-center rounded-md border px-2 py-1 text-[11px] font-semibold", sh.color)}>
                              <span>{sh.name}</span>
                              <span className="text-[10px] opacity-80">{sh.start_time === "—" ? "Flexi" : `${sh.start_time}–${sh.end_time}`}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
