import { useEffect, useState } from "react";
import API from "../api/axios.js";
import useToast from "../hooks/useToast.jsx";

export default function ConfirmModal({
  show,
  onClose,
  onConfirm,
  ride,
  pickupOptions = [],
  dropOptions = [],
}) {
  const [pickupKey, setPickupKey] = useState("");
  const [dropKey, setDropKey] = useState("");
  const [aiMsg, setAiMsg] = useState("");
  const [msgLoading, setMsgLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const { showToast, ToastContainer } = useToast();

  const pick0 = pickupOptions[0]?.value || null;
  const drop0 = dropOptions[0]?.value || null;

  useEffect(() => {
    if (!show) return;
    setPickupKey(pickupOptions[0]?.key || "");
  }, [pickupOptions, show]);

  useEffect(() => {
    if (!show) return;
    setDropKey(dropOptions[0]?.key || "");
    setAiMsg("");
    setPromoCode("");
  }, [dropOptions, show]);

  if (!show) return null;

  const pickup = pickupOptions.find((o) => o.key === pickupKey)?.value ?? pick0;
  const drop = dropOptions.find((o) => o.key === dropKey)?.value ?? drop0;

  const generate = async () => {
    try {
      setMsgLoading(true);
      const res = await API.post("/ai/request-message", {
        ride,
        pickupLabel: pickup?.label || null,
        dropLabel: drop?.label || null,
      });
      setAiMsg(res.data?.text || "");
    } catch {
      showToast("❌ Failed to generate message", "error");
    } finally {
      setMsgLoading(false);
    }
  };

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
      <ToastContainer />
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

        {pickupOptions.length > 0 && (
          <div style={{ textAlign: "left", marginTop: 12 }}>
            <label style={{ color: "#aaa", fontSize: 12 }}>Pickup point</label>
            <select
              value={pickupKey}
              onChange={(e) => setPickupKey(e.target.value)}
              style={{ width: "100%", marginTop: 6 }}
            >
              {pickupOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {dropOptions.length > 0 && (
          <div style={{ textAlign: "left", marginTop: 12 }}>
            <label style={{ color: "#aaa", fontSize: 12 }}>Drop point</label>
            <select
              value={dropKey}
              onChange={(e) => setDropKey(e.target.value)}
              style={{ width: "100%", marginTop: 6 }}
            >
              {dropOptions.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ textAlign: "left", marginTop: 12 }}>
          <label style={{ color: "#aaa", fontSize: 12 }}>Promo code (optional)</label>
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder="e.g. CBE-xxxxx"
            style={{ marginTop: 6 }}
          />
          <div style={{ color: "#888", fontSize: 11, marginTop: 6 }}>
            If valid, discount applies after the driver accepts.
          </div>
        </div>

        <div className="card" style={{ background: "#15171c", marginTop: 12, textAlign: "left" }}>
          <div className="ui-row ui-between">
            <div style={{ color: "#bbb", fontSize: 12 }}>Suggested message</div>
            <button type="button" className="btn btn--sm btn--ghost" onClick={generate} disabled={msgLoading}>
              {msgLoading ? "Generating…" : "Generate"}
            </button>
          </div>
          {aiMsg ? (
            <>
              <div style={{ color: "#eee", fontSize: 13, marginTop: 8, lineHeight: 1.4 }}>{aiMsg}</div>
              <div className="ui-row" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => {
                    navigator.clipboard?.writeText(aiMsg).catch(() => {});
                    showToast("Copied", "success");
                  }}
                >
                  Copy
                </button>
              </div>
            </>
          ) : (
            <div style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
              Generate a polite request (demo AI).
            </div>
          )}
        </div>

        <div style={{ marginTop: "18px", display: "flex", gap: "10px" }}>
          <button
            onClick={() =>
              onConfirm({
                pickup,
                drop,
                promoCode: promoCode.trim() || null,
              })
            }
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
