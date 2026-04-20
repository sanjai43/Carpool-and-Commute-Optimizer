import { io } from "socket.io-client";

const resolveSocketUrl = () => {
  // In dev we proxy `/socket.io` via Vite, so same-origin is best.
  if (import.meta.env.DEV) return window.location.origin;
  return import.meta.env.VITE_SOCKET_URL || window.location.origin;
};

export const socket = io(resolveSocketUrl(), {
  path: "/socket.io",
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelayMax: 4000,
});

