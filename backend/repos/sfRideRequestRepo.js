import crypto from "node:crypto";
import { createSObject, soql, updateSObject } from "../services/salesforceClient.js";

const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const sfRideRequestRepo = {
  async findExisting({ rideId, riderId }) {
    const q =
      "SELECT Id, Ride__c, Rider__c, Status__c FROM RideRequest__c " +
      `WHERE Ride__c='${esc(rideId)}' AND Rider__c='${esc(riderId)}' AND Status__c IN ('Requested','Accepted') LIMIT 1`;
    const res = await soql(q);
    return res?.records?.[0] || null;
  },

  async create({ rideId, riderId, pickup, drop, promoId = null }) {
    const out = await createSObject("RideRequest__c", {
      ExternalRequestId__c: crypto.randomUUID(),
      Name: `Req ${new Date().toISOString()}`.slice(0, 80),
      Ride__c: rideId,
      Rider__c: riderId,
      Status__c: "Requested",
      PromoCode__c: promoId,
      PromoUsed__c: false,
      PickupLabel__c: pickup?.label || null,
      PickupLat__c: toNum(pickup?.lat),
      PickupLng__c: toNum(pickup?.lng),
      DropLabel__c: drop?.label || null,
      DropLat__c: toNum(drop?.lat),
      DropLng__c: toNum(drop?.lng),
    });
    return out?.id;
  },

  async createWaitlisted({ rideId, riderId, pickup, drop, promoId = null }) {
    const out = await createSObject("RideRequest__c", {
      ExternalRequestId__c: crypto.randomUUID(),
      Name: `Waitlist ${new Date().toISOString()}`.slice(0, 80),
      Ride__c: rideId,
      Rider__c: riderId,
      Status__c: "Waitlisted",
      PromoCode__c: promoId,
      PromoUsed__c: false,
      PickupLabel__c: pickup?.label || null,
      PickupLat__c: toNum(pickup?.lat),
      PickupLng__c: toNum(pickup?.lng),
      DropLabel__c: drop?.label || null,
      DropLat__c: toNum(drop?.lat),
      DropLng__c: toNum(drop?.lng),
    });
    return out?.id;
  },

  async setStatusByRideAndRider({ rideId, riderId, status }) {
    const q =
      "SELECT Id FROM RideRequest__c " +
      `WHERE Ride__c='${esc(rideId)}' AND Rider__c='${esc(riderId)}' AND Status__c IN ('Requested','Waitlisted') LIMIT 1`;
    const res = await soql(q);
    const rec = res?.records?.[0];
    if (!rec?.Id) return null;
    await updateSObject("RideRequest__c", rec.Id, { Status__c: status });
    return rec.Id;
  },

  async setStatusById({ id, status }) {
    if (!id) return null;
    await updateSObject("RideRequest__c", id, { Status__c: status });
    return id;
  },

  async findOldestWaitlisted(rideId) {
    const q =
      "SELECT Id, Rider__c FROM RideRequest__c " +
      `WHERE Ride__c='${esc(rideId)}' AND Status__c='Waitlisted' ORDER BY CreatedDate ASC LIMIT 1`;
    const res = await soql(q);
    return res?.records?.[0] || null;
  },

  async withdraw({ rideId, riderId }) {
    // Mark Requested/Accepted as Withdrawn
    const q =
      "SELECT Id, Status__c FROM RideRequest__c " +
      `WHERE Ride__c='${esc(rideId)}' AND Rider__c='${esc(riderId)}' AND Status__c IN ('Requested','Waitlisted','Accepted')`;
    const res = await soql(q);
    const recs = res?.records || [];
    for (const r of recs) {
      await updateSObject("RideRequest__c", r.Id, { Status__c: "Withdrawn" });
    }
    return recs.length;
  },

  async listForRide(rideId) {
    const q =
      "SELECT Id, Rider__c, Rider__r.Name, Rider__r.Email__c, Status__c, " +
      "PickupLabel__c, PickupLat__c, PickupLng__c, DropLabel__c, DropLat__c, DropLng__c, CreatedDate " +
      `FROM RideRequest__c WHERE Ride__c='${esc(rideId)}' ORDER BY CreatedDate DESC`;
    const res = await soql(q);
    return res?.records || [];
  },

  async listAcceptedRidesForRider(riderId) {
    const q =
      "SELECT Ride__c FROM RideRequest__c " +
      `WHERE Rider__c='${esc(riderId)}' AND Status__c='Accepted'`;
    const res = await soql(q);
    return (res?.records || []).map((r) => r.Ride__c).filter(Boolean);
  },
};
