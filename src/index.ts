import express, { type Request, type Response } from "express";
import cors from "cors";
import { matchesRouter } from "./routes/matches/index.js";
import { commentaryCreateRouter } from "./routes/commentary/index.js";
import http from "node:http";
import { attachWebSocketServer } from "./utils/ws.js";

const PORT = 8000;
const HOST = "0.0.0.0";

const app = express();

const server = http.createServer(app);

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Sportz API is running" });
});

app.use("/matches", matchesRouter);
app.use("/commentary", commentaryCreateRouter);

const { broadcastMatchCreated, broadcastCommentary } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;

server.listen(PORT, HOST, () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running on ${baseUrl}`);
  console.log(
    `WebSocket Server is running on ${baseUrl.replace("http", "ws")}/ws`,
  );
});
