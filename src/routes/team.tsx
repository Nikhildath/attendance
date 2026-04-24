import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, X, Users } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Avatar2D } from "@/components/common/Avatar2D";
import { StatusBadge, LeaveStatusBadge } from "@/components/common/StatusBadge";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/team")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      q: (search.q as string) || "",
    };
  },
  head: () => ({
    meta: [
      { title: "Team — Attendly" },
      { name: "description", content: "Manager view: team attendance and leave approvals." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { profile } = useAuth();
  const { q } = Route.useSearch();
  const [members, setMembers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    // Fetch profiles
    const { data: profs } = await supabase.from("profiles").select("*");
    
    // Fetch today's attendance for everyone
    const today = new Date().toISOString().split('T')[0];
    const { data: att } = await supabase
      .from("attendance")
      .select("*")
      .gte("created_at", today);

    if (profs) {
      const merged = profs.map(p => {
        const record = att?.find(a => a.user_id === p.id);
        return {
          ...p,
          checkIn: record?.check_in ? new Date(record.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—",
          status: record?.status || "none"
        };
      });
      setMembers(merged);
    }

    // Fetch pending leave requests
    const { data: lvs } = await supabase
      .from("leaves")
      .select(`*, profiles(name)`)
      .eq("status", "Pending");
    
    if (lvs) setRequests(lvs);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const decide = async (id: string, status: "Approved" | "Rejected") => {
    const { error } = await supabase
      .from("leaves")
      .update({ status })
      .eq("id", id);
    
    if (!error) {
      toast.success(`Leave ${status}`);
      setRequests(rs => rs.map(r => r.id === id ? { ...r, status } : r));
    } else toast.error(error.message);
  };

  return (
    <div>
      <PageHeader
        title="Team Overview"
        subtitle="Monitor your team's attendance and approve leave requests"
        actions={
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-semibold">{members.length}</span>
            <span className="text-muted-foreground">members</span>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <div className="border-b p-5">
            <h2 className="text-lg font-semibold">Today's Attendance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Check-In</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                   <tr><td colSpan={4} className="py-10 text-center text-muted-foreground">Loading team...</td></tr>
                ) : members.filter(m => !q || m.name.toLowerCase().includes(q.toLowerCase())).map((m) => (
                  <tr key={m.id} className="border-t transition-colors hover:bg-accent/30">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar2D name={m.name} size={36} />
                        <div className="font-medium">{m.name}</div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{m.role}</td>
                    <td className="px-5 py-3 font-mono text-xs">{m.checkIn}</td>
                    <td className="px-5 py-3"><StatusBadge status={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h2 className="text-lg font-semibold">Leave Approvals</h2>
          <p className="mt-1 text-xs text-muted-foreground">Pending requests from your team</p>

          <div className="mt-4 space-y-3">
            {requests.length === 0 ? (
               <div className="py-10 text-center text-muted-foreground text-xs">No pending requests</div>
            ) : requests.map((r) => (
              <div key={r.id} className="rounded-lg border bg-background/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{r.profiles?.name} · {r.type}</div>
                    <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{r.days} Days · {r.from_date} → {r.to_date}</div>
                    <div className="mt-2 text-xs">{r.reason}</div>
                  </div>
                  <LeaveStatusBadge status={r.status} />
                </div>
                {r.status === "Pending" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => decide(r.id, "Approved")}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-success/15 px-3 py-1.5 text-xs font-semibold text-success hover:bg-success/25 transition-colors"
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => decide(r.id, "Rejected")}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-destructive/15 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/25 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
