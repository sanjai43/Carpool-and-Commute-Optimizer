import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios";
import Navbar from "../components/Navbar";
import { useSocket } from "../context/SocketContext.jsx";
import Skeleton from "../components/Skeleton.jsx";

export default function HomePage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalRides: 0,
    totalCO2: 0,
    totalDistance: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [userName, setUserName] = useState("EcoRider");
  const socket = useSocket();

  // 🧠 Fetch function to reuse
  const refreshStats = async () => {
    try {
      setStatsLoading(true);
      const { data } = await API.get("/eco");
      setStats(data);
    } catch (err) {
      console.error("❌ Failed to load /eco:", err.response?.data || err.message);
    } finally {
      setStatsLoading(false);
    }
  };

  // 🟢 Fetch user + stats on load
  useEffect(() => {
    const storedUserRaw = localStorage.getItem("user");
    if (!storedUserRaw) return navigate("/login", { replace: true });

    const storedUser = JSON.parse(storedUserRaw);
    if (storedUser?.name) setUserName(storedUser.name.split(" ")[0]);

    refreshStats();
  }, [navigate]);

  // ⚡ Live updates via socket
  useEffect(() => {
    if (!socket) return;

    const onNew = () => {
      console.log("🔄 Ride created — refreshing stats");
      refreshStats();
    };

    const onJoined = () => {
      console.log("🚗 Rider joined — refreshing stats");
      refreshStats();
    };

    const onDataChanged = (payload) => {
      const kinds = payload?.kinds || [];
      if (kinds.includes("eco")) refreshStats();
    };

    socket.on("ride:new", onNew);
    socket.on("ride:joined", onJoined);
    socket.on("user:dataChanged", onDataChanged);

    return () => {
      socket.off("ride:new", onNew);
      socket.off("ride:joined", onJoined);
      socket.off("user:dataChanged", onDataChanged);
    };
  }, [socket]);

  return (
    <>
      <Navbar />

      <div
        className="animated-bg"
        style={{
          minHeight: "calc(100vh - 60px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "30px",
        }}
      >
        <div
          className="fade-in"
          style={{
            background: "rgba(24, 26, 32, 0.85)",
            padding: "40px",
            borderRadius: "15px",
            maxWidth: "900px",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 4px 25px rgba(0,0,0,0.4)",
            backdropFilter: "blur(8px)",
          }}
        >
          <h1
            style={{
              color: "#00b96f",
              fontSize: "2.5rem",
              marginBottom: "10px",
              fontWeight: "600",
            }}
          >
            Hey, {userName}! 
          </h1>
          <p style={{ color: "#aaa", marginBottom: "30px", fontSize: "16px" }}>
            Welcome back to <b style={{ color: "#00b96f" }}>CarpoolX</b> — your smarter,
            greener way to commute.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
              gap: "15px",
              marginBottom: "35px",
            }}
          >
            <div className="card">
              <h3 style={{ color: "#00b96f" }}>
                {statsLoading ? <Skeleton height={28} width={70} /> : stats.totalRides}
              </h3>
              <p style={{ color: "#aaa" }}>Rides Shared</p>
            </div>

            <div className="card">
              <h3 style={{ color: "#00b96f" }}>
                {statsLoading ? <Skeleton height={28} width={110} /> : `${stats.totalDistance} km`}
              </h3>
              <p style={{ color: "#aaa" }}>Distance Covered</p>
            </div>

            <div className="card">
              <h3 style={{ color: "#00b96f" }}>
                {statsLoading ? <Skeleton height={28} width={110} /> : `${stats.totalCO2} kg`}
              </h3>
              <p style={{ color: "#aaa" }}>CO₂ Saved</p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "15px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => navigate("/match")}
              style={{
                background: "#00b96f",
                color: "#fff",
                border: "none",
                padding: "12px 24px",
                borderRadius: "8px",
                fontSize: "16px",
                cursor: "pointer",
                transition: "0.3s",
              }}
            >
             Find a Ride
            </button>

            <button
              onClick={() => navigate("/new")}
              style={{
                background: "#1e2026",
                color: "#00b96f",
                border: "1px solid #00b96f",
                padding: "12px 24px",
                borderRadius: "8px",
                fontSize: "16px",
                cursor: "pointer",
                transition: "0.3s",
              }}
            >
               Offer a Ride
            </button>

            <button
              onClick={() => navigate("/eco")}
              style={{
                background: "linear-gradient(90deg,#00b96f,#007a4b)",
                color: "#fff",
                border: "none",
                padding: "12px 24px",
                borderRadius: "8px",
                fontSize: "16px",
                cursor: "pointer",
                transition: "0.3s",
              }}
            >
               View Eco Impact
            </button>
          </div>

          <p
            style={{
              marginTop: "40px",
              color: "#666",
              fontSize: "13px",
              borderTop: "1px solid #222",
              paddingTop: "15px",
            }}
          >
            Made with in India — CarpoolX © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </>
  );
}
