import { useEffect, useState } from "react";

export function HeroBanner({ name }: { name: string }) {
  const [info, setInfo] = useState<{ greet: string; dateStr: string } | null>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const dateStr = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    setInfo({ greet, dateStr });
  }, []);

  const greet = info?.greet ?? "Hello";
  const dateStr = info?.dateStr ?? "";

  return (
    <div className="relative overflow-hidden rounded-[2rem] gradient-hero p-8 text-primary-foreground shadow-elegant md:p-12 transition-transform hover:scale-[1.01] duration-500">
      <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            {dateStr}
          </div>
          <h1 className="text-4xl font-black tracking-tighter md:text-5xl">
            {greet}, {name} 👋
          </h1>
          <p className="max-w-xl text-lg font-medium opacity-90 leading-relaxed">
            You've maintained a <strong className="text-white underline underline-offset-4 decoration-2">96% attendance rate</strong> this month. Keep the streak alive — mark your attendance to start the day.
          </p>
        </div>
        <div className="hidden lg:block scale-125 translate-x-4">
          <Illustration />
        </div>
      </div>
      <div className="pointer-events-none absolute -right-10 -top-10 h-80 w-80 rounded-full bg-white/20 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-primary-glow/20 blur-[80px]" />
    </div>
  );
}

function Illustration() {
  return (
    <svg width="180" height="140" viewBox="0 0 180 140" fill="none">
      <rect x="20" y="30" width="140" height="90" rx="12" fill="white" fillOpacity="0.15" />
      <rect x="32" y="44" width="60" height="8" rx="4" fill="white" fillOpacity="0.5" />
      <rect x="32" y="58" width="40" height="6" rx="3" fill="white" fillOpacity="0.3" />
      <circle cx="130" cy="78" r="22" fill="white" fillOpacity="0.25" />
      <path d="M120 78l8 8 14-16" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="32" y="92" width="80" height="6" rx="3" fill="white" fillOpacity="0.35" />
      <rect x="32" y="104" width="50" height="6" rx="3" fill="white" fillOpacity="0.25" />
    </svg>
  );
}

export function EmptyIllustration({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 p-10 text-center">
      <svg width="120" height="100" viewBox="0 0 120 100" fill="none">
        <rect x="15" y="20" width="90" height="65" rx="10" fill="oklch(0.55 0.18 260 / 0.1)" />
        <rect x="28" y="36" width="50" height="6" rx="3" fill="oklch(0.55 0.18 260 / 0.4)" />
        <rect x="28" y="48" width="35" height="6" rx="3" fill="oklch(0.55 0.18 260 / 0.25)" />
        <circle cx="85" cy="60" r="12" fill="oklch(0.6 0.2 305 / 0.3)" />
      </svg>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
