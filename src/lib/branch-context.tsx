import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";

export type Branch = {
  id: string;
  name: string;
  city: string;
  country: string;
  lat?: number;
  lng?: number;
  radius_meters?: number;
  employees_count?: number;
  currency?: string;
  timezone?: string;
};

type BranchCtx = {
  current: Branch | null;
  setCurrent: (id: string) => void;
  all: Branch[];
  loading: boolean;
  refresh: () => Promise<void>;
};

const Ctx = createContext<BranchCtx | null>(null);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBranches = async (userBranchId?: string | null) => {
    const { data, error } = await supabase
      .from("branches")
      .select("*")
      .order("name");
    
    if (!error && data) {
      setBranches(data);
      if (userBranchId) {
        setCurrentId(userBranchId);
      } else if (data.length > 0 && !currentId) {
        setCurrentId(data[0].id);
      }
    }
    setLoading(false);
  };

  const { profile } = useAuth();

  useEffect(() => {
    loadBranches(profile?.branch_id);
    
    // Subscribe to realtime branch changes
    const channel = supabase
      .channel('branches_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'branches' },
        () => loadBranches(profile?.branch_id)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.branch_id]);

  const current = branches.find((b) => b.id === currentId) || null;

  return (
    <Ctx.Provider value={{ current, setCurrent: setCurrentId, all: branches, loading, refresh: loadBranches }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBranch must be used inside BranchProvider");
  return ctx;
}
