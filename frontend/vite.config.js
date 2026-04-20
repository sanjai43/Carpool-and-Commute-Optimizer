import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import process from "node:process";
// Backend binds to IPv4 (127.0.0.1) in this repo; use IPv4 target to avoid ::1 websocket proxy resets.
const backendTarget = process.env.BACKEND_TARGET || "http://127.0.0.1:5001";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/socket.io": {
        target: backendTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
