import { createServer } from "node:http";
import next from "next";
import { WebSocketServer } from "ws";
import { transport } from "@/server/sync/transport";

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const nextUpgradeHandle = app.getUpgradeHandler();
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  // Next's own request handler never sees upgrade requests — they're a
  // separate event on the same http.Server, handled here instead. Anything
  // that isn't our own /ws room traffic (notably Next's dev-mode HMR
  // websocket at /_next/webpack-hmr) must be handed to Next's own upgrade
  // handler rather than dropped, or the client never finishes hydrating.
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);

    if (url.pathname !== "/ws") {
      nextUpgradeHandle(req, socket, head);
      return;
    }

    const room = url.searchParams.get("room");
    if (!room) {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      transport.addClient(room, ws);
      ws.on("close", () => transport.removeClient(room, ws));
      ws.on("error", () => transport.removeClient(room, ws));
    });
  });

  httpServer.listen(port, () => {
    console.log(
      `> Hearthlight listening at http://localhost:${port} as ${dev ? "development" : process.env.NODE_ENV} (with /ws for dual-screen sync)`,
    );
  });
});
