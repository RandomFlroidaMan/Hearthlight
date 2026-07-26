"use client";

import { useState } from "react";
import Link from "next/link";
import { CharacterForm, type FormState } from "@/components/CharacterForm";
import type { CharacterSheetData } from "@/lib/characterSchema";

type ParseResponse =
  | { kind: string; data: CharacterSheetData; warnings: string[] }
  | { error: string; message?: string };

function sheetDataToFormState(data: CharacterSheetData): Partial<FormState> {
  return {
    name: data.name,
    useKidName: false,
    race: data.race,
    className: data.className,
    level: data.level,
    strength: data.strength,
    dexterity: data.dexterity,
    constitution: data.constitution,
    intelligence: data.intelligence,
    wisdom: data.wisdom,
    charisma: data.charisma,
    proficienciesText: data.proficiencies.join("\n"),
    equipmentText: data.equipment.join("\n"),
    spellsText: data.spells.join("\n"),
    background: data.background ?? "",
    personality: data.personality ?? "",
    appearance: data.appearance ?? "",
  };
}

export default function ImportCharacterPage() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{
    kind: string;
    data: CharacterSheetData;
    warnings: string[];
    fileName: string;
  } | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setParsed(null);

    const body = new FormData();
    body.append("file", file);

    const res = await fetch("/api/sheets/parse", { method: "POST", body });
    const json: ParseResponse = await res.json();
    setUploading(false);

    if (!res.ok || "error" in json) {
      setError(
        "error" in json
          ? (json.message ?? json.error)
          : "Something went wrong reading this file.",
      );
      return;
    }

    setParsed({ kind: json.kind, data: json.data, warnings: json.warnings, fileName: file.name });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-950 p-8 text-zinc-50">
      <Link href="/dm/characters" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Character library
      </Link>
      <h1 className="text-xl font-semibold">Import a character sheet</h1>
      <p className="max-w-md text-sm text-zinc-400">
        Upload a fillable PDF, a text-based PDF export, or a photo/scan.
        Nothing is saved until you review and confirm below.
      </p>

      <input
        type="file"
        accept="application/pdf,image/*"
        onChange={handleFileChange}
        disabled={uploading}
        className="text-sm"
      />

      {uploading && <p className="text-sm text-zinc-400">Reading sheet…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {parsed && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-zinc-400">
            Detected as <span className="font-mono">{parsed.kind}</span>. Review every field below
            before saving.
          </p>
          {parsed.warnings.length > 0 && (
            <ul className="flex flex-col gap-1 rounded-md border border-amber-700 bg-amber-950/40 p-3 text-sm text-amber-300">
              {parsed.warnings.map((w, i) => (
                <li key={i}>⚠ {w}</li>
              ))}
            </ul>
          )}
          <CharacterForm
            initial={sheetDataToFormState(parsed.data)}
            sourceSheet={parsed.fileName}
          />
        </div>
      )}
    </div>
  );
}
