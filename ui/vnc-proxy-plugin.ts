import * as net from "net";
import type { PluginOption } from "vite";
import { WebSocketServer, type RawData } from "ws";

// Use environment variables or hardcoded defaults from the external script
const VNC_HOST = process.env.OPENCLAW_VNC_HOST || "10.75.171.0";
const VNC_PORT = parseInt(process.env.OPENCLAW_VNC_PORT || "25900", 10);
const WS_PATH = "/vnc";

export function vncProxyPlugin(): PluginOption {
  return {
    name: "openclaw-vnc-proxy",
    configureServer(server) {
      // Create a WebSocket server that shares the Vite HTTP server
      const wss = new WebSocketServer({
        noServer: true,
        path: WS_PATH,
        perMessageDeflate: false,
      });

      console.log(`🚀 [Proxy] VNC WebSocket proxy injected at ${WS_PATH}`);
      console.log(`   Forwarding to: ${VNC_HOST}:${VNC_PORT}`);

      wss.on("connection", (ws) => {
        console.log(`[VNC Proxy] Client connected to ${WS_PATH}`);

        const tcpSocket = net.connect(VNC_PORT, VNC_HOST);

        tcpSocket.on("data", (data) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(data);
          }
        });

        ws.on("message", (data: RawData) => {
          if (!tcpSocket.writable) {
            return;
          }

          if (Buffer.isBuffer(data)) {
            tcpSocket.write(data);
          } else if (Array.isArray(data)) {
            tcpSocket.write(Buffer.concat(data));
          } else {
            tcpSocket.write(Buffer.from(data));
          }
        });

        ws.on("close", () => tcpSocket.end());
        tcpSocket.on("close", () => ws.close());

        tcpSocket.on("error", (e) => {
          console.error("[VNC Proxy] TCP Error:", e.message);
          ws.close();
        });
        ws.on("error", (e) => {
          console.error("[VNC Proxy] WebSocket Error:", e.message);
          tcpSocket.end();
        });
      });

      // Hook into Vite's HTTP server upgrade event
      server.httpServer?.on("upgrade", (req, socket, head) => {
        if (req.url === WS_PATH) {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
          });
        }
      });
    },
  };
}
