import type { Server as HttpServer } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { Match } from "../db/schema.js";

export type ServerMessage =
  | { type: "welcome" }
  | { type: "match_created"; data: Match };

export interface MatchBroadcaster {
  broadcastMatchCreated: (match: Match) => void;
}

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

export function attachWebSocketServer(server: HttpServer): MatchBroadcaster {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 1024 * 1024,
  });

  wss.on("connection", (socket: WebSocket) => {
    sendJson(socket, { type: "welcome" });
    socket.on("error", console.error);
  });

  function broadcastMatchCreated(match: Match): void {
    broadcastToAll(wss, { type: "match_created", data: match });
  }

  return { broadcastMatchCreated };
}
