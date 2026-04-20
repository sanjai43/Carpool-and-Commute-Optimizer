import StatusBadge from "./StatusBadge.jsx";
import { formatCountdown, formatMemberSince } from "../lib/time.js";

export default function RideResultsDrawer({
  open,
  rides = [],
  selectedRideId,
  onClose,
  onSelectRide,
  onRequestRide,
  headerExtra,
  aiExplainText,
  aiExplainSource,
  dismissOnBackdrop = true,
}) {
  const selected = rides.find((r) => r._id === selectedRideId) || null;

  return (
    <div className={`drawer ${open ? "drawer--open" : ""}`} role="dialog" aria-hidden={!open}>
      <div className="drawer__sheet">
        <div className="drawer__head">
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0 }}>Rides nearby</h3>
              <span style={{ color: "#888", fontSize: 12 }}>{rides.length} found</span>
            </div>
            {headerExtra}
          </div>
          <button type="button" className="btn btn--sm btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="drawer__body">
          {rides.length === 0 ? (
            <div className="panel" style={{ color: "#aaa" }}>
              No rides to show.
            </div>
          ) : (
            <div className="drawer__list">
              {rides.map((r) => {
                const active = r._id === selectedRideId;
                const countdown = formatCountdown(r.departureTime);
                const seatsTaken = r.passengers?.length || 0;
                const capacity = r.capacity || 3;
                return (
                  <button
                    key={r._id}
                    type="button"
                    className={`drawer__item ${active ? "drawer__item--active" : ""}`}
                    onClick={() => onSelectRide?.(r)}
                  >
                    <div className="drawer__itemTop">
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: "#eaeaea", fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {r.start} → {r.end}
                        </div>
                        <div style={{ color: "#aaa", fontSize: 12 }}>
                          {r.driver?.name || "Driver"} • {r.vehicleType || "Vehicle"} • {seatsTaken}/{capacity} seats
                        </div>
                        {countdown && <div style={{ color: "#8bd7b6", fontSize: 12, marginTop: 3 }}>{countdown}</div>}
                      </div>
                      <StatusBadge status={r.status} />
                    </div>
                    {typeof r._extraKm === "number" && (
                      <div style={{ color: "#bbb", fontSize: 12, marginTop: 6 }}>
                        Detour: <b>+{r._extraKm} km</b> (~{r._extraMin} min)
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {selected && (
            <div className="panel" style={{ marginTop: 12 }}>
              <div className="ride-head">
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "#eaeaea", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {selected.start} → {selected.end}
                  </div>
                  <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
                    Driver: <b style={{ color: "#dfffe9" }}>{selected.driver?.name || "N/A"}</b>{" "}
                    {selected.driver?.verified ? <span style={{ color: "#00b96f" }}>✓ Verified</span> : null}
                    {selected.driver?.ratingCount ? (
                      <span style={{ marginLeft: 8, color: "#aaa" }}>
                        ⭐ {selected.driver.ratingAvg} • {selected.driver.ratingCount}
                      </span>
                    ) : null}
                    {selected.driver?.createdAt ? (
                      <span style={{ marginLeft: 8, color: "#888" }}>
                        Member since {formatMemberSince(selected.driver.createdAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <StatusBadge status={selected.status} />
              </div>
              {selected.departureTime && (
                <div style={{ marginTop: 8, color: "#bbb", fontSize: 13 }}>
                  Departs: <b>{new Date(selected.departureTime).toLocaleString()}</b>
                </div>
              )}
              <div style={{ marginTop: 10 }}>
                <div style={{ color: "#aaa", fontSize: 12, marginBottom: 6 }}>Why recommended</div>
                <div style={{ color: "#e7e7e7", fontSize: 13, lineHeight: 1.45 }}>
                  {aiExplainText || "Generating explanation…"}
                </div>
                {aiExplainSource ? (
                  <div style={{ color: "#888", fontSize: 11, marginTop: 6 }}>
                    Source: <b style={{ color: "#bbb" }}>{aiExplainSource}</b>
                  </div>
                ) : null}
              </div>
              <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="btn" onClick={() => onRequestRide?.(selected)}>
                  Request ride
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {dismissOnBackdrop ? (
        <button type="button" className="drawer__backdrop" onClick={onClose} aria-label="Close drawer" />
      ) : null}
    </div>
  );
}
