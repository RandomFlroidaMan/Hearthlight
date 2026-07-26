import Link from "next/link";

/**
 * DM screen — private: notes, DCs, story steering controls. Never shown on
 * the story screen. Live dual-screen sync (Phase 6) is still to come; each
 * screen currently reads its own state per page load.
 */
export default function DmScreen() {
  return (
    <div className="flex flex-1 flex-col gap-4 bg-zinc-950 p-8 text-zinc-50">
      <h1 className="text-xl font-semibold">DM screen</h1>
      <p className="max-w-md text-sm text-zinc-400">
        Live dual-screen sync lands in Phase 6 — for now each screen reads
        its own state per page load.
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
