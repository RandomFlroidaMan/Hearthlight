"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CLASSES, RACES, findClass } from "@/lib/dnd";
import { deriveSkills } from "@/lib/deriveSkills";
import { readingAges, type CreateCharacterInput } from "@/lib/characterSchema";

export type FormState = {
  name: string;
  useKidName: boolean;
  race: string;
  className: string;
  level: number;
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
  proficienciesText: string;
  equipmentText: string;
  spellsText: string;
  background: string;
  personality: string;
  appearance: string;
  readingAge: (typeof readingAges)[number];
};

const DEFAULT_STATE: FormState = {
  name: "",
  useKidName: true,
  race: RACES[0],
  className: CLASSES[0].name,
  level: 1,
  strength: 10,
  dexterity: 10,
  constitution: 10,
  intelligence: 10,
  wisdom: 10,
  charisma: 10,
  proficienciesText: "",
  equipmentText: "",
  spellsText: "",
  background: "",
  personality: "",
  appearance: "",
  readingAge: 5,
};

function splitLines(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Shared editable form for both from-scratch character creation and the
 * confirmation screen after a PDF/photo sheet is parsed. `initial` lets a
 * parsed sheet pre-fill the same fields a human would type by hand.
 */
export function CharacterForm({
  initial,
  sourceSheet,
}: {
  initial?: Partial<FormState>;
  sourceSheet?: string | null;
}) {
  const [state, setState] = useState<FormState>({ ...DEFAULT_STATE, ...initial });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const classInfo = findClass(state.className);
  const proficiencies = useMemo(() => splitLines(state.proficienciesText), [state.proficienciesText]);

  const preview = useMemo(
    () =>
      deriveSkills({
        className: state.className,
        level: state.level,
        strength: state.strength,
        dexterity: state.dexterity,
        constitution: state.constitution,
        intelligence: state.intelligence,
        wisdom: state.wisdom,
        charisma: state.charisma,
        proficiencies,
      }),
    [state, proficiencies],
  );

  function updateNumber(key: keyof FormState, value: string) {
    const n = Number(value);
    setState((s) => ({ ...s, [key]: Number.isFinite(n) ? n : 0 }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload: CreateCharacterInput = {
      name: state.name,
      displayName: state.useKidName ? (classInfo?.kidName ?? null) : null,
      race: state.race,
      className: state.className,
      level: state.level,
      strength: state.strength,
      dexterity: state.dexterity,
      constitution: state.constitution,
      intelligence: state.intelligence,
      wisdom: state.wisdom,
      charisma: state.charisma,
      proficiencies,
      equipment: splitLines(state.equipmentText),
      spells: splitLines(state.spellsText),
      background: state.background || null,
      personality: state.personality || null,
      appearance: state.appearance || null,
      readingAge: state.readingAge,
      sourceSheet: sourceSheet ?? null,
    };

    const res = await fetch("/api/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong saving this character.");
      return;
    }

    router.push("/dm/characters");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-2xl flex-col gap-6 text-zinc-50">
      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">Name</span>
        <input
          required
          value={state.name}
          onChange={(e) => setState((s) => ({ ...s, name: e.target.value }))}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-400">Race</span>
          <select
            value={state.race}
            onChange={(e) => setState((s) => ({ ...s, race: e.target.value }))}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
          >
            {RACES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-400">Class</span>
          <select
            value={state.className}
            onChange={(e) => setState((s) => ({ ...s, className: e.target.value }))}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
          >
            {CLASSES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.kidName})
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm text-zinc-400">
        <input
          type="checkbox"
          checked={state.useKidName}
          onChange={(e) => setState((s) => ({ ...s, useKidName: e.target.checked }))}
        />
        Show kid-friendly class name (&quot;{classInfo?.kidName}&quot;) instead of &quot;{state.className}&quot;
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">Level</span>
        <input
          type="number"
          min={1}
          max={20}
          value={state.level}
          onChange={(e) => updateNumber("level", e.target.value)}
          className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
        />
      </label>

      <fieldset className="grid grid-cols-3 gap-4 sm:grid-cols-6">
        <legend className="mb-1 text-sm text-zinc-400">Ability scores</legend>
        {(
          [
            ["strength", "STR"],
            ["dexterity", "DEX"],
            ["constitution", "CON"],
            ["intelligence", "INT"],
            ["wisdom", "WIS"],
            ["charisma", "CHA"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex flex-col items-center gap-1">
            <span className="text-xs text-zinc-500">{label}</span>
            <input
              type="number"
              min={1}
              max={30}
              value={state[key]}
              onChange={(e) => updateNumber(key, e.target.value)}
              className="w-16 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-center"
            />
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">Proficiencies (one per line)</span>
        <textarea
          value={state.proficienciesText}
          onChange={(e) => setState((s) => ({ ...s, proficienciesText: e.target.value }))}
          rows={3}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">Equipment (one per line)</span>
        <textarea
          value={state.equipmentText}
          onChange={(e) => setState((s) => ({ ...s, equipmentText: e.target.value }))}
          rows={3}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">Spells (one per line)</span>
        <textarea
          value={state.spellsText}
          onChange={(e) => setState((s) => ({ ...s, spellsText: e.target.value }))}
          rows={2}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">Background</span>
        <input
          value={state.background}
          onChange={(e) => setState((s) => ({ ...s, background: e.target.value }))}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">Personality</span>
        <input
          value={state.personality}
          onChange={(e) => setState((s) => ({ ...s, personality: e.target.value }))}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">Appearance</span>
        <input
          value={state.appearance}
          onChange={(e) => setState((s) => ({ ...s, appearance: e.target.value }))}
          className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm text-zinc-400">Reading age</span>
        <select
          value={state.readingAge}
          onChange={(e) =>
            setState((s) => ({
              ...s,
              readingAge: Number(e.target.value) as (typeof readingAges)[number],
            }))
          }
          className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
        >
          {readingAges.map((age) => (
            <option key={age} value={age}>
              {age}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-md border border-zinc-700 bg-zinc-900 p-4">
        <p className="mb-2 text-sm text-zinc-400">Derived kid stats (live preview)</p>
        <div className="flex gap-6 text-sm">
          <span>Might {preview.might >= 0 ? `+${preview.might}` : preview.might}</span>
          <span>Magic {preview.magic >= 0 ? `+${preview.magic}` : preview.magic}</span>
          <span>Cunning {preview.cunning >= 0 ? `+${preview.cunning}` : preview.cunning}</span>
          <span>Heart {preview.heart >= 0 ? `+${preview.heart}` : preview.heart}</span>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-zinc-50 px-5 py-3 font-medium text-zinc-950 transition-colors hover:bg-zinc-200 disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Save character"}
      </button>
    </form>
  );
}
