import { useCallback, useEffect, useState } from "react";
import API from "../api/axios.js";
import Navbar from "../components/Navbar.jsx";
import useToast from "../hooks/useToast.jsx";
import { useSocket } from "../context/SocketContext.jsx";

export default function EarningsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast, ToastContainer } = useToast();
  const socket = useSocket();

  const load = useCallback(() => {
    let mounted = true;
    setLoading(true);
    API.get("/driver/earnings")
      .then((res) => {
        if (!mounted) return;
        setData(res.data || null);
      })
      .catch((e) => {
        showToast(e.response?.data?.message || "❌ Failed to load earnings", "error");
        setData({ total: 0, rides: [] });
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
      if (kinds.includes("earnings")) load();
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
          <h2 style={{ color: "#00b96f", marginTop: 0 }}>Earnings</h2>
          <p style={{ color: "#aaa", marginTop: 0 }}>
            Driver payout view (Salesforce powered).
          </p>

          {loading ? (
            <div className="card">Loading…</div>
          ) : (
            <>
              <div className="card" style={{ background: "#14161b" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ color: "#aaa", fontSize: 12 }}>Total earned</div>
                    <div style={{ color: "#eaeaea", fontSize: 28, fontWeight: 800, marginTop: 6 }}>
                      ₹{Number(data?.total || 0).toFixed(0)}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#aaa", fontSize: 12 }}>Completed rides</div>
                    <div style={{ color: "#eaeaea", fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                      {Array.isArray(data?.rides) ? data.rides.length : 0}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ background: "#14161b" }}>
                <h3 style={{ marginTop: 0 }}>By ride</h3>
                {!Array.isArray(data?.rides) || data.rides.length === 0 ? (
                  <div style={{ color: "#aaa" }}>No completed rides yet.</div>
                ) : (
                  data.rides.map((r) => (
                    <div
                      key={r.rideId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        borderTop: "1px solid #262a33",
                        padding: "10px 0",
                        color: "#bbb",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: "#eaeaea", fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis" }}>
                          Ride {String(r.rideId).slice(-6)}
                        </div>
                        <div style={{ color: "#888", fontSize: 12, marginTop: 4 }}>
                          Riders paid: {r.riders}
                        </div>
                      </div>
                      <div style={{ color: "#00b96f", fontWeight: 800 }}>₹{Number(r.total || 0).toFixed(0)}</div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
