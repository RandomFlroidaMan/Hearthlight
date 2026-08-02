import { WebSocket } from "ws";

/**
 * The abstraction the rest of the app talks to instead of raw sockets —
 * so a future cross-network relay (explicitly wanted for family across the
 * US, but out of scope for now) can be swapped in later without touching
 * story/dice/state code. Only a LAN implementation exists today.
 */
export type SyncEvent =
  | { type: "scene"; scene: unknown; outcome?: unknown }
  // Patches a scene's art/narration in once they're ready, after the
  // "scene" event above already revealed its prose/choices — see the
  // text-then-media split in generateBeat.ts's completeBeatAdvance.
  | { type: "scene_media"; sceneId: string; imagePath: string | null; narrationPath: string | null }
  | { type: "generation_failed"; message: string }
  // Another family joined this room with their own character(s) —
  // connected screens re-fetch the party list rather than trying to merge
  // a partial update in over the wire.
  | { type: "party_changed" };

/** Structural, not the full `ws` class — so tests can pass plain mock
 * objects instead of standing up a real WebSocket. */
export interface SocketLike {
  readyState: number;
  send(data: string): void;
}

export interface RealtimeTransport {
  addClient(room: string, socket: SocketLike): void;
  removeClient(room: string, socket: SocketLike): void;
  broadcast(room: string, event: SyncEvent): void;
}

export class LanWebSocketTransport implements RealtimeTransport {
  private rooms = new Map<string, Set<SocketLike>>();

  addClient(room: string, socket: SocketLike): void {
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(socket);
  }

  removeClient(room: string, socket: SocketLike): void {
    const sockets = this.rooms.get(room);
    if (!sockets) return;
    sockets.delete(socket);
    if (sockets.size === 0) {
      this.rooms.delete(room);
    }
  }

  broadcast(room: string, event: SyncEvent): void {
    const sockets = this.rooms.get(room);
    if (!sockets) return;
    const payload = JSON.stringify(event);
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  }
}

const globalForTransport = globalThis as unknown as {
  realtimeTransport: LanWebSocketTransport | undefined;
};

export const transport: LanWebSocketTransport =
  globalForTransport.realtimeTransport ?? new LanWebSocketTransport();

if (process.env.NODE_ENV !== "production") {
  globalForTransport.realtimeTransport = transport;
}
