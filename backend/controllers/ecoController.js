import { rideRepo, VEHICLE_EMISSIONS_KG_PER_KM } from "../storage/store.js";
import { salesforceEnabled, sfApexRestRequest } from "../services/salesforceClient.js";
import { sfRideRepo } from "../repos/sfRideRepo.js";
import { sfRideRequestRepo } from "../repos/sfRideRequestRepo.js";

export const getEcoStats = async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    if (salesforceEnabled()) {
      // Prefer Apex REST (system context) for stable demo + fewer FLS issues.
      try {
        const apex = await sfApexRestRequest({
          path: "/carshary/v1/eco",
          query: { userId },
        });
        if (apex && typeof apex === "object" && apex.totalRides !== undefined) {
          return res.json(apex);
        }
      } catch {
        // fall back to SOQL-based logic below
      }

      const ridesAsDriver = await sfRideRepo.listByDriver(userId, 200);
      const acceptedRideIds = await sfRideRequestRepo.listAcceptedRidesForRider(userId);
      const ridesAsPassenger = [];
      for (const id of acceptedRideIds) {
        const r = await sfRideRepo.findById(id);
        if (r) ridesAsPassenger.push(r);
      }

      const allRides = [...ridesAsDriver, ...ridesAsPassenger];
      if (allRides.length === 0) {
        return res.json({ totalCO2: 0, totalDistance: 0, totalRides: 0, ecoScore: 0 });
      }

      let totalCO2 = 0;
      let totalDistance = 0;
      const byVehicle = Object.fromEntries(Object.keys(VEHICLE_EMISSIONS_KG_PER_KM).map((k) => [k, 0]));

      for (const r of allRides) {
        const distanceKm = Number(r.DistanceKm__c || 0);
        const co2 = Number(r.CO2SavedKg__c || 0);
        totalDistance += distanceKm;
        totalCO2 += co2;
        const key = r.VehicleType__c || "PetrolCar";
        if (!(key in byVehicle)) byVehicle[key] = 0;
        byVehicle[key] += co2;
      }

      const totalRides = allRides.length;
      const ecoScore = Math.round(totalCO2 * 2);
      return res.json({
        totalCO2: totalCO2.toFixed(2),
        totalDistance: totalDistance.toFixed(1),
        totalRides,
        ecoScore,
        byVehicle: Object.fromEntries(Object.entries(byVehicle).map(([k, v]) => [k, Number(v.toFixed(2))])),
      });
    }

    // Find all rides where user participated (as driver or passenger)
    const ridesAsDriver = await rideRepo.listByDriver(userId);
    const ridesAsPassenger = await rideRepo.listJoinedByPassenger(userId);

    const allRides = [...ridesAsDriver, ...ridesAsPassenger];

    if (allRides.length === 0)
      return res.json({ totalCO2: 0, totalDistance: 0, totalRides: 0, ecoScore: 0 });

    // Compute totals
    const totalCO2 = allRides.reduce((sum, r) => sum + (r.co2SavedKg || 0), 0);
    const totalDistance = allRides.reduce((sum, r) => sum + (r.distanceKm || 0), 0);
    const totalRides = allRides.length;
    const ecoScore = Math.round(totalCO2 * 2); // arbitrary “gamified” metric
    const byVehicle = Object.fromEntries(
      Object.keys(VEHICLE_EMISSIONS_KG_PER_KM).map((k) => [k, 0])
    );
    for (const r of allRides) {
      const key = r.vehicleType || "PetrolCar";
      if (!(key in byVehicle)) byVehicle[key] = 0;
      byVehicle[key] += r.co2SavedKg || 0;
    }

    res.json({
      totalCO2: totalCO2.toFixed(2),
      totalDistance: totalDistance.toFixed(1),
      totalRides,
      ecoScore,
      byVehicle: Object.fromEntries(
        Object.entries(byVehicle).map(([k, v]) => [k, Number(v.toFixed(2))])
      ),
    });
  } catch (e) {
    res.status(500).json({ message: "Failed to load eco stats", error: e.message });
  }
};
