import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search, Trash2, Users, Shield, Building2, Copy, Check, MapPin, Settings as SettingsIcon, Save, PartyPopper } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Avatar2D } from "@/components/common/Avatar2D";
import { StatCard } from "@/components/common/StatCard";
import { useAuth, type Profile } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useSettings } from "@/lib/settings-context";
import { useBranch, type Branch } from "@/lib/branch-context";
import { HolidayManager } from "@/components/admin/HolidayManager";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Attendly" },
      { name: "description", content: "Admin view: user management, role assignment and system configuration." },
    ],
  }),
  component: AdminPage,
});

type Role = "Employee" | "Manager" | "Admin";

function AdminPage() {
  const { profile } = useAuth();
  const { settings, refresh: refreshSettings } = useSettings();
  const { all: allBranches, setCurrent: setGlobalBranch, refresh: refreshBranches } = useBranch();
  
  const [users, setUsers] = useState<Profile[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // Forms
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [newUser, setNewUser] = useState({ email: "", name: "", role: "Employee" as Role, dept: "", password: "" });
  
  const [isBranchOpen, setIsBranchOpen] = useState(false);
  const [newBranch, setNewBranch] = useState<Partial<Branch>>({ name: "", city: "", country: "India", radius_meters: 150 });

  const loadData = async () => {
    if (!profile?.id) return;
    setLoading(true);
    
    // Load Users via RPC
    const { data: userData, error: userError } = await supabase.rpc('admin_list_users', { caller_id: profile.id });
    if (userData) setUsers(userData);

    // Load Branches
    const { data: branchData } = await supabase.from("branches").select("*").order("name");
    if (branchData) setBranches(branchData);

    setLoading(false);
  };

  useEffect(() => {
    if (profile?.role === "Admin") {
      loadData();
    }
  }, [profile]);

  // --- User Actions ---
  const updateProfile = async (id: string, updates: Partial<Profile>) => {
    const user = users.find(u => u.id === id);
    if (!user) return;
    const { error } = await supabase.rpc('admin_update_profile', {
      caller_id: profile?.id,
      p_id: id,
      p_name: updates.name || user.name,
      p_role: updates.role || user.role,
      p_dept: updates.dept || user.dept || "",
      p_password: updates.password || user.password || "",
      p_face: updates.face_registered ?? user.face_registered ?? false,
      p_branch_id: updates.branch_id === undefined ? user.branch_id : updates.branch_id
    });
    if (!error) {
      toast.success("User updated");
      setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    }
  };

  const removeUser = async (id: string) => {
    if (id === profile?.id) return toast.error("Self-removal not allowed");
    if (!confirm("Remove this user?")) return;
    const { error } = await supabase.rpc('admin_delete_profile', { caller_id: profile?.id, p_id: id });
    if (!error) {
      toast.success("User removed");
      setUsers(prev => prev.filter(u => u.id !== id));
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.loading("Adding user...", { id: "user" });
    const { error } = await supabase.rpc('admin_insert_profile', {
      caller_id: profile?.id,
      p_id: crypto.randomUUID(),
      p_email: newUser.email,
      p_name: newUser.name,
      p_role: newUser.role,
      p_dept: newUser.dept,
      p_password: newUser.password || "123456",
    });
    if (!error) {
      toast.success("User added", { id: "user" });
      setIsInviteOpen(false);
      loadData();
    } else toast.error(error.message, { id: "user" });
  };

  // --- Branch Actions ---
  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranch.name || !newBranch.city || !newBranch.country) {
      toast.error("Please fill all required fields");
      return;
    }
    toast.loading("Adding branch...", { id: "branch" });
    const { error } = await supabase.from("branches").insert([{
      ...newBranch,
      id: crypto.randomUUID()
    }]);
    if (!error) {
      toast.success("Branch added", { id: "branch" });
      setIsBranchOpen(false);
      setNewBranch({ name: "", city: "", country: "India", radius_meters: 150 });
      await refreshBranches();
      loadData();
    } else {
      toast.error(error.message || "Failed to add branch", { id: "branch" });
    }
  };

  const removeBranch = async (id: string) => {
    if (!confirm("Delete this branch? This action cannot be undone.")) return;
    
    console.log("🗑️ Deleting branch:", id);
    console.log("👤 Current user:", profile?.id, "Role:", profile?.role);
    
    if (!profile?.id) {
      toast.error("❌ Not authenticated", { id: "branch-delete" });
      console.error("Not authenticated");
      return;
    }
    
    if (profile.role !== "Admin") {
      toast.error(`❌ Only admins can delete branches. Your role: ${profile.role}`, { id: "branch-delete" });
      console.error("User is not admin:", profile.role);
      return;
    }
    
    toast.loading("Deleting branch...", { id: "branch-delete" });
    
    try {
      console.log("📤 Sending delete request to Supabase...");
      
      // First try direct delete
      const { data, error } = await supabase
        .from("branches")
        .delete()
        .eq("id", id)
        .select();
      
      console.log("📥 Response:", { data, error });
      
      if (error) {
        console.error("❌ Delete error:", error);
        const errorMsg = error.message || error.details || "Unknown error";
        toast.error(`Failed to delete: ${errorMsg}`, { id: "branch-delete" });
        return;
      }
      
      console.log("✅ Delete successful");
      toast.success("✅ Branch removed", { id: "branch-delete" });
      setBranches(prev => prev.filter(b => b.id !== id));
      await refreshBranches();
    } catch (err) {
      console.error("❌ Delete exception:", err);
      toast.error(`Error: ${err instanceof Error ? err.message : "Unknown error"}`, { id: "branch-delete" });
    }
  };

  // --- Settings Actions ---
  const [tempSettings, setTempSettings] = useState(settings);
  useEffect(() => { if (settings) setTempSettings(settings); }, [settings]);

  const saveSettings = async () => {
    if (!tempSettings) return;
    const { error } = await supabase
      .from("organisation_settings")
      .update(tempSettings)
      .eq("id", 1);
    
    if (!error) {
      toast.success("Settings saved");
      refreshSettings();
    } else toast.error(error.message);
  };

  if (!profile) return <div className="p-10 text-center text-muted-foreground">Loading...</div>;

  if (profile.role !== "Admin") {
    return (
      <div className="rounded-xl border bg-card p-10 text-center shadow-card">
        <Shield className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Admin Access Required</h2>
        <p className="mt-2 text-muted-foreground">Only administrators can manage system settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Console"
        subtitle="Manage users, branches and organisation-wide configuration"
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Users" value={users.length} icon={Users} tone="default" />
        <StatCard label="Branches" value={branches.length} icon={Building2} tone="success" />
        <StatCard label="Currency" value={settings?.default_currency || "INR"} icon={Check} tone="info" />
        <StatCard label="Holidays" value={users.length > 0 ? "Configured" : "None"} icon={PartyPopper} tone="default" />
        <StatCard label="Admins" value={users.filter((u) => u.role === "Admin").length} icon={Shield} tone="warning" />
      </div>

      <Tabs defaultValue="users" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" /> Users</TabsTrigger>
          <TabsTrigger value="branches" className="gap-2"><Building2 className="h-4 w-4" /> Branches</TabsTrigger>
          <TabsTrigger value="holidays" className="gap-2"><PartyPopper className="h-4 w-4" /> Holidays</TabsTrigger>
          <TabsTrigger value="settings" className="gap-2"><SettingsIcon className="h-4 w-4" /> Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <div className="rounded-xl border bg-card shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
              <div className="relative flex-1 max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search users…"
                  className="pl-9"
                />
              </div>
              <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 gradient-primary shadow-elegant">
                    <Plus className="h-4 w-4" /> Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>Create a profile with a custom password.</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddUser} className="space-y-4 py-4">
                    <div className="space-y-2"><Label>Email</Label><Input type="email" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Full Name</Label><Input required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} /></div>
                    <div className="space-y-2"><Label>Password</Label><Input required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <select className="flex h-10 w-full rounded-md border bg-background px-3" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as Role})}>
                          <option value="Employee">Employee</option>
                          <option value="Manager">Manager</option>
                          <option value="Admin">Admin</option>
                        </select>
                      </div>
                      <div className="space-y-2"><Label>Department</Label><Input value={newUser.dept} onChange={e => setNewUser({...newUser, dept: e.target.value})} /></div>
                    </div>
                    <Button type="submit" className="w-full">Create Profile</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3 text-center">Password</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Branch</th>
                    <th className="px-5 py-3">Dept</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => u.name?.toLowerCase().includes(q.toLowerCase())).map(u => (
                    <tr key={u.id} className="border-t hover:bg-accent/30">
                      <td className="px-5 py-3 flex items-center gap-3">
                        <Avatar2D name={u.name} size={32} /> 
                        <Input 
                          className="h-8 w-32 text-xs" 
                          value={u.name} 
                          onChange={e => updateProfile(u.id, { name: e.target.value })} 
                        />
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-5 py-3 text-center">
                        <Input 
                          className="h-8 w-24 mx-auto text-xs" 
                          value={u.password || ""} 
                          onChange={e => updateProfile(u.id, { password: e.target.value })} 
                        />
                      </td>
                      <td className="px-5 py-3">
                        <select className="h-8 rounded border bg-background px-2 text-xs" value={u.role} onChange={e => updateProfile(u.id, { role: e.target.value as Role })}>
                          <option value="Employee">Employee</option>
                          <option value="Manager">Manager</option>
                          <option value="Admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        <select 
                          className="h-8 rounded border bg-background px-2 text-xs w-32" 
                          value={u.branch_id || ""} 
                          onChange={e => updateProfile(u.id, { branch_id: e.target.value || null })}
                        >
                          <option value="">No Branch</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3">
                        <Input 
                          className="h-8 w-24 text-xs" 
                          value={u.dept || ""} 
                          onChange={e => updateProfile(u.id, { dept: e.target.value })}
                          placeholder="Dept"
                        />
                      </td>
                      <td className="px-5 py-3 text-right"><Button variant="ghost" size="icon" onClick={() => removeUser(u.id)} className="text-destructive"><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="branches">
          <div className="rounded-xl border bg-card shadow-card">
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-lg font-semibold">Branch Locations</h2>
              <Dialog open={isBranchOpen} onOpenChange={setIsBranchOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2 gradient-primary shadow-elegant"><Plus className="h-4 w-4" /> Add Branch</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Branch</DialogTitle></DialogHeader>
                  <form onSubmit={handleAddBranch} className="space-y-4 py-4">
                    <div className="space-y-2"><Label>Branch Name</Label><Input required value={newBranch.name} onChange={e => setNewBranch({...newBranch, name: e.target.value})} placeholder="HQ / Mumbai Branch" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>City</Label><Input required value={newBranch.city} onChange={e => setNewBranch({...newBranch, city: e.target.value})} /></div>
                      <div className="space-y-2"><Label>Country</Label><Input required value={newBranch.country} onChange={e => setNewBranch({...newBranch, country: e.target.value})} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label>Latitude</Label><Input type="number" step="any" value={newBranch.lat} onChange={e => setNewBranch({...newBranch, lat: parseFloat(e.target.value)})} /></div>
                      <div className="space-y-2"><Label>Longitude</Label><Input type="number" step="any" value={newBranch.lng} onChange={e => setNewBranch({...newBranch, lng: parseFloat(e.target.value)})} /></div>
                    </div>
                    <div className="space-y-2"><Label>Geofence Radius (meters)</Label><Input type="number" value={newBranch.radius_meters} onChange={e => setNewBranch({...newBranch, radius_meters: parseInt(e.target.value)})} /></div>
                    <Button type="submit" className="w-full">Create Branch</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-2 lg:grid-cols-3">
              {branches.map(b => (
                <div key={b.id} className="relative rounded-xl border bg-background/50 p-4 transition-all hover:border-primary/50">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{b.name}</h3>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeBranch(b.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                    <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {b.city}, {b.country}</div>
                    <div className="flex items-center gap-2"><Users className="h-4 w-4" /> {b.active_staff_count || 0} active / {b.total_staff_count ?? b.employees_count ?? 0} total</div>
                    {b.lat && <div className="text-[10px] font-mono mt-2 bg-muted p-1 rounded">LOC: {b.lat.toFixed(4)}, {b.lng?.toFixed(4)}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="holidays">
           <HolidayManager branches={branches} />
        </TabsContent>

        <TabsContent value="settings">
          <div className="rounded-xl border bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold mb-6">Organisation Settings</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2"><Label>Company Name</Label><Input value={tempSettings?.company_name} onChange={e => setTempSettings(s => s ? {...s, company_name: e.target.value} : null)} /></div>
                <div className="space-y-2"><Label>Default Currency</Label><Input value={tempSettings?.default_currency} onChange={e => setTempSettings(s => s ? {...s, default_currency: e.target.value} : null)} /></div>
                <div className="space-y-2"><Label>Timezone</Label><Input value={tempSettings?.timezone} onChange={e => setTempSettings(s => s ? {...s, timezone: e.target.value} : null)} /></div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2"><Label>Late Threshold (Minutes)</Label><Input type="number" value={tempSettings?.late_threshold_mins} onChange={e => setTempSettings(s => s ? {...s, late_threshold_mins: parseInt(e.target.value)} : null)} /></div>
                <div className="space-y-2"><Label>Working Hours per Day</Label><Input type="number" step="0.5" value={tempSettings?.working_hours_per_day} onChange={e => setTempSettings(s => s ? {...s, working_hours_per_day: parseFloat(e.target.value)} : null)} /></div>
                <div className="space-y-2"><Label>Fiscal Year Start</Label><Input type="date" value={tempSettings?.fiscal_year_start} onChange={e => setTempSettings(s => s ? {...s, fiscal_year_start: e.target.value} : null)} /></div>
              </div>
            </div>
            <div className="mt-8 pt-6 border-t flex justify-end">
              <Button className="gap-2" onClick={saveSettings}><Save className="h-4 w-4" /> Save Changes</Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
