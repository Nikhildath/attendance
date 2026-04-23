import { useEffect, useState } from "react";

export type Holiday = { date: string; localName: string; name: string; countryCode: string };

const cache = new Map<string, Holiday[]>();

export function useHolidays(year: number, country = "US") {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const key = `${country}-${year}`;
    if (cache.has(key)) {
      setHolidays(cache.get(key)!);
      return;
    }
    setLoading(true);
    fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Holiday[]) => {
        cache.set(key, data);
        setHolidays(data);
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
