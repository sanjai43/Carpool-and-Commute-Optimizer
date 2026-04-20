import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { exchangeJwtForAccessToken } from "../services/salesforceJwt.js";
import { salesforceEnabled, sfRequest } from "../services/salesforceClient.js";

const router = express.Router();

// Admin-only: verify JWT OAuth works (does not reveal full token)
router.get("/jwt-test", protect, authorizeRoles("Admin"), async (_req, res) => {
  try {
    const out = await exchangeJwtForAccessToken();
    const token = out.access_token || "";
    res.json({
      ok: true,
      instance_url: out.instance_url || null,
      token_preview: token ? `${token.slice(0, 10)}…${token.slice(-6)}` : null,
      token_length: token ? token.length : 0,
      id: out.id || null,
      issued_at: out.issued_at || null,
      token_type: out.token_type || null,
    });
  } catch (e) {
    res.status(400).json({ ok: false, message: e.message });
  }
});

const runApex = async (apex) => {
  return sfRequest({
    path: "/tooling/executeAnonymous",
    query: { anonymousBody: apex },
  });
};

// Admin-only: schedule reminders every 5 minutes (Execute Anonymous via Tooling API)
router.post("/schedule-reminders", protect, authorizeRoles("Admin"), async (_req, res) => {
  try {
    if (!salesforceEnabled()) return res.status(400).json({ ok: false, message: "Salesforce mode is disabled" });
    const result = await runApex("CarSharySchedulerSetup.scheduleRideReminders();");
    return res.json({ ok: true, result });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }
});

// Admin-only: run reminders once now (inserts Message__c reminders)
router.post("/run-reminders-now", protect, authorizeRoles("Admin"), async (_req, res) => {
  try {
    if (!salesforceEnabled()) return res.status(400).json({ ok: false, message: "Salesforce mode is disabled" });
    const result = await runApex("CarSharyRideReminderJob.runOnce();");
    return res.json({ ok: true, result });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }
});

// Admin-only: quick schema/FLS check for demo troubleshooting
router.get("/schema-check", protect, authorizeRoles("Admin"), async (_req, res) => {
  try {
    if (!salesforceEnabled()) return res.status(400).json({ ok: false, message: "Salesforce mode is disabled" });

    const EXPECTED = {
      AppUser__c: ["Name", "ExternalUserId__c", "Email__c", "Role__c", "Verified__c"],
      Ride__c: ["Driver__c", "StartText__c", "EndText__c", "StartLat__c", "StartLng__c", "EndLat__c", "EndLng__c", "Status__c", "DistanceKm__c", "CO2SavedKg__c"],
      RideRequest__c: ["Ride__c", "Rider__c", "Status__c", "Fare__c", "DiscountAmount__c", "FinalFare__c"],
      PromoCode__c: ["Code__c", "Value__c", "DiscountType__c", "Active__c", "ExpiresAt__c", "UsedCount__c", "MaxUses__c"],
      Incident__c: ["Type__c", "Status__c", "Flagged__c"],
      Message__c: ["Ride__c", "Author__c", "Body__c"],
    };

    const out = {};
    for (const [obj, fields] of Object.entries(EXPECTED)) {
      const desc = await sfRequest({ path: `/sobjects/${obj}/describe` });
      const actual = new Set((desc?.fields || []).map((f) => f?.name).filter(Boolean));
      const missing = fields.filter((f) => !actual.has(f));
      out[obj] = { missing, ok: missing.length === 0 };
    }

    return res.json({
      ok: Object.values(out).every((v) => v.ok),
      note:
        "If fields show as missing but exist in Setup, it's almost always Field-Level Security for the JWT user (SF_USERNAME). Assign the permission set / profile access and retry.",
      objects: out,
    });
  } catch (e) {
    return res.status(400).json({ ok: false, message: e.message });
  }
});

export default router;
