import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { Avatar2D } from "@/components/common/Avatar2D";
import { User, Building2, Bell, Save } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Attendly" },
      { name: "description", content: "Manage your profile, work hours and system preferences." },
    ],
  }),
  component: SettingsPage,
});

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "work", label: "Work", icon: Building2 },
  { id: "system", label: "System", icon: Bell },
] as const;

function SettingsPage() {
  const [tab, setTab] = useState<typeof tabs[number]["id"]>("profile");

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your profile, work hours and system preferences" />

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <nav className="space-y-1 rounded-xl border bg-card p-2 shadow-card">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="rounded-xl border bg-card p-6 shadow-card">
          {tab === "profile" && <ProfileSettings />}
          {tab === "work" && <WorkSettings />}
          {tab === "system" && <SystemSettings />}

          <div className="mt-6 flex justify-end border-t pt-5">
            <button className="inline-flex items-center gap-2 rounded-lg gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant">
              <Save className="h-4 w-4" /> Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputClass = "h-10 w-full rounded-lg border bg-background px-3 text-sm";

function ProfileSettings() {
  return (
    <div>
      <h2 className="text-lg font-semibold">Profile</h2>
      <p className="text-xs text-muted-foreground">Personal details visible across Attendly</p>

      <div className="mt-5 flex items-center gap-4 rounded-lg border bg-background/40 p-4">
        <Avatar2D name="Alex Morgan" size={64} />
        <div>
          <div className="text-sm font-semibold">Alex Morgan</div>
          <div className="text-xs text-muted-foreground">Engineer · Acme Inc.</div>
          <button className="mt-2 text-xs font-medium text-primary hover:underline">Change avatar</button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Full Name"><input className={inputClass} defaultValue="Alex Morgan" /></Field>
        <Field label="Email"><input className={inputClass} type="email" defaultValue="alex@acme.co" /></Field>
        <Field label="Phone"><input className={inputClass} defaultValue="+1 555 0142" /></Field>
        <Field label="Location"><input className={inputClass} defaultValue="San Francisco, CA" /></Field>
      </div>
    </div>
  );
}

function WorkSettings() {
  return (
    <div>
      <h2 className="text-lg font-semibold">Work</h2>
      <p className="text-xs text-muted-foreground">Configure working hours and schedule</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Start Time"><input className={inputClass} type="time" defaultValue="09:00" /></Field>
        <Field label="End Time"><input className={inputClass} type="time" defaultValue="18:00" /></Field>
        <Field label="Timezone">
          <select className={inputClass} defaultValue="PST">
            <option>PST</option><option>EST</option><option>UTC</option><option>IST</option>
          </select>
        </Field>
        <Field label="Working Days"><input className={inputClass} defaultValue="Mon – Fri" /></Field>
      </div>

      <div className="mt-5 space-y-3">
        <Toggle label="Auto check-out at end of day" defaultChecked />
        <Toggle label="Allow remote check-in" defaultChecked />
        <Toggle label="Require face recognition" />
      </div>
    </div>
  );
}

function SystemSettings() {
  return (
    <div>
      <h2 className="text-lg font-semibold">System</h2>
      <p className="text-xs text-muted-foreground">Notifications and app preferences</p>

      <div className="mt-5 space-y-3">
        <Toggle label="Email notifications" defaultChecked />
        <Toggle label="Push notifications" defaultChecked />
        <Toggle label="Weekly attendance summary" />
        <Toggle label="Leave approval alerts" defaultChecked />
        <Toggle label="Reduce motion" />
      </div>
    </div>
  );
}

function Toggle({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <div className="flex items-center justify-between rounded-lg border bg-background/40 p-4">
      <span className="text-sm">{label}</span>
      <button
        onClick={() => setOn(!on)}
        className={cn(
          "relative h-6 w-11 rounded-full transition-colors",
          on ? "gradient-primary" : "bg-muted"
        )}
      >
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", on ? "left-[22px]" : "left-0.5")} />
      </button>
    </div>
  );
}
