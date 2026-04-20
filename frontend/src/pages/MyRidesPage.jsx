import { useEffect, useState } from "react";
import API from "../api/axios.js";
import Navbar from "../components/Navbar.jsx";
import useToast from "../hooks/useToast.jsx";
import RideChatModal from "../components/RideChatModal.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { formatCountdown } from "../lib/time.js";

export default function MyRides() {
  const [rides, setRides] = useState([]);
  const { showToast, ToastContainer } = useToast();
  const [chatRide, setChatRide] = useState(null);
  const socket = useSocket();

  // 🟢 Fetch driver's rides
  const fetchMyRides = async () => {
    try {
      const { data } = await API.get("/rides/mine");
      setRides(data || []);
    } catch (err) {
      console.error("❌ Failed to load rides:", err);
      showToast("❌ Failed to load rides", "error");
    }
  };

  // 🟢 Handle Accept / Reject actions
  const handleAction = async (rideId, passengerId, action) => {
    try {
      await API.patch(`/rides/${rideId}/${action}/${passengerId}`);
      showToast(`✅ Rider ${action}ed successfully`, "success");
      fetchMyRides();
    } catch (err) {
      console.error("❌ Failed to update:", err);
      showToast(err.response?.data?.message || "❌ Failed to update ride", "error");
    }
  };

  // 🟢 Mark ride as completed
  const handleComplete = async (rideId) => {
    try {
      await API.patch(`/rides/${rideId}/complete`);
      showToast("✅ Ride marked as completed", "success");
      fetchMyRides();
    } catch (err) {
      console.error("❌ Failed to complete ride:", err);
      showToast("❌ Could not mark ride as completed", "error");
    }
  };

  const handleCancel = async (rideId) => {
    try {
      await API.patch(`/rides/${rideId}/cancel`, { reason: "Cancelled by driver" });
      showToast("✅ Ride cancelled", "success");
      fetchMyRides();
    } catch (err) {
      console.error("❌ Failed to cancel ride:", err);
      showToast(err.response?.data?.message || "❌ Could not cancel ride", "error");
    }
  };

  // 🟢 Live socket updates
  useEffect(() => {
    fetchMyRides();
    if (!socket) return;

    const refresh = (e) => {
      console.log(`📡 Event: ${e} → refreshing rides`);
      fetchMyRides();
    };

    const onNew = () => refresh("new");
    const onAccepted = () => refresh("accepted");
    const onRejected = () => refresh("rejected");
    const onCompleted = () => refresh("completed");
    const onCancelled = () => refresh("cancelled");
    const onJoin = ({ riderName }) => {
      showToast(`🆕 ${riderName} requested to join your ride`, "info");
      refresh("join");
    };

    socket.on("ride:new", onNew);
    socket.on("ride:accepted", onAccepted);
    socket.on("ride:rejected", onRejected);
    socket.on("ride:completed", onCompleted);
    socket.on("ride:cancelled", onCancelled);
    socket.on("ride:join", onJoin);

    return () => {
      socket.off("ride:new", onNew);
      socket.off("ride:accepted", onAccepted);
      socket.off("ride:rejected", onRejected);
      socket.off("ride:completed", onCompleted);
      socket.off("ride:cancelled", onCancelled);
      socket.off("ride:join", onJoin);
    };
  }, [socket]);

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: "80px" }}>
        <h2 style={{ color: "#00b96f", marginBottom: "20px" }}>🚘 My Rides</h2>

        {rides.length === 0 ? (
          <p style={{ color: "#aaa" }}>No rides created yet.</p>
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

              {/* 🚗 Capacity & Status */}
              <div className="ride-subline" style={{ marginBottom: 10 }}>
                <span>
                  Seats: <b>{r.passengers?.length || 0}/{r.capacity || 3}</b>
                </span>
                <span>
                  Pending: <b>{r.requests?.length || 0}</b>
                </span>
              </div>
              {r.departureTime && (
                <p style={{ color: "#aaa", fontSize: 13, marginTop: 0 }}>
                  {formatCountdown(r.departureTime)} • {new Date(r.departureTime).toLocaleString()} • {r.vehicleType}
                </p>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => setChatRide(r)}
                  style={{ background: "#1e2026", border: "1px solid #00b96f", color: "#00b96f" }}
                >
                  💬 Chat
                </button>
                {r.status !== "Completed" && r.status !== "Cancelled" && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() => handleCancel(r._id)}
                    style={{ background: "#d33" }}
                  >
                    Cancel Ride
                  </button>
                )}
              </div>

              {/* ✅ Mark as Completed */}
              {r.status !== "Completed" && r.status !== "Cancelled" && (
                <button
                  onClick={() => handleComplete(r._id)}
                  style={{
                    marginTop: "10px",
                    background: "#00b96f",
                    color: "#fff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    cursor: "pointer",
                  }}
                >
                  ✅ Mark as Completed
                </button>
              )}

              {/* 🟢 Accepted Passengers */}
              {r.passengers?.length > 0 && (
                <div style={{ marginTop: "15px" }}>
                  <h4 style={{ color: "#aaa" }}>Accepted Passengers:</h4>
                  {r.passengers.map((p) => (
                    <div
                      key={p._id}
                      style={{
                        background: "#2a2c34",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        marginBottom: "5px",
                        color: "#fff",
                      }}
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
              )}

              {/* 🟠 Pending Requests */}
              {r.requests?.length > 0 && (
                <div style={{ marginTop: "15px" }}>
                  <h4 style={{ color: "#aaa" }}>Pending Requests:</h4>
                  {r.requests.map((req) => (
                    <div
                      key={req._id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: "#2a2c34",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        marginBottom: "5px",
                      }}
                    >
                      <div style={{ color: "#fff" }}>
                        <div>{req.name}</div>
                        {req.pickup?.label && (
                          <div style={{ color: "#aaa", fontSize: 12 }}>Pickup: {req.pickup.label}</div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          onClick={() =>
                            handleAction(r._id, req._id, "accept")
                          }
                          disabled={r.passengers?.length >= (r.capacity || 3)}
                          style={{
                            background:
                              r.passengers?.length >= (r.capacity || 3)
                                ? "#555"
                                : "#00b96f",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            padding: "4px 10px",
                            cursor:
                              r.passengers?.length >= (r.capacity || 3)
                                ? "not-allowed"
                                : "pointer",
                          }}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() =>
                            handleAction(r._id, req._id, "reject")
                          }
                          style={{
                            background: "#d33",
                            color: "#fff",
                            border: "none",
                            borderRadius: "4px",
                            padding: "4px 10px",
                            cursor: "pointer",
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
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
