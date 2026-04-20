import { useEffect, useRef, useState } from "react";
import API from "../api/axios.js";
import useToast from "../hooks/useToast.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

export default function RideChatModal({ open, ride, onClose }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [shareLive, setShareLive] = useState(false);
  const [live, setLive] = useState({}); // { userId: { lat,lng,userName,t } }
  const { showToast, ToastContainer } = useToast();
  const bottomRef = useRef(null);
  const socket = useSocket();
  const watchIdRef = useRef(null);

  useEffect(() => {
    if (!open || !ride?._id) return;
    API.get(`/rides/${ride._id}/messages`)
      .then((res) => setMessages(res.data?.messages || []))
      .catch(() => showToast("❌ Failed to load chat", "error"));
  }, [open, ride?._id]);

  useEffect(() => {
    if (!open || !socket || !ride?._id) return;
    socket.emit("ride:joinRoom", { rideId: ride._id });
    return () => socket.emit("ride:leaveRoom", { rideId: ride._id });
  }, [open, socket, ride?._id]);

  useEffect(() => {
    if (!open || !socket) return;
    const onMessage = ({ rideId, message }) => {
      if (rideId !== ride?._id) return;
      setMessages((prev) => [...prev, message]);
    };
    const onLoc = (p) => {
      if (p?.rideId !== ride?._id) return;
      if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lng)) return;
      const key = p.userId || p.userName || "unknown";
      setLive((prev) => ({ ...prev, [key]: { ...p } }));
    };
    socket.on("ride:message", onMessage);
    socket.on("ride:loc", onLoc);
    return () => socket.off("ride:message", onMessage);
  }, [open, socket, ride?._id]);

  useEffect(() => {
    if (!open) return;
    if (!shareLive) {
      if (watchIdRef.current !== null && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
      return;
    }
    if (!navigator.geolocation) {
      showToast("Geolocation not available.", "error");
      setShareLive(false);
      return;
    }
    const me = (() => {
      try {
        return JSON.parse(localStorage.getItem("user") || "null");
      } catch {
        return null;
      }
    })();
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        socket?.emit("ride:loc", {
          rideId: ride?._id,
          userId: me?.id || me?._id || null,
          userName: me?.name || null,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          t: Date.now(),
        });
      },
      () => {
        showToast("Location permission denied.", "error");
        setShareLive(false);
      },
      { enableHighAccuracy: false, maximumAge: 5000, timeout: 8000 }
    );
    return () => {
      if (watchIdRef.current !== null && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      watchIdRef.current = null;
    };
  }, [open, shareLive, socket, ride?._id, showToast]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      const res = await API.post(`/rides/${ride._id}/messages`, { text: trimmed });
      setText("");
      // optimistic add if socket is slow
      if (res.data?.message) setMessages((prev) => [...prev, res.data.message]);
    } catch {
      showToast("❌ Failed to send message (maybe blocked)", "error");
    }
  };

  if (!open) return null;

  const liveList = Object.values(live || {}).sort((a, b) => (b.t || 0) - (a.t || 0));
  const liveCenter = liveList[0] ? [liveList[0].lat, liveList[0].lng] : null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <ToastContainer />
      <div
        className="card"
        style={{
          width: "min(720px, 96vw)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          background: "#14161b",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div>
            <h3 style={{ margin: 0 }}>{ride.start} → {ride.end}</h3>
            <p style={{ margin: 0, color: "#aaa", fontSize: 12 }}>Ride chat</p>
          </div>
          <div className="ui-row" style={{ gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, color: "#bbb", fontSize: 12 }}>
              <input
                type="checkbox"
                checked={shareLive}
                onChange={(e) => setShareLive(e.target.checked)}
                style={{ width: "auto", margin: 0 }}
              />
              Share live
            </label>
            <button
              type="button"
              className="btn btn--sm btn--danger"
              onClick={async () => {
                const ok = window.confirm("Trigger SOS for this ride? This will alert admins in Salesforce.");
                if (!ok) return;
                try {
                  await API.post(`/rides/${ride._id}/sos`, { reason: "SOS from chat" });
                  showToast("🆘 SOS sent. Admins will be alerted in Salesforce.", "success");
                } catch (e) {
                  showToast(e.response?.data?.message || "❌ Failed to send SOS", "error");
                }
              }}
            >
              SOS
            </button>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              disabled={suggestBusy}
              onClick={async () => {
                try {
                  setSuggestBusy(true);
                  const res = await API.post("/ai/chat-suggest", { lastMessages: messages.slice(-8) });
                  const list = res.data?.suggestions;
                  setSuggestions(Array.isArray(list) ? list : []);
                } catch {
                  showToast("❌ Failed to generate suggestions", "error");
                } finally {
                  setSuggestBusy(false);
                }
              }}
            >
              {suggestBusy ? "Thinking…" : "Suggest replies"}
            </button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {liveCenter && (
          <div className="panel" style={{ marginTop: 10, background: "#0f1115" }}>
            <div style={{ color: "#aaa", fontSize: 12, marginBottom: 8 }}>Live locations</div>
            <div style={{ height: 180, borderRadius: 12, overflow: "hidden", border: "1px solid #262a33" }}>
              <MapContainer center={liveCenter} zoom={13} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution="&copy; OpenStreetMap"
                />
                {liveList.slice(0, 8).map((p) => (
                  <Marker key={`${p.userId || p.userName}-${p.t}`} position={[p.lat, p.lng]} />
                ))}
              </MapContainer>
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: 10,
            padding: 10,
            background: "#0f1115",
            borderRadius: 8,
            overflowY: "auto",
            flex: 1,
            border: "1px solid #262a33",
          }}
        >
          {messages.length === 0 ? (
            <p style={{ color: "#888" }}>No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div key={m._id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: "#aaa" }}>
                  <b style={{ color: "#00b96f" }}>{m.userName || "User"}</b> •{" "}
                  {new Date(m.createdAt).toLocaleString()}
                </div>
                <div style={{ color: "#eee" }}>
                  {m.text}{" "}
                  {m.flagged ? <span style={{ color: "#ffaa00", fontSize: 11 }}>• flagged</span> : null}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {suggestions.length > 0 && (
          <div className="panel" style={{ marginTop: 10 }}>
            <div style={{ color: "#aaa", fontSize: 12, marginBottom: 8 }}>Quick replies</div>
            <div className="ui-row" style={{ gap: 8 }}>
              {suggestions.map((s) => (
                <button key={s} type="button" className="btn btn--sm btn--ghost" onClick={() => setText(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message…"
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
          />
          <button type="button" className="btn" onClick={send}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
