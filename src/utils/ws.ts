import type { Server as HttpServer } from "node:http";
import { type RawData, WebSocket, WebSocketServer } from "ws";
import type { Commentary, Match } from "../db/schema.js";

/** Primary key of a match, as used by the commentary routes. */
export type MatchId = number;

/** Everything the server pushes to clients. */
export type ServerMessage =
  | { type: "welcome" }
  | { type: "error"; message: string }
  | { type: "subscribed"; matchId: MatchId }
  | { type: "unsubscribed"; matchId: MatchId }
  | { type: "match_created"; data: Match }
  | { type: "commentary"; data: Commentary };

/** Everything a client may send. Anything else is answered with an error. */
export type ClientMessage =
  | { type: "subscribe"; matchId: MatchId }
  | { type: "unsubscribe"; matchId: MatchId };

export interface MatchBroadcaster {
  broadcastMatchCreated: (match: Match) => void;
  broadcastCommentary: (matchId: MatchId, comment: Commentary) => void;
}

const HEARTBEAT_INTERVAL_MS = 30_000;

/** matchId -> sockets watching that match. */
const matchSubscribers = new Map<MatchId, Set<WebSocket>>();

/**
 * The reverse index, so a disconnecting socket can be removed without scanning
 * every match. Held outside the socket (rather than as a `socket.subscriptions`
 * property) so `ws.WebSocket` stays unmodified — same reasoning as `alive`.
 * A WeakMap also drops entries automatically once a socket is collected.
 */
const socketSubscriptions = new WeakMap<WebSocket, Set<MatchId>>();

function subscribe(matchId: MatchId, socket: WebSocket): void {
  let subscribers = matchSubscribers.get(matchId);

  if (!subscribers) {
    subscribers = new Set<WebSocket>();
    matchSubscribers.set(matchId, subscribers);
  }

  subscribers.add(socket);

  let subscriptions = socketSubscriptions.get(socket);

  if (!subscriptions) {
    subscriptions = new Set<MatchId>();
    socketSubscriptions.set(socket, subscriptions);
  }

  subscriptions.add(matchId);
}

function unsubscribe(matchId: MatchId, socket: WebSocket): void {
  const subscribers = matchSubscribers.get(matchId);

  if (!subscribers) return;

  subscribers.delete(socket);

  // Drop the empty Set so the map does not grow unbounded across matches.
  if (subscribers.size === 0) {
    matchSubscribers.delete(matchId);
  }

  socketSubscriptions.get(socket)?.delete(matchId);
}

function cleanupSubscriptions(socket: WebSocket): void {
  const subscriptions = socketSubscriptions.get(socket);

  if (!subscriptions) return;

  for (const matchId of [...subscriptions]) {
    unsubscribe(matchId, socket);
  }

  socketSubscriptions.delete(socket);
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

function broadcastToMatch(matchId: MatchId, payload: ServerMessage): void {
  const subscribers = matchSubscribers.get(matchId);

  if (!subscribers || subscribers.size === 0) return;

  const message = JSON.stringify(payload);

  for (const client of subscribers) {
    if (client.readyState !== WebSocket.OPEN) continue;
    client.send(message);
  }
}

function parseClientMessage(value: unknown): ClientMessage | null {
  if (typeof value !== "object" || value === null) return null;

  const { type, matchId } = value as Record<string, unknown>;

  if (
    (type !== "subscribe" && type !== "unsubscribe") ||
    typeof matchId !== "number" ||
    !Number.isInteger(matchId) ||
    matchId <= 0
  ) {
    return null;
  }

  return { type, matchId };
}

function handleMessage(socket: WebSocket, data: RawData): void {
  let parsed: unknown;

  try {
    parsed = JSON.parse(data.toString());
  } catch {
    sendJson(socket, { type: "error", message: "Invalid JSON" });
    return;
  }

  const message = parseClientMessage(parsed);

  if (!message) {
    sendJson(socket, { type: "error", message: "Unsupported message" });
    return;
  }

  if (message.type === "subscribe") {
    subscribe(message.matchId, socket);
    sendJson(socket, { type: "subscribed", matchId: message.matchId });
    return;
  } else {
    unsubscribe(message.matchId, socket);
    sendJson(socket, { type: "unsubscribed", matchId: message.matchId });
  }
}

export function attachWebSocketServer(server: HttpServer): MatchBroadcaster {
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

    socket.on("message", (data) => handleMessage(socket, data));

    socket.on("error", (err) => {
      console.error(err);
      socket.terminate();
    });

    socket.on("close", () => cleanupSubscriptions(socket));
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
  }, HEARTBEAT_INTERVAL_MS);

  // Closing the http server does NOT emit 'close' on the WebSocketServer when
  // the server was passed in, so both paths must be covered. unref() is the
  // backstop: a stray heartbeat should never hold the process open by itself.
  const stopHeartbeat = () => clearInterval(interval);
  wss.on("close", stopHeartbeat);
  server.on("close", stopHeartbeat);
  interval.unref();

  function broadcastMatchCreated(match: Match): void {
    broadcastToAll(wss, { type: "match_created", data: match });
  }

  function broadcastCommentary(matchId: MatchId, comment: Commentary): void {
    broadcastToMatch(matchId, { type: "commentary", data: comment });
  }

  return { broadcastMatchCreated, broadcastCommentary };
}
