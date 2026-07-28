import { redirect } from "next/navigation";
import { getCurrentFamily } from "@/server/auth/session";
import { FamilyAuthForm } from "@/components/FamilyAuthForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const family = await getCurrentFamily();
  if (family) redirect("/");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-950 px-6 text-center text-zinc-50">
      <h1 className="text-3xl font-black tracking-wide text-amber-100">Hearthlight</h1>
      <p className="max-w-sm text-zinc-400">
        Every family shares one simple login — a name and a code everyone in the
        household knows.
      </p>
      <FamilyAuthForm />
    </div>
  );
}
