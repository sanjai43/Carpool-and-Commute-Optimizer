import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/authRoutes.js";
import rideRoutes from "./routes/rideRoutes.js";
import ecoRoutes from "./routes/ecoRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import sfRoutes from "./routes/sfRoutes.js";
import promoRoutes from "./routes/promoRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import safetyRoutes from "./routes/safetyRoutes.js";
import verificationRoutes from "./routes/verificationRoutes.js";
import { validateEnv } from "./config/validateEnv.js";

export const createApp = ({ io, staticDir } = {}) => {
  const app = express();
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = "dev_jwt_secret_change_me";
  validateEnv();

  const allowedOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

  const corsOptions = {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (process.env.NODE_ENV !== "production") return callback(null, true);
      return callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  };

  app.use(cors(corsOptions));
  app.options(/.*/, cors(corsOptions));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));

  if (io) app.set("io", io);

  app.use("/api/auth", authRoutes);
  app.use("/api/rides", rideRoutes);
  app.use("/api/eco", ecoRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/sf", sfRoutes);
  app.use("/api/promos", promoRoutes);
  app.use("/api/driver", driverRoutes);
  app.use("/api/safety", safetyRoutes);
  app.use("/api/verify", verificationRoutes);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "ecoride-backend" });
  });

  // Serve frontend build (optional, for `npm run build` + `npm start` demo)
  if (staticDir) {
    const indexPath = path.join(staticDir, "index.html");
    if (fs.existsSync(indexPath)) {
      app.use(express.static(staticDir));
      // SPA fallback (avoid Express 5 "*" path-to-regexp issues by using regex)
      app.get(/^(?!\/api).*/, (_req, res) => {
        res.sendFile(indexPath);
      });
    }
  }

  return app;
};
