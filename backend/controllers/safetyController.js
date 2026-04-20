import { salesforceEnabled, sfRequest } from "../services/salesforceClient.js";
import { sfIncidentRepo } from "../repos/sfIncidentRepo.js";
import { sfEventRepo } from "../repos/sfEventRepo.js";

export const listIncidents = async (_req, res) => {
  try {
    if (!salesforceEnabled()) return res.json({ incidents: [] });
    const rows = await sfIncidentRepo.listAll(200);
    const incidents = (rows || []).map((r) => ({
      _id: r.Id,
      id: r.Id,
      type: r.Type__c,
      rideId: r.Ride__c,
      reporterId: r.Reporter__c,
      reporterName: r.Reporter__r?.Name || null,
      reportedUserId: r.ReportedUser__c || null,
      reason: r.Reason__c || "",
      flagged: Boolean(r.Flagged__c),
      status: r.Status__c || "New",
      createdAt: r.CreatedDate,
    }));
    return res.json({ incidents });
  } catch (e) {
    return res.status(500).json({ message: "Failed to load incidents", error: e.message });
  }
};

export const resolveIncident = async (req, res) => {
  try {
    if (!salesforceEnabled()) return res.status(400).json({ message: "Salesforce mode disabled" });
    const id = String(req.params.id || "").trim();
    const status = String(req.body?.status || "Resolved").trim();
    if (!id) return res.status(400).json({ message: "Missing incident id" });

    await sfRequest({ method: "PATCH", path: `/sobjects/Incident__c/${id}`, body: { Status__c: status, Flagged__c: false } });
    await sfEventRepo.log({ type: "Safety", actorId: req.user?._id, payload: { action: "incident_status", id, status } });
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: "Failed to update incident", error: e.message });
  }
};

