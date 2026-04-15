import Ride from "../models/Ride.js";
import User from "../models/User.js";

export const getEcoStats = async (req, res) => {
  try {
    const userId = req.user.id;

    // Find all rides where user participated (as driver or passenger)
    const ridesAsDriver = await Ride.find({ driver: userId });
    const ridesAsPassenger = await Ride.find({ passengers: userId });

    const allRides = [...ridesAsDriver, ...ridesAsPassenger];

    if (allRides.length === 0)
      return res.json({ totalCO2: 0, totalDistance: 0, totalRides: 0, ecoScore: 0 });

    // Compute totals
    const totalCO2 = allRides.reduce((sum, r) => sum + (r.co2SavedKg || 0), 0);
    const totalDistance = allRides.reduce((sum, r) => sum + (r.distanceKm || 0), 0);
    const totalRides = allRides.length;
    const ecoScore = Math.round(totalCO2 * 2); // arbitrary “gamified” metric

    res.json({
      totalCO2: totalCO2.toFixed(2),
      totalDistance: totalDistance.toFixed(1),
      totalRides,
      ecoScore,
    });
  } catch (e) {
    res.status(500).json({ message: "Failed to load eco stats", error: e.message });
  }
};
