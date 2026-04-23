import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MapPinned, Battery, Activity, Pause, Power, Search } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/field-tracking")({
  head: () => ({
    meta: [
      { title: "Field Staff Tracking — Attendly" },
      { name: "description", content: "Live geo-tracking of field staff with status, battery and current task." },
    ],
  }),
  component: FieldTrackingPage,
});

type FieldStaff = {
  id: string;
  name: string;
  initials: string;
  role: string;
  status: "active" | "idle" | "offline";
  lat: number;
  lng: number;
  battery: number;
  task: string;
  speedKmh: number;
  lastUpdate: string;
};

function FieldTrackingPage() {
  const [selected, setSelected] = useState<FieldStaff | null>(null);
  const [q, setQ] = useState("");
  const [staff, setStaff] = useState<FieldStaff[]>([]);
  const [loading, setLoading] = useState(true);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});

  const loadData = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: tracking } = await supabase.from("staff_tracking").select("*");

    if (profiles) {
      const merged: FieldStaff[] = profiles.map(p => {
        const t = tracking?.find(tr => tr.user_id === p.id);
        return {
          id: p.id,
          name: p.name || "Unknown",
          initials: (p.name || "U").split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
          role: p.role,
          status: (t?.status as any) || "offline",
          lat: Number(t?.lat || 12.9716),
          lng: Number(t?.lng || 77.5946),
          battery: t?.battery || 0,
          task: t?.current_task || "No active task",
          speedKmh: Number(t?.speed_kmh || 0),
          lastUpdate: t?.last_update ? new Date(t.last_update).toLocaleTimeString() : "Never"
        };
      });
      setStaff(merged);
      if (merged.length > 0 && !selected) setSelected(merged[0]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const sub = supabase.channel('tracking_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_tracking' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  // Initialize Leaflet
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || mapInstance.current) return;
    let canceled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (canceled || !mapRef.current) return;
      
      const map = L.map(mapRef.current, { zoomControl: true }).setView([12.9716, 77.5946], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      mapInstance.current = map;
    })();
    return () => { canceled = true; };
  }, []);

  // Update markers
  useEffect(() => {
    if (typeof window === "undefined" || !mapInstance.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      staff.forEach((s) => {
        const color = s.status === "active" ? "#16a34a" : s.status === "idle" ? "#eab308" : "#94a3b8";
        const html = `<div style="background:${color};color:white;width:32px;height:32px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.25)">${s.initials}</div>`;
        const icon = L.divIcon({ html, className: "", iconSize: [32, 32], iconAnchor: [16, 16] });
        
        const existing = markersRef.current[s.id];
        if (existing) {
          existing.setLatLng([s.lat, s.lng]);
          existing.setIcon(icon);
        } else {
          const m = L.marker([s.lat, s.lng], { icon }).addTo(mapInstance.current);
          m.bindPopup(`<b>${s.name}</b><br/>${s.role}<br/><span style="color:#666">${s.task}</span>`);
          m.on("click", () => setSelected(s));
          markersRef.current[s.id] = m;
        }
      });
    })();
  }, [staff]);

  const filtered = staff.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()));
  const counts = {
    active: staff.filter((s) => s.status === "active").length,
    idle: staff.filter((s) => s.status === "idle").length,
    offline: staff.filter((s) => s.status === "offline").length,
  };

  return (
    <div>
      <PageHeader
        title="Live Field Tracking"
        subtitle="Track, locate and manage your field staff in real-time"
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <PillStat label="Active" value={counts.active} cls="bg-success/10 text-success border-success/30" />
        <PillStat label="Idle" value={counts.idle} cls="bg-warning/15 text-warning-foreground border-warning/40" />
        <PillStat label="Offline" value={counts.offline} cls="bg-muted text-muted-foreground border-border" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-xl border bg-card shadow-card">
          <div ref={mapRef} className="h-[560px] w-full" style={{ background: "var(--muted)" }} />
        </div>

        <div className="rounded-xl border bg-card shadow-card">
          <div className="border-b p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search staff…" className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm" />
            </div>
          </div>
          <ul className="max-h-[492px] overflow-y-auto">
            {loading ? (
               <div className="p-10 text-center text-muted-foreground text-xs">Loading staff...</div>
            ) : filtered.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setSelected(s)}
                  className={cn(
                    "flex w-full items-start gap-3 border-b p-4 text-left transition-colors hover:bg-accent/40",
                    selected?.id === s.id && "bg-accent/60"
                  )}
                >
                  <div className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                    s.status === "active" ? "bg-success" : s.status === "idle" ? "bg-warning" : "bg-muted-foreground"
                  )}>
                    {s.initials}
                    {s.status === "active" && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-success ring-2 ring-card animate-pulse" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-semibold">{s.name}</div>
                      <BatteryDot v={s.battery} />
                    </div>
                    <div className="text-xs text-muted-foreground">{s.role}</div>
                    <div className="mt-1 truncate text-xs text-foreground/70">{s.task}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {s.status === "active" ? <Activity className="h-3 w-3 text-success" /> : s.status === "idle" ? <Pause className="h-3 w-3 text-warning" /> : <Power className="h-3 w-3" />}
                      <span>{s.lastUpdate}</span>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function PillStat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={cn("flex items-center justify-between rounded-xl border px-4 py-3", cls)}>
      <div className="flex items-center gap-2 text-sm font-semibold"><MapPinned className="h-4 w-4" />{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function BatteryDot({ v }: { v: number }) {
  const tone = v > 50 ? "text-success" : v > 20 ? "text-warning" : "text-destructive";
  return <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", tone)}><Battery className="h-3 w-3" />{v}%</span>;
}
