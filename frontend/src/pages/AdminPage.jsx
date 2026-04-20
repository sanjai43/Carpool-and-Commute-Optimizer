import { useEffect, useState } from "react";
import API from "../api/axios.js";
import Navbar from "../components/Navbar.jsx";
import useToast from "../hooks/useToast.jsx";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [rides, setRides] = useState([]);
  const [reports, setReports] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [insights, setInsights] = useState(null);
  const [insightsBusy, setInsightsBusy] = useState(false);
  const { showToast, ToastContainer } = useToast();

  const load = async () => {
    try {
      const [u, r, rep, m] = await Promise.all([
        API.get("/admin/users"),
        API.get("/admin/rides"),
        API.get("/admin/reports"),
        API.get("/admin/metrics"),
      ]);
      setUsers(u.data?.users || []);
      setRides(r.data?.rides || []);
      setReports(rep.data?.reports || []);
      setMetrics(m.data || null);
    } catch (e) {
      showToast(e.response?.data?.message || "❌ Failed to load admin data", "error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const loadInsights = async () => {
    try {
      setInsightsBusy(true);
      const res = await API.get("/ai/admin-insights");
      setInsights(res.data || null);
    } catch (e) {
      showToast(e.response?.data?.message || "❌ Failed to load AI insights", "error");
    } finally {
      setInsightsBusy(false);
    }
  };

  const seedNearMe = async () => {
    if (!navigator.geolocation) {
      showToast("Geolocation not available in this browser.", "error");
      return;
    }
    setSeeding(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const centerLat = pos.coords.latitude;
          const centerLng = pos.coords.longitude;
          await API.post("/admin/seed-rides", { centerLat, centerLng, count: 10, radiusKm: 10 });
          showToast("✅ Seeded 10 demo rides near you", "success");
          await load();
        } catch (e) {
          showToast(e.response?.data?.message || "❌ Failed to seed rides", "error");
        } finally {
          setSeeding(false);
        }
      },
      () => {
        setSeeding(false);
        showToast("Location permission denied (or unavailable).", "error");
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  };

  const seedCoimbatore = async () => {
    try {
      setSeeding(true);
      await API.post("/admin/seed-rides", { preset: "coimbatore", count: 18 });
      showToast("✅ Seeded demo rides around Coimbatore", "success");
      await load();
    } catch (e) {
      showToast(e.response?.data?.message || "❌ Failed to seed Coimbatore rides", "error");
    } finally {
      setSeeding(false);
    }
  };

  const resetDemo = async () => {
    try {
      setSeeding(true);
      await API.post("/admin/reset-demo");
      showToast("✅ Demo data reset", "success");
      await load();
    } catch (e) {
      showToast(e.response?.data?.message || "❌ Failed to reset demo data", "error");
    } finally {
      setSeeding(false);
    }
  };

  const fullSetup = async () => {
    try {
      setSeeding(true);
      await API.post("/admin/reset-demo").catch(() => {});
      await API.post("/admin/seed-rides", { preset: "coimbatore", count: 18 });
      await API.post("/sf/schedule-reminders").catch(() => {});
      showToast("✅ Full demo setup done", "success");
      await load();
    } catch (e) {
      showToast(e.response?.data?.message || "❌ Full setup failed", "error");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <>
      <Navbar />
      <ToastContainer />
      <div className="container" style={{ paddingTop: "80px" }}>
        <h2>🛡️ Admin</h2>

        {metrics && (
          <div className="card" style={{ background: "#14161b" }}>
            <h3 style={{ marginTop: 0 }}>Dashboard</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
              }}
            >
              <div className="panel">
                <div style={{ color: "#aaa", fontSize: 12 }}>Total rides</div>
                <div style={{ color: "#eaeaea", fontSize: 24, fontWeight: 800, marginTop: 6 }}>
                  {metrics.totalRides ?? 0}
                </div>
              </div>
              <div className="panel">
                <div style={{ color: "#aaa", fontSize: 12 }}>CO₂ saved (kg)</div>
                <div style={{ color: "#00b96f", fontSize: 24, fontWeight: 800, marginTop: 6 }}>
                  {Number(metrics.totalCO2 || 0).toFixed(2)}
                </div>
              </div>
              <div className="panel">
                <div style={{ color: "#aaa", fontSize: 12 }}>Revenue (₹)</div>
                <div style={{ color: "#eaeaea", fontSize: 24, fontWeight: 800, marginTop: 6 }}>
                  {Number(metrics.totalRevenue || 0).toFixed(0)}
                </div>
              </div>
              <div className="panel">
                <div style={{ color: "#aaa", fontSize: 12 }}>Incidents</div>
                <div style={{ color: "#eaeaea", fontSize: 13, marginTop: 10 }}>
                  SOS: <b style={{ color: "#ff6b6b" }}>{metrics.incidents?.SOS ?? 0}</b> • Reports:{" "}
                  <b style={{ color: "#ffaa00" }}>{metrics.incidents?.Report ?? 0}</b>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Demo tools</h3>
          <p style={{ color: "#aaa", marginTop: 0 }}>
            Generate rides around your current location to make the map demo look alive.
          </p>
          <div className="ui-row" style={{ gap: 10 }}>
            <button type="button" className="btn" onClick={seedNearMe} disabled={seeding}>
              {seeding ? "Seeding…" : "Generate 10 rides around me"}
            </button>
            <button type="button" className="btn" onClick={seedCoimbatore} disabled={seeding}>
              {seeding ? "Seeding…" : "Demo Setup: Coimbatore"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={resetDemo} disabled={seeding}>
              {seeding ? "Working…" : "Reset demo"}
            </button>
            <button type="button" className="btn" onClick={fullSetup} disabled={seeding}>
              {seeding ? "Working…" : "Full setup"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={loadInsights} disabled={insightsBusy}>
              {insightsBusy ? "Loading…" : "AI insights"}
            </button>
          </div>
          {insights?.summary && (
            <div className="card" style={{ background: "#111318", marginTop: 12 }}>
              <div style={{ color: "#aaa", fontSize: 12, marginBottom: 6 }}>Safety summary</div>
              <div style={{ color: "#e7e7e7", whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.45 }}>
                {insights.summary}
              </div>
              {Array.isArray(insights.topUsers) && insights.topUsers.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ color: "#aaa", fontSize: 12, marginBottom: 6 }}>Most reported</div>
                  {insights.topUsers.map((u) => (
                    <div key={u.userId} style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #262a33", padding: "8px 0", color: "#bbb" }}>
                      <span>{u.name}</span>
                      <span>{u.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h3>Users</h3>
          {users.length === 0 ? (
            <p style={{ color: "#aaa" }}>No users</p>
          ) : (
            users.map((u) => (
              <div
                key={u._id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  borderBottom: "1px solid #262a33",
                  padding: "8px 0",
                }}
              >
                <div>
                  <div style={{ color: "#fff" }}>
                    {u.name} <span style={{ color: "#aaa" }}>({u.role})</span>
                  </div>
                  <div style={{ color: "#aaa", fontSize: 12 }}>{u.email}</div>
                </div>
                <div style={{ color: "#aaa", fontSize: 12 }}>
                  ⭐ {u.ratingAvg} • {u.ratingCount}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h3>Rides</h3>
          {rides.length === 0 ? (
            <p style={{ color: "#aaa" }}>No rides</p>
          ) : (
            rides.slice(0, 30).map((r) => (
              <div
                key={r._id}
                style={{
                  borderBottom: "1px solid #262a33",
                  padding: "8px 0",
                }}
              >
                <div style={{ color: "#fff" }}>
                  {r.start} → {r.end}{" "}
                  <span style={{ color: "#aaa", fontSize: 12 }}>
                    ({r.status})
                  </span>
                </div>
                <div style={{ color: "#aaa", fontSize: 12 }}>
                  Driver: {r.driver?.name || "N/A"} • Seats: {r.passengers?.length || 0}/{r.capacity}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h3>Reports</h3>
          {reports.length === 0 ? (
            <p style={{ color: "#aaa" }}>No reports</p>
          ) : (
            reports.map((rep) => (
              <div key={rep._id} style={{ borderBottom: "1px solid #262a33", padding: "8px 0" }}>
                <div style={{ color: "#fff" }}>
                  {rep.reason}{" "}
                  {rep.flagged ? <span style={{ color: "#ffaa00", fontSize: 12 }}>• flagged</span> : null}
                </div>
                <div style={{ color: "#aaa", fontSize: 12 }}>
                  ride: {rep.rideId} • reported: {rep.reportedUserId} • by: {rep.reporterId}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
