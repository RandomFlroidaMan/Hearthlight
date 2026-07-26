import Link from "next/link";

/**
 * DM screen — private: notes, DCs, story steering controls. Never shown on
 * the story screen. Most of this is still a placeholder; character
 * management (Phase 2) and the art pipeline (Phase 3) are the first real
 * features to land here.
 */
export default function DmScreen() {
  return (
    <div className="flex flex-1 flex-col gap-4 bg-zinc-950 p-8 text-zinc-50">
      <h1 className="text-xl font-semibold">DM screen</h1>
      <p className="max-w-md text-sm text-zinc-400">
        Story steering and DCs land here in later phases (story engine in
        Phase 4, dice in Phase 5).
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dm/characters"
          className="w-fit rounded-full bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
        >
          Character library
        </Link>
        <Link
          href="/dm/settings"
          className="w-fit rounded-full bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
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
