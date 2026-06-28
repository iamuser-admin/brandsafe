import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect("/");
  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <LoginForm />
    </div>
  );
}
