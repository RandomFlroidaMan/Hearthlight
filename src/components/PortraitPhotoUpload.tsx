"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadPortraitPhoto } from "@/lib/uploadPortraitPhoto";

/** A small "upload a photo" action for one character's row in the library —
 * generates (or replaces) that character's portrait from a real photo of a
 * kid or pet instead of the from-scratch text description. */
export function PortraitPhotoUpload({ characterId, hasPortrait }: { characterId: string; hasPortrait: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    const result = await uploadPortraitPhoto(characterId, file);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";

    if (!result.ok) {
      setError(result.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="cursor-pointer rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800">
        {uploading ? "Making portrait…" : hasPortrait ? "Replace with photo" : "Upload a photo"}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleChange}
          disabled={uploading}
          className="hidden"
        />
      </label>
      {error && <p className="max-w-40 text-right text-xs text-red-400">{error}</p>}
    </div>
  );
}
