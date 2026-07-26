"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PALETTE_KEYS } from "@/lib/worldSettingPalettes";

const MAX_IMAGES = 5;

export function WorldSettingForm() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [paletteKey, setPaletteKey] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > MAX_IMAGES) {
      setError(`Up to ${MAX_IMAGES} reference images.`);
      return;
    }
    setError(null);
    setFiles(selected);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const body = new FormData();
    body.append("name", name);
    body.append("description", description);
    if (paletteKey) body.append("paletteKey", paletteKey);
    for (const file of files) body.append("referenceImages", file);

    const res = await fetch("/api/world-settings", { method: "POST", body });
    setSubmitting(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.message ?? json.error ?? "Something went wrong saving this setting.");
      return;
    }

    router.push("/dm/settings");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6 text-zinc-50">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">Name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="The Wandering Bog"
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">
          Description / prompt — describe the world in your own words
        </span>
        <textarea
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="A bog town on the back of a giant, slow-moving turtle. No one knows where it'll be next — the turtle is always grazing, and never stays anywhere longer than a month or two."
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">
          Starting palette (optional — leave blank for a fully custom look)
        </span>
        <select
          value={paletteKey}
          onChange={(e) => setPaletteKey(e.target.value)}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
        >
          <option value="">Custom (from description + reference images)</option>
          {PALETTE_KEYS.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">
          Reference images (optional, up to {MAX_IMAGES}) — anchor what things in this
          setting should actually look like. Style still follows the style bible.
        </span>
        <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleFilesChange} />
        {files.length > 0 && (
          <p className="text-xs text-zinc-500">{files.length} image(s) selected</p>
        )}
      </label>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-zinc-50 px-5 py-3 font-medium text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save setting"}
      </button>
    </form>
  );
}
