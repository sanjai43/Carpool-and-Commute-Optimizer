import crypto from "node:crypto";
import { createSObject, soql } from "../services/salesforceClient.js";

const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export const sfEventRepo = {
  async log({ type = "System", actorId = null, rideId = null, payload = {} }) {
    const out = await createSObject("Event__c", {
      ExternalEventId__c: crypto.randomUUID(),
      Name: `${type} ${new Date().toISOString()}`.slice(0, 80),
      Type__c: type,
      Actor__c: actorId,
      Ride__c: rideId,
      Payload__c: JSON.stringify(payload || {}).slice(0, 32000),
    });
    return out?.id || null;
  },

  async list(limit = 200) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200));
    const q =
      "SELECT Id, Name, Type__c, Actor__c, Actor__r.Name, Ride__c, Payload__c, CreatedDate " +
      `FROM Event__c ORDER BY CreatedDate DESC LIMIT ${safeLimit}`;
    const res = await soql(q);
    return res?.records || [];
  },

  async listByRide(rideId, limit = 100) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
    const q =
      "SELECT Id, Name, Type__c, Actor__c, Actor__r.Name, Ride__c, Payload__c, CreatedDate " +
      `FROM Event__c WHERE Ride__c='${esc(rideId)}' ORDER BY CreatedDate DESC LIMIT ${safeLimit}`;
    const res = await soql(q);
    return res?.records || [];
  },

  toApi(e) {
    return {
      _id: e.Id,
      id: e.Id,
      name: e.Name,
      type: e.Type__c,
      actorId: e.Actor__c || null,
      actorName: e.Actor__r?.Name || null,
      rideId: e.Ride__c || null,
      payload: e.Payload__c || null,
      createdAt: e.CreatedDate,
    };
  },
};

