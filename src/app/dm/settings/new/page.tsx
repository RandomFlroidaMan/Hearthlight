import Link from "next/link";
import { WorldSettingForm } from "@/components/WorldSettingForm";

export default function NewWorldSettingPage() {
  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-950 p-8">
      <Link href="/dm/settings" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← World settings
      </Link>
      <h1 className="text-xl font-semibold text-zinc-50">New world setting</h1>
      <p className="max-w-md text-sm text-zinc-400">
        A prompt alone is enough to start a new story — reference images are
        optional but help anchor what things should actually look like.
      </p>
      <WorldSettingForm />
    </div>
  );
}
