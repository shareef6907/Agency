import { createClient } from "@supabase/supabase-js";

// Server-only. Uses the service_role key — never import this into client components.
export function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Verify the caller's access token belongs to a CEO before allowing admin actions.
export async function requireCeo(accessToken: string | undefined) {
  if (!accessToken) return { ok: false, error: "Not signed in" };
  const admin = adminClient();
  const { data: userData, error } = await admin.auth.getUser(accessToken);
  if (error || !userData?.user) return { ok: false, error: "Invalid session" };
  const { data: profile } = await admin.from("profiles").select("role").eq("id", userData.user.id).single();
  if (profile?.role !== "ceo") return { ok: false, error: "Only the CEO can do this" };
  return { ok: true, admin };
}
