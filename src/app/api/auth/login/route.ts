import { NextResponse } from "next/server";
import { setSessionUser } from "@/lib/session";

export async function POST(req: Request) {
  const { email } = (await req.json().catch(() => ({}))) as { email?: string };
  const user = (email && email.trim()) || "manager@brandsafe.demo";
  await setSessionUser(user);
  return NextResponse.json({ ok: true, user });
}
