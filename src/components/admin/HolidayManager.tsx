import { useState, useEffect } from "react";
import { Plus, Trash2, Download, PartyPopper, Calendar as CalendarIcon, Globe, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Holiday = {
  id: string;
  name: string;
  date: string;
  kind: "public" | "restricted" | "optional";
  branch_id: string | null;
  region: string;
};

export function HolidayManager({ branches }: { branches: any[] }) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [countryCode, setCountryCode] = useState("IN");
  const [year, setYear] = useState(new Date().getFullYear());
  
  const [newH, setNewH] = useState<Partial<Holiday>>({
    name: "",
    date: new Date().toISOString().split('T')[0],
    kind: "public",
    branch_id: null,
    region: "All"
  });

  const loadHolidays = async () => {
    setLoading(true);
    const { data } = await supabase.from("company_holidays").select("*").order("date");
    if (data) setHolidays(data);
    setLoading(false);
  };

  useEffect(() => { loadHolidays(); }, []);

  const addManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const branch = branches.find(b => b.id === newH.branch_id);
    const { error } = await supabase.from("company_holidays").insert([{
      ...newH,
      region: branch ? `${branch.city}, ${branch.country}` : "Global"
    }]);
    if (!error) {
      toast.success("Holiday added");
      loadHolidays();
    } else toast.error(error.message);
  };

  const deleteH = async (id: string) => {
    const { error } = await supabase.from("company_holidays").delete().eq("id", id);
    if (!error) {
      toast.success("Deleted");
      setHolidays(h => h.filter(x => x.id !== id));
    }
  };

  const fetchPublicHolidays = async () => {
    const apiKey = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;
    if (!apiKey) {
      return toast.error("VITE_GOOGLE_CALENDAR_API_KEY is missing. Please add it to your .env file.");
    }

    if (!countryCode || countryCode.length !== 2) {
      return toast.error("Please enter a valid 2-letter country code (e.g., IN, US)");
    }

    const GOOGLE_CALENDAR_IDS: Record<string, string> = {
      "IN": "en.indian#holiday@group.v.calendar.google.com",
      "US": "en.usa#holiday@group.v.calendar.google.com",
      "GB": "en.uk#holiday@group.v.calendar.google.com",
      "DE": "en.german#holiday@group.v.calendar.google.com",
      "FR": "en.french#holiday@group.v.calendar.google.com",
      "CA": "en.canadian#holiday@group.v.calendar.google.com",
      "AU": "en.australian#holiday@group.v.calendar.google.com",
      "JP": "en.japanese#holiday@group.v.calendar.google.com",
      "BR": "en.brazilian#holiday@group.v.calendar.google.com",
      "ES": "en.spanish#holiday@group.v.calendar.google.com",
    };

    const calendarId = GOOGLE_CALENDAR_IDS[countryCode] || GOOGLE_CALENDAR_IDS["IN"];

    toast.loading(`Fetching ${countryCode} holidays from Google...`, { id: "fetch" });
    try {
      const timeMin = new Date(year, 0, 1).toISOString();
      const timeMax = new Date(year, 11, 31).toISOString();
      
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true`);
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error?.message || `API Error: ${res.status}`);
      }

      const data = await res.json();
      if (!data.items || data.items.length === 0) {
        throw new Error("No holidays found in Google Calendar for this country and year.");
      }
      
      const toInsert = data.items.map((h: any) => ({
        name: h.summary,
        date: h.start.date || h.start.dateTime.split("T")[0],
        kind: "public",
        region: countryCode === "IN" ? "India" : countryCode,
        branch_id: null
      }));

      // Filter out duplicates if they already exist in the database
      const { data: existing } = await supabase.from("company_holidays").select("date, name");
      const filtered = toInsert.filter((h: any) => !existing?.some(e => e.date === h.date && e.name === h.name));

      if (filtered.length === 0) {
        toast.info("All holidays are already imported.", { id: "fetch" });
        return;
      }

      const { error } = await supabase.from("company_holidays").insert(filtered);
      if (error) throw error;
      
      toast.success(`Imported ${filtered.length} holidays from Google Calendar`, { id: "fetch" });
      loadHolidays();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to fetch holidays", { id: "fetch" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Manual Add */}
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h3 className="mb-4 flex items-center gap-2 font-semibold"><Plus className="h-4 w-4" /> Add Manual Holiday</h3>
          <form onSubmit={addManual} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Name</Label>
              <Input value={newH.name} onChange={e => setNewH({...newH, name: e.target.value})} required placeholder="Festival Name" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Date</Label>
                <Input type="date" value={newH.date} onChange={e => setNewH({...newH, date: e.target.value})} required />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Type</Label>
                <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={newH.kind} onChange={e => setNewH({...newH, kind: e.target.value as any})}>
                  <option value="public">Public</option>
                  <option value="restricted">Restricted</option>
                  <option value="optional">Optional</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Apply to Branch</Label>
              <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={newH.branch_id || ""} onChange={e => setNewH({...newH, branch_id: e.target.value || null})}>
                <option value="">Global (All Branches)</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.city})</option>)}
              </select>
            </div>
            <Button type="submit" className="w-full mt-2">Add Holiday</Button>
          </form>
        </div>

        {/* Public Holiday Importer */}
        <div className="rounded-xl border bg-card p-5 shadow-card">
          <h3 className="mb-4 flex items-center gap-2 font-semibold"><Globe className="h-4 w-4" /> Import Public Holidays</h3>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Automatically fetch official holidays for any country using ISO 3166-1 codes.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Country Code</Label>
                <Input value={countryCode} onChange={e => setCountryCode(e.target.value.toUpperCase())} placeholder="IN, US, GB..." />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase">Year</Label>
                <Input type="number" value={year} onChange={e => setYear(parseInt(e.target.value))} />
              </div>
            </div>
            <Button variant="outline" className="w-full gap-2" onClick={fetchPublicHolidays}>
              <Download className="h-4 w-4" /> Fetch & Import
            </Button>
            <div className="text-[10px] text-center text-muted-foreground">Powered by Google Calendar API</div>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border bg-card shadow-card overflow-hidden">
        <div className="border-b p-4 flex items-center justify-between">
           <h3 className="font-semibold flex items-center gap-2"><CalendarIcon className="h-4 w-4" /> Holiday List</h3>
           <span className="text-xs text-muted-foreground">{holidays.length} holidays configured</span>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sticky top-0">
              <tr>
                <th className="px-5 py-3">Holiday</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Scope</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {holidays.map(h => (
                <tr key={h.id} className="border-t hover:bg-accent/30">
                  <td className="px-5 py-3 flex items-center gap-2 font-medium"><PartyPopper className="h-3 w-3 text-holiday" /> {h.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{h.date}</td>
                  <td className="px-5 py-3">
                     <span className="flex items-center gap-1.5">
                       {h.branch_id ? <MapPin className="h-3 w-3 text-primary" /> : <Globe className="h-3 w-3 text-muted-foreground" />}
                       {h.region}
                     </span>
                  </td>
                  <td className="px-5 py-3"><span className="text-[10px] font-bold uppercase">{h.kind}</span></td>
                  <td className="px-5 py-3 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteH(h.id)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
