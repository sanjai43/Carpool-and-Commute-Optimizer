import Ride from "../models/Ride.js";
import User from "../models/User.js";

// 🌍 Constants for CO₂ savings calculation
const CO2_PER_LITRE = 2.31; // kg CO₂ / litre petrol
const AVG_MILEAGE_KM_PER_L = 15;

// 🔹 Estimate CO₂ saved by ride sharing
const calcCO2SavedKg = (distanceKm, passengerCount = 1) => {
  const extraPassengers = Math.max(0, passengerCount - 1);
  const fuelSavedL = (distanceKm / AVG_MILEAGE_KM_PER_L) * extraPassengers;
  return +((fuelSavedL * CO2_PER_LITRE).toFixed(2));
};

const parseCoordinate = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildPoint = (lng, lat) => ({
  type: "Point",
  coordinates: [lng ?? 0, lat ?? 0],
});

// =========================================================
// ✅ Create a new ride (Driver)
// =========================================================
export const createRide = async (req, res) => {
  try {
    const { start, end, distanceKm, startLat, startLng, endLat, endLng, capacity } = req.body;

    if (!start || !end || !distanceKm) {
      return res.status(400).json({ message: "Start, end, and distance are required" });
    }

    const rideCapacity = capacity && capacity > 0 ? capacity : 3;
    const safeDistance = Number(distanceKm);
    const parsedStartLat = parseCoordinate(startLat);
    const parsedStartLng = parseCoordinate(startLng);
    const parsedEndLat = parseCoordinate(endLat);
    const parsedEndLng = parseCoordinate(endLng);

    if (!Number.isFinite(safeDistance) || safeDistance <= 0) {
      return res.status(400).json({ message: "Distance must be a valid number" });
    }

    const ride = await Ride.create({
      driver: req.user._id,
      start,
      end,
      distanceKm: safeDistance,
      capacity: rideCapacity,
      passengers: [],
      requests: [],
      startLocation: buildPoint(parsedStartLng, parsedStartLat),
      endLocation: buildPoint(parsedEndLng, parsedEndLat),
      co2SavedKg: calcCO2SavedKg(safeDistance, 1),
      status: "Open",
    });

    const populatedRide = await Ride.findById(ride._id).populate("driver", "name");

    const io = req.app.get("io");
    if (io) io.emit("ride:new", populatedRide);

    res.status(201).json({
      success: true,
      message: "Ride created successfully",
      ride: populatedRide,
    });
  } catch (err) {
    console.error("❌ CreateRide Error:", err);
    res.status(500).json({ message: "Create ride failed", error: err.message });
  }
};

// =========================================================
// ✅ Get all rides (Public or filtered by role)
// =========================================================
export const getRides = async (_req, res) => {
  try {
    const rides = await Ride.find()
      .sort({ createdAt: -1 })
      .populate("driver", "name role");
    res.json(rides);
  } catch (e) {
    res.status(500).json({ message: "Get rides failed", error: e.message });
  }
};

// =========================================================
// ✅ Rider requests to join a ride
// =========================================================
export const joinRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (ride.driver.toString() === req.user._id.toString())
      return res.status(400).json({ message: "Drivers cannot join their own ride" });

    if (ride.requests.includes(req.user._id))
      return res.status(400).json({ message: "Already requested this ride" });

    if (["Full", "Completed", "Cancelled"].includes(ride.status))
      return res.status(400).json({ message: `Cannot join a ${ride.status} ride` });

    ride.requests.push(req.user._id);
    await ride.save();

    const populatedRide = await Ride.findById(ride._id)
      .populate("driver", "name")
      .populate("requests", "name");

    const io = req.app.get("io");
    if (io) io.emit("ride:join", { rideId: ride._id, riderName: req.user.name });

    res.status(200).json({
      success: true,
      message: "Join request sent successfully",
      ride: populatedRide,
    });
  } catch (err) {
    console.error("❌ joinRide error:", err);
    res.status(500).json({ message: "Failed to send join request" });
  }
};

// =========================================================
// ✅ AI-like Ride Matching (nearby rides by start/end)
// =========================================================
export const matchRides = async (req, res) => {
  try {
    const { startLat, startLng, endLat, endLng, start, end } = req.body;
    const radius = 25000; // meters (25 km)
    const parsedStartLat = parseCoordinate(startLat);
    const parsedStartLng = parseCoordinate(startLng);
    const parsedEndLat = parseCoordinate(endLat);
    const parsedEndLng = parseCoordinate(endLng);

    if (
      parsedStartLat !== null &&
      parsedStartLng !== null &&
      parsedEndLat !== null &&
      parsedEndLng !== null
    ) {
      const nearbyRides = await Ride.find({
        startLocation: {
          $near: {
            $geometry: { type: "Point", coordinates: [parsedStartLng, parsedStartLat] },
            $maxDistance: radius,
          },
        },
        status: "Open",
      })
        .populate("driver", "name")
        .limit(50);

      const filtered = nearbyRides.filter((ride) => {
        const [lng, lat] = ride.endLocation.coordinates;
        const dx = parsedEndLat - lat;
        const dy = parsedEndLng - lng;
        const distKm = Math.sqrt(dx * dx + dy * dy) * 111;
        return distKm <= radius / 1000;
      });

      return res.json(filtered);
    }

    const openRides = await Ride.find({ status: "Open" })
      .sort({ createdAt: -1 })
      .populate("driver", "name")
      .limit(50);

    const normalizedStart = start?.trim().toLowerCase();
    const normalizedEnd = end?.trim().toLowerCase();

    const filtered = openRides.filter((ride) => {
      const matchesStart = normalizedStart
        ? ride.start.toLowerCase().includes(normalizedStart)
        : true;
      const matchesEnd = normalizedEnd
        ? ride.end.toLowerCase().includes(normalizedEnd)
        : true;
      return matchesStart && matchesEnd;
    });

    res.json(filtered);
  } catch (e) {
    console.error("❌ matchRides Error:", e);
    res.status(500).json({ message: "Geo Match failed", error: e.message });
  }
};

// =========================================================
// ✅ Driver marks ride as completed
// =========================================================
export const completeRide = async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.rideId)
      .populate("driver", "name")
      .populate("passengers", "name");

    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (ride.driver._id.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Access denied — not your ride" });

    if (ride.status === "Completed")
      return res.status(400).json({ message: "Ride already completed" });

    ride.status = "Completed";
    await ride.save();

    const io = req.app.get("io");
    if (io)
      io.emit("ride:completed", {
        rideId: ride._id,
        driver: ride.driver.name,
        passengers: ride.passengers.map((p) => p.name),
      });

    res.status(200).json({
      success: true,
      message: "Ride marked as completed",
      ride,
    });
  } catch (err) {
    console.error("❌ completeRide Error:", err);
    res.status(500).json({ message: "Failed to complete ride" });
  }
};

// =========================================================
// ✅ Driver: Get all rides they created
// =========================================================
export const getMyRides = async (req, res) => {
  try {
    const rides = await Ride.find({ driver: req.user._id })
      .populate("passengers", "name email")
      .populate("requests", "name email")
      .sort({ createdAt: -1 });
    res.json(rides);
  } catch (err) {
    console.error("❌ Error fetching my rides:", err);
    res.status(500).json({ message: "Server error fetching driver rides" });
  }
};

// =========================================================
// ✅ Driver: Accept a ride request
// =========================================================
export const acceptRequest = async (req, res) => {
  try {
    const { rideId, riderId } = req.params;

    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (ride.driver.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Access denied" });

    if (ride.passengers.length >= ride.capacity)
      return res.status(400).json({ message: "Ride is already full" });

    if (!ride.passengers.includes(riderId)) {
      ride.passengers.push(riderId);
      ride.requests = ride.requests.filter((r) => r.toString() !== riderId.toString());
    }

    ride.co2SavedKg = calcCO2SavedKg(ride.distanceKm, ride.passengers.length + 1);
    if (ride.passengers.length >= ride.capacity) ride.status = "Full";

    await ride.save();

    const io = req.app.get("io");
    if (io)
      io.emit("ride:accepted", { riderId, rideId, driver: req.user.name });

    res.status(200).json({ success: true, message: "Rider accepted successfully", ride });
  } catch (err) {
    console.error("❌ Accept Request Error:", err);
    res.status(500).json({ message: "Server error while accepting request" });
  }
};

// =========================================================
// ✅ Driver: Reject a ride request
// =========================================================
export const rejectRequest = async (req, res) => {
  try {
    const { rideId, riderId } = req.params;

    const ride = await Ride.findById(rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (ride.driver.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Access denied" });

    if (!ride.requests.includes(riderId))
      return res.status(400).json({ message: "Rider did not request this ride" });

    ride.requests = ride.requests.filter((r) => r.toString() !== riderId.toString());
    await ride.save();

    const updatedRide = await Ride.findById(rideId)
      .populate("driver", "name")
      .populate("passengers", "name")
      .populate("requests", "name");

    const io = req.app.get("io");
    if (io)
      io.emit("ride:rejected", {
        rideId: ride._id,
        riderId,
        driver: req.user.name,
      });

    res.status(200).json({
      success: true,
      message: "Rider rejected successfully",
      ride: updatedRide,
    });
  } catch (err) {
    console.error("❌ Reject Request Error:", err);
    res.status(500).json({ message: "Server error while rejecting request" });
  }
};

// =========================================================
// ✅ Rider: Get all rides they've joined
// =========================================================
export const getJoinedRides = async (req, res) => {
  try {
    const rides = await Ride.find({ passengers: req.user._id })
      .populate("driver", "name email")
      .populate("passengers", "name email")
      .select("start end distanceKm co2SavedKg status driver passengers");

    res.status(200).json(rides);
  } catch (err) {
    console.error("❌ getJoinedRides Error:", err);
    res.status(500).json({ message: "Failed to fetch joined rides" });
  }
};
