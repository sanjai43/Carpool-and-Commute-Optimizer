export default function ConfirmModal({ show, onClose, onConfirm, ride }) {
  if (!show) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "#181a20",
          padding: "25px 30px",
          borderRadius: "10px",
          width: "340px",
          color: "#fff",
          boxShadow: "0 2px 15px rgba(0,0,0,0.4)",
          textAlign: "center",
          animation: "fadeIn 0.2s ease-in-out",
        }}
      >
        <h3 style={{ color: "#00b96f", marginBottom: "8px" }}>Confirm Ride</h3>
        <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "15px" }}>
          You’re about to join this ride with <b>{ride?.driver?.name}</b>
        </p>
        <p style={{ fontSize: "13px", color: "#ccc" }}>
          <b>From:</b> {ride?.start} <br />
          <b>To:</b> {ride?.end} <br />
          <b>CO₂ Saved:</b> {ride?.co2SavedKg} kg
        </p>

        <div style={{ marginTop: "18px", display: "flex", gap: "10px" }}>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              background: "#00b96f",
              color: "#fff",
              padding: "10px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Confirm
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              background: "#333",
              color: "#fff",
              padding: "10px",
              borderRadius: "6px",
              border: "none",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
