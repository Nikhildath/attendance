import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { MonthlyRateChart, DepartmentBarChart, WeeklyTrendChart } from "@/components/charts/Charts";
import { TrendingUp, Clock, CalendarCheck, Users, Download } from "lucide-react";
import { StatCard } from "@/components/common/StatCard";
import { statusMeta, type AttendanceStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useSettings } from "@/lib/settings-context";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Attendly" },
      { name: "description", content: "Attendance trends, muster roll, payroll reports and performance metrics." },
    ],
  }),
  component: ReportsPage,
});

type Tab = "overview" | "muster" | "payroll";

function ReportsPage() {
  const { settings } = useSettings();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [muster, setMuster] = useState<any[]>([]);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [stats, setStats] = useState({
    avgAttendance: "0%",
    onTimeRate: "0%",
    activeEmployees: 0,
    productivity: "0"
  });

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const currency = settings?.default_currency || "INR";

  useEffect(() => {
    async function load() {
      setLoading(true);
      
      // Fetch all profiles
      const { data: profiles } = await supabase.from("profiles").select("*");
      
      // Fetch current month attendance
      const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString();
      
      const { data: attendance } = await supabase
        .from("attendance")
        .select("*")
        .gte("created_at", start)
        .lte("created_at", end);

      if (profiles && attendance) {
        // Build Muster Roll
        const musterRoll = profiles.map(p => {
          const row = Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const rec = attendance.find(a => a.user_id === p.id && new Date(a.created_at).getDate() === day);
            if (rec) return rec.status as AttendanceStatus;
            
            const date = new Date(today.getFullYear(), today.getMonth(), day);
            const dow = date.getDay();
            if (dow === 0 || dow === 6) return "weekend" as AttendanceStatus;
            return "none" as AttendanceStatus;
          });
          return { id: p.id, name: p.name, role: p.role, row };
        });
        setMuster(musterRoll);

        // Stats
        const totalPossible = profiles.length * daysInMonth;
        const totalPresent = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
        const onTime = attendance.filter(a => a.status === 'present').length;
        
        setStats({
          avgAttendance: totalPossible > 0 ? ((totalPresent / totalPossible) * 100).toFixed(1) + "%" : "0%",
          onTimeRate: totalPresent > 0 ? ((onTime / totalPresent) * 100).toFixed(1) + "%" : "0%",
          activeEmployees: profiles.length,
          productivity: "92" // Static placeholder for complex calculation
        });
      }

      // Fetch Payslips
      const { data: slips } = await supabase.from("payslips").select("*, profiles(name)");
      if (slips) setPayslips(slips);

      setLoading(false);
    }
    load();
  }, [tab]);

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Attendance trends, muster roll and payroll reports"
        actions={
          <button className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-xs font-semibold hover:bg-accent">
            <Download className="h-4 w-4" /> Export
          </button>
        }
      />

      <div className="mb-4 inline-flex rounded-lg border bg-card p-1 shadow-card">
        {([["overview","Overview"],["muster","Muster Roll"],["payroll","Payroll"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cn(
            "rounded-md px-4 py-1.5 text-xs font-semibold transition-colors",
            tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}>{l}</button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Avg Attendance" value={stats.avgAttendance} icon={CalendarCheck} tone="success" />
            <StatCard label="On-Time Rate" value={stats.onTimeRate} icon={Clock} tone="info" />
            <StatCard label="Active Employees" value={stats.activeEmployees} icon={Users} tone="default" />
            <StatCard label="Productivity" value={stats.productivity} icon={TrendingUp} tone="warning" />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border bg-card p-6 shadow-card">
              <h2 className="text-lg font-semibold">Monthly Attendance Rate</h2>
              <p className="text-xs text-muted-foreground">Company-wide attendance % per month</p>
              <div className="mt-4"><MonthlyRateChart data={[]} /></div>
            </div>
            <div className="rounded-xl border bg-card p-6 shadow-card">
              <h2 className="text-lg font-semibold">Activity Heatmap</h2>
              <p className="text-xs text-muted-foreground">Recent engagement levels</p>
              <div className="mt-4"><DepartmentBarChart data={[]} /></div>
            </div>
          </div>
          <div className="mt-6 rounded-xl border bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold">Weekly Trend</h2>
            <p className="text-xs text-muted-foreground">Present, late and absent counts across the week</p>
            <WeeklyTrendChart data={[]} />
          </div>
        </>
      )}

      {tab === "muster" && (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <div className="flex items-center justify-between border-b p-5">
            <div>
              <h2 className="text-lg font-semibold">Muster Roll · {today.toLocaleString("en", { month: "long", year: "numeric" })}</h2>
              <p className="text-xs text-muted-foreground">Daily attendance per employee</p>
            </div>
            <div className="flex items-center gap-3 text-[11px]">
              {(["present","late","absent","leave","holiday","weekend"] as const).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 rounded-sm", statusMeta[s].dot)} />
                  {statusMeta[s].label}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="sticky left-0 z-10 bg-muted/60 px-4 py-3">Employee</th>
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <th key={i} className="px-1 py-3 text-center font-semibold">{i + 1}</th>
                  ))}
                  <th className="px-3 py-3 text-center">P</th>
                  <th className="px-3 py-3 text-center">A</th>
                  <th className="px-3 py-3 text-center">L</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                   <tr><td colSpan={daysInMonth + 4} className="py-20 text-center text-muted-foreground">Loading report data...</td></tr>
                ) : muster.map((row) => {
                  const p = row.row.filter((s: string) => s === "present").length;
                  const a = row.row.filter((s: string) => s === "absent").length;
                  const l = row.row.filter((s: string) => s === "leave" || s === "late").length;
                  return (
                    <tr key={row.id} className="border-t hover:bg-accent/20">
                      <td className="sticky left-0 z-10 bg-card px-4 py-2">
                        <div className="text-sm font-medium">{row.name}</div>
                        <div className="text-[10px] text-muted-foreground">{row.role}</div>
                      </td>
                      {row.row.map((s: AttendanceStatus, i: number) => (
                        <td key={i} className="px-0.5 py-2">
                          <div className={cn("mx-auto h-5 w-5 rounded-sm", statusMeta[s].dot)} title={statusMeta[s].label} />
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center font-bold text-success">{p}</td>
                      <td className="px-3 py-2 text-center font-bold text-destructive">{a}</td>
                      <td className="px-3 py-2 text-center font-bold text-info">{l}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "payroll" && (
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold">Payroll Summary Report</h2>
            <p className="text-xs text-muted-foreground">Latest generated payslips overview</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  <th className="px-4 py-3 text-right text-destructive">Deductions</th>
                  <th className="px-4 py-3 text-right">Net</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-20 text-center text-muted-foreground">Loading payroll data...</td></tr>
                ) : payslips.length === 0 ? (
                  <tr><td colSpan={6} className="py-20 text-center text-muted-foreground">No payroll records found.</td></tr>
                ) : payslips.map((p) => {
                  const gross = Number(p.basic_pay) + Number(p.hra) + Number(p.allowances) + Number(p.bonus) + Number(p.overtime_pay);
                  const ded = Number(p.fines) + Number(p.loan_deduction) + Number(p.tax);
                  return (
                    <tr key={p.id} className="border-t hover:bg-accent/20">
                      <td className="px-5 py-3 font-medium">{p.profiles?.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.month}</td>
                      <td className="px-4 py-3 text-right">{currency} {gross.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-destructive">−{currency} {ded.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-bold">{currency} {p.net_payable.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          p.status === "Paid" ? "border-success/40 bg-success/10 text-success" :
                          p.status === "Processing" ? "border-info/40 bg-info/10 text-info" :
                          "border-warning/40 bg-warning/10 text-warning-foreground")}>{p.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
