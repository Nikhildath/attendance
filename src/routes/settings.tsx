import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { User, Building2, Bell, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings-context";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { exportToCSV, parseCSV } from "@/lib/csv-utils";
import { Avatar2D } from "@/components/common/Avatar2D";
import { StatusBadge } from "@/components/common/StatusBadge";

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
  const { profile, refreshProfile } = useAuth();
  const { settings, refresh: refreshSettings } = useSettings();
  const [saving, setSaving] = useState(false);
  
  // Local state for forms
  const [formData, setFormData] = useState<any>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name,
        email: profile.email,
        dept: profile.dept || "",
        phone: (profile as any).phone || "",
        location: (profile as any).location || "",
        ...settings
      });
    }
  }, [profile, settings]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    
    // Update Profile
    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        name: formData.name,
        dept: formData.dept,
      })
      .eq("id", profile.id);
    
    if (pErr) toast.error("Profile update failed: " + pErr.message);
    else {
      await refreshProfile();
      toast.success("Profile updated");
    }

    // Update Global Settings if Admin
    if (profile.role === "Admin") {
        const { error: sErr } = await supabase
          .from("organisation_settings")
          .update({
            company_name: formData.company_name,
            late_threshold_mins: formData.late_threshold_mins,
            late_fine_amount: formData.late_fine_amount,
            working_hours_per_day: formData.working_hours_per_day
          })
          .eq("id", 1);
       
       if (!sErr) {
          refreshSettings();
          toast.success("Organisation settings updated");
       }
    }

    setSaving(false);
  };

  if (!formData) return null;

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
          {tab === "profile" && <ProfileSettings data={formData} onChange={(d) => setFormData({...formData, ...d})} />}
          {tab === "work" && <WorkSettings data={formData} onChange={(d) => setFormData({...formData, ...d})} isAdmin={profile?.role === "Admin"} />}
          {tab === "system" && <SystemSettings isAdmin={profile?.role === "Admin"} />}

          <div className="mt-6 flex justify-end border-t pt-5">
            <button 
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-elegant disabled:opacity-50"
            >
              <Save className={cn("h-4 w-4", saving && "animate-spin")} />
              {saving ? "Saving..." : "Save Changes"}
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

function ProfileSettings({ data, onChange }: { data: any; onChange: (d: any) => void }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">Profile</h2>
      <p className="text-xs text-muted-foreground">Personal details visible across Attendly</p>

      <div className="mt-5 flex items-center gap-4 rounded-lg border bg-background/40 p-4">
        <Avatar2D name={data.name} size={64} />
        <div>
          <div className="text-sm font-semibold">{data.name}</div>
          <div className="text-xs text-muted-foreground">{data.role || "Staff"} · {data.company_name || "Attendly"}</div>
          <button className="mt-2 text-xs font-medium text-primary hover:underline cursor-not-allowed opacity-50">Change avatar (Coming soon)</button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Full Name">
          <input 
            className={inputClass} 
            value={data.name} 
            onChange={e => onChange({ name: e.target.value })} 
          />
        </Field>
        <Field label="Email">
          <input 
            className={cn(inputClass, "opacity-60")} 
            type="email" 
            value={data.email} 
            readOnly 
          />
        </Field>
        <Field label="Department">
          <input 
            className={inputClass} 
            value={data.dept} 
            onChange={e => onChange({ dept: e.target.value })} 
          />
        </Field>
        <Field label="Staff ID">
          <input 
            className={cn(inputClass, "opacity-60 font-mono")} 
            value={`ATD-${data.name?.split(' ')[0].toUpperCase()}`} 
            readOnly 
          />
        </Field>
      </div>
    </div>
  );
}

function WorkSettings({ data, onChange, isAdmin }: { data: any; onChange: (d: any) => void; isAdmin: boolean }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">Organisation & Schedule</h2>
      <p className="text-xs text-muted-foreground">Global configuration for your workplace</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label="Company Name">
          <input 
            className={inputClass} 
            value={data.company_name} 
            onChange={e => onChange({ company_name: e.target.value })}
            readOnly={!isAdmin}
          />
        </Field>
        <Field label="Late Threshold (Minutes)">
          <input 
            className={inputClass} 
            type="number" 
            value={data.late_threshold_mins} 
            onChange={e => onChange({ late_threshold_mins: parseInt(e.target.value) })}
            readOnly={!isAdmin}
          />
        </Field>
        <Field label="Late Fine Amount (per instance)">
          <input 
            className={inputClass} 
            type="number" 
            value={data.late_fine_amount} 
            onChange={e => onChange({ late_fine_amount: parseFloat(e.target.value) })}
            readOnly={!isAdmin}
          />
        </Field>
        <Field label="Working Hours per Day">
          <input 
            className={inputClass} 
            type="number" 
            value={data.working_hours_per_day} 
            onChange={e => onChange({ working_hours_per_day: parseFloat(e.target.value) })}
            readOnly={!isAdmin}
          />
        </Field>
        <Field label="Timezone">
          <input 
            className={cn(inputClass, "opacity-60")} 
            value={data.timezone} 
            readOnly 
          />
        </Field>
      </div>

      {!isAdmin && (
        <p className="mt-4 text-[10px] text-muted-foreground italic">
          * Only administrators can change global organisation settings.
        </p>
      )}

      <div className="mt-6 space-y-3 opacity-50 pointer-events-none">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Coming Soon</div>
        <Toggle label="Auto check-out at end of day" defaultChecked />
        <Toggle label="Allow remote check-in" defaultChecked />
        <Toggle label="Require face recognition" />
      </div>
    </div>
  );
}

function SystemSettings({ isAdmin }: { isAdmin: boolean }) {
  const ALL_TABLES = [
    "branches", "profiles", "organisation_settings", "shifts", 
    "shift_schedule", "attendance", "leave_categories", "leaves", "company_holidays", 
    "payslips", "comp_off_requests", "financial_requests", "staff_tracking"
  ];

  const handleFullBackup = async () => {
    toast.info("Starting full system backup...");
    try {
      const backup: Record<string, any[]> = {};
      
      for (const table of ALL_TABLES) {
        const { data, error } = await supabase.from(table).select("*");
        if (error) throw error;
        backup[table] = data || [];
      }

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendly_full_backup_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      toast.success("Full backup downloaded successfully!");
    } catch (err: any) {
      toast.error("Full backup failed: " + err.message);
    }
  };

  const handleFullRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string);
        toast.info("Restoring all system tables...");

        // Restore in order to satisfy foreign keys (branches first, then profiles, then others)
        const order = [
          "branches", "profiles", "organisation_settings", "shifts",
          "shift_schedule", "attendance", "leave_categories", "leaves", "company_holidays",
          "payslips", "comp_off_requests", "financial_requests", "staff_tracking"
        ];

        for (const table of order) {
          if (backup[table] && backup[table].length > 0) {
            console.log(`Restoring ${table}...`);
            const { error } = await supabase.from(table).upsert(backup[table]);
            if (error) {
               console.error(`Error restoring ${table}:`, error);
               toast.error(`Error in ${table}: ${error.message}`);
            }
          }
        }

        toast.success("Full system restore complete!");
        setTimeout(() => window.location.reload(), 2000);
      } catch (err: any) {
        toast.error("Restore failed: Invalid backup file format.");
      }
    };
    reader.readAsText(file);
  };

  const handleWorkforceExport = async () => {
    toast.info("Generating workforce CSV...");
    const { data, error } = await supabase.from("profiles").select("*");
    if (error) return toast.error("Export failed: " + error.message);
    exportToCSV(data, "attendly_workforce_backup");
    toast.success("Workforce CSV downloaded!");
  };

  const handleWorkforceRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const data = parseCSV(text);
        if (data.length === 0) throw new Error("No data found in CSV");

        toast.info(`Restoring ${data.length} records...`);
        const { error } = await supabase.from("profiles").upsert(data);
        if (error) throw error;
        toast.success("Workforce restored!");
        setTimeout(() => window.location.reload(), 2000);
      } catch (err: any) {
        toast.error("Restore failed: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8">
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

      {isAdmin && (
        <div className="space-y-4">
            <div className="rounded-xl border border-primary/20 p-6 bg-primary/5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Full System Backup & Restore</h3>
                <p className="mt-1 text-xs text-muted-foreground">Download or restore ALL data (Attendance, Leaves, Settings, Profiles, Branches, etc.) in a single file.</p>
                
                <div className="mt-5 flex flex-wrap gap-4">
                    <button 
                        onClick={handleFullBackup}
                        className="inline-flex items-center gap-2 rounded-lg gradient-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-elegant"
                    >
                        Download Full Backup (JSON)
                    </button>
                    
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-5 py-2.5 text-sm font-bold hover:bg-accent shadow-sm">
                        Restore Full System
                        <input type="file" accept=".json" className="hidden" onChange={handleFullRestore} />
                    </label>
                </div>
            </div>

            <div className="rounded-xl border border-dashed p-6 bg-muted/20">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Workforce CSV Tools</h3>
                <p className="mt-1 text-xs text-muted-foreground">Export or Import the Employee list for use in Excel/Spreadsheets.</p>
                
                <div className="mt-4 flex flex-wrap gap-4">
                    <button 
                        onClick={handleWorkforceExport}
                        className="text-xs font-semibold text-primary hover:underline"
                    >
                        Export Workforce CSV
                    </button>
                    
                    <label className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                        Restore from CSV
                        <input type="file" accept=".csv" className="hidden" onChange={handleWorkforceRestore} />
                    </label>
                </div>
            </div>
        </div>
      )}
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
