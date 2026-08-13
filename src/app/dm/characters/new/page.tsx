import Link from "next/link";
import { CharacterForm } from "@/components/CharacterForm";

export default function NewCharacterPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-950 p-8">
      <div className="flex items-center gap-4">
        <Link href="/dm/characters" className="text-sm text-zinc-400 hover:text-zinc-200">
          ← Character library
        </Link>
      </div>
      <h1 className="text-xl font-semibold text-zinc-50">New character</h1>
      <p className="max-w-md text-sm text-zinc-400">
        PDF and photo sheet import land in the same place once the parsers
        are verified — for now this is from-scratch creation.
      </p>
      <CharacterForm />
    </div>
  );
}
