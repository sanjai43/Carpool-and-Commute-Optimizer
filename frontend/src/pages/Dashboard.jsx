import { useEffect, useState } from "react";
import API from "../api/axios";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const [rides, setRides] = useState([]);
  const user = JSON.parse(localStorage.getItem("user"));
  const role = localStorage.getItem("role");

  useEffect(() => {
    API.get("/rides")
      .then((res) => setRides(res.data))
      .catch((err) => console.error("Error fetching rides:", err));
  }, []);

  const logout = () => {
    localStorage.clear();
    window.location.href = "/login";
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0f1115", color: "#fff" }}>
      {/* 🔹 Navbar */}
      <div
        style={{
          background: "#181a20",
          padding: "15px 30px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #262a33",
        }}
      >
        <h2 style={{ color: "#00b96f", margin: 0 }}>🚗 EcoRide Dashboard</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ color: "#aaa", fontSize: "14px" }}>
            {user?.name} ({role})
          </span>
          <button
            onClick={logout}
            style={{
              background: "#d33",
              color: "white",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "none",
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* 🔹 Action buttons */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginTop: "20px",
          gap: "10px",
        }}
      >
        {role === "Driver" && (
          <Link to="/new">
            <button>+ New Ride</button>
          </Link>
        )}
        {role === "Rider" && (
          <Link to="/match">
            <button>Find Ride</button>
          </Link>
        )}
        <Link to="/eco">
          <button>Eco Stats</button>
        </Link>
      </div>

      {/* 🔹 Ride List */}
      <div
        style={{
          maxWidth: "700px",
          margin: "30px auto",
          padding: "0 20px",
        }}
      >
        {rides.length === 0 ? (
          <p
            style={{
              textAlign: "center",
              color: "#aaa",
              marginTop: "100px",
              fontSize: "18px",
            }}
          >
            No rides yet 🚗<br />Create or join a ride to get started.
          </p>
        ) : (
          rides.map((r) => (
            <div
              key={r._id}
              className="card fade-in"
              style={{
                background: "#181a20",
                border: "1px solid #262a33",
                borderRadius: "10px",
                padding: "15px 20px",
                marginBottom: "12px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.3)",
              }}
            >
              <h4 style={{ color: "#00b96f", marginBottom: "8px" }}>
                {r.start} → {r.end}
              </h4>
              <p style={{ color: "#ccc", margin: "2px 0" }}>
                Distance: {r.distanceKm} km | CO₂ Saved: {r.co2SavedKg} kg
              </p>
              <p
                style={{
                  color: "#aaa",
                  fontSize: "13px",
                  marginTop: "4px",
                }}
              >
                Driver: {r.driver?.name || "N/A"}
              </p>
              <p>
                <b>Status:</b>{" "}
                <span
                  style={{
                    background:
                      r.status === "Completed"
                        ? "#777"
                        : r.status === "Full"
                        ? "#ffcc00"
                        : "#00b96f",
                    color: "#fff",
                    padding: "3px 8px",
                    borderRadius: "5px",
                    fontSize: "12px",
                  }}
                >
                  {r.status}
                </span>
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
