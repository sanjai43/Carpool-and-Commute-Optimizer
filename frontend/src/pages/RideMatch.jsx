import { useState, useEffect, useRef } from "react";
import API from "../api/axios";
import { io } from "socket.io-client";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";
import useToast from "../hooks/useToast.jsx";
import Navbar from "../components/Navbar";

export default function RideMatch() {
  const [start, setStart] = useState("");
  const [destination, setDestination] = useState("");
  const [matches, setMatches] = useState([]);
  const [selectedRide, setSelectedRide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const socketRef = useRef(null);
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();

  // 🟢 Initialize socket
  useEffect(() => {
    const url =
      import.meta.env.VITE_SOCKET_URL ||
      import.meta.env.VITE_API_URL.replace("/api", "");
    socketRef.current = io(url, { transports: ["websocket"] });
    console.log("✅ Socket connected to:", url);
    return () => socketRef.current?.disconnect();
  }, []);

  const fetchMatches = async (nextStart = start, nextDestination = destination) => {
    setLoading(true);
    try {
      const { data } = await API.post("/rides/match", {
        start: nextStart.trim(),
        end: nextDestination.trim(),
      });
      setMatches(data);
      if (data.length === 0) {
        showToast("No matching rides found yet.", "info");
      }
    } catch (err) {
      console.error("Match fetch error:", err);
      showToast("❌ Failed to load rides", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!start.trim() && !destination.trim()) {
      showToast("Enter a start, destination, or both to search rides.", "info");
      return;
    }
    await fetchMatches(start, destination);
  };

  const confirmJoinRide = async () => {
    if (!selectedRide) return;
    try {
      await API.post(`/rides/${selectedRide._id}/join`);
      showToast("✅ Ride join request sent!", "success");
      setShowConfirm(false);
      setSelectedRide(null);
      fetchMatches();
    } catch (err) {
      showToast(err.response?.data?.message || "❌ Join failed", "error");
    }
  };

  // 🟢 Live socket updates
  useEffect(() => {
    if (!socketRef.current) return;

    const user = JSON.parse(localStorage.getItem("user"));

    socketRef.current.on("ride:accepted", ({ driver, riderId }) => {
      if (user?.id === riderId || user?._id === riderId) {
        showToast(`🎉 Your request was accepted by ${driver}`, "success");
        fetchMatches();
      }
    });

    socketRef.current.on("ride:rejected", ({ driver, riderId }) => {
      if (user?.id === riderId || user?._id === riderId) {
        showToast(`❌ Your request was rejected by ${driver}`, "error");
        fetchMatches();
      }
    });

    socketRef.current.on("ride:completed", ({ driver, passengers }) => {
      if (passengers?.includes(user?.name)) {
        showToast(`✅ ${driver} completed your ride`, "success");
        fetchMatches();
      }
    });

    return () => {
      socketRef.current.off("ride:accepted");
      socketRef.current.off("ride:rejected");
      socketRef.current.off("ride:completed");
    };
  }, [start, destination]);

  return (
    <>
      <Navbar />

      <div style={{ minHeight: "calc(100vh - 60px)", paddingTop: "80px", paddingBottom: "30px" }}>
        <div className="container fade-in">
          <h2 style={{ color: "#00b96f", marginBottom: "10px" }}>Ride Match Demo</h2>
          <p style={{ color: "#aaa", marginBottom: "20px" }}>
            Google Maps is turned off for this demo. Search rides by route names instead.
          </p>

          <form
            onSubmit={handleSearch}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: "12px",
              alignItems: "end",
              marginBottom: "20px",
            }}
          >
            <div>
              <label>Start Location</label>
              <input
                value={start}
                onChange={(e) => setStart(e.target.value)}
                placeholder="Example: Gandhipuram"
              />
            </div>
            <div>
              <label>Destination</label>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="Example: RS Puram"
              />
            </div>
            <button type="submit" disabled={loading} style={{ height: "42px" }}>
              {loading ? "Searching..." : "Search Rides"}
            </button>
          </form>

          <div
            className="card"
            style={{ marginBottom: "20px", background: "#15171c", border: "1px dashed #2d8b65" }}
          >
            <p style={{ color: "#bbb", margin: 0 }}>
              Tip: leave one field empty to browse rides broadly, or fill both for a narrower match.
            </p>
          </div>

          {loading ? (
            <p style={{ color: "#888" }}>Searching available rides...</p>
          ) : matches.length === 0 ? (
            <p style={{ color: "#888" }}>No rides to show yet. Try a broader search or create a demo ride.</p>
          ) : (
            matches.map((r) => (
              <div
                key={r._id}
                className="card fade-in"
                style={{
                  marginBottom: "10px",
                  padding: "16px",
                  borderRadius: "8px",
                  background: "#1e2026",
                }}
              >
                <h4 style={{ color: "#00b96f", marginBottom: "6px" }}>
                  {r.start} → {r.end}
                </h4>
                <p style={{ color: "#ccc", fontSize: "13px", margin: "0 0 4px" }}>
                  Driver: {r.driver?.name || "N/A"}
                </p>
                <p style={{ color: "#aaa", fontSize: "13px", margin: "0 0 10px" }}>
                  {r.distanceKm} km | CO2 Saved: {r.co2SavedKg} kg | Seats:{" "}
                  <b>{r.passengers?.length || 0}/{r.capacity || 3}</b>
                </p>
                <button
                  onClick={() => {
                    setSelectedRide(r);
                    setShowConfirm(true);
                  }}
                  disabled={
                    r.status === "Full" ||
                    r.passengers?.length >= (r.capacity || 3)
                  }
                  style={{
                    background:
                      r.status === "Full" ||
                      r.passengers?.length >= (r.capacity || 3)
                        ? "#555"
                        : "#00b96f",
                    cursor:
                      r.status === "Full" ||
                      r.passengers?.length >= (r.capacity || 3)
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {r.status === "Full" ? "Ride Full" : "Request Ride"}
                </button>
              </div>
            ))
          )}

          <button
            onClick={() => navigate("/")}
            style={{
              width: "100%",
              marginTop: "10px",
              padding: "10px 0",
              borderRadius: "6px",
              border: "none",
              background: "#00b96f",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      <ConfirmModal
        show={showConfirm}
        ride={selectedRide}
        onClose={() => setShowConfirm(false)}
        onConfirm={confirmJoinRide}
      />
      <ToastContainer />
    </>
  );
}
