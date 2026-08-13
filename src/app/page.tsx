import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentFamily } from "@/server/auth/session";
import { LogoutButton } from "@/components/LogoutButton";

/** A single metal corner bracket — an "L" of two rounded-cap arms
 * emanating from the corner point, like the reinforcing metal corners on
 * an old bound book. Reused for all four corners of the cover via CSS
 * transforms (mirroring/rotating one drawing rather than hand-placing
 * four separate paths). */
function CornerGuard({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 66 66"
      className={`corner-guard h-12 w-12 md:h-16 md:w-16 ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="cornerMetal" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f5dca3" />
          <stop offset="40%" stopColor="#a67c3d" />
          <stop offset="75%" stopColor="#6b4a1a" />
          <stop offset="100%" stopColor="#3d2a10" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="46" height="13" rx="6.5" fill="url(#cornerMetal)" />
      <rect x="4" y="4" width="13" height="46" rx="6.5" fill="url(#cornerMetal)" />
      <circle cx="15" cy="15" r="4.5" fill="#f5dca3" stroke="#2b1c0a" strokeWidth="1" />
    </svg>
  );
}

export default async function Home() {
  const family = await getCurrentFamily();
  if (!family) redirect("/login");

  return (
    <div className="book-cover relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden px-6 text-center text-zinc-50">
      <CornerGuard className="left-3 top-3" />
      <CornerGuard className="right-3 top-3 scale-x-[-1]" />
      <CornerGuard className="bottom-3 left-3 scale-y-[-1]" />
      <CornerGuard className="bottom-3 right-3 scale-x-[-1] scale-y-[-1]" />

      <div className="absolute right-6 top-6 flex items-center gap-4 text-sm text-amber-200/70">
        <span>{family.name}</span>
        <LogoutButton />
      </div>

      <div className="brass-plate relative flex flex-col items-center gap-6 px-10 py-12 md:px-16 md:py-14">
        <span className="plate-rivet" style={{ left: 10, top: 10 }} />
        <span className="plate-rivet" style={{ right: 10, top: 10 }} />
        <span className="plate-rivet" style={{ left: 10, bottom: 10 }} />
        <span className="plate-rivet" style={{ right: 10, bottom: 10 }} />

        <span aria-hidden="true" className="relative text-sm tracking-[0.3em] text-amber-900/70">
          ✦ ─────────── ✦
        </span>
        <h1 className="plate-title relative text-5xl font-black tracking-wide md:text-6xl">
          Hearthlight
        </h1>
        <p className="relative max-w-md text-lg text-amber-950/80">
          A family storytelling adventure — pick a story, build your party, and
          play together on one screen.
        </p>
        <div className="relative flex flex-wrap justify-center gap-4">
          <Link
            href="/play"
            className="rounded-full border border-amber-200/50 bg-gradient-to-b from-amber-100 to-amber-400 px-7 py-3 font-display font-semibold tracking-wide text-amber-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-2px_4px_rgba(120,70,10,0.4),0_4px_10px_rgba(0,0,0,0.35)] transition-transform hover:scale-105"
          >
            Play together
          </Link>
          <Link
            href="/dm"
            className="rounded-full border border-amber-900/50 bg-gradient-to-b from-[#3d2a10] to-[#241a0c] px-5 py-3 font-medium text-amber-100 shadow-[inset_0_1px_0_rgba(255,244,214,0.15),inset_0_-2px_4px_rgba(0,0,0,0.5)] transition-colors hover:from-[#4a3418]"
          >
            DM screen
          </Link>
          <Link
            href="/story"
            className="rounded-full border border-amber-900/50 bg-gradient-to-b from-[#3d2a10] to-[#241a0c] px-5 py-3 font-medium text-amber-100 shadow-[inset_0_1px_0_rgba(255,244,214,0.15),inset_0_-2px_4px_rgba(0,0,0,0.5)] transition-colors hover:from-[#4a3418]"
          >
            Story screen
          </Link>
        </div>
      </div>

      <p className="relative max-w-md text-xs text-amber-200/50">
        The DM and Story screens are the original two-device mode — a private
        operator screen synced live to a public one. Play together is a
        single shared screen for the whole family, no second device needed.
      </p>
    </div>
  );
}
