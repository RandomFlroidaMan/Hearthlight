"use client";

import { useState } from "react";

type Prefs = {
  narrationMuted: boolean;
  ambienceMuted: boolean;
  effectsMuted: boolean;
  dmFudgeEnabled: boolean;
  monthlyCapUsd: number | null;
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

export function PreferencesForm({
  initial,
  spendThisMonthUsd,
}: {
  initial: Prefs;
  spendThisMonthUsd: number;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState<keyof Prefs | null>(null);
  const [capDraft, setCapDraft] = useState(initial.monthlyCapUsd?.toString() ?? "");
  const [capError, setCapError] = useState<string | null>(null);

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

  async function saveCap() {
    setCapError(null);
    const trimmed = capDraft.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isFinite(value) || value <= 0)) {
      setCapError("Enter a positive dollar amount, or leave it blank for no cap.");
      return;
    }
    setSaving("monthlyCapUsd");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monthlyCapUsd: value }),
    });
    setSaving(null);
    if (res.ok) {
      setPrefs((p) => ({ ...p, monthlyCapUsd: value }));
    } else {
      setCapError("Couldn't save that — try again.");
    }
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

      <div className="flex flex-col gap-3 rounded-md border border-zinc-800 bg-zinc-900 p-4">
        <div>
          <p className="font-medium text-zinc-50">Monthly spending cap</p>
          <p className="text-sm text-zinc-400">
            Stops generating new beats once this month&apos;s API spend reaches this amount. Leave blank for no cap.
          </p>
        </div>
        <p className="text-sm text-amber-300">Spent so far this month: ${spendThisMonthUsd.toFixed(2)}</p>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={capDraft}
            onChange={(e) => setCapDraft(e.target.value)}
            placeholder="No cap"
            className="w-32 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-50"
          />
          <button
            onClick={saveCap}
            disabled={saving === "monthlyCapUsd"}
            className="rounded-full bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-950 disabled:opacity-50"
          >
            Save
          </button>
        </div>
        {capError && <p className="text-sm text-red-400">{capError}</p>}
      </div>
    </div>
  );
}
