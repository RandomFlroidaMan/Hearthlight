"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CopyCharacterButton({ characterId }: { characterId: string }) {
  const [copying, setCopying] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  async function handleCopy() {
    setCopying(true);
    const res = await fetch(`/api/characters/${characterId}/copy`, { method: "POST" });
    setCopying(false);
    if (res.ok) {
      setDone(true);
      router.refresh();
    }
  }

  if (done) {
    return <span className="text-xs text-emerald-400">Copied to your library ✓</span>;
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={copying}
      className="rounded-full border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-50"
    >
      {copying ? "Copying…" : "Copy to my family"}
    </button>
  );
}
