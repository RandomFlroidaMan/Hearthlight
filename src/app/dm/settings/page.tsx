import Image from "next/image";
import Link from "next/link";
import { db } from "@/server/db";
import { publicImageUrl } from "@/server/art/imageStore";

export const dynamic = "force-dynamic";

export default async function WorldSettingLibraryPage() {
  const worldSettings = await db.worldSetting.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-950 p-8 text-zinc-50">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">World settings</h1>
        <Link
          href="/dm/settings/new"
          className="rounded-full bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
        >
          New setting
        </Link>
      </div>

      {worldSettings.length === 0 ? (
        <p className="text-sm text-zinc-400">
          No settings yet. Create one from a prompt, optionally with reference
          images.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {worldSettings.map((setting) => {
            const referenceImages = Array.isArray(setting.referenceImages)
              ? (setting.referenceImages as unknown[]).filter(
                  (p): p is string => typeof p === "string",
                )
              : [];

            return (
              <li
                key={setting.id}
                className="flex flex-col gap-3 rounded-md border border-zinc-800 bg-zinc-900 p-4"
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    {setting.name}
                    {setting.paletteKey && (
                      <span className="ml-2 text-xs text-zinc-500">({setting.paletteKey})</span>
                    )}
                  </p>
                </div>
                <p className="text-sm text-zinc-400">{setting.description}</p>
                {referenceImages.length > 0 && (
                  <div className="flex gap-2">
                    {referenceImages.map((filename) => (
                      <Image
                        key={filename}
                        src={publicImageUrl(filename)}
                        alt={`${setting.name} reference`}
                        width={96}
                        height={96}
                        className="rounded-md object-cover"
                      />
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
