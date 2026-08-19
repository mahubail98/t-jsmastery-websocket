import express, { type Request, type Response } from "express";
import { matchesRouter } from "./routes/matches/index.js";
import http from "node:http";
import { attachWebSocketServer } from "./utils/ws.js";

const PORT = 8000;
const HOST = "0.0.0.0";

const app = express();

const server = http.createServer(app);

app.use(express.json());

app.get("/", (_req: Request, res: Response) => {
  res.json({ message: "Sportz API is running" });
});

app.use("/matches", matchesRouter);

const { broadcastMatchCreated } = attachWebSocketServer(server);
app.locals.broadcastMatchCreated = broadcastMatchCreated;

server.listen(PORT, HOST, () => {
  const baseUrl =
    HOST === "0.0.0.0" ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running on ${baseUrl}`);
  console.log(
    `WebSocket Server is running on ${baseUrl.replace("http", "ws")}/ws`,
  );
});
