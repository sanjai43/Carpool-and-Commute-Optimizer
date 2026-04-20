import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../context/SocketContext.jsx";
import { clearNotifications, loadNotifications, markAllRead, pushNotification } from "../lib/notifications.js";

export default function Navbar() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [openNotifs, setOpenNotifs] = useState(false);
  const [banner, setBanner] = useState(null); // { text, tone }
  const socket = useSocket();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user?.name) setUserName(user.name.split(" ")[0]);
    if (user?.role) setRole(user.role);

    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setNotifications(loadNotifications());
  }, []);

  useEffect(() => {
    if (!socket) return;

    const showBanner = (text, tone = "info") => {
      setBanner({ text, tone });
      window.clearTimeout(showBanner._t);
      showBanner._t = window.setTimeout(() => setBanner(null), 4500);
    };

    const push = (text) => {
      const next = pushNotification(text);
      setNotifications(next);

      if (Notification?.permission === "granted") {
        try {
          new Notification("CarShary", { body: text });
        } catch {
          // ignore
        }
      }
    };

    const onNew = (ride) => {
      const t = `New ride: ${ride?.start || ""} → ${ride?.end || ""}`;
      push(t);
      showBanner(t, "success");
    };
    const onAccepted = ({ driver }) => {
      const t = `Your request was accepted by ${driver}`;
      push(t);
      showBanner(t, "success");
    };
    const onRejected = ({ driver }) => {
      const t = `Your request was rejected by ${driver}`;
      push(t);
      showBanner(t, "warning");
    };
    const onCompleted = ({ driver }) => {
      const t = `Ride completed by ${driver}`;
      push(t);
      showBanner(t, "success");
    };
    const onCancelled = ({ reason }) => {
      const t = `Ride cancelled: ${reason}`;
      push(t);
      showBanner(t, "warning");
    };
    const onMessage = ({ message }) => {
      const t = `New message from ${message?.userName || "user"}`;
      push(t);
      showBanner(t, "info");
    };

    socket.on("ride:new", onNew);
    socket.on("ride:accepted", onAccepted);
    socket.on("ride:rejected", onRejected);
    socket.on("ride:completed", onCompleted);
    socket.on("ride:cancelled", onCancelled);
    socket.on("ride:message", onMessage);

    return () => {
      socket.off("ride:new", onNew);
      socket.off("ride:accepted", onAccepted);
      socket.off("ride:rejected", onRejected);
      socket.off("ride:completed", onCompleted);
      socket.off("ride:cancelled", onCancelled);
      socket.off("ride:message", onMessage);
    };
  }, [socket]);

  const unread = notifications.reduce((acc, n) => acc + (n.read ? 0 : 1), 0);

  const logout = () => {
    try {
      // Best-effort cookie clear
      fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    } catch {
      // ignore
    }
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("role");
    navigate("/login", { replace: true });
  };

  const navButtonStyle = {
    background: "transparent",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: "15px",
    transition: "0.3s",
  };

  return (
    <>
      {banner?.text ? (
        <div
          style={{
            position: "fixed",
            top: scrolled ? 55 : 70,
            left: 0,
            width: "100%",
            zIndex: 1001,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              pointerEvents: "auto",
              background:
                banner.tone === "success"
                  ? "rgba(0,185,111,0.18)"
                  : banner.tone === "warning"
                  ? "rgba(255,170,0,0.18)"
                  : "rgba(255,255,255,0.08)",
              border:
                banner.tone === "success"
                  ? "1px solid rgba(0,185,111,0.35)"
                  : banner.tone === "warning"
                  ? "1px solid rgba(255,170,0,0.35)"
                  : "1px solid rgba(255,255,255,0.16)",
              color: "#eaeaea",
              padding: "10px 12px",
              borderRadius: 10,
              width: "min(920px, calc(100% - 24px))",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {banner.text}
            </div>
            <button
              type="button"
              onClick={() => setBanner(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#bbb",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ) : null}

      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: scrolled ? "55px" : "70px",
          background: scrolled
            ? "rgba(18, 20, 25, 0.9)"
            : "rgba(18, 20, 25, 0.6)",
          backdropFilter: "blur(10px)",
          boxShadow: scrolled
            ? "0 0 15px rgba(0,185,111,0.3)"
            : "0 0 0 transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 25px",
          transition: "all 0.3s ease",
          zIndex: 1000,
        }}
      >
        {/* 🚗 Logo */}
        <div
          style={{
            color: "#00b96f",
            fontWeight: "700",
            fontSize: scrolled ? "1.3rem" : "1.5rem",
            letterSpacing: "0.5px",
            cursor: "pointer",
          }}
          onClick={() => navigate("/")}
        >
          CarPoolX
        </div>

      {/* 🧭 Navigation Buttons */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}
      >
        {/* Common Nav Options */}
        <button
          style={navButtonStyle}
          onClick={() => navigate("/")}
          onMouseOver={(e) => (e.target.style.color = "#00b96f")}
          onMouseOut={(e) => (e.target.style.color = "#fff")}
        >
          Home
        </button>

        {role === "Rider" && (
          <button
            style={navButtonStyle}
            onClick={() => navigate("/match")}
            onMouseOver={(e) => (e.target.style.color = "#00b96f")}
            onMouseOut={(e) => (e.target.style.color = "#fff")}
          >
            Find Ride
          </button>
        )}

        {role === "Driver" && (
          <button
            style={navButtonStyle}
            onClick={() => navigate("/new")}
            onMouseOver={(e) => (e.target.style.color = "#00b96f")}
            onMouseOut={(e) => (e.target.style.color = "#fff")}
          >
            Offer Ride
          </button>
        )}

        <button
          style={navButtonStyle}
          onClick={() => navigate("/eco")}
          onMouseOver={(e) => (e.target.style.color = "#00b96f")}
          onMouseOut={(e) => (e.target.style.color = "#fff")}
        >
          Eco Stats
        </button>

        <button
          style={navButtonStyle}
          onClick={() => navigate("/promos")}
          onMouseOver={(e) => (e.target.style.color = "#00b96f")}
          onMouseOut={(e) => (e.target.style.color = "#fff")}
        >
          Discounts
        </button>

        <button
          style={navButtonStyle}
          onClick={() => navigate("/demo")}
          onMouseOver={(e) => (e.target.style.color = "#00b96f")}
          onMouseOut={(e) => (e.target.style.color = "#fff")}
        >
          Demo Guide
        </button>

        {/* 🧭 Conditional Links by Role */}
        {role === "Driver" && (
          <button
            style={navButtonStyle}
            onClick={() => navigate("/myrides")}
            onMouseOver={(e) => (e.target.style.color = "#00b96f")}
            onMouseOut={(e) => (e.target.style.color = "#fff")}
          >
            My Rides
          </button>
        )}

        {role === "Driver" && (
          <button
            style={navButtonStyle}
            onClick={() => navigate("/earnings")}
            onMouseOver={(e) => (e.target.style.color = "#00b96f")}
            onMouseOut={(e) => (e.target.style.color = "#fff")}
          >
            Earnings
          </button>
        )}

        {role === "Rider" && (
          <button
            style={navButtonStyle}
            onClick={() => navigate("/joined")}
            onMouseOver={(e) => (e.target.style.color = "#00b96f")}
            onMouseOut={(e) => (e.target.style.color = "#fff")}
          >
            My Joined Rides
          </button>
        )}

        {role === "Admin" && (
          <button
            style={navButtonStyle}
            onClick={() => navigate("/admin")}
            onMouseOver={(e) => (e.target.style.color = "#00b96f")}
            onMouseOut={(e) => (e.target.style.color = "#fff")}
          >
            Admin
          </button>
        )}

        {/* 👋 User Info */}
        <div
          style={{
            color: "#aaa",
            fontSize: "14px",
            borderLeft: "1px solid #333",
            paddingLeft: "15px",
          }}
        >
          👋 {userName || "User"} {role ? `(${role})` : ""}
        </div>

        {/* 🔔 Notifications */}
        <div style={{ position: "relative" }}>
          <button
            type="button"
            style={navButtonStyle}
            onClick={() => {
              setOpenNotifs((s) => !s);
              if (!openNotifs) setNotifications(markAllRead());
            }}
            title="Notifications"
          >
            🔔{unread ? ` (${unread})` : ""}
          </button>
          {openNotifs && (
            <div
              className="card"
              style={{
                position: "absolute",
                right: 0,
                top: 40,
                width: 320,
                maxHeight: 360,
                overflow: "auto",
                background: "#14161b",
                zIndex: 3000,
              }}
            >
              <div className="ui-row ui-between">
                <div>
                  <b>Notifications</b>
                  <div style={{ color: "#888", fontSize: 12 }}>{unread ? `${unread} unread` : "All read"}</div>
                </div>
                <div className="ui-row" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => {
                      if (!("Notification" in window)) return;
                      Notification.requestPermission().catch(() => {});
                    }}
                  >
                    Enable
                  </button>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => {
                      setOpenNotifs(false);
                      navigate("/notifications");
                    }}
                  >
                    View
                  </button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <p style={{ color: "#aaa" }}>No notifications</p>
              ) : (
                notifications.slice(0, 6).map((n) => (
                  <div
                    key={n._id}
                    style={{
                      borderTop: "1px solid #262a33",
                      paddingTop: 8,
                      marginTop: 8,
                      opacity: n.read ? 0.75 : 1,
                    }}
                  >
                    <div style={{ color: "#eee", fontSize: 13 }}>{n.text}</div>
                    <div style={{ color: "#888", fontSize: 11 }}>
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setNotifications(clearNotifications());
                  }}
                  className="btn btn--sm btn--danger"
                  style={{ width: "100%", marginTop: 10 }}
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* 🚪 Logout */}
        <button
          onClick={logout}
          style={{
            background: "#d33",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "6px 10px",
            cursor: "pointer",
            fontSize: "14px",
            transition: "0.3s",
          }}
          onMouseOver={(e) => (e.target.style.background = "#b22")}
          onMouseOut={(e) => (e.target.style.background = "#d33")}
        >
          Logout
        </button>
      </div>
      </nav>
    </>
  );
}
