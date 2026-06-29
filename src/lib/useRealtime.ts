"use client";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Subscribe to live database changes on the given tables and re-run onChange.
// Makes every page update instantly across all devices.
export function useRealtime(tables: string[], onChange: () => void) {
  useEffect(() => {
    const ch = supabase.channel("rt-" + tables.join("-") + "-" + Math.random().toString(36).slice(2));
    tables.forEach((t) =>
      ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => onChange())
    );
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
