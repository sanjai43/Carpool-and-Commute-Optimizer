const normalizeStatus = (status) => {
  const s = String(status || "").toLowerCase();
  if (s.includes("cancel")) return { label: "Cancelled", tone: "danger" };
  if (s.includes("complete")) return { label: "Completed", tone: "success" };
  if (s.includes("full")) return { label: "Full", tone: "warn" };
  if (s.includes("open")) return { label: "Open", tone: "success" };
  if (!s) return { label: "Unknown", tone: "muted" };
  return { label: status, tone: "muted" };
};

export default function StatusBadge({ status }) {
  const { label, tone } = normalizeStatus(status);
  return <span className={`status-badge status-badge--${tone}`}>{label}</span>;
}

