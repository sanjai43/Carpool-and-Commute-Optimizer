import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet.markercluster";

const DEFAULT_CENTER = { lat: 13.0827, lng: 80.2707 }; // Chennai (safe default)

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const clampSuggestions = (items, max = 6) => items.slice(0, max);

const nominatimUrlFor = (query) => {
  const u = new URL("https://nominatim.openstreetmap.org/search");
  u.searchParams.set("q", query);
  u.searchParams.set("format", "json");
  u.searchParams.set("addressdetails", "1");
  u.searchParams.set("limit", "6");
  return u.toString();
};

const osrmRouteUrlFor = (start, end) => {
  const u = new URL(
    `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}`
  );
  u.searchParams.set("overview", "full");
  u.searchParams.set("geometries", "geojson");
  return u.toString();
};

const haversineKm = (a, b) => {
  if (!a || !b) return null;
  if (
    !Number.isFinite(a.lat) ||
    !Number.isFinite(a.lng) ||
    !Number.isFinite(b.lat) ||
    !Number.isFinite(b.lng)
  ) {
    return null;
  }
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
};

const nominatimReverseUrlFor = (lat, lng) => {
  const u = new URL("https://nominatim.openstreetmap.org/reverse");
  u.searchParams.set("lat", String(lat));
  u.searchParams.set("lon", String(lng));
  u.searchParams.set("format", "json");
  u.searchParams.set("zoom", "16");
  return u.toString();
};

const MapFitter = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (!bounds) return;
    map.fitBounds(bounds, { padding: [24, 24] });
  }, [bounds, map]);
  return null;
};

const RideClusters = ({ rideMarkers, icons, onRideMarkerClick }) => {
  const map = useMap();
  const clusterRef = useRef(null);

  useEffect(() => {
    if (!map) return;
    const group = L.markerClusterGroup({ chunkedLoading: true });
    clusterRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      clusterRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const group = clusterRef.current;
    if (!group) return;
    group.clearLayers();

    for (const m of rideMarkers) {
      const icon = m.variant === "end" ? icons.endRide : icons.startRide;
      const marker = L.marker([m.position.lat, m.position.lng], { icon });

      const meta = m.meta
        ? `<div style="margin-top:8px;font-size:12px;color:#333">
             <div>Distance: ${m.meta.distanceKm} km</div>
             <div>Seats: ${m.meta.seatsTaken}/${m.meta.capacity} • Status: ${m.meta.status}</div>
             ${m.meta.vehicleType ? `<div>Vehicle: ${m.meta.vehicleType}</div>` : ""}
             ${m.meta.departureTime ? `<div>Departs: ${new Date(m.meta.departureTime).toLocaleString()}</div>` : ""}
             ${
               typeof m.meta.extraKm === "number"
                 ? `<div>Detour: +${m.meta.extraKm.toFixed(1)} km (~${m.meta.extraMin} min)</div>`
                 : ""
             }
             <div>CO₂ Saved: ${m.meta.co2SavedKg} kg</div>
           </div>`
        : "";

      marker.bindPopup(
        `<div style="min-width:200px">
           <div style="font-weight:700;margin-bottom:6px">${m.title}</div>
           <div style="font-size:12px;color:#333">${m.subtitle}</div>
           ${meta}
           <div style="margin-top:10px;font-size:12px;color:#333">
             ${m.disabled ? "Unavailable" : "Click marker to request"}
           </div>
         </div>`
      );

      marker.on("click", () => {
        if (!m.disabled) onRideMarkerClick?.(m);
      });

      group.addLayer(marker);
    }
  }, [rideMarkers, icons, onRideMarkerClick]);

  return null;
};

const MapClicker = ({
  startLatLng,
  endLatLng,
  onPick,
}) => {
  useMapEvents({
    click: (e) => {
      onPick?.({ lat: e.latlng.lat, lng: e.latlng.lng, startLatLng, endLatLng });
    },
  });
  return null;
};

export default function MapComponent({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  onRouteComputed,
  onPointsChanged,
  onUseMyLocation,
  rideMarkers = [],
  onRideMarkerClick,
  highlightRide,
  externalStartLatLng,
  externalEndLatLng,
  initialStartLatLng,
  initialEndLatLng,
  height = 380,
}) {
  // Fix leaflet marker icon paths under Vite bundling
  useMemo(() => {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url)
        .toString(),
      iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).toString(),
      shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).toString(),
    });
  }, []);

  const [startLatLng, setStartLatLng] = useState(initialStartLatLng || null);
  const [endLatLng, setEndLatLng] = useState(initialEndLatLng || null);
  const [routeCoords, setRouteCoords] = useState(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState(null);
  const highlightCoords = useMemo(() => {
    const sLng = highlightRide?.startLocation?.coordinates?.[0];
    const sLat = highlightRide?.startLocation?.coordinates?.[1];
    const eLng = highlightRide?.endLocation?.coordinates?.[0];
    const eLat = highlightRide?.endLocation?.coordinates?.[1];
    if (![sLng, sLat, eLng, eLat].every((x) => Number.isFinite(x))) return null;
    if ((sLng === 0 && sLat === 0) || (eLng === 0 && eLat === 0)) return null;
    return [
      [sLat, sLng],
      [eLat, eLng],
    ];
  }, [highlightRide]);

  const [startSuggestions, setStartSuggestions] = useState([]);
  const [endSuggestions, setEndSuggestions] = useState([]);
  const [isPicking, setIsPicking] = useState(null); // "start" | "end" | null
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState(null);

  const startAbortRef = useRef(null);
  const endAbortRef = useRef(null);
  const startDebounceRef = useRef(null);
  const endDebounceRef = useRef(null);
  const geocodeCacheRef = useRef(new Map());

  const mapCenter = startLatLng || endLatLng || DEFAULT_CENTER;

  const icons = useMemo(() => {
    const svg = (color) =>
      `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="42" viewBox="0 0 26 42"><path d="M13 41s12-14.2 12-25C25 7.2 19.6 2 13 2S1 7.2 1 16c0 10.8 12 25 12 25z" fill="${color}" stroke="#0f1115" stroke-width="2"/><circle cx="13" cy="16" r="5" fill="#fff"/></svg>`
      )}`;

    return {
      startRide: L.icon({
        iconUrl: svg("#00b96f"),
        iconSize: [26, 42],
        iconAnchor: [13, 42],
        popupAnchor: [0, -38],
      }),
      endRide: L.icon({
        iconUrl: svg("#4c7dff"),
        iconSize: [26, 42],
        iconAnchor: [13, 42],
        popupAnchor: [0, -38],
      }),
      userStart: L.icon({
        iconUrl: svg("#ffaa00"),
        iconSize: [26, 42],
        iconAnchor: [13, 42],
        popupAnchor: [0, -38],
      }),
      userEnd: L.icon({
        iconUrl: svg("#ff5aa5"),
        iconSize: [26, 42],
        iconAnchor: [13, 42],
        popupAnchor: [0, -38],
      }),
    };
  }, []);

  const routeBounds = useMemo(() => {
    if (!startLatLng && !endLatLng) return null;
    const pts = [];
    if (startLatLng) pts.push([startLatLng.lat, startLatLng.lng]);
    if (endLatLng) pts.push([endLatLng.lat, endLatLng.lng]);
    if (routeCoords?.length) {
      for (const c of routeCoords) pts.push([c[0], c[1]]);
    }
    if (highlightCoords?.length) {
      for (const c of highlightCoords) pts.push([c[0], c[1]]);
    }
    return pts.length ? L.latLngBounds(pts) : null;
  }, [startLatLng, endLatLng, routeCoords, highlightCoords]);

  const geocode = async (query, which) => {
    const trimmed = String(query || "").trim();
    if (trimmed.length < 3) return [];

    const cached = geocodeCacheRef.current.get(trimmed.toLowerCase());
    if (cached) return cached;

    const abortRef = which === "start" ? startAbortRef : endAbortRef;
    abortRef.current?.abort?.();
    const controller = new AbortController();
    abortRef.current = controller;

    const res = await fetch(nominatimUrlFor(trimmed), {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    const list = clampSuggestions(
      data
        .map((p) => ({
          label: p.display_name,
          lat: toNumber(p.lat),
          lng: toNumber(p.lon),
        }))
        .filter((p) => p.lat !== null && p.lng !== null)
    );
    geocodeCacheRef.current.set(trimmed.toLowerCase(), list);
    return list;
  };

  const computeRoute = async (s, e) => {
    if (!s || !e) return;
    try {
      const res = await fetch(osrmRouteUrlFor(s, e), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) throw new Error("OSRM unavailable");
      const data = await res.json();
      const route = data?.routes?.[0];
      const coords = route?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) throw new Error("No route geometry");

      // OSRM returns [lng,lat] pairs
      const latLngs = coords.map(([lng, lat]) => [lat, lng]);
      setRouteCoords(latLngs);

      const meters = toNumber(route.distance);
      const km = meters !== null ? Number((meters / 1000).toFixed(1)) : null;
      setRouteDistanceKm(km);

      onRouteComputed?.({
        distanceKm: km,
        startLat: s.lat,
        startLng: s.lng,
        endLat: e.lat,
        endLng: e.lng,
      });
    } catch {
      // Fallback: straight line distance and polyline
      const km = haversineKm(s, e);
      setRouteCoords([
        [s.lat, s.lng],
        [e.lat, e.lng],
      ]);
      setRouteDistanceKm(km !== null ? Number(km.toFixed(1)) : null);
      onRouteComputed?.({
        distanceKm: km !== null ? Number(km.toFixed(1)) : null,
        startLat: s.lat,
        startLng: s.lng,
        endLat: e.lat,
        endLng: e.lng,
      });
    }
  };

  const notifyPointsChanged = (nextStart, nextEnd) => {
    onPointsChanged?.({
      startLat: nextStart?.lat ?? null,
      startLng: nextStart?.lng ?? null,
      endLat: nextEnd?.lat ?? null,
      endLng: nextEnd?.lng ?? null,
    });
  };

  const reverseGeocodeLabel = async (lat, lng) => {
    try {
      const res = await fetch(nominatimReverseUrlFor(lat, lng), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.display_name || null;
    } catch {
      return null;
    }
  };

  const pickPoint = async ({ lat, lng, startLatLng: s, endLatLng: e }) => {
    setStartSuggestions([]);
    setEndSuggestions([]);

    const clicked = { lat, lng };

    const target =
      isPicking ||
      (!s ? "start" : !e ? "end" : "start");

    if (target === "start") {
      setStartLatLng(clicked);
      setEndLatLng(null);
      setRouteCoords(null);
      setRouteDistanceKm(null);
      const label = (await reverseGeocodeLabel(lat, lng)) || `Pinned: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      onStartChange?.(label);
      onEndChange?.("");
      notifyPointsChanged(clicked, null);
    } else {
      setEndLatLng(clicked);
      setRouteCoords(null);
      setRouteDistanceKm(null);
      const label = (await reverseGeocodeLabel(lat, lng)) || `Pinned: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      onEndChange?.(label);
      notifyPointsChanged(s || startLatLng, clicked);
    }

    setIsPicking(null);
  };

  useEffect(() => {
    if (startLatLng && endLatLng) {
      computeRoute(startLatLng, endLatLng).catch(() => {});
    }
  }, [startLatLng, endLatLng]);

  useEffect(() => {
    // Keep internal state aligned if parent restores persisted points
    if (initialStartLatLng && !startLatLng) setStartLatLng(initialStartLatLng);
    if (initialEndLatLng && !endLatLng) setEndLatLng(initialEndLatLng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialStartLatLng, initialEndLatLng]);

  useEffect(() => {
    if (externalStartLatLng === undefined && externalEndLatLng === undefined) return;

    if (externalStartLatLng === null) {
      setStartLatLng(null);
    } else if (externalStartLatLng && Number.isFinite(externalStartLatLng.lat) && Number.isFinite(externalStartLatLng.lng)) {
      setStartLatLng({ lat: externalStartLatLng.lat, lng: externalStartLatLng.lng });
    }

    if (externalEndLatLng === null) {
      setEndLatLng(null);
    } else if (externalEndLatLng && Number.isFinite(externalEndLatLng.lat) && Number.isFinite(externalEndLatLng.lng)) {
      setEndLatLng({ lat: externalEndLatLng.lat, lng: externalEndLatLng.lng });
    }
    setRouteCoords(null);
    setRouteDistanceKm(null);
  }, [externalStartLatLng, externalEndLatLng]);

  useEffect(() => {
    notifyPointsChanged(startLatLng, endLatLng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startLatLng, endLatLng]);

  return (
    <div className="card" style={{ background: "#111318" }}>
      <div className="ui-row ui-between" style={{ marginBottom: 10 }}>
        <p style={{ margin: 0, color: "#aaa", fontSize: 13 }}>
          Tip: click the map to set{" "}
          <b style={{ color: "#00b96f" }}>Start</b> then{" "}
          <b style={{ color: "#00b96f" }}>Destination</b>.
        </p>
        <div className="ui-row" style={{ gap: 8 }}>
          <button className="btn btn--sm" type="button" onClick={() => setIsPicking("start")}>
            Pick Start
          </button>
          <button className="btn btn--sm" type="button" onClick={() => setIsPicking("end")}>
            Pick Destination
          </button>
          <button
            className="btn btn--sm btn--ghost"
            type="button"
            disabled={geoBusy}
            onClick={() => {
              if (!navigator.geolocation) return;
              setGeoBusy(true);
              setGeoError(null);
              navigator.geolocation.getCurrentPosition(
                async (pos) => {
                  const lat = pos.coords.latitude;
                  const lng = pos.coords.longitude;
                  const clicked = { lat, lng };
                  setStartLatLng(clicked);
                  setEndLatLng(null);
                  setRouteCoords(null);
                  setRouteDistanceKm(null);
                  const label =
                    (await reverseGeocodeLabel(lat, lng)) ||
                    `My Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                  onStartChange?.(label);
                  onEndChange?.("");
                  setStartSuggestions([]);
                  setEndSuggestions([]);
                  setIsPicking(null);
                  notifyPointsChanged(clicked, null);
                  onUseMyLocation?.({ lat, lng, label });
                  setGeoBusy(false);
                },
                () => {
                  setGeoBusy(false);
                  setGeoError("Location permission denied (or unavailable).");
                },
                { enableHighAccuracy: false, timeout: 8000 }
              );
            }}
            style={{
              opacity: navigator.geolocation ? 1 : 0.6,
              cursor: navigator.geolocation ? "pointer" : "not-allowed",
            }}
            title={navigator.geolocation ? "Use current location" : "Geolocation not available"}
          >
            {geoBusy ? "Locating…" : "Use My Location"}
          </button>
          <button
            className="btn btn--sm btn--danger"
            type="button"
            onClick={() => {
              setIsPicking(null);
              setStartLatLng(null);
              setEndLatLng(null);
              setRouteCoords(null);
              setRouteDistanceKm(null);
              setStartSuggestions([]);
              setEndSuggestions([]);
              onStartChange?.("");
              onEndChange?.("");
              notifyPointsChanged(null, null);
            }}
          >
            Clear
          </button>
        </div>
      </div>
      {geoError && (
        <div className="card" style={{ background: "#15171c", border: "1px dashed #333" }}>
          <p style={{ margin: 0, color: "#bbb" }}>{geoError}</p>
        </div>
      )}

      <div className="ui-row ui-muted" style={{ gap: 14, marginBottom: 10, fontSize: 12 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="legend-dot" style={{ background: "#ffaa00" }} />{" "}
          Your start
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="legend-dot" style={{ background: "#ff5aa5" }} />{" "}
          Your destination
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="legend-dot" style={{ background: "#00b96f" }} />{" "}
          Ride start
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="legend-dot" style={{ background: "#4c7dff" }} />{" "}
          Ride end
        </span>
      </div>

      <div className="ui-row ui-muted" style={{ gap: 10, marginBottom: 14, fontSize: 12, flexWrap: "wrap" }}>
        <span style={{ color: "#888" }}>Status:</span>
        <span style={{ padding: "2px 8px", borderRadius: 999, border: "1px solid #234f3a", color: "#00b96f" }}>Open</span>
        <span style={{ padding: "2px 8px", borderRadius: 999, border: "1px solid #544019", color: "#ffaa00" }}>Full</span>
        <span style={{ padding: "2px 8px", borderRadius: 999, border: "1px solid #2a2f3a", color: "#aaa" }}>Completed</span>
        <span style={{ padding: "2px 8px", borderRadius: 999, border: "1px solid #4a1b1b", color: "#ff6b6b" }}>Cancelled</span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div style={{ position: "relative" }}>
          <label>Start (search)</label>
          <input
            value={startValue}
            onChange={async (e) => {
              const v = e.target.value;
              onStartChange?.(v);
              setIsPicking(null);
              if (startDebounceRef.current) clearTimeout(startDebounceRef.current);
              startDebounceRef.current = setTimeout(async () => {
                try {
                  const list = await geocode(v, "start");
                  setStartSuggestions(list);
                } catch {
                  setStartSuggestions([]);
                }
              }, 300);
            }}
            placeholder="Type a place (min 3 chars)"
          />
          {startSuggestions.length > 0 && (
            <div className="suggestion-list">
              {startSuggestions.map((s) => (
                <button
                  key={`${s.lat},${s.lng},${s.label}`}
                  type="button"
                  onClick={() => {
                    onStartChange?.(s.label);
                    const ll = { lat: s.lat, lng: s.lng };
                    setStartLatLng(ll);
                    setEndLatLng(null);
                    setRouteCoords(null);
                    setRouteDistanceKm(null);
                    onEndChange?.("");
                    setStartSuggestions([]);
                    notifyPointsChanged(ll, null);
                  }}
                  className="suggestion-item"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <label>Destination (search)</label>
          <input
            value={endValue}
            onChange={async (e) => {
              const v = e.target.value;
              onEndChange?.(v);
              setIsPicking(null);
              if (endDebounceRef.current) clearTimeout(endDebounceRef.current);
              endDebounceRef.current = setTimeout(async () => {
                try {
                  const list = await geocode(v, "end");
                  setEndSuggestions(list);
                } catch {
                  setEndSuggestions([]);
                }
              }, 300);
            }}
            placeholder="Type a place (min 3 chars)"
          />
          {endSuggestions.length > 0 && (
            <div className="suggestion-list">
              {endSuggestions.map((s) => (
                <button
                  key={`${s.lat},${s.lng},${s.label}`}
                  type="button"
                  onClick={() => {
                    onEndChange?.(s.label);
                    const ll = { lat: s.lat, lng: s.lng };
                    setEndLatLng(ll);
                    setRouteCoords(null);
                    setRouteDistanceKm(null);
                    setEndSuggestions([]);
                    notifyPointsChanged(startLatLng, ll);
                  }}
                  className="suggestion-item"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ height }}>
        <MapContainer
          center={mapCenter}
          zoom={startLatLng || endLatLng ? 12 : 10}
          style={{ width: "100%", height: "100%", borderRadius: 10 }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {routeBounds && <MapFitter bounds={routeBounds} />}
          <MapClicker startLatLng={startLatLng} endLatLng={endLatLng} onPick={pickPoint} />
          {startLatLng && (
            <Marker position={startLatLng} icon={icons.userStart}>
              <Popup>Your start</Popup>
            </Marker>
          )}
          {endLatLng && (
            <Marker position={endLatLng} icon={icons.userEnd}>
              <Popup>Your destination</Popup>
            </Marker>
          )}
          {routeCoords && <Polyline positions={routeCoords} pathOptions={{ color: "#00b96f" }} />}
          {highlightCoords && (
            <Polyline
              positions={highlightCoords}
              pathOptions={{ color: "#4c7dff", weight: 4, dashArray: "8 8" }}
            />
          )}
          {rideMarkers.length > 0 && (
            <RideClusters rideMarkers={rideMarkers} icons={icons} onRideMarkerClick={onRideMarkerClick} />
          )}
        </MapContainer>
      </div>

      {routeDistanceKm !== null && (
        <p style={{ margin: "10px 0 0", color: "#aaa", fontSize: 13 }}>
          Route distance: <b style={{ color: "#00b96f" }}>{routeDistanceKm} km</b>
        </p>
      )}
    </div>
  );
}
