import { salesforceEnabled, sfApexRestRequest, soql } from "../services/salesforceClient.js";
import { rideRepo, populateRide } from "../storage/store.js";

export const getDriverEarnings = async (req, res) => {
  try {
    const driverId = req.user.id || req.user._id;

    if (salesforceEnabled()) {
      try {
        const apex = await sfApexRestRequest({ path: "/carshary/v1/earnings", query: { userId: driverId } });
        if (apex && typeof apex === "object" && apex.total !== undefined) return res.json(apex);
      } catch {
        // fallback to SOQL aggregate
      }

      const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      const q =
        "SELECT Ride__c rideId, SUM(FinalFare__c) total, COUNT(Id) cnt " +
        "FROM RideRequest__c " +
        `WHERE Status__c='Accepted' AND Ride__r.Status__c='Completed' AND Ride__r.Driver__c='${esc(driverId)}' ` +
        "GROUP BY Ride__c";
      const agg = await soql(q);
      const rows = agg?.records || [];

      const total = rows.reduce((sum, r) => sum + Number(r.total || 0), 0);
      const rides = rows
        .map((r) => ({
          rideId: r.rideId,
          total: Number(r.total || 0),
          riders: Number(r.cnt || 0),
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 50);

      return res.json({ total: Number(total.toFixed(2)), rides });
    }

    // Local store fallback: sum ride "contribution" as passenger paid (no real payments), approximate using co2SavedKg as proxy.
    const rides = (await rideRepo.listByDriver(driverId)).filter((r) => r.status === "Completed");
    const out = rides.map((r) => {
      const pr = populateRide(r, { withPassengers: true });
      const riders = pr.passengers?.length || 0;
      const total = 0;
      return { rideId: pr._id, riders, total };
    });
    return res.json({ total: 0, rides: out });
  } catch (e) {
    return res.status(500).json({ message: "Failed to load earnings", error: e.message });
  }
};
