import Link from "next/link";
import { db } from "@/server/db";
import { PreferencesForm } from "@/components/PreferencesForm";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const settings = await db.settings.findUnique({ where: { id: "default" } });

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-950 p-8">
      <Link href="/dm" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← DM screen
      </Link>
      <h1 className="text-xl font-semibold text-zinc-50">Preferences</h1>
      <PreferencesForm
        initial={{
          narrationMuted: settings?.narrationMuted ?? false,
          ambienceMuted: settings?.ambienceMuted ?? false,
          effectsMuted: settings?.effectsMuted ?? false,
          dmFudgeEnabled: settings?.dmFudgeEnabled ?? false,
        }}
      />
    </div>
  );
}
