/**
 * Story screen — art and choices only, legible from across a room. No
 * mechanics, no spoilers. Real content lands in later phases; this proves
 * the App Router split renders.
 */
export default function StoryScreen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-950 p-8 text-center text-zinc-50">
      <h1 className="text-2xl font-semibold">Story screen</h1>
      <p className="max-w-md text-zinc-400">
        Full-bleed illustration and choices land here starting in Phase 3
        (art pipeline) and Phase 4 (story engine).
      </p>
    </div>
  );
}
