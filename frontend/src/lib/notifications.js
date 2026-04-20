const KEY = "notifications";

export function loadNotifications() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    // Back-compat: older notifications had no `read`
    return arr
      .map((n) => ({
        _id: n?._id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        text: String(n?.text || ""),
        createdAt: typeof n?.createdAt === "number" ? n.createdAt : Date.now(),
        read: typeof n?.read === "boolean" ? n.read : false,
      }))
      .filter((n) => n.text);
  } catch {
    return [];
  }
}

export function saveNotifications(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function pushNotification(text) {
  const n = {
    _id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    text,
    createdAt: Date.now(),
    read: false,
  };
  const prev = loadNotifications();
  const next = [n, ...prev].slice(0, 60);
  saveNotifications(next);
  return next;
}

export function markAllRead() {
  const prev = loadNotifications();
  const next = prev.map((n) => ({ ...n, read: true }));
  saveNotifications(next);
  return next;
}

export function clearNotifications() {
  saveNotifications([]);
  return [];
}

export function deleteNotification(id) {
  const prev = loadNotifications();
  const next = prev.filter((n) => n._id !== id);
  saveNotifications(next);
  return next;
}

