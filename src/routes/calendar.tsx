import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { MonthCalendar } from "@/components/calendar/MonthCalendar";
import { Download, Filter } from "lucide-react";

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
  const [holidays, setHolidays] = useState<{ date: string; localName: string }[]>([]);

  const today = new Date();
  const upcoming = holidays
    .filter((h) => new Date(h.date) >= new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Attendance Calendar"
        subtitle="Color-coded view of your attendance, leaves and public holidays"
        actions={
          <>
            <button className="inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-accent">
              <Filter className="h-4 w-4" /> Filter
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg gradient-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-elegant">
              <Download className="h-4 w-4" /> Export
            </button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <MonthCalendar onHolidaysChange={setHolidays} />

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">This Month</h3>
            <div className="mt-4 space-y-3 text-sm">
              <Row dotClass="bg-success" label="Present" value="20 days" />
              <Row dotClass="bg-destructive" label="Absent" value="1 day" />
              <Row dotClass="bg-warning" label="Late" value="2 days" />
              <Row dotClass="bg-info" label="On Leave" value="3 days" />
              <Row dotClass="bg-holiday" label="Holidays" value={`${holidays.length} this year`} />
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
