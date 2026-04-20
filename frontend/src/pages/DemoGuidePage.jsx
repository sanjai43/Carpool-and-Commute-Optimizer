import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/axios.js";
import Navbar from "../components/Navbar.jsx";
import useToast from "../hooks/useToast.jsx";

const copy = async (text) => {
  try {
    await navigator.clipboard?.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export default function DemoGuidePage() {
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();
  const [busy, setBusy] = useState(false);

  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "null");
    } catch {
      return null;
    }
  }, []);
  const role = localStorage.getItem("role") || user?.role || "";

  const seedCoimbatore = async () => {
    try {
      setBusy(true);
      await API.post("/admin/seed-rides", { preset: "coimbatore", count: 18 });
      showToast("✅ Seeded Coimbatore rides", "success");
      navigate("/match");
    } catch (e) {
      showToast(e.response?.data?.message || "❌ Failed to seed rides", "error");
    } finally {
      setBusy(false);
    }
  };

  const resetDemo = async () => {
    try {
      setBusy(true);
      await API.post("/admin/reset-demo");
      showToast("✅ Demo data reset", "success");
    } catch (e) {
      showToast(e.response?.data?.message || "❌ Failed to reset demo data", "error");
    } finally {
      setBusy(false);
    }
  };

  const fullDemoSetup = async () => {
    try {
      setBusy(true);
      await API.post("/admin/reset-demo").catch(() => {});
      await API.post("/admin/seed-rides", { preset: "coimbatore", count: 18 });
      await API.post("/sf/schedule-reminders").catch(() => {});
      showToast("✅ Full demo setup done", "success");
      navigate("/match");
    } catch (e) {
      showToast(e.response?.data?.message || "❌ Full setup failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const scheduleReminders = async () => {
    try {
      setBusy(true);
      const res = await API.post("/sf/schedule-reminders");
      if (res.data?.ok === false) throw new Error(res.data?.message || "Failed");
      showToast("✅ Reminders scheduled (every 5 min)", "success");
    } catch (e) {
      showToast(e.response?.data?.message || e.message || "❌ Failed to schedule reminders", "error");
    } finally {
      setBusy(false);
    }
  };

  const runRemindersNow = async () => {
    try {
      setBusy(true);
      const res = await API.post("/sf/run-reminders-now");
      if (res.data?.ok === false) throw new Error(res.data?.message || "Failed");
      showToast("✅ Reminder messages generated", "success");
      showToast("Open a ride chat to see Message__c reminders.", "info");
    } catch (e) {
      showToast(e.response?.data?.message || e.message || "❌ Failed to run reminders", "error");
    } finally {
      setBusy(false);
    }
  };

  const schemaCheck = async () => {
    try {
      setBusy(true);
      const res = await API.get("/sf/schema-check");
      if (!res.data?.ok) {
        const objects = res.data?.objects || {};
        const missing = Object.entries(objects)
          .filter(([, v]) => Array.isArray(v?.missing) && v.missing.length > 0)
          .map(([k, v]) => `${k}: ${v.missing.join(", ")}`)
          .slice(0, 2)
          .join(" | ");
        showToast("⚠️ Salesforce schema/FLS mismatch", "error");
        if (missing) showToast(missing, "info");
        return;
      }
      showToast("✅ Salesforce schema OK", "success");
    } catch (e) {
      showToast(e.response?.data?.message || e.message || "❌ Schema check failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const apexSchedule = "CarSharySchedulerSetup.scheduleRideReminders();";
  const apexRunOnce = "CarSharyRideReminderJob.runOnce();";

  return (
    <>
      <Navbar />
      <ToastContainer />

      <div style={{ minHeight: "calc(100vh - 60px)", paddingTop: "80px", paddingBottom: "30px" }}>
        <div className="container fade-in" style={{ marginTop: 0 }}>
          <h2 style={{ marginTop: 0, color: "#00b96f" }}>Demo Guide</h2>
          <p style={{ marginTop: 0, color: "#aaa" }}>
            One page to run the full CarpoolX demo quickly.
          </p>

          <div className="card" style={{ background: "#14161b" }}>
            <h3 style={{ marginTop: 0 }}>1) Make the map look alive</h3>
            <div className="ui-row" style={{ gap: 10 }}>
              <button
                type="button"
                className="btn"
                disabled={busy || role !== "Admin"}
                onClick={seedCoimbatore}
                title={role !== "Admin" ? "Admin only" : "Seed rides"}
              >
                {busy ? "Working…" : "Seed Coimbatore rides"}
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={busy || role !== "Admin"}
                onClick={resetDemo}
                title={role !== "Admin" ? "Admin only" : "Reset demo data"}
              >
                Reset demo
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy || role !== "Admin"}
                onClick={fullDemoSetup}
                title={role !== "Admin" ? "Admin only" : "Reset + seed + schedule"}
              >
                Full setup
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => navigate("/match")}>
                Open Match
              </button>
            </div>
            {role !== "Admin" ? (
              <div style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
                Seeding is Admin-only. Login as `admin@carshary.local` (or SF Admin) to use it.
              </div>
            ) : null}
          </div>

          <div className="card" style={{ background: "#14161b" }}>
            <h3 style={{ marginTop: 0 }}>2) Pricing + Discounts</h3>
            <div className="ui-row" style={{ gap: 10 }}>
              <button type="button" className="btn btn--ghost" onClick={() => navigate("/promos")}>
                Open Discounts
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => navigate("/match")}>
                Request Ride (use promo)
              </button>
            </div>
            <div style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
              Tip: after a ride completes, a promo code appears in Discounts (auto-refreshes). Use it in the “Promo code” field while requesting the next ride.
            </div>
          </div>

          {role === "Driver" ? (
            <div className="card" style={{ background: "#14161b" }}>
              <h3 style={{ marginTop: 0 }}>3) Driver earnings</h3>
              <div className="ui-row" style={{ gap: 10 }}>
                <button type="button" className="btn btn--ghost" onClick={() => navigate("/earnings")}>
                  Open Earnings
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => navigate("/myrides")}>
                  Open My Rides
                </button>
              </div>
              <div style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
                After completing a ride, Earnings updates automatically.
              </div>
            </div>
          ) : null}

          <div className="card" style={{ background: "#14161b" }}>
            <h3 style={{ marginTop: 0 }}>4) Eco stats</h3>
            <div className="ui-row" style={{ gap: 10 }}>
              <button type="button" className="btn btn--ghost" onClick={() => navigate("/eco")}>
                Open Eco Stats
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => navigate("/myrides")}>
                Complete a ride
              </button>
            </div>
            <div style={{ color: "#888", fontSize: 12, marginTop: 8 }}>
              Eco stats now auto-refresh when you accept/complete rides (and also every 30 seconds). Use the Refresh button if needed.
            </div>
          </div>

          {role === "Admin" ? (
            <div className="card" style={{ background: "#14161b" }}>
              <h3 style={{ marginTop: 0 }}>5) Reminders (Salesforce job)</h3>
              <div className="ui-row" style={{ gap: 10 }}>
                <button type="button" className="btn" disabled={busy} onClick={scheduleReminders}>
                  {busy ? "Working…" : "Schedule (5 min)"}
                </button>
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={runRemindersNow}>
                  Run once now
                </button>
                <button type="button" className="btn btn--ghost" disabled={busy} onClick={schemaCheck}>
                  Schema check
                </button>
              </div>
              <div style={{ marginTop: 10, color: "#888", fontSize: 12 }}>
                If Tooling API is blocked in your org, run these in Execute Anonymous:
              </div>
              <div className="panel" style={{ marginTop: 8, background: "#0f1115" }}>
                <div className="ui-row ui-between" style={{ alignItems: "center" }}>
                  <code style={{ color: "#bbb" }}>{apexSchedule}</code>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={async () => {
                      const ok = await copy(apexSchedule);
                      showToast(ok ? "Copied" : "Copy failed", ok ? "success" : "error");
                    }}
                  >
                    Copy
                  </button>
                </div>
                <div className="ui-row ui-between" style={{ alignItems: "center", marginTop: 10 }}>
                  <code style={{ color: "#bbb" }}>{apexRunOnce}</code>
                  <button
                    type="button"
                    className="btn btn--sm btn--ghost"
                    onClick={async () => {
                      const ok = await copy(apexRunOnce);
                      showToast(ok ? "Copied" : "Copy failed", ok ? "success" : "error");
                    }}
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="card" style={{ background: "#14161b" }}>
            <h3 style={{ marginTop: 0 }}>6) Safety (SOS)</h3>
            <div style={{ color: "#888", fontSize: 12 }}>
              Open any ride chat → click <b>SOS</b>. Salesforce will auto-escalate the incident and create a High priority Task for Admin.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
