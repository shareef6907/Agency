import { NextRequest, NextResponse } from "next/server";
import { requireCeo } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const check = await requireCeo(token);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 403 });

  const { email, password, full_name, role } = await req.json();
  if (!email || !password || !full_name || !role)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { data, error } = await check.admin!.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, role },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data.user?.id });
}
