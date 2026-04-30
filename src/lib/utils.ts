import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isWeekend(date: Date, type: string = 'second_saturday_sundays') {
  const day = date.getDay();
  const dateNum = date.getDate();
  
  // Sunday is always a weekend
  if (day === 0) return true;
  
  if (type === 'second_saturday_sundays') {
    // Second Saturday only (Day 8 to 14 of the month)
    return day === 6 && dateNum > 7 && dateNum <= 14;
  }
  
  if (type === 'all_saturdays_sundays') {
    return day === 6 || day === 0;
  }

  if (type === 'only_sundays') {
    return day === 0;
  }
  
  return false;
}
