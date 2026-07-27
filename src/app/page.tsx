import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-950 px-6 text-center text-zinc-50">
      <h1 className="text-3xl font-semibold tracking-tight">Hearthlight</h1>
      <p className="max-w-md text-zinc-400">
        A family storytelling adventure — pick a story, build your party, and
        play together on one screen.
      </p>
      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href="/play"
          className="rounded-full bg-zinc-50 px-5 py-3 font-medium text-zinc-950 transition-colors hover:bg-zinc-200"
        >
          Play together
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
      <p className="max-w-md text-xs text-zinc-600">
        The DM and Story screens are the original two-device mode — a private
        operator screen synced live to a public one. Play together is a
        single shared screen for the whole family, no second device needed.
      </p>
    </div>
  );
}
