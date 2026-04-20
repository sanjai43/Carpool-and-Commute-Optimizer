import { useState } from "react";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import MapComponent from "../components/MapComponent.jsx";
import useToast from "../hooks/useToast.jsx";

export default function RideForm() {
  const navigate = useNavigate();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [nl, setNl] = useState("");
  const [nlBusy, setNlBusy] = useState(false);
  const [distance, setDistance] = useState("");
  const [capacity, setCapacity] = useState(3);
  const [loading, setLoading] = useState(false);
  const [departureTime, setDepartureTime] = useState("");
  const [vehicleType, setVehicleType] = useState("PetrolCar");
  const [coords, setCoords] = useState({
    startLat: null,
    startLng: null,
    endLat: null,
    endLng: null,
  });
  const { showToast, ToastContainer } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!start.trim() || !end.trim()) {
      showToast("Please enter both start and destination.", "info");
      return;
    }
    if (
      !Number.isFinite(coords.startLat) ||
      !Number.isFinite(coords.startLng) ||
      !Number.isFinite(coords.endLat) ||
      !Number.isFinite(coords.endLng)
    ) {
      showToast("Please pick both start and destination on the map.", "info");
      return;
    }
    if (!distance || Number(distance) <= 0) {
      showToast("Please enter a valid distance.", "info");
      return;
    }
    if (!capacity || capacity < 1 || capacity > 8)
      return showToast("Please select a valid seat capacity (1–8).", "info");
    if (!departureTime) {
      showToast("Please set a departure time.", "info");
      return;
    }

    setLoading(true);
    try {
      await API.post("/rides", {
        start: start.trim(),
        end: end.trim(),
        distanceKm: Number(distance),
        capacity,
        ...coords,
        departureTime: new Date(departureTime).toISOString(),
        vehicleType,
      });

      showToast("✅ Ride created successfully!", "success");
      navigate("/");
    } catch (err) {
      console.error(err);
      const message =
        err?.response?.data?.message ||
        (err?.response?.status === 403
          ? "Only Drivers can offer rides."
          : "❌ Failed to create ride");
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <ToastContainer />

      <form className="container fade-in" onSubmit={handleSubmit}>
        <h2 style={{ color: "#00b96f", textAlign: "center" }}> Create New Ride</h2>
        <p style={{ color: "#aaa", textAlign: "center", marginBottom: "20px" }}>
          Use the map to pick a route and auto-calculate distance (free OpenStreetMap).
        </p>

        <div className="card" style={{ background: "#14161b" }}>
          <div className="ui-row ui-between">
            <div>
              <h3 style={{ margin: 0 }}>Schedule helper</h3>
              <div style={{ color: "#aaa", fontSize: 12 }}>Try: “Tomorrow 9am from Anna Nagar to T Nagar”</div>
            </div>
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              disabled={nlBusy || !nl.trim()}
              onClick={async () => {
                try {
                  setNlBusy(true);
                  const res = await API.post("/ai/schedule-parse", { text: nl });
                  if (!res.data?.ok) {
                    showToast(res.data?.message || "Could not parse", "error");
                    return;
                  }
                  if (res.data?.start) setStart(res.data.start);
                  if (res.data?.end) setEnd(res.data.end);
                  if (res.data?.departureTime) {
                    // Convert ISO -> datetime-local
                    const d = new Date(res.data.departureTime);
                    const pad = (n) => String(n).padStart(2, "0");
                    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                    setDepartureTime(local);
                  }
                  showToast("✅ Parsed schedule", "success");
                } catch {
                  showToast("❌ Failed to parse schedule", "error");
                } finally {
                  setNlBusy(false);
                }
              }}
            >
              {nlBusy ? "Parsing…" : "Parse"}
            </button>
          </div>
          <input
            value={nl}
            onChange={(e) => setNl(e.target.value)}
            placeholder='e.g., "Tomorrow 9am from Anna Nagar to T Nagar"'
            style={{ marginTop: 10 }}
          />
        </div>

        <MapComponent
          startValue={start}
          endValue={end}
          onStartChange={setStart}
          onEndChange={setEnd}
          onPointsChanged={({ startLat, startLng, endLat, endLng }) => {
            setCoords({ startLat, startLng, endLat, endLng });
          }}
          onRouteComputed={({ distanceKm, startLat, startLng, endLat, endLng }) => {
            if (distanceKm) setDistance(String(distanceKm));
            setCoords({
              startLat,
              startLng,
              endLat,
              endLng,
            });
          }}
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

        <label>Departure Time</label>
        <input
          type="datetime-local"
          value={departureTime}
          onChange={(e) => setDepartureTime(e.target.value)}
        />

        <label>Vehicle Type</label>
        <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
          <option value="PetrolCar">Petrol car</option>
          <option value="DieselCar">Diesel car</option>
          <option value="CNGCar">CNG car</option>
          <option value="TwoWheeler">Two-wheeler</option>
          <option value="EV">EV</option>
        </select>

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
