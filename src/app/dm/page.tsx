import Link from "next/link";

/**
 * DM screen — private: notes, DCs, story steering controls. Never shown on
 * the story screen. Most of this is still a placeholder; character
 * management (Phase 2) is the first real feature to land here.
 */
export default function DmScreen() {
  return (
    <div className="flex flex-1 flex-col gap-4 bg-zinc-950 p-8 text-zinc-50">
      <h1 className="text-xl font-semibold">DM screen</h1>
      <p className="max-w-md text-sm text-zinc-400">
        Story steering and DCs land here in later phases (story engine in
        Phase 4, dice in Phase 5).
      </p>
      <Link
        href="/dm/characters"
        className="w-fit rounded-full bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
      >
        Character library
      </Link>
    </div>
  );
}
