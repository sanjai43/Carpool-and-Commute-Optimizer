/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo } from "react";
import { socket as singletonSocket } from "../lib/socket.js";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  useEffect(() => {
    const joinUserRoom = () => {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        const userId = user?._id || user?.id;
        if (userId) singletonSocket.emit("user:joinRoom", { userId });
      } catch {
        // ignore
      }
    };

    singletonSocket.connect();
    singletonSocket.on("connect", joinUserRoom);
    joinUserRoom();
    return () => {
      singletonSocket.off("connect", joinUserRoom);
      singletonSocket.disconnect();
    };
  }, []);

  const value = useMemo(() => singletonSocket, []);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const socket = useContext(SocketContext);
  if (!socket) return singletonSocket;
  return socket;
}
