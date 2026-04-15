import { useEffect, useState } from "react";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Navbar from "../components/Navbar";

export default function EcoDashboard() {
  const [stats, setStats] = useState(null);
  const [ridesData, setRidesData] = useState([]);
  const [animatedCO2, setAnimatedCO2] = useState(0);
  const navigate = useNavigate();

  // 🟢 Fetch eco + ride data
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return navigate("/login");

    // Eco stats
    API.get("/eco", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setStats(res.data))
      .catch((err) => console.error("Eco stats error:", err));

    // Rides for chart
    API.get("/rides", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const chartData = res.data.map((ride, i) => ({
          name: `Ride ${i + 1}`,
          CO2: ride.co2SavedKg,
        }));
        setRidesData(chartData.slice(-10)); // latest 10 rides
      })
      .catch((err) => console.error("Rides data error:", err));
  }, []);

  // 🟢 Animate CO₂ counter
  useEffect(() => {
    if (!stats?.totalCO2) return;
    let start = 0;
    const step = stats.totalCO2 / 40; // ~1s animation
    const timer = setInterval(() => {
      start += step;
      if (start >= stats.totalCO2) {
        setAnimatedCO2(stats.totalCO2);
        clearInterval(timer);
      } else setAnimatedCO2(Number(start.toFixed(1)));
    }, 25);
    return () => clearInterval(timer);
  }, [stats]);

  if (!stats)
    return (
      <div className="container" style={{ textAlign: "center" }}>
        <p>Loading Eco Stats...</p>
      </div>
    );

  // 🧮 Computed values
  const trees = (stats.totalCO2 / 21).toFixed(1); // 1 tree ≈ 21kg CO₂/year
  const pieData = [
    { name: "CO₂ Saved", value: stats.totalCO2 },
    { name: "Remaining", value: Math.max(stats.totalDistance * 0.15, 1) },
  ];
  const COLORS = ["#00b96f", "#1e2026"];

  return (
    <>
      {/* 🧭 NAVBAR */}
      <Navbar />

      {/* 🌿 MAIN CONTENT */}
      <div className="container fade-in" style={{ textAlign: "center" }}>
        <h2>🌿 Your Eco Impact</h2>

        {/* 🧩 Stats Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
            gap: "20px",
            margin: "20px 0",
          }}
        >
          <div className="card">
            <h3 style={{ color: "#00b96f" }}>{stats.totalRides}</h3>
            <p style={{ color: "#aaa" }}>Total Rides Shared</p>
          </div>

          <div className="card">
            <h3 style={{ color: "#00b96f" }}>{stats.totalDistance} km</h3>
            <p style={{ color: "#aaa" }}>Total Distance</p>
          </div>

          <div className="card">
            <h3 style={{ color: "#00b96f" }}>{animatedCO2} kg</h3>
            <p style={{ color: "#aaa" }}>CO₂ Saved</p>
          </div>

          <div className="card">
            <h3 style={{ color: "#00b96f" }}>{trees} 🌳</h3>
            <p style={{ color: "#aaa" }}>Trees Equivalent</p>
          </div>

          <div
            className="card"
            style={{
              background:
                "linear-gradient(135deg,#00b96f33,#00b96f11,#181a20)",
              boxShadow: "0 0 15px #00b96f44",
            }}
          >
            <h3 style={{ color: "#00ff99" }}>{stats.ecoScore}</h3>
            <p style={{ color: "#aaa" }}>Eco Score</p>
          </div>
        </div>

        {/* 🥧 Pie chart */}
        <div style={{ width: "100%", height: 300, marginTop: "40px" }}>
          <h3 style={{ color: "#00b96f", marginBottom: "10px" }}>
            🌍 CO₂ Savings vs Potential Emissions
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* 📊 Bar chart */}
        <div style={{ width: "100%", height: 300, marginTop: "50px" }}>
          <h3 style={{ color: "#00b96f", marginBottom: "10px" }}>
            🚘 CO₂ Saved per Ride
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={ridesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="name" stroke="#aaa" />
              <YAxis stroke="#aaa" />
              <Tooltip />
              <Bar dataKey="CO2" fill="#00b96f" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 🔙 Back Button */}
        <button
          onClick={() => navigate("/")}
          style={{
            marginTop: "30px",
            background: "#00b96f",
            color: "#fff",
            border: "none",
            padding: "10px 18px",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          ← Back to Dashboard
        </button>
      </div>
    </>
  );
}
