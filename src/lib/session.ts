import { cookies } from "next/headers";

/** Mock auth: a single cookie holding the signed-in manager's email. */
const COOKIE = "brandsafe_user";

export async function getSessionUser(): Promise<string | null> {
  const store = await cookies();
  return store.get(COOKIE)?.value ?? null;
}

export async function setSessionUser(email: string) {
  const store = await cookies();
  store.set(COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionUser() {
  const store = await cookies();
  store.delete(COOKIE);
}
