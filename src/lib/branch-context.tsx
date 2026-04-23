import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { supabase } from "./supabase";

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
};

const Ctx = createContext<BranchCtx | null>(null);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("branches")
        .select("*")
        .order("name");
      
      if (!error && data) {
        setBranches(data);
        if (data.length > 0 && !currentId) {
          setCurrentId(data[0].id);
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  const current = branches.find((b) => b.id === currentId) || null;

  return (
    <Ctx.Provider value={{ current, setCurrent: setCurrentId, all: branches, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBranch() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useBranch must be used inside BranchProvider");
  return ctx;
}
