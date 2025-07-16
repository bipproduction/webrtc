// ./src/index.tsx
import { ServerWebSocket } from "bun";
import { Elysia } from "elysia";
import index from "./index.html";

// Simpan semua client yang terhubung
const clients = new Map<
  string,
  {
    ws: ServerWebSocket;
    id: string;
    role: string;
    deviceName: string;
  }
>();

const app = new Elysia()
  .ws("/ws", {
    open(ws: any) {
      console.log("🟢 Client connected");
    },

    close(ws: any) {
      console.log("🔴 Client disconnected");
    },

    message(ws: any, message: any) {
      if (message.type === "ping") {
        ws.send(
          JSON.stringify({
            type: "pong",
          })
        );
      }

      if (message.type === "pong") {
        console.log("✅ Pong received");
      }

      if (message.type === "restart") {
        ws.send(
          JSON.stringify({
            type: "restart",
          })
        );
      }

      if (message.type === "req-list-user") {
        const userData = Array.from(clients.values()).map((v) => {
          return {
            id: v.id,
            role: v.role,
            deviceName: v.deviceName,
          };
        });
        ws.send(
          JSON.stringify({
            type: "res-list-user",
            users: userData,
          })
        );
      }

      if (message.type === "req-register") {
        clients.set(message.id, {
          ws,
          id: message.id,
          role: message.role,
          deviceName: message.deviceName,
        });
        console.log("🟢 Client registered: " + message.id);

        const userData = Array.from(clients.values()).map((v) => {
          return {
            id: v.id,
            role: v.role,
            deviceName: v.deviceName,
          };
        });
        ws.send(
          JSON.stringify({
            type: "res-list-user",
            users: userData,
          })
        );
      }

      for (const client of clients.values()) {
        if (client.ws !== ws) client.ws.send(JSON.stringify(message));
      }
    },
  })
  .onError((ctx) => {
    console.error(ctx.error);
  })
  // Serve file statis (optional, jika React tidak pakai dev server)
  .get("*", index);

app.listen({
  port: 3000,
  hostname: "0.0.0.0",
});
console.log("🚀 Signaling server running at ws://localhost:3000");
