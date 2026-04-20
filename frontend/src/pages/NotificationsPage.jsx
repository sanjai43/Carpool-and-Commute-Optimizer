import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar.jsx";
import {
  clearNotifications,
  deleteNotification,
  loadNotifications,
  markAllRead,
  saveNotifications,
} from "../lib/notifications.js";

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  useEffect(() => {
    setItems(loadNotifications());
  }, []);

  const unreadCount = useMemo(
    () => items.reduce((acc, n) => acc + (n.read ? 0 : 1), 0),
    [items]
  );

  const visible = useMemo(() => {
    const list = showUnreadOnly ? items.filter((n) => !n.read) : items;
    return list;
  }, [items, showUnreadOnly]);

  const enableBrowser = () => {
    if (!("Notification" in window)) return;
    Notification.requestPermission().catch(() => {});
  };

  const onMarkAllRead = () => setItems(markAllRead());
  const onClear = () => setItems(clearNotifications());
  const onDeleteOne = (id) => setItems(deleteNotification(id));

  const toggleRead = (id) => {
    const next = items.map((n) => (n._id === id ? { ...n, read: !n.read } : n));
    saveNotifications(next);
    setItems(next);
  };

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: 80 }}>
        <div className="ui-row ui-between" style={{ marginBottom: 10 }}>
          <div>
            <h2 style={{ margin: 0, color: "#00b96f" }}>Notifications</h2>
            <div style={{ color: "#aaa", fontSize: 13 }}>
              {unreadCount ? `${unreadCount} unread` : "All caught up"}
            </div>
          </div>
          <div className="ui-row">
            <button type="button" className="btn btn--sm btn--ghost" onClick={enableBrowser}>
              Enable browser
            </button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={onMarkAllRead} disabled={!items.length}>
              Mark all read
            </button>
            <button type="button" className="btn btn--sm btn--danger" onClick={onClear} disabled={!items.length}>
              Clear
            </button>
          </div>
        </div>

        <div className="panel">
          <label style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={showUnreadOnly}
              onChange={(e) => setShowUnreadOnly(e.target.checked)}
              style={{ width: "auto", margin: 0 }}
            />
            Show unread only
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          {visible.length === 0 ? (
            <div className="panel" style={{ color: "#aaa" }}>
              No notifications to show.
            </div>
          ) : (
            visible.map((n) => (
              <div
                key={n._id}
                className="card"
                style={{
                  background: n.read ? "#14161b" : "rgba(0, 185, 111, 0.08)",
                  borderColor: n.read ? "#262a33" : "rgba(0, 185, 111, 0.35)",
                }}
              >
                <div className="ui-row ui-between" style={{ gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#eee", fontSize: 14, overflowWrap: "anywhere" }}>{n.text}</div>
                    <div style={{ color: "#888", fontSize: 11, marginTop: 6 }}>
                      {new Date(n.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="ui-row" style={{ gap: 8 }}>
                    <button type="button" className="btn btn--sm btn--ghost" onClick={() => toggleRead(n._id)}>
                      {n.read ? "Unread" : "Read"}
                    </button>
                    <button type="button" className="btn btn--sm btn--danger" onClick={() => onDeleteOne(n._id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

