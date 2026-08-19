import type { Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { Match } from "../db/schema.js";

export type ServerMessage =
  | { type: "welcome" }
  | { type: "match_created"; data: Match };

export interface MatchBroadcaster {
  broadcastMatchCreated: (match: Match) => void;
}

export interface WebSocketOptions {
  heartbeatIntervalMs?: number;
}

const DEFAULT_HEARTBEAT_MS = 30_000;

function sendJson(socket: WebSocket, payload: ServerMessage): void {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function broadcastToAll(wss: WebSocketServer, payload: ServerMessage): void {
  const message = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(message);
  }
}

export function attachWebSocketServer(
  server: HttpServer,
  { heartbeatIntervalMs = DEFAULT_HEARTBEAT_MS }: WebSocketOptions = {},
): MatchBroadcaster {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  const alive = new WeakSet<WebSocket>();

  wss.on("connection", (socket) => {
    alive.add(socket);
    socket.on("pong", () => alive.add(socket));

    sendJson(socket, { type: "welcome" });

    socket.on("error", console.error);
  });

  const interval = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.has(socket)) {
        socket.terminate();
        continue;
      }
      alive.delete(socket);
      socket.ping();
    }
  }, heartbeatIntervalMs);

  const stopHeartbeat = () => clearInterval(interval);
  wss.on("close", stopHeartbeat);
  server.on("close", stopHeartbeat);
  interval.unref();

  function broadcastMatchCreated(match: Match): void {
    broadcastToAll(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
