import { useCallback, useEffect, useState } from "react";
import API from "../api/axios.js";
import Navbar from "../components/Navbar.jsx";
import useToast from "../hooks/useToast.jsx";
import { useSocket } from "../context/SocketContext.jsx";

const formatExpiry = (iso) => {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return iso;
  return new Date(t).toLocaleString();
};

export default function PromosPage() {
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const { showToast, ToastContainer } = useToast();
  const socket = useSocket();

  const load = useCallback(() => {
    let mounted = true;
    setLoading(true);
    API.get("/promos/mine")
      .then((res) => {
        if (!mounted) return;
        setPromos(res.data?.promos || []);
      })
      .catch((e) => {
        showToast(e.response?.data?.message || "❌ Failed to load promo codes", "error");
        setPromos([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [showToast]);

  useEffect(() => {
    return load();
  }, [load]);

  useEffect(() => {
    if (!socket) return;
    const handler = (payload) => {
      const kinds = payload?.kinds || [];
      if (kinds.includes("promos")) load();
    };
    socket.on("user:dataChanged", handler);
    return () => socket.off("user:dataChanged", handler);
  }, [load, socket]);

  return (
    <>
      <Navbar />
      <ToastContainer />
      <div style={{ minHeight: "calc(100vh - 60px)", paddingTop: "80px", paddingBottom: "30px" }}>
        <div className="container fade-in" style={{ marginTop: 0 }}>
          <h2 style={{ color: "#00b96f", marginTop: 0 }}>Discounts</h2>
          <p style={{ color: "#aaa", marginTop: 0 }}>
            Your earned promo codes (Salesforce powered).
          </p>

          {loading ? (
            <div className="card">Loading…</div>
          ) : promos.length === 0 ? (
            <div className="card" style={{ color: "#aaa" }}>
              No promo codes yet. Complete a ride to earn rewards.
            </div>
          ) : (
            <div className="card" style={{ background: "#14161b" }}>
              {promos.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "10px 0",
                    borderTop: "1px solid #262a33",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: "#eaeaea", fontWeight: 700 }}>
                      {p.code}{" "}
                      {!p.active ? <span style={{ color: "#888", fontWeight: 500 }}>(inactive)</span> : null}
                    </div>
                    <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
                      {p.discountType === "Percent" ? `${p.value}% off` : `₹${p.value} off`} • Uses{" "}
                      {p.usedCount}/{p.maxUses || 1} • Expires {formatExpiry(p.expiresAt)}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={() => {
                      navigator.clipboard?.writeText(p.code).catch(() => {});
                      showToast("Copied promo code", "success");
                    }}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
