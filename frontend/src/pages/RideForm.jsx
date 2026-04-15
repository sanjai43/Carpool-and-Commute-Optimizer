import { useState } from "react";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

export default function RideForm() {
  const navigate = useNavigate();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [distance, setDistance] = useState("");
  const [capacity, setCapacity] = useState(3);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!start.trim() || !end.trim()) {
      alert("Please enter both start and destination.");
      return;
    }
    if (!distance || Number(distance) <= 0) {
      alert("Please enter a valid distance.");
      return;
    }
    if (!capacity || capacity < 1 || capacity > 8)
      return alert("Please select a valid seat capacity (1–8).");

    setLoading(true);
    try {
      await API.post("/rides", {
        start: start.trim(),
        end: end.trim(),
        distanceKm: Number(distance),
        capacity,
      });

      alert("✅ Ride created successfully!");
      navigate("/");
    } catch (err) {
      console.error(err);
      alert("❌ Failed to create ride");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      <form className="container fade-in" onSubmit={handleSubmit}>
        <h2 style={{ color: "#00b96f", textAlign: "center" }}> Create New Ride</h2>
        <p style={{ color: "#aaa", textAlign: "center", marginBottom: "20px" }}>
          Demo mode is enabled. Enter the route details manually instead of using Google Maps.
        </p>

        <label>Start Location</label>
        <input
          value={start}
          onChange={(e) => setStart(e.target.value)}
          placeholder="Example: Gandhipuram"
        />

        <label>Destination</label>
        <input
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          placeholder="Example: RS Puram"
        />

        <label>Distance (km)</label>
        <input
          type="number"
          min="1"
          step="0.1"
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
          placeholder="Example: 12.5"
        />

        <label>Seats Available</label>
        <select value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
            <option key={num} value={num}>
              {num}
            </option>
          ))}
        </select>

        <div
          className="card"
          style={{ marginTop: "20px", background: "#181a20", textAlign: "center" }}
        >
          <p style={{ color: "#aaa", marginBottom: "12px" }}>
            Riders will match this demo ride by start and destination text.
          </p>
          <button
            type="submit"
            disabled={loading}
            style={{
              background: "#00b96f",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "10px 18px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Creating..." : "Create Ride"}
          </button>
        </div>
      </form>
    </>
  );
}
