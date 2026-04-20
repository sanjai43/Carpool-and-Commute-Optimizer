import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import API from "../api/axios";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../components/ConfirmModal";
import useToast from "../hooks/useToast.jsx";
import Navbar from "../components/Navbar";
import MapComponent from "../components/MapComponent.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import Skeleton from "../components/Skeleton.jsx";
import RideResultsDrawer from "../components/RideResultsDrawer.jsx";
import { formatCountdown } from "../lib/time.js";

const haversineKm = (aLat, aLng, bLat, bLng) => {
  if (
    !Number.isFinite(aLat) ||
    !Number.isFinite(aLng) ||
    !Number.isFinite(bLat) ||
    !Number.isFinite(bLng)
  ) {
    return null;
  }
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
};

export default function RideMatch() {
  const [start, setStart] = useState("");
  const [destination, setDestination] = useState("");
  const [matches, setMatches] = useState([]);
  const [selectedRide, setSelectedRide] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [radiusKm, setRadiusKm] = useState(25);
  const [maxDetourKm, setMaxDetourKm] = useState(20);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [departTime, setDepartTime] = useState("");
  const [windowMin, setWindowMin] = useState(30);
  const [nearbyMode, setNearbyMode] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [highlightRideId, setHighlightRideId] = useState(null);
  const [aiExplain, setAiExplain] = useState({});
  const [aiStatus, setAiStatus] = useState(null);

  const socket = useSocket();
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();
  const [coords, setCoords] = useState({
    startLat: null,
    startLng: null,
    endLat: null,
    endLng: null,
  });
  const [initialStartLatLng, setInitialStartLatLng] = useState(null);
  const [initialEndLatLng, setInitialEndLatLng] = useState(null);
  const [externalStartLatLng, setExternalStartLatLng] = useState(undefined);
  const nearbyStartedRef = useRef(false);

  useEffect(() => {
    try {
      if (window.matchMedia("(max-width: 860px)").matches) setFiltersOpen(false);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    API.get("/ai/status")
      .then((res) => setAiStatus(res.data || null))
      .catch(() => setAiStatus(null));
  }, []);

  // Restore last search points
  useEffect(() => {
    try {
      const raw = localStorage.getItem("lastMatchPoints");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        Number.isFinite(parsed?.startLat) &&
        Number.isFinite(parsed?.startLng)
      ) {
        setInitialStartLatLng({ lat: parsed.startLat, lng: parsed.startLng });
        setCoords((prev) => ({ ...prev, startLat: parsed.startLat, startLng: parsed.startLng }));
      }
      if (Number.isFinite(parsed?.endLat) && Number.isFinite(parsed?.endLng)) {
        setInitialEndLatLng({ lat: parsed.endLat, lng: parsed.endLng });
        setCoords((prev) => ({ ...prev, endLat: parsed.endLat, endLng: parsed.endLng }));
      }
      if (typeof parsed?.radiusKm === "number") setRadiusKm(parsed.radiusKm);
      if (typeof parsed?.windowMin === "number") setWindowMin(parsed.windowMin);
      if (typeof parsed?.maxDetourKm === "number") setMaxDetourKm(parsed.maxDetourKm);
      if (typeof parsed?.departTimeLocal === "string") setDepartTime(parsed.departTimeLocal);
    } catch {
      // ignore
    }
  }, []);

  const fetchMatches = useCallback(async (nextStart = start, nextDestination = destination, coordsOverride = null) => {
    setLoading(true);
    try {
      const effectiveCoords = coordsOverride || coords;
      const { data } = await API.post("/rides/match", {
        start: nextStart.trim(),
        end: nextDestination.trim(),
        radiusKm,
        windowMin,
        maxDetourKm,
        departTime: departTime ? new Date(departTime).toISOString() : null,
        ...effectiveCoords,
      });
      const enriched = (data || []).map((r) => {
        const sLng = r?.startLocation?.coordinates?.[0];
        const sLat = r?.startLocation?.coordinates?.[1];
        const eLng = r?.endLocation?.coordinates?.[0];
        const eLat = r?.endLocation?.coordinates?.[1];

        const startDelta =
          Number.isFinite(effectiveCoords.startLat) && Number.isFinite(effectiveCoords.startLng)
            ? haversineKm(effectiveCoords.startLat, effectiveCoords.startLng, sLat, sLng)
            : null;
        const endDelta =
          Number.isFinite(effectiveCoords.endLat) && Number.isFinite(effectiveCoords.endLng)
            ? haversineKm(effectiveCoords.endLat, effectiveCoords.endLng, eLat, eLng)
            : null;

        const extraKm =
          startDelta !== null || endDelta !== null
            ? Number(((startDelta || 0) + (endDelta || 0)).toFixed(1))
            : null;
        const extraMin =
          extraKm !== null ? Math.max(1, Math.round((extraKm / 40) * 60)) : null; // ~40km/h

        return { ...r, _extraKm: extraKm, _extraMin: extraMin };
      });

      enriched.sort((a, b) => {
        const ak = typeof a._extraKm === "number" ? a._extraKm : Number.POSITIVE_INFINITY;
        const bk = typeof b._extraKm === "number" ? b._extraKm : Number.POSITIVE_INFINITY;
        return ak - bk;
      });

      setMatches(enriched);
      if (enriched.length > 0) {
        setDrawerOpen(true);
        setHighlightRideId((prev) => prev || enriched[0]._id);
      }
      if (data.length === 0) {
        showToast("No matching rides found yet.", "info");
      }
    } catch (err) {
      console.error("Match fetch error:", err);
      showToast("❌ Failed to load rides", "error");
    } finally {
      setLoading(false);
    }
  }, [coords, radiusKm, windowMin, departTime, maxDetourKm, showToast, start, destination]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const hasGeo =
      Number.isFinite(coords.startLat) &&
      Number.isFinite(coords.startLng) ||
      Number.isFinite(coords.endLat) &&
      Number.isFinite(coords.endLng);
    if (!start.trim() && !destination.trim() && !hasGeo) {
      showToast("Enter a start/destination or pick a point on the map to search rides.", "info");
      return;
    }
    await fetchMatches(start, destination);
  };

  const confirmJoinRide = async ({ pickup, drop, promoCode } = {}) => {
    if (!selectedRide) return;
    try {
      await API.post(`/rides/${selectedRide._id}/join`, {
        pickup: pickup || null,
        drop: drop || null,
        promoCode: promoCode || null,
      });
      showToast("✅ Ride join request sent!", "success");
      setShowConfirm(false);
      setSelectedRide(null);
      fetchMatches();
    } catch (err) {
      showToast(err.response?.data?.message || "❌ Join failed", "error");
    }
  };

  const pickupDropOptions = (() => {
    const pickupOptions = [];
    const dropOptions = [];

    const rideStartLng = selectedRide?.startLocation?.coordinates?.[0];
    const rideStartLat = selectedRide?.startLocation?.coordinates?.[1];
    const rideEndLng = selectedRide?.endLocation?.coordinates?.[0];
    const rideEndLat = selectedRide?.endLocation?.coordinates?.[1];

    const myStart =
      Number.isFinite(coords.startLat) && Number.isFinite(coords.startLng)
        ? { lat: coords.startLat, lng: coords.startLng, label: start || "My start" }
        : null;
    const myEnd =
      Number.isFinite(coords.endLat) && Number.isFinite(coords.endLng)
        ? { lat: coords.endLat, lng: coords.endLng, label: destination || "My destination" }
        : null;
    const rideStart =
      Number.isFinite(rideStartLat) &&
      Number.isFinite(rideStartLng) &&
      !(rideStartLat === 0 && rideStartLng === 0)
        ? { lat: rideStartLat, lng: rideStartLng, label: "Ride start" }
        : null;
    const rideEnd =
      Number.isFinite(rideEndLat) &&
      Number.isFinite(rideEndLng) &&
      !(rideEndLat === 0 && rideEndLng === 0)
        ? { lat: rideEndLat, lng: rideEndLng, label: "Ride end" }
        : null;

    if (myStart) pickupOptions.push({ key: "myStart", label: "My start", value: myStart });
    if (rideStart) pickupOptions.push({ key: "rideStart", label: "Ride start", value: rideStart });
    if (myStart && rideStart) {
      pickupOptions.push({
        key: "midStart",
        label: "Midpoint (suggested)",
        value: {
          lat: (myStart.lat + rideStart.lat) / 2,
          lng: (myStart.lng + rideStart.lng) / 2,
          label: "Midpoint pickup",
        },
      });
    }

    if (myEnd) dropOptions.push({ key: "myEnd", label: "My destination", value: myEnd });
    if (rideEnd) dropOptions.push({ key: "rideEnd", label: "Ride end", value: rideEnd });
    if (myEnd && rideEnd) {
      dropOptions.push({
        key: "midEnd",
        label: "Midpoint (suggested)",
        value: {
          lat: (myEnd.lat + rideEnd.lat) / 2,
          lng: (myEnd.lng + rideEnd.lng) / 2,
          label: "Midpoint drop",
        },
      });
    }

    return { pickupOptions, dropOptions };
  })();

  // 🟢 Live socket updates
  useEffect(() => {
    if (!socket) return;

    const user = JSON.parse(localStorage.getItem("user"));

    const onAccepted = ({ driver, riderId }) => {
      if (user?.id === riderId || user?._id === riderId) {
        showToast(`🎉 Your request was accepted by ${driver}`, "success");
        fetchMatches();
      }
    };

    const onRejected = ({ driver, riderId }) => {
      if (user?.id === riderId || user?._id === riderId) {
        showToast(`❌ Your request was rejected by ${driver}`, "error");
        fetchMatches();
      }
    };

    const onCompleted = ({ driver, passengers }) => {
      if (passengers?.includes(user?.name)) {
        showToast(`✅ ${driver} completed your ride`, "success");
        fetchMatches();
      }
    };

    socket.on("ride:accepted", onAccepted);
    socket.on("ride:rejected", onRejected);
    socket.on("ride:completed", onCompleted);

    return () => {
      socket.off("ride:accepted", onAccepted);
      socket.off("ride:rejected", onRejected);
      socket.off("ride:completed", onCompleted);
    };
  }, [socket, showToast, fetchMatches]);

  // Auto-refresh (if enabled)
  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(() => {
      fetchMatches().catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, [
    autoRefresh,
    radiusKm,
    windowMin,
    departTime,
    coords.startLat,
    coords.startLng,
    coords.endLat,
    coords.endLng,
    maxDetourKm,
    fetchMatches,
  ]);

  // Persist last points/radius
  useEffect(() => {
    localStorage.setItem(
      "lastMatchPoints",
      JSON.stringify({ ...coords, radiusKm, windowMin, maxDetourKm, departTimeLocal: departTime })
    );
  }, [coords, radiusKm, windowMin, maxDetourKm, departTime]);

  // Nearby mode: one-click locate + auto-refresh
  useEffect(() => {
    if (!nearbyMode) {
      setExternalStartLatLng(undefined);
      nearbyStartedRef.current = false;
      return;
    }
    if (nearbyStartedRef.current) return;
    nearbyStartedRef.current = true;
    if (!navigator.geolocation) {
      showToast("Geolocation not available in this browser.", "error");
      setNearbyMode(false);
      return;
    }
    setAutoRefresh(true);
    if (radiusKm < 10) setRadiusKm(10);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setExternalStartLatLng({ lat, lng });
        setStart("My location");
        setDestination("");
        setCoords((prev) => ({ ...prev, startLat: lat, startLng: lng, endLat: null, endLng: null }));
        fetchMatches("My location", "");
      },
      () => {
        showToast("Location permission denied (or unavailable).", "error");
        setNearbyMode(false);
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, [nearbyMode, fetchMatches, showToast, radiusKm]);

  const highlightRide = useMemo(
    () => matches.find((r) => r._id === highlightRideId) || null,
    [matches, highlightRideId]
  );

  useEffect(() => {
    if (!highlightRide) return;
    if (aiExplain[highlightRide._id]) return;
    API.post("/ai/match-explain", {
      ride: highlightRide,
      query: {
        radiusKm,
        windowMin,
        maxDetourKm,
        departTime: departTime ? new Date(departTime).toISOString() : null,
      },
    })
      .then((res) => {
        const text = res.data?.text;
        const source = res.data?.source;
        if (text) setAiExplain((prev) => ({ ...prev, [highlightRide._id]: { text, source } }));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightRide?._id, radiusKm, windowMin, maxDetourKm, departTime]);

  return (
    <>
      <Navbar />
      <RideResultsDrawer
        open={drawerOpen}
        rides={matches}
        selectedRideId={highlightRideId}
        onClose={() => setDrawerOpen(false)}
        onSelectRide={(r) => setHighlightRideId(r._id)}
        onRequestRide={(r) => {
          setSelectedRide(r);
          setShowConfirm(true);
          setDrawerOpen(false);
        }}
        dismissOnBackdrop={false}
        headerExtra={
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 4 }}>
            {nearbyMode ? (
              <div style={{ color: "#aaa", fontSize: 12 }}>Nearby mode is on • auto-refresh 15s</div>
            ) : null}
            {aiStatus?.mode ? (
              <div style={{ color: "#888", fontSize: 12 }}>
                AI: <b style={{ color: aiStatus.mode === "openai" ? "#dfffe9" : "#bbb" }}>{aiStatus.mode}</b>
                {aiStatus.model ? <span style={{ marginLeft: 6 }}>({aiStatus.model})</span> : null}
              </div>
            ) : null}
          </div>
        }
        aiExplainText={highlightRideId ? aiExplain[highlightRideId]?.text : null}
        aiExplainSource={highlightRideId ? aiExplain[highlightRideId]?.source : null}
      />

      <div style={{ minHeight: "calc(100vh - 60px)", paddingTop: "80px", paddingBottom: "30px" }}>
        <div className="container fade-in">
          <h2 style={{ color: "#00b96f", marginBottom: "10px" }}>Ride Match Demo</h2>
          <p style={{ color: "#aaa", marginBottom: "20px" }}>
            Pick a route on the map or search by text (free OpenStreetMap).
          </p>

          <MapComponent
            startValue={start}
            endValue={destination}
            onStartChange={setStart}
            onEndChange={setDestination}
            onUseMyLocation={({ lat, lng }) => {
              // Rider wants “rides around me” even without start/destination.
              // Force geo-only matching (ignore end point) and open results drawer.
              const nextCoords = { startLat: lat, startLng: lng, endLat: null, endLng: null };
              setCoords(nextCoords);
              setDestination("");
              setDrawerOpen(true);
              fetchMatches("", "", nextCoords);
            }}
            onPointsChanged={({ startLat, startLng, endLat, endLng }) => {
              setCoords({ startLat, startLng, endLat, endLng });
            }}
            onRouteComputed={({ startLat, startLng, endLat, endLng }) => {
              setCoords({ startLat, startLng, endLat, endLng });
            }}
            initialStartLatLng={initialStartLatLng}
            initialEndLatLng={initialEndLatLng}
            rideMarkers={matches
              .flatMap((r) => {
                const startLng = r?.startLocation?.coordinates?.[0];
                const startLat = r?.startLocation?.coordinates?.[1];
                const endLng = r?.endLocation?.coordinates?.[0];
                const endLat = r?.endLocation?.coordinates?.[1];

                const seatsTaken = r.passengers?.length || 0;
                const capacity = r.capacity || 3;
                const isFull = r.status === "Full" || seatsTaken >= capacity;
                const isOpen = r.status === "Open" && !isFull;

                const base = {
                  title: `${r.start} → ${r.end}`,
                  subtitle: `Driver: ${r.driver?.name || "N/A"} • ${r.vehicleType || "Vehicle"}`,
                  actionLabel: isOpen ? "Request Ride" : "Unavailable",
                  disabled: !isOpen,
                  ride: r,
                  meta: {
                    distanceKm: r.distanceKm,
                    capacity,
                    seatsTaken,
                    status: r.status,
                    co2SavedKg: r.co2SavedKg,
                    vehicleType: r.vehicleType,
                    departureTime: r.departureTime,
                    extraKm: typeof r._extraKm === "number" ? r._extraKm : undefined,
                    extraMin: typeof r._extraMin === "number" ? r._extraMin : undefined,
                  },
                };

                const markers = [];
                if (Number.isFinite(startLat) && Number.isFinite(startLng) && !(startLat === 0 && startLng === 0)) {
                  markers.push({
                    ...base,
                    id: `${r._id}:start`,
                    variant: "start",
                    position: { lat: startLat, lng: startLng },
                  });
                }
                if (Number.isFinite(endLat) && Number.isFinite(endLng) && !(endLat === 0 && endLng === 0)) {
                  markers.push({
                    ...base,
                    id: `${r._id}:end`,
                    variant: "end",
                    position: { lat: endLat, lng: endLng },
                  });
                }
                return markers;
              })}
            onRideMarkerClick={(m) => {
              if (m?.ride) {
                setHighlightRideId(m.ride._id);
                setSelectedRide(m.ride);
                setShowConfirm(true);
                setDrawerOpen(false);
              }
            }}
            height={320}
            highlightRide={highlightRide}
            externalStartLatLng={externalStartLatLng}
          />

          <div className="panel" style={{ marginTop: 14 }}>
            <div className="ui-row ui-between" style={{ marginBottom: 10 }}>
              <div style={{ color: "#aaa", fontSize: 13 }}>
                Filters
                {nearbyMode ? <span style={{ marginLeft: 8, color: "#8bd7b6" }}>• Nearby mode</span> : null}
              </div>
              <div className="ui-row" style={{ gap: 8 }}>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => setDrawerOpen(true)}
                  disabled={matches.length === 0}
                >
                  Results
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--ghost"
                  onClick={() => setFiltersOpen((s) => !s)}
                >
                  {filtersOpen ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {filtersOpen && (
            <div className="filters-grid">
              <div className="filter-item">
                <div className="filter-label">
                  <span>Search radius</span>
                  <span className="filter-value">{radiusKm} km</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="5"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                />
              </div>
              <div className="filter-item">
                <div className="filter-label">
                  <span>Time window</span>
                  <span className="filter-value">±{windowMin} min</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="120"
                  step="10"
                  value={windowMin}
                  onChange={(e) => setWindowMin(Number(e.target.value))}
                />
              </div>
              <div className="filter-item">
                <div className="filter-label">
                  <span>Max detour</span>
                  <span className="filter-value">≤ {maxDetourKm} km</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="60"
                  step="5"
                  value={maxDetourKm}
                  onChange={(e) => setMaxDetourKm(Number(e.target.value))}
                />
              </div>
              <div className="filter-item">
                <div className="filter-label">
                  <span>Departure time (optional)</span>
                </div>
                <input
                  type="datetime-local"
                  value={departTime}
                  onChange={(e) => setDepartTime(e.target.value)}
                />
              </div>
            </div>
            )}

            <div className="filters-foot">
              <label style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  style={{ width: "auto", margin: 0 }}
                />
                Auto refresh (15s)
              </label>
              <label style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={nearbyMode}
                  onChange={(e) => setNearbyMode(e.target.checked)}
                  style={{ width: "auto", margin: 0 }}
                />
                Nearby mode
              </label>
              <span style={{ color: "#bbb", fontSize: 13 }}>
                Sort: lowest detour when start/end are set
              </span>
            </div>
          </div>

          <form
            onSubmit={handleSearch}
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "18px",
              marginTop: "12px",
            }}
          >
            <button className="btn" type="submit" disabled={loading} style={{ height: "42px", minWidth: 180 }}>
              {loading ? "Searching..." : "Search Rides"}
            </button>
          </form>

          <div
            className="panel"
            style={{ marginBottom: "20px" }}
          >
            <p style={{ color: "#bbb", margin: 0 }}>
              Tip: use <b>Use My Location</b> + search radius to find nearby rides quickly.
            </p>
          </div>

          {loading ? (
            <div style={{ display: "grid", gap: 10 }}>
              {[0, 1, 2].map((k) => (
                <div key={k} className="card">
                  <div className="ride-head" style={{ marginBottom: 10 }}>
                    <Skeleton height={18} width={"60%"} />
                    <Skeleton height={18} width={90} />
                  </div>
                  <Skeleton height={12} width={"70%"} style={{ marginBottom: 8 }} />
                  <Skeleton height={12} width={"90%"} style={{ marginBottom: 12 }} />
                  <Skeleton height={38} width={140} />
                </div>
              ))}
            </div>
          ) : matches.length === 0 ? (
            <p style={{ color: "#888" }}>No rides to show yet. Try a broader search or create a demo ride.</p>
          ) : (
            <>
              <p style={{ color: "#aaa", marginTop: 0 }}>
                Showing <b style={{ color: "#00b96f" }}>{matches.length}</b> ride(s)
              </p>
              {matches.map((r) => (
              <div
                key={r._id}
                className="card fade-in"
                style={{
                  marginBottom: "10px",
                  padding: "16px",
                  borderRadius: "8px",
                  background: "#1e2026",
                }}
                onClick={() => {
                  setHighlightRideId(r._id);
                  setDrawerOpen(true);
                }}
              >
                <div className="ride-head" style={{ marginBottom: 6 }}>
                  <h4 style={{ color: "#00b96f", margin: 0 }}>
                    {r.start} → {r.end}
                  </h4>
                  <StatusBadge status={r.status} />
                </div>
                <p style={{ color: "#ccc", fontSize: "13px", margin: "0 0 4px" }}>
                  Driver: {r.driver?.name || "N/A"}{" "}
                  {r.driver?.verified ? <span style={{ color: "#00b96f" }}>✓ Verified</span> : null}
                </p>
                <div className="ride-subline" style={{ marginBottom: 10 }}>
                  <span>
                    {r.distanceKm} km • CO₂ saved: {r.co2SavedKg} kg
                  </span>
                  <span>
                    Seats: <b>{r.passengers?.length || 0}/{r.capacity || 3}</b>
                  </span>
                  {typeof r._extraKm === "number" && (
                    <span>
                      Detour: <b>+{r._extraKm} km</b> (~{r._extraMin} min)
                    </span>
                  )}
                  {r.departureTime && (
                    <span>
                      {formatCountdown(r.departureTime)} • <b>{new Date(r.departureTime).toLocaleString()}</b>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedRide(r);
                    setShowConfirm(true);
                    setDrawerOpen(false);
                  }}
                  disabled={
                    r.status === "Full" ||
                    r.passengers?.length >= (r.capacity || 3)
                  }
                  // keep minimal inline styling (state), base styles come from .btn
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
              ))}
            </>
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
        pickupOptions={pickupDropOptions.pickupOptions}
        dropOptions={pickupDropOptions.dropOptions}
        onConfirm={confirmJoinRide}
      />
      <ToastContainer />
    </>
  );
}
