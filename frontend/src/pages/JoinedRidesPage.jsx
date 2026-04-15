import { useEffect, useState } from "react";
import API from "../api/axios.js";
import Navbar from "../components/Navbar.jsx";
import useToast from "../hooks/useToast.jsx";

export default function JoinedRidesPage() {
  const [rides, setRides] = useState([]);
  const { showToast, ToastContainer } = useToast();

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
              <p style={{ color: "#ccc" }}>
                Driver: {r.driver?.name || "N/A"}
              </p>
              <p style={{ color: "#aaa" }}>
                {r.distanceKm} km | CO₂ Saved: {r.co2SavedKg} kg
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
            </div>
          ))
        )}
      </div>
      <ToastContainer />
    </>
  );
}
