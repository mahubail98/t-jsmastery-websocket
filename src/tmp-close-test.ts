import { createServer } from "node:http";
import { WebSocketServer } from "ws";

const server = createServer();
const wss = new WebSocketServer({ server, path: "/ws" });

let closeFired = false;
wss.on("close", () => { closeFired = true; });

await new Promise<void>((r) => server.listen(8125, r));
await new Promise<void>((r) => server.close(() => r()));
await new Promise((r) => setTimeout(r, 300));

console.log("http server closed; wss 'close' fired:", closeFired);

// And with an explicit wss.close():
const server2 = createServer();
const wss2 = new WebSocketServer({ server: server2, path: "/ws" });
let closeFired2 = false;
wss2.on("close", () => { closeFired2 = true; });
await new Promise<void>((r) => server2.listen(8126, r));
await new Promise<void>((r) => wss2.close(() => r()));
await new Promise((r) => setTimeout(r, 200));
console.log("wss.close() called;  wss 'close' fired:", closeFired2);
server2.close();
process.exit(0);
