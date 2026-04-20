import { deleteSObject, soql } from "../services/salesforceClient.js";

const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const collectIds = (records, key = "Id") =>
  (records || []).map((r) => r?.[key]).filter(Boolean).map(String);

const deleteMany = async (sobject, ids) => {
  let ok = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      await deleteSObject(sobject, id);
      ok += 1;
    } catch {
      failed += 1;
    }
  }
  return { ok, failed, total: ids.length };
};

export const sfAdminRepo = {
  async resetDemoData({ demoPrefix = "DEMO-" } = {}) {
    const prefix = esc(demoPrefix);

    // Only remove demo-tagged rides and related records.
    const rides = await soql(
      `SELECT Id FROM Ride__c WHERE ExternalRideId__c LIKE '${prefix}%' LIMIT 500`
    );
    const rideIds = collectIds(rides?.records);

    if (rideIds.length === 0) {
      return { ok: true, deleted: {}, note: "No demo rides found" };
    }

    const inClause = `('${rideIds.map(esc).join("','")}')`;

    const [reqs, msgs, incidents, promos] = await Promise.all([
      soql(`SELECT Id FROM RideRequest__c WHERE Ride__c IN ${inClause} LIMIT 2000`),
      soql(`SELECT Id FROM Message__c WHERE Ride__c IN ${inClause} LIMIT 2000`),
      soql(`SELECT Id FROM Incident__c WHERE Ride__c IN ${inClause} LIMIT 2000`),
      soql(`SELECT Id FROM PromoCode__c WHERE Ride__c IN ${inClause} LIMIT 2000`),
    ]);

    const reqIds = collectIds(reqs?.records);
    const msgIds = collectIds(msgs?.records);
    const incidentIds = collectIds(incidents?.records);
    const promoIds = collectIds(promos?.records);

    // Delete children first, then rides.
    const deleted = {
      RideRequest__c: await deleteMany("RideRequest__c", reqIds),
      Message__c: await deleteMany("Message__c", msgIds),
      Incident__c: await deleteMany("Incident__c", incidentIds),
      PromoCode__c: await deleteMany("PromoCode__c", promoIds),
      Ride__c: await deleteMany("Ride__c", rideIds),
    };

    return { ok: true, deleted };
  },
};

