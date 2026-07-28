import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentFamily } from "@/server/auth/session";
import { LogoutButton } from "@/components/LogoutButton";

/**
 * DM screen — private: notes, DCs, story steering controls. Never shown on
 * the story screen.
 */
export default async function DmScreen() {
  const family = await getCurrentFamily();
  if (!family) redirect("/login");

  return (
    <div className="flex flex-1 flex-col gap-4 bg-zinc-950 p-8 text-zinc-50">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">DM screen</h1>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span>{family.name}</span>
          <LogoutButton />
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dm/campaigns/new"
          className="w-fit rounded-full bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
        >
          Start an adventure
        </Link>
        <Link
          href="/dm/characters"
          className="w-fit rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-900"
        >
          Character library
        </Link>
        <Link
          href="/dm/settings"
          className="w-fit rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-900"
        >
          World settings
        </Link>
        <Link
          href="/dm/art-test"
          className="w-fit rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-900"
        >
          Art consistency test
        </Link>
        <Link
          href="/dm/preferences"
          className="w-fit rounded-full border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-50 hover:bg-zinc-900"
        >
          Preferences
        </Link>
      </div>
    </div>
  );
}
