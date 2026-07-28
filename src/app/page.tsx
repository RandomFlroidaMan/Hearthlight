import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentFamily } from "@/server/auth/session";
import { LogoutButton } from "@/components/LogoutButton";

export default async function Home() {
  const family = await getCurrentFamily();
  if (!family) redirect("/login");

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden bg-zinc-950 px-6 text-center text-zinc-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_700px_420px_at_50%_15%,rgba(232,182,99,0.22),transparent_70%)]"
      />
      <div className="absolute right-6 top-6 flex items-center gap-4 text-sm text-zinc-400">
        <span>{family.name}</span>
        <LogoutButton />
      </div>
      <span aria-hidden="true" className="relative text-amber-400/70 text-sm tracking-[0.3em]">
        ✦ ─────────── ✦
      </span>
      <h1 className="relative text-5xl font-black tracking-wide text-amber-100 drop-shadow-[0_0_18px_rgba(232,182,99,0.35)]">
        Hearthlight
      </h1>
      <p className="relative max-w-md text-lg text-zinc-300">
        A family storytelling adventure — pick a story, build your party, and
        play together on one screen.
      </p>
      <div className="relative flex flex-wrap justify-center gap-4">
        <Link
          href="/play"
          className="rounded-full border border-amber-300/40 bg-gradient-to-b from-amber-200 to-amber-400 px-7 py-3 font-display font-semibold tracking-wide text-amber-950 shadow-[0_0_25px_rgba(232,182,99,0.35)] transition-transform hover:scale-105 hover:shadow-[0_0_35px_rgba(232,182,99,0.5)]"
        >
          ⚔ Play together
        </Link>
        <Link
          href="/dm"
          className="rounded-full border border-zinc-700 px-5 py-3 font-medium text-zinc-50 transition-colors hover:bg-zinc-900"
        >
          DM screen
        </Link>
        <Link
          href="/story"
          className="rounded-full border border-zinc-700 px-5 py-3 font-medium text-zinc-50 transition-colors hover:bg-zinc-900"
        >
          Story screen
        </Link>
      </div>
      <p className="relative max-w-md text-xs text-zinc-500">
        The DM and Story screens are the original two-device mode — a private
        operator screen synced live to a public one. Play together is a
        single shared screen for the whole family, no second device needed.
      </p>
    </div>
  );
}
