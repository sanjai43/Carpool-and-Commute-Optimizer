export const formatCountdown = (iso) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const diffMin = Math.round((t - Date.now()) / 60000);
  if (diffMin > 0) return `Starts in ${diffMin} min`;
  if (diffMin > -10) return "Starting now";
  return "Departed";
};

export const formatMemberSince = (iso) => {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toLocaleDateString();
};

