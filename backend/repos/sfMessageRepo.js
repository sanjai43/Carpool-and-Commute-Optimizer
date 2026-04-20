import crypto from "node:crypto";
import { createSObject, soql } from "../services/salesforceClient.js";

const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export const sfMessageRepo = {
  async create({ rideId, authorId, text, flagged = false, flags = [] }) {
    const out = await createSObject("Message__c", {
      ExternalMessageId__c: crypto.randomUUID(),
      Name: `Msg ${new Date().toISOString()}`.slice(0, 80),
      Ride__c: rideId,
      Author__c: authorId,
      Text__c: String(text || "").slice(0, 1000),
      Flagged__c: Boolean(flagged),
      Flags__c: Array.isArray(flags) ? flags.join(",").slice(0, 255) : null,
      SentAt__c: new Date().toISOString(),
    });
    return out?.id;
  },

  async listForRide(rideId, limit = 200) {
    const q =
      "SELECT Id, Author__c, Author__r.Name, Text__c, Flagged__c, Flags__c, SentAt__c, CreatedDate " +
      `FROM Message__c WHERE Ride__c='${esc(rideId)}' ORDER BY CreatedDate ASC LIMIT ${Math.max(1, Math.min(500, limit))}`;
    const res = await soql(q);
    return res?.records || [];
  },

  toApiMessages(records) {
    return (records || []).map((m) => ({
      _id: m.Id,
      userId: m.Author__c,
      userName: m.Author__r?.Name || "User",
      text: m.Text__c || "",
      flagged: Boolean(m.Flagged__c),
      flags: m.Flags__c ? String(m.Flags__c).split(",").map((s) => s.trim()).filter(Boolean) : [],
      createdAt: m.SentAt__c || m.CreatedDate,
    }));
  },
};

