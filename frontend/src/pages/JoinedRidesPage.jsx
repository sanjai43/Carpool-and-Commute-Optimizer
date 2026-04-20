import { useEffect, useState } from "react";
import API from "../api/axios.js";
import Navbar from "../components/Navbar.jsx";
import useToast from "../hooks/useToast.jsx";
import RideChatModal from "../components/RideChatModal.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { formatCountdown } from "../lib/time.js";

export default function JoinedRidesPage() {
  const [rides, setRides] = useState([]);
  const { showToast, ToastContainer } = useToast();
  const [chatRide, setChatRide] = useState(null);

  const fetchJoinedRides = async () => {
    try {
      const { data } = await API.get("/rides/joined");
      setRides(data);
    } catch (err) {
      console.error("❌ Fetch Joined Rides Error:", err);
      showToast("❌ Failed to load joined rides", "error");
    }
  };

  useEffect(() => {
    fetchJoinedRides();
  }, []);

  const leaveRide = async (rideId) => {
    try {
      await API.delete(`/rides/${rideId}/leave`);
      showToast("✅ Left ride", "success");
      fetchJoinedRides();
    } catch (e) {
      showToast(e.response?.data?.message || "❌ Failed to leave ride", "error");
    }
  };

  const rate = async (rideId, stars) => {
    try {
      await API.post(`/rides/${rideId}/rate`, { stars });
      showToast("✅ Thanks for rating!", "success");
    } catch (e) {
      showToast(e.response?.data?.message || "❌ Failed to rate", "error");
    }
  };

  const report = async (rideId, reportedUserId) => {
    const reason = prompt("Report reason (short):");
    if (!reason) return;
    try {
      await API.post(`/rides/${rideId}/report`, { reportedUserId, reason });
      showToast("✅ Report submitted", "success");
    } catch (e) {
      showToast(e.response?.data?.message || "❌ Failed to report", "error");
    }
  };

  const block = async (userId) => {
    try {
      await API.post(`/auth/block/${userId}`);
      showToast("✅ User blocked. Their rides will be hidden.", "success");
    } catch (e) {
      showToast(e.response?.data?.message || "❌ Failed to block user", "error");
    }
  };

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: "80px" }}>
        <h2 style={{ color: "#00b96f", marginBottom: "20px" }}> My Joined Rides</h2>

        {rides.length === 0 ? (
          <p style={{ color: "#aaa" }}>You haven’t joined any rides yet.</p>
        ) : (
          rides.map((r) => (
            <div
              key={r._id}
              className="card"
            >
              <div className="ride-head" style={{ marginBottom: 6 }}>
                <h3 style={{ color: "#00b96f", margin: 0 }}>
                  {r.start} → {r.end}
                </h3>
                <StatusBadge status={r.status} />
              </div>
              <p style={{ color: "#ccc" }}>
                Driver: {r.driver?.name || "N/A"}{" "}
                {r.driver?.verified ? <span style={{ color: "#00b96f" }}>✓ Verified</span> : null}{" "}
                {r.driver?.ratingCount ? (
                  <span style={{ color: "#aaa", fontSize: 12 }}>
                    (⭐ {r.driver.ratingAvg} • {r.driver.ratingCount})
                  </span>
                ) : null}
              </p>
              <p style={{ color: "#aaa" }}>
                {r.distanceKm} km | CO₂ Saved: {r.co2SavedKg} kg
              </p>
              {r.departureTime && (
                <p style={{ color: "#aaa", fontSize: 13, marginTop: 0 }}>
                  {formatCountdown(r.departureTime)} • {new Date(r.departureTime).toLocaleString()} • {r.vehicleType}
                </p>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setChatRide(r)}
                  style={{ background: "#1e2026", border: "1px solid #00b96f", color: "#00b96f" }}
                >
                  💬 Chat
                </button>
                {r.status !== "Completed" && r.status !== "Cancelled" && (
                  <button type="button" className="danger" onClick={() => leaveRide(r._id)}>
                    Leave Ride
                  </button>
                )}
                <button type="button" onClick={() => report(r._id, r.driver?._id)}>
                  Report Driver
                </button>
                <button type="button" onClick={() => block(r.driver?._id)}>
                  Block Driver
                </button>
              </div>

              {r.status === "Completed" && (
                <div className="card" style={{ background: "#15171c", marginTop: 12 }}>
                  <p style={{ marginTop: 0, color: "#bbb" }}>Rate your driver</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button key={s} type="button" onClick={() => rate(r._id, s)}>
                        {s}⭐
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <ToastContainer />
      <RideChatModal open={Boolean(chatRide)} ride={chatRide} onClose={() => setChatRide(null)} />
    </>
  );
}
