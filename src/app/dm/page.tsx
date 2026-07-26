import Link from "next/link";

/**
 * DM screen — private: notes, DCs, story steering controls. Never shown on
 * the story screen. Dice (Phase 5) and dual-screen sync (Phase 6) are still
 * to come; choices currently auto-resolve as success.
 */
export default function DmScreen() {
  return (
    <div className="flex flex-1 flex-col gap-4 bg-zinc-950 p-8 text-zinc-50">
      <h1 className="text-xl font-semibold">DM screen</h1>
      <p className="max-w-md text-sm text-zinc-400">
        Real dice resolution lands in Phase 5; live dual-screen sync in
        Phase 6.
      </p>
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
      </div>
    </div>
  );
}
