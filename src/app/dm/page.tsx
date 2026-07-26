/**
 * DM screen — private: notes, DCs, story steering controls. Never shown on
 * the story screen. Real content lands in later phases; this proves the
 * App Router split renders.
 */
export default function DmScreen() {
  return (
    <div className="flex flex-1 flex-col gap-4 bg-zinc-950 p-8 text-zinc-50">
      <h1 className="text-xl font-semibold">DM screen</h1>
      <p className="max-w-md text-sm text-zinc-400">
        Private controls, DCs, and story steering land here in later phases
        (character creation in Phase 2, story engine in Phase 4).
      </p>
    </div>
  );
}
