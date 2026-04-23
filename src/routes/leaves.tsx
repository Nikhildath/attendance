import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, X, Plane } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { LeaveStatusBadge } from "@/components/common/StatusBadge";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/leaves")({
  head: () => ({
    meta: [
      { title: "Leaves — Attendly" },
      { name: "description", content: "Apply for leaves and review your past leave requests." },
    ],
  }),
  component: LeavesPage,
});

function LeavesPage() {
  const { profile } = useAuth();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadLeaves = async () => {
    if (!profile?.id) return;
    const { data } = await supabase
      .from("leaves")
      .select("*")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false });
    if (data) setLeaves(data);
    setLoading(false);
  };

  useEffect(() => {
    loadLeaves();
  }, [profile]);

  const submit = async (data: any) => {
    const from = new Date(data.from);
    const to = new Date(data.to);
    const days = data.half ? 0.5 : Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
    
    const { error } = await supabase.from("leaves").insert([{
      user_id: profile?.id,
      type: data.type,
      from_date: data.from,
      to_date: data.to,
      days: days,
      half_day: data.half,
      reason: data.reason,
      status: "Pending"
    }]);

    if (!error) {
      toast.success("Leave request submitted");
      setOpen(false);
      loadLeaves();
    } else toast.error(error.message);
  };

  const balance = [
    { label: "Annual", used: 0, total: 20, tone: "text-info" },
    { label: "Sick", used: 0, total: 10, tone: "text-success" },
    { label: "Casual", used: 0, total: 8, tone: "text-warning-foreground" },
  ];

  return (
    <div>
      <PageHeader
        title="Leaves"
        subtitle="Track balances and submit new leave requests"
        actions={
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant"
          >
            <Plus className="h-4 w-4" /> Apply for Leave
          </button>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {balance.map((b) => {
          const pct = (b.used / b.total) * 100;
          return (
            <div key={b.label} className="rounded-xl border bg-card p-5 shadow-card">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-muted-foreground">{b.label} Leave</div>
                <Plane className={`h-4 w-4 ${b.tone}`} />
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold">{b.total - b.used}</span>
                <span className="text-sm text-muted-foreground">/ {b.total} left</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full gradient-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <div className="flex items-center justify-between border-b p-5">
          <h2 className="text-lg font-semibold">Leave Requests</h2>
          <span className="text-xs text-muted-foreground">{leaves.length} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Period</th>
                <th className="px-5 py-3">Days</th>
                <th className="px-5 py-3">Reason</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">Loading leaves...</td></tr>
              ) : leaves.length === 0 ? (
                <tr><td colSpan={5} className="py-10 text-center text-muted-foreground">No leave requests found.</td></tr>
              ) : leaves.map((l) => (
                <tr key={l.id} className="border-t transition-colors hover:bg-accent/30">
                  <td className="px-5 py-3 font-medium">{l.type}</td>
                  <td className="px-5 py-3 text-muted-foreground">{l.from_date} → {l.to_date}</td>
                  <td className="px-5 py-3">{l.days}{l.half_day && " (½)"}</td>
                  <td className="px-5 py-3 max-w-xs truncate text-muted-foreground">{l.reason}</td>
                  <td className="px-5 py-3"><LeaveStatusBadge status={l.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && <LeaveModal onClose={() => setOpen(false)} onSubmit={submit} />}
    </div>
  );
}

function LeaveModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (d: any) => void }) {
  const [type, setType] = useState("Casual");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [half, setHalf] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-elegant">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Apply for Leave</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-accent"><X className="h-4 w-4" /></button>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (from && to) onSubmit({ type, from, to, half, reason }); }}
          className="mt-5 space-y-4"
        >
          <div>
            <label className="mb-1.5 block text-xs font-medium">Leave Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm">
              {(["Casual", "Sick", "Annual", "Unpaid"] as const).map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium">From</label>
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium">To</label>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" required />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border bg-background/40 p-3">
            <input id="half" type="checkbox" checked={half} onChange={(e) => setHalf(e.target.checked)} className="h-4 w-4 accent-primary" />
            <label htmlFor="half" className="text-sm">Half-day leave</label>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full rounded-lg border bg-background p-3 text-sm" placeholder="Brief reason for your leave…" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent">Cancel</button>
            <button type="submit" className="rounded-lg gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-elegant">Submit Request</button>
          </div>
        </form>
      </div>
    </div>
  );
}
