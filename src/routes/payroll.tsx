import { createFileRoute } from "@tanstack/react-router";
import { Wallet, TrendingUp, Download, FileText, AlertTriangle, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useSettings } from "@/lib/settings-context";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/payroll")({
  head: () => ({
    meta: [
      { title: "Payroll — Attendly" },
      { name: "description", content: "Auto-calculated payroll with fines, overtime, allowances, bonuses and loan deductions." },
    ],
  }),
  component: PayrollPage,
});

function PayrollPage() {
  const { settings } = useSettings();
  const [month, setMonth] = useState("Apr 2025");
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const currency = settings?.default_currency || "INR";

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("payslips")
        .select(`*, profiles(name)`)
        .eq("month", month);
      
      if (data) setPayslips(data);
      setLoading(false);
    }
    load();
  }, [month]);

  const totals = payslips.reduce((acc, p) => ({
    gross: acc.gross + Number(p.basic_pay) + Number(p.hra) + Number(p.allowances) + Number(p.bonus) + Number(p.overtime_pay),
    net: acc.net + Number(p.net_payable),
    fines: acc.fines + Number(p.fines),
    overtime: acc.overtime + Number(p.overtime_pay),
  }), { gross: 0, net: 0, fines: 0, overtime: 0 });

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Automatic salary calculation with fines, OT, allowances, bonuses and loan EMIs"
        actions={
          <div className="flex items-center gap-2">
            <select value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 rounded-lg border bg-card px-3 text-sm font-medium">
              <option>Apr 2025</option>
              <option>Mar 2025</option>
            </select>
            <button className="inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant">
              <Plus className="h-4 w-4" /> Run Payroll
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Net Payable" value={`${currency} ${totals.net.toLocaleString()}`} icon={Wallet} tone="success" />
        <StatCard label="Gross Payroll" value={`${currency} ${totals.gross.toLocaleString()}`} icon={TrendingUp} tone="info" />
        <StatCard label="Total OT Pay" value={`${currency} ${totals.overtime.toLocaleString()}`} icon={TrendingUp} tone="default" />
        <StatCard label="Fines Deducted" value={`${currency} ${totals.fines.toLocaleString()}`} icon={AlertTriangle} tone="warning" />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <RuleCard title="Late Fine" formula={`${currency} 50 / late mark`} detail="Auto-deducted when check-in > thresholds." />
        <RuleCard title="Overtime" formula="1.5× hourly rate" detail={`Triggers after ${settings?.working_hours_per_day || 9} working hours.`} />
        <RuleCard title="Loan EMI" formula="Principal ÷ months" detail="Auto-deducted from each payslip." />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-lg font-semibold">Payslips · {month}</h2>
          <button className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Employee</th>
                <th className="px-4 py-3 text-right">Basic</th>
                <th className="px-4 py-3 text-right">HRA</th>
                <th className="px-4 py-3 text-right">Allow.</th>
                <th className="px-4 py-3 text-right">Bonus</th>
                <th className="px-4 py-3 text-right">OT</th>
                <th className="px-4 py-3 text-right text-destructive">Fines</th>
                <th className="px-4 py-3 text-right text-destructive">Loan</th>
                <th className="px-4 py-3 text-right text-destructive">Tax</th>
                <th className="px-4 py-3 text-right">Net</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="py-10 text-center text-muted-foreground">Loading payslips...</td></tr>
              ) : payslips.length === 0 ? (
                <tr><td colSpan={12} className="py-10 text-center text-muted-foreground">No records found for this month.</td></tr>
              ) : payslips.map((p) => (
                <tr key={p.id} className="border-t transition-colors hover:bg-accent/30">
                  <td className="px-5 py-3 font-medium">{p.profiles?.name}</td>
                  <td className="px-4 py-3 text-right">{currency} {p.basic_pay}</td>
                  <td className="px-4 py-3 text-right">{currency} {p.hra}</td>
                  <td className="px-4 py-3 text-right">{currency} {p.allowances}</td>
                  <td className="px-4 py-3 text-right text-success">{currency} {p.bonus}</td>
                  <td className="px-4 py-3 text-right text-success">{currency} {p.overtime_pay}</td>
                  <td className="px-4 py-3 text-right text-destructive">−{currency} {p.fines}</td>
                  <td className="px-4 py-3 text-right text-destructive">−{currency} {p.loan_deduction}</td>
                  <td className="px-4 py-3 text-right text-destructive">−{currency} {p.tax}</td>
                  <td className="px-4 py-3 text-right font-bold">{currency} {p.net_payable}</td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                      p.status === "Paid" ? "border-success/40 bg-success/10 text-success" :
                      p.status === "Processing" ? "border-info/40 bg-info/10 text-info" :
                      "border-warning/40 bg-warning/10 text-warning-foreground")}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3"><button className="rounded-md p-1.5 hover:bg-accent" title="Download payslip"><FileText className="h-4 w-4 text-muted-foreground" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RuleCard({ title, formula, detail }: { title: string; formula: string; detail: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-card">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-1 text-xl font-bold text-primary">{formula}</div>
      <div className="mt-2 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}
