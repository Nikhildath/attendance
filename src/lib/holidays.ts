import { useEffect, useState } from "react";

export type Holiday = { date: string; localName: string; name: string; countryCode: string };

const cache = new Map<string, Holiday[]>();

// Mapping of country codes to Google Calendar Holiday IDs
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

export function useHolidays(year: number, country = "IN") {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY;
    const calendarId = GOOGLE_CALENDAR_IDS[country] || GOOGLE_CALENDAR_IDS["IN"];
    const key = `${country}-${year}`;

    if (cache.has(key)) {
      setHolidays(cache.get(key)!);
      return;
    }

    if (!apiKey) {
      console.warn("VITE_GOOGLE_CALENDAR_API_KEY is missing. Using fallback holidays.");
      // Fallback for India if no API key
      if (country === "IN") {
          const fallback = [
            { date: `${year}-01-01`, localName: "New Year's Day", name: "New Year's Day", countryCode: "IN" },
            { date: `${year}-01-26`, localName: "Republic Day", name: "Republic Day", countryCode: "IN" },
            { date: `${year}-08-15`, localName: "Independence Day", name: "Independence Day", countryCode: "IN" },
            { date: `${year}-10-02`, localName: "Gandhi Jayanti", name: "Gandhi Jayanti", countryCode: "IN" },
            { date: `${year}-12-25`, localName: "Christmas Day", name: "Christmas Day", countryCode: "IN" },
          ];
          setHolidays(fallback);
      }
      return;
    }

    setLoading(true);
    const timeMin = new Date(year, 0, 1).toISOString();
    const timeMax = new Date(year, 11, 31).toISOString();
    
    fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data: any) => {
        const mapped: Holiday[] = (data.items || []).map((item: any) => ({
          date: item.start.date || item.start.dateTime.split("T")[0],
          localName: item.summary,
          name: item.summary,
          countryCode: country,
        }));
        
        // Sort by date
        mapped.sort((a, b) => a.date.localeCompare(b.date));
        
        cache.set(key, mapped);
        setHolidays(mapped);
      })
      .catch(() => setHolidays([]))
      .finally(() => setLoading(false));
  }, [year, country]);

  return { holidays, loading };
}

export function holidayOnDate(holidays: Holiday[], y: number, m: number, d: number) {
  const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return holidays.find((h) => h.date === iso);
}
