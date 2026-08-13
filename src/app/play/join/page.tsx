import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getCurrentFamily } from "@/server/auth/session";
import { JoinRoomForm } from "@/components/JoinRoomForm";

export const dynamic = "force-dynamic";

export default async function JoinRoomPage() {
  const family = await getCurrentFamily();
  if (!family) redirect("/login");

  const characters = await db.character.findMany({
    where: { familyId: family.id },
    select: { id: true, name: true, displayName: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-950 p-8 text-center text-zinc-50">
      <Link href="/play" className="self-start text-sm text-zinc-400 hover:text-zinc-200">
        ← Play together
      </Link>
      <h1 className="text-2xl font-semibold">Join someone else&apos;s adventure</h1>
      <p className="max-w-md text-zinc-400">
        Got a room code from another family? Enter it and pick which of your
        own characters are coming along.
      </p>
      <JoinRoomForm characters={characters} />
    </div>
  );
}
