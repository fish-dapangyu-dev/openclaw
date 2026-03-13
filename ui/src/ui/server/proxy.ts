import http from "http";
// server/proxy.ts
import { WebSocket, WebSocketServer } from "ws";

const PORT = 8081;
const TARGET_VNC = "ws://10.75.171.0:25900"; // ← 改成你的真實 VNC 位址

const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (clientWs) => {
  console.log("[Proxy] Client connected");

  const targetWs = new WebSocket(TARGET_VNC);

  targetWs.on("open", () => console.log("[Proxy] 已連線到真實 VNC"));

  clientWs.on("message", (data) => targetWs.readyState === WebSocket.OPEN && targetWs.send(data));
  targetWs.on("message", (data) => clientWs.readyState === WebSocket.OPEN && clientWs.send(data));

  const cleanup = () => {
    targetWs.close();
    clientWs.close();
  };
  clientWs.on("close", cleanup);
  targetWs.on("close", cleanup);
  clientWs.on("error", cleanup);
  targetWs.on("error", cleanup);
});

server.listen(PORT, () => {
  console.log(`✅ noVNC Proxy 啟動成功 → ws://localhost:${PORT}`);
});
