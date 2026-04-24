import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MapPin, MapPinned, Navigation, Battery, Zap, Info, Search, Filter, Radio, ChevronRight, Activity, Clock, Pause, Power } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { socketService, type StaffLocation } from "@/lib/socket-service";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/field-tracking")({
  head: () => ({
    meta: [
      { title: "Field Staff Tracking — Attendly" },
      { name: "description", content: "Live geo-tracking of field staff with status, battery and current task. Real-time updates powered by socket.io" },
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
  accuracy?: number;
};

function FieldTrackingPage() {
  const { profile } = useAuth();
  const navigate = Route.useNavigate();
  const [selected, setSelected] = useState<FieldStaff | null>(null);

  useEffect(() => {
    if (profile && profile.role === "Employee") {
      navigate({ to: "/" });
    }
  }, [profile]);
  const [q, setQ] = useState("");
  const [staff, setStaff] = useState<FieldStaff[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(false);
  const [useSocketIO, setUseSocketIO] = useState(false);
  
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const realtimeSubRef = useRef<any>(null);
  const staffMapRef = useRef<Map<string, FieldStaff>>(new Map());

  const loadData = async () => {
    try {
      // Fetch branches for filter
      const { data: branchData } = await supabase.from("branches").select("id, name");
      if (branchData) setBranches(branchData);

      // Fetch profiles with branch_id
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
            lat: t?.lat ? Number(t.lat) : null,
            lng: t?.lng ? Number(t.lng) : null,
            battery: t?.battery || 0,
            task: t?.current_task || "No active task",
            speedKmh: Number(t?.speed_kmh || 0),
            lastUpdate: t?.last_update ? new Date(t.last_update).toLocaleTimeString() : "Never",
            accuracy: t?.accuracy || 0,
            branch_id: p.branch_id // Store branch_id for filtering
          } as any;
        });
        setStaff(merged);
        staffMapRef.current = new Map(merged.map(s => [s.id, s]));
        
        // Initial selected branch
        if (profile?.branch_id && selectedBranchId === "all") {
            setSelectedBranchId(profile.branch_id);
        }

        if (merged.length > 0 && !selected) setSelected(merged[0]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Listen for staff location updates
  useEffect(() => {
    if (!profile?.id) return;

    // Check connection status periodically for UI
    const checkInterval = setInterval(() => {
      setSocketConnected(socketService.isConnected());
      setUseSocketIO(socketService.isConnected());
    }, 2000);

    // Initial state
    setSocketConnected(socketService.isConnected());
    setUseSocketIO(socketService.isConnected());

    // Request fresh data from socket
    if (socketService.isConnected()) {
        socketService.requestStaffLocations();
    }

    // Listen for location updates from socket
    const unsubscribeLocation = socketService.onStaffLocationUpdate((data: StaffLocation) => {
      const staffMember = staffMapRef.current.get(data.id) || {
        id: data.id,
        name: data.name,
        initials: (data.name || "U").split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        role: 'Field Staff',
        task: 'On field',
        accuracy: 0,
        speedKmh: 0,
        status: data.status
      };
      const updated = { ...staffMember, ...data };
      staffMapRef.current.set(data.id, updated as any);
      setStaff(Array.from(staffMapRef.current.values()));
      if (selected?.id === data.id) setSelected(updated as any);
    });

    const unsubscribeLocations = socketService.onStaffLocations((data: StaffLocation[]) => {
      const updated: FieldStaff[] = data.map(d => ({
        id: d.id,
        name: d.name,
        initials: (d.name || "U").split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
        role: 'Field Staff',
        status: d.status,
        lat: d.lat,
        lng: d.lng,
        battery: d.battery,
        task: d.task,
        speedKmh: d.speed,
        lastUpdate: new Date(d.lastUpdate).toLocaleTimeString(),
        accuracy: d.accuracy,
        branch_id: (staffMapRef.current.get(d.id) as any)?.branch_id
      }));
      setStaff(prev => {
          // Merge with existing branch_id info
          return updated.map(u => ({
              ...u,
              branch_id: (prev.find(p => p.id === u.id) as any)?.branch_id || u.branch_id
          }));
      });
      staffMapRef.current = new Map(updated.map(s => [s.id, s]));
      if (updated.length > 0 && !selected) setSelected(updated[0]);
    });

    return () => {
      clearInterval(checkInterval);
      unsubscribeLocation();
      unsubscribeLocations();
    };
  }, [profile?.id, selected?.id]);

  useEffect(() => {
    loadData();
    
    // Setup Supabase Realtime as fallback if socket not connected
    if (!socketConnected) {
      realtimeSubRef.current = supabase.channel('tracking_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_tracking' }, () => loadData())
        .subscribe();
    }

    return () => {
      if (realtimeSubRef.current) {
        supabase.removeChannel(realtimeSubRef.current);
      }
    };
  }, [socketConnected]);

  // Initialize Leaflet
  useEffect(() => {
    if (typeof window === "undefined" || !mapRef.current || mapInstance.current) return;
    let canceled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (canceled || !mapRef.current) return;
      
      // Default to India view if no location yet
      const map = L.map(mapRef.current, { zoomControl: true }).setView([20.5937, 78.9629], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      mapInstance.current = map;
      
      // Try to center on user's current location
      if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition((pos) => {
              if (mapInstance.current) {
                  mapInstance.current.setView([pos.coords.latitude, pos.coords.longitude], 12);
              }
          });
      }
    })();
    return () => { canceled = true; };
  }, []);

  // Update markers
  useEffect(() => {
    if (typeof window === "undefined" || !mapInstance.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      staff.forEach((s) => {
        if (s.lat === null || s.lng === null) return; // Skip if no location
        const isActive = s.status === "active";
        const isIdle = s.status === "idle";
        const color = isActive ? "#16a34a" : isIdle ? "#eab308" : "#94a3b8";
        const opacity = isActive || isIdle ? 1 : 0.6;
        
        const html = `
          <div class="relative flex flex-col items-center">
            ${isActive ? '<div class="absolute -top-1 -inset-x-1 h-10 w-10 animate-ping rounded-full bg-success/30"></div>' : ''}
            <div class="flex flex-col items-center drop-shadow-lg">
                <div style="background:${color};width:36px;height:36px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;border:3px solid white;z-index:10;position:relative;">
                    ${s.initials}
                </div>
                <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid white;margin-top:-3px;z-index:5;"></div>
                <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:8px solid ${color};margin-top:-10px;z-index:6;"></div>
            </div>
            ${isActive ? '<span class="absolute top-0 right-0 h-3.5 w-3.5 rounded-full bg-success border-2 border-white z-20"></span>' : ''}
          </div>
        `;
        const icon = L.divIcon({ 
          html, 
          className: "", 
          iconSize: [40, 50], 
          iconAnchor: [20, 48] // Point of the pin
        });
        
        const existing = markersRef.current[s.id];
        const popupContent = `
          <div class="p-2 min-w-[150px]">
            <div class="flex items-center gap-2 mb-1">
              <span class="h-2 w-2 rounded-full" style="background:${color}"></span>
              <b class="text-sm">${s.name}</b>
            </div>
            <div class="text-xs text-muted-foreground mb-2">${s.role}</div>
            <div class="space-y-1">
              <div class="flex items-center justify-between text-[10px] border-t pt-1">
                <span class="uppercase tracking-wider font-bold">Status:</span>
                <span class="font-semibold" style="color:${color}">${s.status === 'active' ? 'LIVE' : s.status === 'idle' ? 'IDLE' : 'OFFLINE'}</span>
              </div>
              <div class="flex items-center justify-between text-[10px]">
                <span class="uppercase tracking-wider font-bold">Battery:</span>
                <span class="font-semibold">${s.battery}%</span>
              </div>
              <div class="flex items-center justify-between text-[10px]">
                <span class="uppercase tracking-wider font-bold">${s.status === 'offline' ? 'Last Seen:' : 'Last Update:'}</span>
                <span class="font-semibold">${s.lastUpdate}</span>
              </div>
            </div>
          </div>
        `;

        if (existing) {
          existing.setLatLng([s.lat, s.lng]);
          existing.setIcon(icon);
          existing.setPopupContent(popupContent);
        } else {
          const m = L.marker([s.lat, s.lng], { icon }).addTo(mapInstance.current);
          m.bindPopup(popupContent);
          m.on("click", () => setSelected(s));
          markersRef.current[s.id] = m;
        }
      });
      
      // If we have markers and map is at default, fit bounds
      if (staff.length > 0 && mapInstance.current.getZoom() < 6) {
          const group = L.featureGroup(Object.values(markersRef.current));
          mapInstance.current.fitBounds(group.getBounds().pad(0.1));
      }
    })();
  }, [staff]);

  const filtered = staff.filter((s) => {
    const matchesQuery = s.name.toLowerCase().includes(q.toLowerCase());
    const matchesBranch = selectedBranchId === "all" || (s as any).branch_id === selectedBranchId;
    return matchesQuery && matchesBranch;
  });

  // Update markers visibility
  useEffect(() => {
    if (!mapInstance.current) return;
    const filteredIds = new Set(filtered.map(s => s.id));
    Object.entries(markersRef.current).forEach(([id, marker]) => {
        if (filteredIds.has(id)) {
            marker.addTo(mapInstance.current);
        } else {
            marker.remove();
        }
    });
  }, [filtered.length, selectedBranchId, q]);

  const counts = {
    active: filtered.filter((s) => s.status === "active").length,
    idle: filtered.filter((s) => s.status === "idle").length,
    offline: filtered.filter((s) => s.status === "offline").length,
  };

  return (
    <div>
      <PageHeader
        title="Live Field Tracking"
        subtitle="Track, locate and manage your field staff in real-time"
        actions={
            <div className="flex items-center gap-3">
                <select 
                    value={selectedBranchId} 
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="h-10 rounded-lg border bg-card px-3 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                    <option value="all">All Branches</option>
                    {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                </select>
            </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-4">
        {socketConnected && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
            <Radio className="h-4 w-4 animate-pulse" />
            <span className="font-medium">Live connection active</span>
          </div>
        )}
        <button 
          onClick={() => {
              if ("geolocation" in navigator) {
                  navigator.geolocation.getCurrentPosition((pos) => {
                      mapInstance.current?.setView([pos.coords.latitude, pos.coords.longitude], 15);
                  });
              }
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/20 transition-all shadow-sm"
        >
          <MapPin className="h-4 w-4" />
          Locate Me
        </button>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 md:grid-cols-4">
        <PillStat label="Active" value={counts.active} cls="bg-success/10 text-success border-success/30" />
        <PillStat label="Idle" value={counts.idle} cls="bg-warning/15 text-warning-foreground border-warning/40" />
        <PillStat label="Offline" value={counts.offline} cls="bg-muted text-muted-foreground border-border" />
        <PillStat 
          label={socketConnected ? "Socket.io" : "Supabase Realtime"} 
          value={socketConnected ? 1 : 0} 
          cls={socketConnected ? "bg-info/10 text-info border-info/30" : "bg-warning/10 text-warning border-warning/30"}
        />
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
