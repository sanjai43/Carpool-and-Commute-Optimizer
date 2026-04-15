import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import rideRoutes from "./routes/rideRoutes.js";
import ecoRoutes from "./routes/ecoRoutes.js";

dotenv.config();
const app = express();
const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

// =======================
// 🔹 CORE MIDDLEWARE
// =======================
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

// =======================
// 🔹 HTTP SERVER + SOCKET.IO
// =======================
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PATCH"],
  },
});

// Socket.io basic connection log
io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);
  socket.on("disconnect", () =>
    console.log("🔌 Client disconnected:", socket.id)
  );
});

// Make `io` accessible in controllers
app.set("io", io);

// =======================
// 🔹 ROUTES
// =======================
app.use("/api/auth", authRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/eco", ecoRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "ecoride-backend" });
});

// =======================
// 🔹 START SERVER
// =======================
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`✅ EcoRide backend running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect DB:", err);
    process.exit(1);
  });
