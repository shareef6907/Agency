import { NextRequest, NextResponse } from "next/server";
import { requireCeo } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  const check = await requireCeo(token);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 403 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // don't allow the CEO to delete their own account
  const { data: userData } = await check.admin!.auth.getUser(token!);
  if (userData?.user?.id === id)
    return NextResponse.json({ error: "You can't delete your own account." }, { status: 400 });

  // deleting the auth user cascades and removes their profile row
  const { error } = await check.admin!.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
