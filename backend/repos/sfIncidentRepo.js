import crypto from "node:crypto";
import { createSObject, soql } from "../services/salesforceClient.js";

const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export const sfIncidentRepo = {
  async createSos({ rideId, reporterId, reason }) {
    const out = await createSObject("Incident__c", {
      ExternalIncidentId__c: crypto.randomUUID(),
      Name: `SOS ${new Date().toISOString()}`.slice(0, 80),
      Type__c: "SOS",
      Ride__c: rideId,
      Reporter__c: reporterId,
      Reason__c: String(reason || "SOS triggered from app").slice(0, 1000),
      Flagged__c: true,
      Status__c: "New",
    });
    return out?.id;
  },

  async createReport({ rideId, reporterId, reportedUserId, reason, flagged = false, flags = [] }) {
    const out = await createSObject("Incident__c", {
      ExternalIncidentId__c: crypto.randomUUID(),
      Name: `Incident ${new Date().toISOString()}`.slice(0, 80),
      Type__c: "Report",
      Ride__c: rideId,
      Reporter__c: reporterId,
      ReportedUser__c: reportedUserId,
      Reason__c: String(reason || "").slice(0, 1000),
      Flagged__c: Boolean(flagged),
      Status__c: "New",
    });
    return out?.id;
  },

  async listReports(limit = 200) {
    const q =
      "SELECT Id, Type__c, Ride__c, Reporter__c, ReportedUser__c, Reason__c, Flagged__c, Status__c, CreatedDate " +
      `FROM Incident__c WHERE Type__c='Report' ORDER BY CreatedDate DESC LIMIT ${Math.max(1, Math.min(500, limit))}`;
    const res = await soql(q);
    return res?.records || [];
  },

  async listAll(limit = 200) {
    const q =
      "SELECT Id, Type__c, Ride__c, Reporter__c, Reporter__r.Name, ReportedUser__c, Reason__c, Flagged__c, Status__c, CreatedDate " +
      `FROM Incident__c ORDER BY CreatedDate DESC LIMIT ${Math.max(1, Math.min(500, limit))}`;
    const res = await soql(q);
    return res?.records || [];
  },

  async updateStatus(id, status) {
    // Use PATCH via generic client in controller (avoid circular deps).
    // Implemented in controller using sfRequest, so this is a placeholder for compatibility.
    return { id, status };
  },

  toApiReports(records) {
    return (records || []).map((r) => ({
      _id: r.Id,
      rideId: r.Ride__c,
      reporterId: r.Reporter__c,
      reporterName: r.Reporter__r?.Name || null,
      reportedUserId: r.ReportedUser__c,
      reason: r.Reason__c,
      flagged: Boolean(r.Flagged__c),
      status: r.Status__c,
      createdAt: r.CreatedDate,
    }));
  },
};
