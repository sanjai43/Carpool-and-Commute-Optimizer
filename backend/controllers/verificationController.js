import { salesforceEnabled } from "../services/salesforceClient.js";
import { sfUserRepo } from "../repos/sfUserRepo.js";
import { sfEventRepo } from "../repos/sfEventRepo.js";

export const submitVerification = async (req, res) => {
  try {
    if (!salesforceEnabled()) return res.status(400).json({ message: "Salesforce mode disabled" });
    const userId = req.user?._id;
    const docUrl = String(req.body?.docUrl || "").trim();
    if (!docUrl) return res.status(400).json({ message: "Doc URL is required" });
    const updated = await sfUserRepo.submitVerification({ userId, docUrl });
    await sfEventRepo.log({ type: "System", actorId: userId, payload: { action: "verify_submit", docUrl } });
    return res.json({ ok: true, user: sfUserRepo.toApiUser(updated) });
  } catch (e) {
    return res.status(500).json({ message: "Failed to submit verification", error: e.message });
  }
};

export const listPendingDrivers = async (_req, res) => {
  try {
    if (!salesforceEnabled()) return res.json({ drivers: [] });
    const rows = await sfUserRepo.listAll(200);
    const drivers = (rows || [])
      .filter((u) => u.Role__c === "Driver" && (u.VerificationStatus__c === "Pending" || u.Verified__c === false))
      .map((u) => sfUserRepo.toApiUser(u));
    return res.json({ drivers });
  } catch (e) {
    return res.status(500).json({ message: "Failed to load pending drivers", error: e.message });
  }
};

export const setDriverVerification = async (req, res) => {
  try {
    if (!salesforceEnabled()) return res.status(400).json({ message: "Salesforce mode disabled" });
    const userId = String(req.params.userId || "").trim();
    const status = String(req.body?.status || "").trim();
    const notes = String(req.body?.notes || "").trim();
    if (!userId) return res.status(400).json({ message: "Missing userId" });
    if (!["Approved", "Rejected", "Pending", "None"].includes(status))
      return res.status(400).json({ message: "Invalid status" });
    const updated = await sfUserRepo.setVerification({ userId, status, notes });
    await sfEventRepo.log({ type: "System", actorId: req.user?._id, payload: { action: "verify_set", userId, status } });
    return res.json({ ok: true, user: sfUserRepo.toApiUser(updated) });
  } catch (e) {
    return res.status(500).json({ message: "Failed to update verification", error: e.message });
  }
};

