import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import API from "../api/axios.js";
import Navbar from "../components/Navbar.jsx";
import useToast from "../hooks/useToast.jsx";

export default function MyRides() {
  const [rides, setRides] = useState([]);
  const { showToast, ToastContainer } = useToast();

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

  // 🟢 Live socket updates
  useEffect(() => {
    fetchMyRides();

    const url =
      import.meta.env.VITE_SOCKET_URL ||
      import.meta.env.VITE_API_URL.replace("/api", "");

    const socket = io(url, { transports: ["websocket"] });
    console.log("✅ Socket connected (MyRides):", url);

    const refresh = (e) => {
      console.log(`📡 Event: ${e} → refreshing rides`);
      fetchMyRides();
    };

    socket.on("ride:new", () => refresh("new"));
    socket.on("ride:accepted", () => refresh("accepted"));
    socket.on("ride:rejected", () => refresh("rejected"));
    socket.on("ride:completed", () => refresh("completed"));
    socket.on("ride:join", ({ riderName }) => {
      showToast(`🆕 ${riderName} requested to join your ride`, "info");
      refresh("join");
    });

    return () => socket.disconnect();
  }, []);

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
              style={{
                background: "#1e2026",
                padding: "15px",
                marginBottom: "10px",
                borderRadius: "8px",
              }}
            >
              <h3 style={{ color: "#00b96f" }}>
                {r.start} → {r.end}
              </h3>

              {/* 🚗 Capacity & Status */}
              <p style={{ color: "#ccc" }}>
                Seats: {r.passengers?.length || 0}/{r.capacity || 3} •{" "}
                {r.requests?.length || 0} Pending
              </p>

              <p
                style={{
                  color:
                    r.status === "Completed"
                      ? "#00b96f"
                      : r.status === "Full"
                      ? "#ffaa00"
                      : "#888",
                }}
              >
                Status: {r.status}
              </p>

              {/* ✅ Mark as Completed */}
              {r.status !== "Completed" && (
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
                      <span style={{ color: "#fff" }}>{req.name}</span>
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
    </>
  );
}
