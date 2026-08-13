import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { LanWebSocketTransport, type SocketLike } from "../transport";

function mockSocket(readyState: number = WebSocket.OPEN): SocketLike & { sent: string[] } {
  return {
    readyState,
    sent: [] as string[],
    send(data: string) {
      this.sent.push(data);
    },
  };
}

describe("LanWebSocketTransport", () => {
  it("broadcasts only to clients in the target room", () => {
    const transport = new LanWebSocketTransport();
    const roomA = mockSocket();
    const roomB = mockSocket();
    transport.addClient("AAAA", roomA);
    transport.addClient("BBBB", roomB);

    transport.broadcast("AAAA", { type: "scene", scene: { id: "1" } });

    expect(roomA.sent).toEqual([JSON.stringify({ type: "scene", scene: { id: "1" } })]);
    expect(roomB.sent).toEqual([]);
  });

  it("broadcasts to every client in the room", () => {
    const transport = new LanWebSocketTransport();
    const first = mockSocket();
    const second = mockSocket();
    transport.addClient("AAAA", first);
    transport.addClient("AAAA", second);

    transport.broadcast("AAAA", { type: "scene", scene: { id: "1" } });

    expect(first.sent).toHaveLength(1);
    expect(second.sent).toHaveLength(1);
  });

  it("skips sockets that are not open", () => {
    const transport = new LanWebSocketTransport();
    const open = mockSocket(WebSocket.OPEN);
    const closed = mockSocket(WebSocket.CLOSED);
    transport.addClient("AAAA", open);
    transport.addClient("AAAA", closed);

    transport.broadcast("AAAA", { type: "scene", scene: { id: "1" } });

    expect(open.sent).toHaveLength(1);
    expect(closed.sent).toHaveLength(0);
  });

  it("does nothing when broadcasting to a room with no clients", () => {
    const transport = new LanWebSocketTransport();
    expect(() => transport.broadcast("EMPTY", { type: "scene", scene: {} })).not.toThrow();
  });

  it("stops delivering to a client after it's removed", () => {
    const transport = new LanWebSocketTransport();
    const socket = mockSocket();
    transport.addClient("AAAA", socket);
    transport.removeClient("AAAA", socket);

    transport.broadcast("AAAA", { type: "scene", scene: { id: "1" } });

    expect(socket.sent).toEqual([]);
  });

  it("removing one client doesn't affect other clients in the same room", () => {
    const transport = new LanWebSocketTransport();
    const first = mockSocket();
    const second = mockSocket();
    transport.addClient("AAAA", first);
    transport.addClient("AAAA", second);
    transport.removeClient("AAAA", first);

    transport.broadcast("AAAA", { type: "scene", scene: { id: "1" } });

    expect(first.sent).toEqual([]);
    expect(second.sent).toHaveLength(1);
  });

  it("removing a client from an unknown room is a no-op", () => {
    const transport = new LanWebSocketTransport();
    const socket = mockSocket();
    expect(() => transport.removeClient("NOPE", socket)).not.toThrow();
  });
});
