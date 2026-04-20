import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { createApp } from "./app.js";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

// =======================
// 🔹 HTTP SERVER + SOCKET.IO
// =======================
const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    methods: ["GET", "POST", "PATCH"],
  },
});

// Socket.io basic connection log
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);
  socket.on("user:joinRoom", ({ userId }) => {
    if (userId) socket.join(String(userId));
  });
  socket.on("user:leaveRoom", ({ userId }) => {
    if (userId) socket.leave(String(userId));
  });
  socket.on("ride:joinRoom", ({ rideId }) => {
    if (rideId) socket.join(String(rideId));
  });
  socket.on("ride:leaveRoom", ({ rideId }) => {
    if (rideId) socket.leave(String(rideId));
  });
  socket.on("ride:loc", (payload) => {
    const rideId = payload?.rideId;
    if (!rideId) return;
    io.to(String(rideId)).emit("ride:loc", {
      rideId: String(rideId),
      userId: payload?.userId || null,
      userName: payload?.userName || null,
      lat: Number(payload?.lat),
      lng: Number(payload?.lng),
      t: payload?.t || Date.now(),
    });
  });
  socket.on("disconnect", () =>
    console.log("🔌 Client disconnected:", socket.id)
  );
});

// Make `io` accessible in controllers
const distDir = path.resolve(__dirname, "..", "frontend", "dist");
const staticDir = fs.existsSync(path.join(distDir, "index.html")) ? distDir : null;

const app = createApp({ io, staticDir });
server.removeAllListeners("request");
server.on("request", app);

// =======================
// 🔹 START SERVER
// =======================
connectDB()
  .then(() => {
    const DEFAULT_PORT = 5001;
    const envPort = Number(process.env.PORT);
    const preferredPort = Number.isFinite(envPort) ? envPort : DEFAULT_PORT;
    const startPort =
      process.env.NODE_ENV === "production"
        ? preferredPort
        : preferredPort === 5000
        ? DEFAULT_PORT
        : preferredPort;

    const HOST =
      process.env.NODE_ENV === "production"
        ? process.env.HOST || "0.0.0.0"
        : process.env.HOST || "127.0.0.1";

    const tryListen = (port, remainingAttempts) => {
      server.once("error", (err) => {
        if (err?.code === "EADDRINUSE" && remainingAttempts > 0) {
          server.removeAllListeners("listening");
          return tryListen(port + 1, remainingAttempts - 1);
        }
        if (err?.code === "EPERM") {
          console.error(
            "❌ Backend cannot listen on a TCP port in this environment. Run the root `npm run dev` to use the backend mounted into Vite."
          );
          process.exit(1);
        }
        console.error("❌ Server listen error:", err);
        process.exit(1);
      });

      server.listen(port, HOST, () => {
        console.log(`✅ EcoRide backend running on http://${HOST}:${port}`);
        if (staticDir) {
          console.log(`🖥️  Serving frontend from ${staticDir}`);
        }
      });
    };

    tryListen(startPort, 10);
  })
  .catch((err) => {
    console.error("❌ Failed to connect DB:", err);
    process.exit(1);
  });
