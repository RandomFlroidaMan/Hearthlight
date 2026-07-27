"use client";

import { useState } from "react";

type Prefs = {
  narrationMuted: boolean;
  ambienceMuted: boolean;
  effectsMuted: boolean;
  dmFudgeEnabled: boolean;
};

type Field = {
  key: keyof Prefs;
  label: string;
  description: string;
  /** Whether the toggle's "on" state means the boolean field is true, or
   * false — the three audio fields are *Muted (on = not muted), while
   * dmFudgeEnabled is on = true directly. */
  onMeans: "true" | "false";
};

const FIELDS: Field[] = [
  {
    key: "narrationMuted",
    label: "Narration voice",
    description: "Spoken narration on the story screen.",
    onMeans: "false",
  },
  {
    key: "ambienceMuted",
    label: "Background music",
    description: "Ambient music matching each scene's mood.",
    onMeans: "false",
  },
  {
    key: "effectsMuted",
    label: "Sound effects",
    description: "Chimes for rolls, items, and choices.",
    onMeans: "false",
  },
  {
    key: "dmFudgeEnabled",
    label: "DM fudge",
    description: "Show force-success/force-failure buttons on skill checks.",
    onMeans: "true",
  },
];

export function PreferencesForm({ initial }: { initial: Prefs }) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState<keyof Prefs | null>(null);

  async function toggle(field: Field) {
    const next = !prefs[field.key];
    setPrefs((p) => ({ ...p, [field.key]: next }));
    setSaving(field.key);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field.key]: next }),
    }).catch(() => {
      // Best-effort — local state already reflects the change.
    });
    setSaving(null);
  }

  return (
    <div className="flex max-w-lg flex-col gap-4">
      {FIELDS.map((field) => {
        const isOn = field.onMeans === "true" ? prefs[field.key] : !prefs[field.key];
        return (
          <div
            key={field.key}
            className="flex items-center justify-between gap-4 rounded-md border border-zinc-800 bg-zinc-900 p-4"
          >
            <div>
              <p className="font-medium text-zinc-50">{field.label}</p>
              <p className="text-sm text-zinc-400">{field.description}</p>
            </div>
            <button
              onClick={() => toggle(field)}
              disabled={saving === field.key}
              className={`w-16 shrink-0 rounded-full px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                isOn ? "bg-zinc-50 text-zinc-950" : "border border-zinc-700 text-zinc-400"
              }`}
            >
              {isOn ? "On" : "Off"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
