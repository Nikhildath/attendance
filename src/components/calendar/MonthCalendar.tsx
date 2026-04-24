import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusMeta, type AttendanceStatus } from "@/lib/mock-data";
import { useHolidays, holidayOnDate } from "@/lib/holidays";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings-context";

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "IN", name: "India" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "JP", name: "Japan" },
  { code: "BR", name: "Brazil" },
  { code: "ES", name: "Spain" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dotMap: Record<AttendanceStatus, string> = {
  present: "bg-success",
  absent: "bg-destructive",
  late: "bg-warning",
  leave: "bg-info",
  holiday: "bg-holiday",
  weekend: "bg-transparent",
  none: "bg-transparent",
};

const cellTone: Record<AttendanceStatus, string> = {
  present: "border-success/40 bg-success/20 hover:border-success/60 hover:bg-success/25",
  absent: "border-destructive/40 bg-destructive/20 hover:border-destructive/60 hover:bg-destructive/25",
  late: "border-warning/40 bg-warning/25 hover:border-warning/60 hover:bg-warning/30",
  leave: "border-info/40 bg-info/20 hover:border-info/60 hover:bg-info/25",
  holiday: "border-holiday/40 bg-holiday/20 hover:border-holiday/60 hover:bg-holiday/25",
  weekend: "opacity-60 bg-muted/30",
  none: "opacity-50 hover:bg-muted/40",
};

export function MonthCalendar({ compact = false, onHolidaysChange }: { compact?: boolean; onHolidaysChange?: (h: { date: string; localName: string }[]) => void }) {
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [today, setToday] = useState<Date | null>(null);
  const [cursor, setCursor] = useState({ y: 2025, m: 3 });
  const [country, setCountry] = useState("IN");
  const [attendanceData, setAttendanceData] = useState<Record<number, { status: AttendanceStatus; checkIn?: string; checkOut?: string; note?: string }>>({});
  
  const { holidays, loading: holidaysLoading } = useHolidays(cursor.y, country);

  useEffect(() => {
    if (settings?.timezone === "Asia/Kolkata" || !settings?.timezone) {
       setCountry("IN");
    }
  }, [settings]);

  useEffect(() => {
    const t = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    setToday(t);
    setCursor({ y: t.getFullYear(), m: t.getMonth() });
  }, []);

  useEffect(() => {
    async function load() {
      if (!profile?.id) return;
      
      const start = new Date(cursor.y, cursor.m, 1).toISOString();
      const end = new Date(cursor.y, cursor.m + 1, 0).toISOString();

      const { data } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", profile.id)
        .gte("created_at", start)
        .lte("created_at", end);

      const map: Record<number, { status: AttendanceStatus; checkIn?: string; checkOut?: string; note?: string }> = {};
      
      // 1. Initialise all days
      const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(cursor.y, cursor.m, d);
        const dow = date.getDay();
        
        // Sunday is always a holiday by default
        if (dow === 0) {
          map[d] = { status: "holiday", note: "Sunday" };
        } else if (dow === 6 && d >= 8 && d <= 14) {
          // 2nd Saturday (Common in India, can be refined later if needed per country)
          map[d] = { status: "holiday", note: "2nd Saturday" };
        } else if (dow === 6) {
          map[d] = { status: "weekend" };
        } else {
          map[d] = { status: "none" };
        }
      }

      // 2. Overwrite with Public Holidays from API
      if (holidays && holidays.length > 0) {
        holidays.forEach(h => {
          const hDate = new Date(h.date);
          if (hDate.getMonth() === cursor.m && hDate.getFullYear() === cursor.y) {
            const d = hDate.getDate();
            map[d] = { status: "holiday", note: h.localName };
          }
        });
      }

      // 3. Overwrite with actual Attendance data
      if (data) {
        data.forEach(rec => {
          const dateStr = rec.check_in || rec.created_at;
          const d = new Date(dateStr).getDate();
          const rawStatus = (rec.status || "present").toLowerCase();
          
          map[d] = {
            status: rawStatus as AttendanceStatus,
            checkIn: rec.check_in ? new Date(rec.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
            checkOut: rec.check_out ? new Date(rec.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
            note: rec.notes
          };
        });
      }

      // 4. Overwrite with Approved Leaves
      const { data: leaves } = await supabase
        .from("leaves")
        .select("*")
        .eq("user_id", profile.id)
        .eq("status", "Approved")
        .gte("from_date", start.split('T')[0])
        .lte("to_date", end.split('T')[0]);

      if (leaves) {
        leaves.forEach(lv => {
          const lStart = new Date(lv.from_date);
          const lEnd = new Date(lv.to_date);
          
          for (let d = 1; d <= daysInMonth; d++) {
            const curDate = new Date(cursor.y, cursor.m, d);
            if (curDate >= lStart && curDate <= lEnd) {
               // Leave applies if user didn't work
               if (map[d]?.status === "none" || map[d]?.status === "absent" || map[d]?.status === "holiday") {
                  map[d] = { status: "leave", note: `Leave: ${lv.reason}` };
               }
            }
          }
        });
      }

      setAttendanceData(map);
    }
    load();
  }, [cursor, profile, holidays]); // Now reacts to holiday changes too!

  useEffect(() => {
    if (onHolidaysChange) {
      onHolidaysChange(holidays.map((h) => ({ date: h.date, localName: h.localName })));
    }
  }, [holidays, onHolidaysChange]);

  const firstDow = new Date(cursor.y, cursor.m, 1).getDay();
  const days = new Date(cursor.y, cursor.m + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const move = (delta: number) => {
    const m = cursor.m + delta;
    const y = cursor.y + Math.floor(m / 12);
    setCursor({ y, m: ((m % 12) + 12) % 12 });
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-card md:p-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className={cn("font-bold tracking-tight", compact ? "text-base" : "text-xl")}>
            {MONTHS[cursor.m]} {cursor.y}
          </h2>
          {!compact && <p className="text-xs text-muted-foreground">Hover any day for details</p>}
        </div>
        <div className="flex items-center gap-1">
          {!compact && (
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="mr-1 h-9 rounded-lg border bg-background px-2 text-xs font-medium"
              title="Holiday region"
            >
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          )}
          {holidaysLoading && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <button onClick={() => move(-1)} className="rounded-lg border p-2 transition-colors hover:bg-accent">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => today && setCursor({ y: today.getFullYear(), m: today.getMonth() })}
            className="rounded-lg border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
          >
            Today
          </button>
          <button onClick={() => move(1)} className="rounded-lg border p-2 transition-colors hover:bg-accent">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {DOW.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} className={compact ? "aspect-square" : "h-20"} />;
          const baseInfo = attendanceData[d] || { status: "none" };
          const holiday = holidayOnDate(holidays, cursor.y, cursor.m, d);
          const info = holiday && baseInfo.status !== "leave" && baseInfo.status !== "present" && baseInfo.status !== "late"
            ? { ...baseInfo, status: "holiday" as AttendanceStatus, note: holiday.localName }
            : baseInfo;
          const isToday = !!today && cursor.y === today.getFullYear() && cursor.m === today.getMonth() && d === today.getDate();
          const meta = statusMeta[info.status];
          
          return (
            <div
              key={i}
              className={cn(
                "group relative rounded-lg border bg-background/40 p-1.5 transition-all",
                compact ? "aspect-square text-[11px]" : "h-20 text-xs",
                cellTone[info.status],
                isToday && "ring-2 ring-primary"
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("font-semibold", isToday && "text-primary")}>{d}</span>
                <span className={cn("h-1.5 w-1.5 rounded-full", dotMap[info.status])} />
              </div>
              {!compact && info.status !== "weekend" && info.status !== "none" && (
                <div className="mt-1 line-clamp-2 text-[10px] leading-tight text-muted-foreground">
                  {info.status === "holiday"
                    ? holiday?.localName ?? "Holiday"
                    : info.status === "present" || info.status === "late"
                    ? info.checkIn
                    : meta.label}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!compact && (
        <div className="mt-5 flex flex-wrap items-center gap-3 border-t pt-4 text-xs">
          {(["present", "absent", "late", "leave", "holiday"] as AttendanceStatus[]).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-full", dotMap[s])} />
              <span className="text-muted-foreground">{statusMeta[s].label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
