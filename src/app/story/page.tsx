import { RoomCodeJoinForm } from "@/components/RoomCodeJoinForm";

/**
 * Story screen landing — enter the room code shown on the DM screen to
 * join that campaign's live session.
 */
export default function StoryScreen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-950 p-8 text-center text-zinc-50">
      <h1 className="text-2xl font-semibold">Join a story</h1>
      <p className="max-w-md text-zinc-400">
        Enter the room code from the DM screen to follow along here.
      </p>
      <RoomCodeJoinForm />
    </div>
  );
}
