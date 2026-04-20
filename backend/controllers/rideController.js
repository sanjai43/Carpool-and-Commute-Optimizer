import { rideRepo, populateRide, userRepo, reportRepo } from "../storage/store.js";
import { moderateText } from "../services/aiService.js";
import { salesforceEnabled } from "../services/salesforceClient.js";
import { sfRideRepo } from "../repos/sfRideRepo.js";
import { sfRideRequestRepo } from "../repos/sfRideRequestRepo.js";
import { sfMessageRepo } from "../repos/sfMessageRepo.js";
import { sfIncidentRepo } from "../repos/sfIncidentRepo.js";
import { calcCO2SavedKg } from "../storage/store.js";
import { sfUserRepo } from "../repos/sfUserRepo.js";
import { sfEventRepo } from "../repos/sfEventRepo.js";

const parseCoordinate = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildPoint = (lng, lat) => ({
  type: "Point",
  coordinates: [lng ?? 0, lat ?? 0],
});

const hasPoint = (point) => {
  const lng = point?.coordinates?.[0];
  const lat = point?.coordinates?.[1];
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  // Treat (0,0) as "missing" in this demo app
  if (lng === 0 && lat === 0) return false;
  return true;
};

const haversineKm = (aLat, aLng, bLat, bLng) => {
  if (
    !Number.isFinite(aLat) ||
    !Number.isFinite(aLng) ||
    !Number.isFinite(bLat) ||
    !Number.isFinite(bLng)
  ) {
    return Number.POSITIVE_INFINITY;
  }
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
};

const buildApiRideFromSf = async (sfRide, { withPassengers = false, withRequests = false } = {}) => {
  const api = sfRideRepo.toApiRide(sfRide);
  if (!withPassengers && !withRequests) return api;
  const reqs = await sfRideRequestRepo.listForRide(sfRide.Id);

  const requests = [];
  const passengers = [];
  for (const r of reqs) {
    const rider = r.Rider__r;
    if (!rider) continue;
    const base = {
      _id: r.Rider__c,
      id: r.Rider__c,
      name: rider.Name,
      email: rider.Email__c,
    };
    if (r.Status__c === "Accepted") passengers.push(base);
    if (r.Status__c === "Requested" || r.Status__c === "Waitlisted") {
      requests.push({
        ...base,
        status: r.Status__c,
        pickup:
          r.PickupLat__c !== null && r.PickupLng__c !== null
            ? { lat: Number(r.PickupLat__c), lng: Number(r.PickupLng__c), label: r.PickupLabel__c || "" }
            : r.PickupLabel__c
            ? { lat: null, lng: null, label: r.PickupLabel__c }
            : null,
        drop:
          r.DropLat__c !== null && r.DropLng__c !== null
            ? { lat: Number(r.DropLat__c), lng: Number(r.DropLng__c), label: r.DropLabel__c || "" }
            : r.DropLabel__c
            ? { lat: null, lng: null, label: r.DropLabel__c }
            : null,
        createdAt: r.CreatedDate,
      });
    }
  }

  if (withPassengers) api.passengers = passengers;
  if (withRequests) api.requests = requests;

  // Co2 (derived) – extra passengers only
  api.co2SavedKg = calcCO2SavedKg({
    distanceKm: api.distanceKm,
    passengerCount: passengers.length + 1,
    vehicleType: api.vehicleType,
  });

  return api;
};

const promoteWaitlistSf = async ({ rideId, driverId, io }) => {
  const ride = await sfRideRepo.findById(rideId);
  if (!ride) return null;
  const allReq = await sfRideRequestRepo.listForRide(rideId);
  const accepted = allReq.filter((r) => r.Status__c === "Accepted").length;
  const cap = Number(ride.Capacity__c || 3);
  if (accepted >= cap) return null;

  const oldest = await sfRideRequestRepo.findOldestWaitlisted(rideId);
  if (!oldest?.Id) return null;
  await sfRideRequestRepo.setStatusById({ id: oldest.Id, status: "Requested" });

  if (io) {
    io.emit("ride:waitlistPromoted", { rideId, riderId: oldest.Rider__c });
    io.to(String(oldest.Rider__c)).emit("user:dataChanged", { kinds: ["eco"], rideId });
    io.to(String(driverId)).emit("user:dataChanged", { kinds: ["eco"], rideId });
  }
  await sfEventRepo
    .log({ type: "Request", actorId: driverId, rideId, payload: { action: "waitlist_promoted", riderId: oldest.Rider__c } })
    .catch(() => {});
  return oldest.Rider__c;
};

const recomputeRideStatusAndCo2 = async (sfRide) => {
  const reqs = await sfRideRequestRepo.listForRide(sfRide.Id);
  const accepted = reqs.filter((r) => r.Status__c === "Accepted").length;
  const cap = Number(sfRide.Capacity__c || 3);
  const status = accepted >= cap ? "Full" : "Open";
  const co2 = calcCO2SavedKg({
    distanceKm: Number(sfRide.DistanceKm__c || 0),
    passengerCount: accepted + 1,
    vehicleType: sfRide.VehicleType__c || "PetrolCar",
  });
  await sfRideRepo.updateStatus(sfRide.Id, status, { CO2SavedKg__c: co2 });
};

// =========================================================
// ✅ Create a new ride (Driver)
// =========================================================
	export const createRide = async (req, res) => {
	  try {
	    const {
	      start,
	      end,
	      distanceKm,
	      startLat,
	      startLng,
	      endLat,
	      endLng,
	      capacity,
	      departureTime,
	      vehicleType,
	    } = req.body;

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

	    let populatedRide;
	    if (salesforceEnabled()) {
	      const ride = await sfRideRepo.createRide({
	        driverId: req.user._id,
	        start,
	        end,
	        distanceKm: safeDistance,
	        capacity: rideCapacity,
	        startLat: parsedStartLat,
	        startLng: parsedStartLng,
	        endLat: parsedEndLat,
	        endLng: parsedEndLng,
	        departureTime: departureTime || null,
	        vehicleType: vehicleType || "PetrolCar",
	      });
	      populatedRide = sfRideRepo.toApiRide(ride);
	      await sfEventRepo
	        .log({ type: "Ride", actorId: req.user._id, rideId: ride?.Id, payload: { action: "create_ride" } })
	        .catch(() => {});
	    } else {
	      const ride = await rideRepo.create({
	        driverId: req.user._id,
	        start,
	        end,
	        distanceKm: safeDistance,
	        capacity: rideCapacity,
	        startLocation: buildPoint(parsedStartLng, parsedStartLat),
	        endLocation: buildPoint(parsedEndLng, parsedEndLat),
	        departureTime: departureTime || null,
	        vehicleType: vehicleType || "PetrolCar",
	      });
	      populatedRide = populateRide(ride);
	    }

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
    if (salesforceEnabled()) {
      const rides = await sfRideRepo.listAll(200);
      res.json(rides.map((r) => sfRideRepo.toApiRide(r)));
    } else {
      const rides = await rideRepo.listAll();
      res.json(rides.map((r) => populateRide(r)));
    }
  } catch (e) {
    res.status(500).json({ message: "Get rides failed", error: e.message });
  }
};

// =========================================================
// ✅ Rider requests to join a ride
// =========================================================
export const joinRide = async (req, res) => {
  try {
    if (salesforceEnabled()) {
      const ride = await sfRideRepo.findById(req.params.rideId);
      if (!ride) return res.status(404).json({ message: "Ride not found" });

      const userId = req.user._id.toString();
      const { pickup, drop, promoCode } = req.body || {};

      if (ride.Driver__c === userId)
        return res.status(400).json({ message: "Drivers cannot join their own ride" });

      const existing = await sfRideRequestRepo.findExisting({ rideId: ride.Id, riderId: userId });
      if (existing?.Status__c === "Accepted")
        return res.status(400).json({ message: "Already joined this ride" });
      if (existing?.Status__c === "Requested")
        return res.status(400).json({ message: "Already requested this ride" });

      if (["Full", "Completed", "Cancelled"].includes(ride.Status__c))
        return res.status(400).json({ message: `Cannot join a ${ride.Status__c} ride` });

      // Capacity check: count accepted
      const allReq = await sfRideRequestRepo.listForRide(ride.Id);
      const accepted = allReq.filter((r) => r.Status__c === "Accepted").length;
      const cap = Number(ride.Capacity__c || 3);
      const isFull = accepted >= cap;

      let promoId = null;
      if (promoCode) {
        const { sfPromoRepo } = await import("../repos/sfPromoRepo.js");
        const p = await sfPromoRepo.findActiveByCode(promoCode);
        if (!p) return res.status(400).json({ message: "Invalid promo code" });

        const now = Date.now();
        const exp = p.ExpiresAt__c ? Date.parse(p.ExpiresAt__c) : NaN;
        if (Number.isFinite(exp) && exp <= now) return res.status(400).json({ message: "Promo code expired" });
        if (!p.Active__c) return res.status(400).json({ message: "Promo code inactive" });
        const maxUses = Number(p.MaxUses__c || 0);
        const used = Number(p.UsedCount__c || 0);
        if (maxUses !== 0 && used >= maxUses) return res.status(400).json({ message: "Promo code fully used" });
        if (p.EligibleRole__c && p.EligibleRole__c !== "Any" && p.EligibleRole__c !== "Rider")
          return res.status(400).json({ message: "Promo code not valid for riders" });
        if (p.Rider__c && p.Rider__c !== userId) return res.status(400).json({ message: "Promo code not assigned to you" });
        promoId = p.Id;
      }

      if (isFull) {
        await sfRideRequestRepo.createWaitlisted({ rideId: ride.Id, riderId: userId, pickup, drop, promoId });
        await sfEventRepo
          .log({ type: "Request", actorId: userId, rideId: ride.Id, payload: { action: "waitlist_join" } })
          .catch(() => {});
      } else {
        await sfRideRequestRepo.create({ rideId: ride.Id, riderId: userId, pickup, drop, promoId });
        await sfEventRepo
          .log({ type: "Request", actorId: userId, rideId: ride.Id, payload: { action: "request_join" } })
          .catch(() => {});
      }

      const populatedRide = sfRideRepo.toApiRide(ride);

      const io = req.app.get("io");
      if (io) {
        io.emit("ride:join", { rideId: ride.Id, riderName: req.user.name, riderId: req.user._id });
        io.emit("ride:joined", { rideId: ride.Id, riderName: req.user.name, riderId: req.user._id });
      }

      return res.status(200).json({
        success: true,
        message: isFull ? "Ride is full — you were added to the waitlist" : "Join request sent successfully",
        ride: populatedRide,
      });
    }

    const ride = await rideRepo.findById(req.params.rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    const userId = req.user._id.toString();
    const { pickup, drop } = req.body || {};

    if (ride.driver.toString() === userId)
      return res.status(400).json({ message: "Drivers cannot join their own ride" });

    if (ride.passengers.some((p) => p.toString() === userId))
      return res.status(400).json({ message: "Already joined this ride" });

    if (ride.requests.some((r) => r.riderId?.toString?.() === userId))
      return res.status(400).json({ message: "Already requested this ride" });
    if (ride.waitlist?.some?.((r) => r.riderId?.toString?.() === userId))
      return res.status(400).json({ message: "Already waitlisted for this ride" });

    if (["Full", "Completed", "Cancelled"].includes(ride.status))
      return res.status(400).json({ message: `Cannot join a ${ride.status} ride` });

    if (ride.passengers.length >= ride.capacity) {
      ride.waitlist = [...(ride.waitlist || []), { riderId: req.user._id, pickup: pickup || null, drop: drop || null, createdAt: new Date().toISOString() }];
      await rideRepo.save(ride);
      return res.status(200).json({ success: true, message: "Ride is full — you were added to the waitlist", ride: populateRide(ride, { withRequests: true }) });
    }

    ride.requests.push({
      riderId: req.user._id,
      pickup: pickup || null,
      drop: drop || null,
      createdAt: new Date().toISOString(),
    });
    await rideRepo.save(ride);

    const populatedRide = populateRide(ride, { withRequests: true });

    const io = req.app.get("io");
    if (io) {
      io.emit("ride:join", { rideId: ride._id, riderName: req.user.name, riderId: req.user._id });
      io.emit("ride:joined", { rideId: ride._id, riderName: req.user.name, riderId: req.user._id });
    }

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
    const {
      startLat,
      startLng,
      endLat,
      endLng,
      start,
      end,
      radiusKm,
      departTime,
      windowMin,
      maxDetourKm,
      maxDetourMin,
    } = req.body;
    const parsedStartLat = parseCoordinate(startLat);
    const parsedStartLng = parseCoordinate(startLng);
    const parsedEndLat = parseCoordinate(endLat);
    const parsedEndLng = parseCoordinate(endLng);

    const openRides = salesforceEnabled()
      ? (await sfRideRepo.listOpen(200)).map((r) => sfRideRepo.toApiRide(r))
      : (await rideRepo.listOpen(50)).map((r) => populateRide(r));

    const normalizedStart = start?.trim().toLowerCase();
    const normalizedEnd = end?.trim().toLowerCase();

    const hasStart = parsedStartLat !== null && parsedStartLng !== null;
    const hasEnd = parsedEndLat !== null && parsedEndLng !== null;
    const requestedRadius = Number(radiusKm);
    const safeRadiusKm =
      Number.isFinite(requestedRadius) && requestedRadius > 0
        ? Math.min(100, requestedRadius)
        : 25;

    const depart = departTime ? Date.parse(departTime) : NaN;
    const safeWindowMinRaw = Number(windowMin);
    const safeWindowMin =
      Number.isFinite(safeWindowMinRaw) && safeWindowMinRaw >= 0
        ? Math.min(240, safeWindowMinRaw)
        : 30;

    const maxDetourKmRaw = Number(maxDetourKm);
    const safeMaxDetourKm =
      Number.isFinite(maxDetourKmRaw) && maxDetourKmRaw >= 0
        ? Math.min(200, maxDetourKmRaw)
        : null;
    const maxDetourMinRaw = Number(maxDetourMin);
    const safeMaxDetourMin =
      Number.isFinite(maxDetourMinRaw) && maxDetourMinRaw >= 0
        ? Math.min(600, maxDetourMinRaw)
        : null;

    const filtered = openRides.filter((ride) => {
      if (Number.isFinite(depart) && ride.departureTime) {
        const t = Date.parse(ride.departureTime);
        if (Number.isFinite(t)) {
          const diffMin = Math.abs(t - depart) / 60000;
          if (diffMin > safeWindowMin) return false;
        }
      }

      // Geo match: if rider provided a start and/or end point, match by distance.
      if (hasStart && hasPoint(ride.startLocation)) {
        const rideLng = ride.startLocation.coordinates[0];
        const rideLat = ride.startLocation.coordinates[1];
        const d = haversineKm(parsedStartLat, parsedStartLng, rideLat, rideLng);
        if (d > safeRadiusKm) return false;
      } else if (hasStart) {
        // Rider asked for geo match but ride has no geo data
        return false;
      }

      if (hasEnd && hasPoint(ride.endLocation)) {
        const rideLng = ride.endLocation.coordinates[0];
        const rideLat = ride.endLocation.coordinates[1];
        const d = haversineKm(parsedEndLat, parsedEndLng, rideLat, rideLng);
        if (d > safeRadiusKm) return false;
      } else if (hasEnd) {
        return false;
      }

      // Optional detour filter (requires geo)
      if ((safeMaxDetourKm !== null || safeMaxDetourMin !== null) && (hasStart || hasEnd)) {
        let extraKm = 0;
        if (hasStart && hasPoint(ride.startLocation)) {
          const rideLng = ride.startLocation.coordinates[0];
          const rideLat = ride.startLocation.coordinates[1];
          extraKm += haversineKm(parsedStartLat, parsedStartLng, rideLat, rideLng);
        }
        if (hasEnd && hasPoint(ride.endLocation)) {
          const rideLng = ride.endLocation.coordinates[0];
          const rideLat = ride.endLocation.coordinates[1];
          extraKm += haversineKm(parsedEndLat, parsedEndLng, rideLat, rideLng);
        }

        if (safeMaxDetourKm !== null && extraKm > safeMaxDetourKm) return false;
        if (safeMaxDetourMin !== null) {
          // Rough conversion: 40km/h average.
          const extraMin = (extraKm / 40) * 60;
          if (extraMin > safeMaxDetourMin) return false;
        }
      }

      // Text match fallback (still applies when geo is absent)
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
    if (salesforceEnabled()) {
      const ride = await sfRideRepo.findById(req.params.rideId);
      if (!ride) return res.status(404).json({ message: "Ride not found" });
      if (ride.Driver__c !== req.user._id) return res.status(403).json({ message: "Access denied — not your ride" });
      if (ride.Status__c === "Completed") return res.status(400).json({ message: "Ride already completed" });

      const updated = await sfRideRepo.updateStatus(ride.Id, "Completed");
      const apiRide = await buildApiRideFromSf(updated, { withPassengers: true });
      await sfEventRepo
        .log({ type: "Ride", actorId: req.user._id, rideId: ride.Id, payload: { action: "complete" } })
        .catch(() => {});
      const io = req.app.get("io");
      if (io) {
        io.emit("ride:completed", {
          rideId: ride.Id,
          driver: apiRide.driver?.name,
          passengers: (apiRide.passengers || []).map((p) => p.name),
        });
        const passengerIds = (apiRide.passengers || [])
          .map((p) => p?.id || p?._id)
          .filter(Boolean)
          .map(String);
        const driverId = String(apiRide.driver?.id || apiRide.driver?._id || ride.Driver__c);
        io.to(driverId).emit("user:dataChanged", { kinds: ["eco", "earnings"], rideId: ride.Id });
        for (const pid of passengerIds) {
          io.to(pid).emit("user:dataChanged", { kinds: ["eco", "promos"], rideId: ride.Id });
        }
      }
      return res.status(200).json({ success: true, message: "Ride marked as completed", ride: apiRide });
    }

    const ride = await rideRepo.findById(req.params.rideId);

    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (ride.driver.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Access denied — not your ride" });

    if (ride.status === "Completed")
      return res.status(400).json({ message: "Ride already completed" });

    ride.status = "Completed";
    await rideRepo.save(ride);

    const io = req.app.get("io");
    if (io) {
      const populated = populateRide(ride, { withPassengers: true });
      io.emit("ride:completed", {
        rideId: ride._id,
        driver: populated.driver?.name,
        passengers: (populated.passengers || []).map((p) => p.name),
      });
      const driverId = String(populated.driver?._id || populated.driver?.id || ride.driver);
      io.to(driverId).emit("user:dataChanged", { kinds: ["eco", "earnings"], rideId: String(ride._id) });
      for (const pid of ride.passengers || []) {
        io.to(String(pid)).emit("user:dataChanged", { kinds: ["eco", "promos"], rideId: String(ride._id) });
      }
    }

    res.status(200).json({
      success: true,
      message: "Ride marked as completed",
      ride: populateRide(ride, { withPassengers: true }),
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
    if (salesforceEnabled()) {
      const rides = await sfRideRepo.listByDriver(req.user._id, 200);
      const out = [];
      for (const r of rides) {
        out.push(await buildApiRideFromSf(r, { withPassengers: true, withRequests: true }));
      }
      return res.json(out);
    }
    const rides = await rideRepo.listByDriver(req.user._id);
    res.json(rides.map((r) => populateRide(r, { withPassengers: true, withRequests: true })));
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

    if (salesforceEnabled()) {
      const ride = await sfRideRepo.findById(rideId);
      if (!ride) return res.status(404).json({ message: "Ride not found" });
      if (ride.Driver__c !== req.user._id) return res.status(403).json({ message: "Access denied" });
      if (["Completed", "Cancelled"].includes(ride.Status__c)) return res.status(400).json({ message: `Cannot accept on ${ride.Status__c} ride` });

      const updatedReqId = await sfRideRequestRepo.setStatusByRideAndRider({ rideId, riderId, status: "Accepted" });
      if (!updatedReqId) return res.status(400).json({ message: "Rider did not request this ride" });

      await recomputeRideStatusAndCo2(ride);
      await sfEventRepo
        .log({ type: "Request", actorId: req.user._id, rideId, payload: { action: "accept", riderId } })
        .catch(() => {});

      const io = req.app.get("io");
      if (io) {
        io.emit("ride:accepted", { riderId, rideId, driver: req.user.name });
        io.to(String(riderId)).emit("user:dataChanged", { kinds: ["eco"], rideId });
        io.to(String(ride.Driver__c)).emit("user:dataChanged", { kinds: ["eco"], rideId });
      }

      const apiRide = await buildApiRideFromSf(ride, { withPassengers: true, withRequests: true });
      return res.status(200).json({ success: true, message: "Rider accepted successfully", ride: apiRide });
    }

    const ride = await rideRepo.findById(rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (ride.driver.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Access denied" });

    if (ride.passengers.length >= ride.capacity)
      return res.status(400).json({ message: "Ride is already full" });

    const alreadyPassenger = ride.passengers.some((p) => p.toString() === riderId.toString());
    if (alreadyPassenger) {
      return res
        .status(200)
        .json({ success: true, message: "Rider already accepted", ride });
    }

    const hasRequested = ride.requests.some((r) => r.riderId?.toString?.() === riderId.toString());
    const hasWaitlisted = (ride.waitlist || []).some((r) => r.riderId?.toString?.() === riderId.toString());
    if (!hasRequested && !hasWaitlisted) return res.status(400).json({ message: "Rider did not request this ride" });

    ride.passengers.push(riderId);
    ride.requests = ride.requests.filter((r) => r.riderId?.toString?.() !== riderId.toString());
    ride.waitlist = (ride.waitlist || []).filter((r) => r.riderId?.toString?.() !== riderId.toString());

    await rideRepo.save(ride);

    const io = req.app.get("io");
    if (io) {
      io.emit("ride:accepted", { riderId, rideId, driver: req.user.name });
      io.to(String(riderId)).emit("user:dataChanged", { kinds: ["eco"], rideId });
      io.to(String(req.user._id)).emit("user:dataChanged", { kinds: ["eco"], rideId });
    }

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

    if (salesforceEnabled()) {
      const ride = await sfRideRepo.findById(rideId);
      if (!ride) return res.status(404).json({ message: "Ride not found" });
      if (ride.Driver__c !== req.user._id) return res.status(403).json({ message: "Access denied" });

      const updatedReqId = await sfRideRequestRepo.setStatusByRideAndRider({ rideId, riderId, status: "Rejected" });
      if (!updatedReqId) return res.status(400).json({ message: "Rider did not request this ride" });
      await sfEventRepo
        .log({ type: "Request", actorId: req.user._id, rideId, payload: { action: "reject", riderId } })
        .catch(() => {});

      const io = req.app.get("io");
      if (io)
        io.emit("ride:rejected", {
          rideId,
          riderId,
          driver: req.user.name,
        });

      const apiRide = await buildApiRideFromSf(ride, { withPassengers: true, withRequests: true });
      return res.status(200).json({ success: true, message: "Rider rejected successfully", ride: apiRide });
    }

    const ride = await rideRepo.findById(rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (ride.driver.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Access denied" });

    if (!ride.requests.some((r) => r.riderId?.toString?.() === riderId.toString()))
      if (!(ride.waitlist || []).some((r) => r.riderId?.toString?.() === riderId.toString()))
        return res.status(400).json({ message: "Rider did not request this ride" });

    ride.requests = ride.requests.filter((r) => r.riderId?.toString?.() !== riderId.toString());
    ride.waitlist = (ride.waitlist || []).filter((r) => r.riderId?.toString?.() !== riderId.toString());
    await rideRepo.save(ride);

    const updatedRide = populateRide(ride, { withPassengers: true, withRequests: true });

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
    if (salesforceEnabled()) {
      const rideIds = await sfRideRequestRepo.listAcceptedRidesForRider(req.user._id);
      const rides = [];
      for (const id of rideIds) {
        const r = await sfRideRepo.findById(id);
        if (r) rides.push(await buildApiRideFromSf(r, { withPassengers: true }));
      }
      return res.status(200).json(rides);
    }
    const rides = await rideRepo.listJoinedByPassenger(req.user._id);
    res.status(200).json(
      rides.map((r) =>
        populateRide(r, { withPassengers: true })
      )
    );
  } catch (err) {
    console.error("❌ getJoinedRides Error:", err);
    res.status(500).json({ message: "Failed to fetch joined rides" });
  }
};

// =========================================================
// ✅ Driver: Cancel a ride
// =========================================================
export const cancelRide = async (req, res) => {
  try {
    if (salesforceEnabled()) {
      const ride = await sfRideRepo.findById(req.params.rideId);
      if (!ride) return res.status(404).json({ message: "Ride not found" });
      if (ride.Driver__c !== req.user._id) return res.status(403).json({ message: "Access denied — not your ride" });
      if (["Completed", "Cancelled"].includes(ride.Status__c)) return res.status(400).json({ message: `Cannot cancel a ${ride.Status__c} ride` });
      const { reason } = req.body || {};
      await sfRideRepo.updateStatus(ride.Id, "Cancelled", { CancelReason__c: reason || "Cancelled by driver" });
      const io = req.app.get("io");
      if (io) io.emit("ride:cancelled", { rideId: ride.Id, reason: reason || "Cancelled by driver" });
      const updated = await sfRideRepo.findById(ride.Id);
      return res.json({ success: true, ride: await buildApiRideFromSf(updated, { withPassengers: true, withRequests: true }) });
    }

    const ride = await rideRepo.findById(req.params.rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    if (ride.driver.toString() !== req.user._id.toString())
      return res.status(403).json({ message: "Access denied — not your ride" });

    if (["Completed", "Cancelled"].includes(ride.status))
      return res.status(400).json({ message: `Cannot cancel a ${ride.status} ride` });

    const { reason } = req.body || {};
    ride.status = "Cancelled";
    ride.cancelReason = reason || "Cancelled by driver";
    ride.cancelledBy = req.user._id;
    await rideRepo.save(ride);

    const io = req.app.get("io");
    if (io) io.emit("ride:cancelled", { rideId: ride._id, reason: ride.cancelReason });

    return res.json({ success: true, ride: populateRide(ride, { withPassengers: true, withRequests: true }) });
  } catch (e) {
    console.error("❌ cancelRide Error:", e);
    return res.status(500).json({ message: "Failed to cancel ride" });
  }
};

// =========================================================
// ✅ Rider: Leave ride (or withdraw request)
// =========================================================
export const leaveRide = async (req, res) => {
  try {
    if (salesforceEnabled()) {
      const ride = await sfRideRepo.findById(req.params.rideId);
      if (!ride) return res.status(404).json({ message: "Ride not found" });
      const riderId = req.user._id.toString();
      await sfRideRequestRepo.withdraw({ rideId: ride.Id, riderId });
      await recomputeRideStatusAndCo2(ride);
      const io = req.app.get("io");
      if (io) {
        io.emit("ride:left", { rideId: ride.Id, riderId });
        io.to(String(riderId)).emit("user:dataChanged", { kinds: ["eco"], rideId: ride.Id });
        io.to(String(ride.Driver__c)).emit("user:dataChanged", { kinds: ["eco"], rideId: ride.Id });
      }
      await sfEventRepo
        .log({ type: "Request", actorId: riderId, rideId: ride.Id, payload: { action: "withdraw" } })
        .catch(() => {});

      // If a seat frees up, promote the oldest waitlist entry.
      await promoteWaitlistSf({ rideId: ride.Id, driverId: ride.Driver__c, io });
      const updated = await sfRideRepo.findById(ride.Id);
      return res.json({ success: true, ride: await buildApiRideFromSf(updated, { withPassengers: true, withRequests: true }) });
    }

    const ride = await rideRepo.findById(req.params.rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    const riderId = req.user._id.toString();
    ride.passengers = ride.passengers.filter((p) => p.toString() !== riderId);
    ride.requests = ride.requests.filter((r) => r.riderId?.toString?.() !== riderId);
    ride.waitlist = (ride.waitlist || []).filter((r) => r.riderId?.toString?.() !== riderId);
    await rideRepo.save(ride);

    // Auto-promote from waitlist if a seat is now available
    if (ride.passengers.length < ride.capacity && (ride.waitlist || []).length > 0) {
      const next = [...ride.waitlist].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))[0];
      if (next?.riderId) {
        ride.waitlist = (ride.waitlist || []).filter((x) => x.riderId?.toString?.() !== String(next.riderId));
        ride.requests.push({
          riderId: next.riderId,
          pickup: next.pickup || null,
          drop: next.drop || null,
          createdAt: new Date().toISOString(),
        });
        await rideRepo.save(ride);
        const io = req.app.get("io");
        if (io) io.emit("ride:waitlistPromoted", { rideId: ride._id, riderId: String(next.riderId) });
      }
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("ride:left", { rideId: ride._id, riderId });
      io.to(String(riderId)).emit("user:dataChanged", { kinds: ["eco"], rideId: String(ride._id) });
      io.to(String(ride.driver)).emit("user:dataChanged", { kinds: ["eco"], rideId: String(ride._id) });
    }

    return res.json({ success: true, ride: populateRide(ride, { withPassengers: true, withRequests: true }) });
  } catch (e) {
    console.error("❌ leaveRide Error:", e);
    return res.status(500).json({ message: "Failed to leave ride" });
  }
};

// =========================================================
// 💬 Ride messages (chat)
// =========================================================
export const getRideMessages = async (req, res) => {
  try {
    if (salesforceEnabled()) {
      const ride = await sfRideRepo.findById(req.params.rideId);
      if (!ride) return res.status(404).json({ message: "Ride not found" });

      const userId = req.user._id.toString();
      const isDriver = ride.Driver__c === userId;
      const existing = await sfRideRequestRepo.findExisting({ rideId: ride.Id, riderId: userId });
      const isPassenger = existing?.Status__c === "Accepted";
      const isRequester = existing?.Status__c === "Requested" || existing?.Status__c === "Waitlisted";
      if (!isDriver && !isPassenger && !isRequester) return res.status(403).json({ message: "Access denied" });

      const messages = await sfMessageRepo.listForRide(ride.Id);
      return res.json({ messages: sfMessageRepo.toApiMessages(messages) });
    }

    const ride = await rideRepo.findById(req.params.rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    const userId = req.user._id.toString();
    const isDriver = ride.driver.toString() === userId;
    const isPassenger = ride.passengers.some((p) => p.toString() === userId);
    const isRequester = ride.requests.some((r) => r.riderId?.toString?.() === userId);
    if (!isDriver && !isPassenger && !isRequester)
      return res.status(403).json({ message: "Access denied" });

    return res.json({ messages: ride.messages || [] });
  } catch (e) {
    console.error("❌ getRideMessages Error:", e);
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
};

export const postRideMessage = async (req, res) => {
  try {
    if (salesforceEnabled()) {
      const ride = await sfRideRepo.findById(req.params.rideId);
      if (!ride) return res.status(404).json({ message: "Ride not found" });
      const userId = req.user._id.toString();
      const isDriver = ride.Driver__c === userId;
      const existing = await sfRideRequestRepo.findExisting({ rideId: ride.Id, riderId: userId });
      const isPassenger = existing?.Status__c === "Accepted";
      const isRequester = existing?.Status__c === "Requested" || existing?.Status__c === "Waitlisted";
      if (!isDriver && !isPassenger && !isRequester) return res.status(403).json({ message: "Access denied" });

      const { text } = req.body || {};
      const trimmed = String(text || "").trim();
      if (!trimmed) return res.status(400).json({ message: "Message text is required" });
      const mod = moderateText({ text: trimmed });
      if (mod.severe) return res.status(400).json({ message: "Message blocked by safety filter" });

      const id = await sfMessageRepo.create({
        rideId: ride.Id,
        authorId: userId,
        text: trimmed,
        flagged: Boolean(mod.flagged),
        flags: mod.categories || [],
      });
      const message = {
        _id: id,
        userId,
        userName: req.user.name,
        text: trimmed.slice(0, 500),
        flagged: Boolean(mod.flagged),
        flags: mod.categories || [],
        createdAt: new Date().toISOString(),
      };
      const io = req.app.get("io");
      if (io) io.emit("ride:message", { rideId: ride.Id, message });
      await sfEventRepo
        .log({ type: "Ride", actorId: userId, rideId: ride.Id, payload: { action: "message" } })
        .catch(() => {});
      return res.status(201).json({ success: true, message });
    }

    const ride = await rideRepo.findById(req.params.rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    const userId = req.user._id.toString();
    const isDriver = ride.driver.toString() === userId;
    const isPassenger = ride.passengers.some((p) => p.toString() === userId);
    const isRequester = ride.requests.some((r) => r.riderId?.toString?.() === userId);
    if (!isDriver && !isPassenger && !isRequester)
      return res.status(403).json({ message: "Access denied" });

    const { text } = req.body || {};
    const trimmed = String(text || "").trim();
    if (!trimmed) return res.status(400).json({ message: "Message text is required" });

    const mod = moderateText({ text: trimmed });
    if (mod.severe) {
      return res.status(400).json({ message: "Message blocked by safety filter" });
    }

    const message = {
      _id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      userId,
      userName: req.user.name,
      text: trimmed.slice(0, 500),
      flagged: Boolean(mod.flagged),
      flags: mod.categories || [],
      createdAt: new Date().toISOString(),
    };
    ride.messages = [...(ride.messages || []), message];
    await rideRepo.save(ride);

    const io = req.app.get("io");
    if (io) io.emit("ride:message", { rideId: ride._id, message });

    return res.status(201).json({ success: true, message });
  } catch (e) {
    console.error("❌ postRideMessage Error:", e);
    return res.status(500).json({ message: "Failed to post message" });
  }
};

// =========================================================
// ⭐ Rider: Rate driver after completion
// =========================================================
export const rateDriver = async (req, res) => {
  try {
    if (salesforceEnabled()) {
      const ride = await sfRideRepo.findById(req.params.rideId);
      if (!ride) return res.status(404).json({ message: "Ride not found" });
      if (ride.Status__c !== "Completed") return res.status(400).json({ message: "Ride not completed" });
      const riderId = req.user._id.toString();
      const existing = await sfRideRequestRepo.findExisting({ rideId: ride.Id, riderId });
      if (existing?.Status__c !== "Accepted") return res.status(403).json({ message: "Only passengers can rate" });
      const stars = Number(req.body?.stars);
      if (!Number.isFinite(stars) || stars < 1 || stars > 5) return res.status(400).json({ message: "Stars must be 1-5" });
      await sfUserRepo.addRating({ userId: ride.Driver__c, stars });
      return res.json({ success: true });
    }

    const ride = await rideRepo.findById(req.params.rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (ride.status !== "Completed") return res.status(400).json({ message: "Ride not completed" });

    const riderId = req.user._id.toString();
    const wasPassenger = ride.passengers.some((p) => p.toString() === riderId);
    if (!wasPassenger) return res.status(403).json({ message: "Only passengers can rate" });

    const stars = Number(req.body?.stars);
    if (!Number.isFinite(stars) || stars < 1 || stars > 5)
      return res.status(400).json({ message: "Stars must be 1-5" });

    await userRepo.addRating({ userId: ride.driver, stars });
    return res.json({ success: true });
  } catch (e) {
    console.error("❌ rateDriver Error:", e);
    return res.status(500).json({ message: "Failed to rate driver" });
  }
};

// =========================================================
// 🚩 Report driver/rider
// =========================================================
export const reportRideUser = async (req, res) => {
  try {
    if (salesforceEnabled()) {
      const ride = await sfRideRepo.findById(req.params.rideId);
      if (!ride) return res.status(404).json({ message: "Ride not found" });
      const { reportedUserId, reason } = req.body || {};
      if (!reportedUserId || !reason) return res.status(400).json({ message: "reportedUserId and reason are required" });
      const mod = moderateText({ text: reason });
      if (mod.severe) return res.status(400).json({ message: "Report reason blocked by safety filter" });
      const incidentId = await sfIncidentRepo.createReport({
        rideId: ride.Id,
        reporterId: req.user._id,
        reportedUserId,
        reason,
        flagged: Boolean(mod.flagged),
        flags: mod.categories || [],
      });
      await sfEventRepo
        .log({ type: "Safety", actorId: req.user._id, rideId: ride.Id, payload: { action: "report", incidentId, reportedUserId } })
        .catch(() => {});
      return res.status(201).json({ success: true, report: { _id: incidentId } });
    }

    const ride = await rideRepo.findById(req.params.rideId);
    if (!ride) return res.status(404).json({ message: "Ride not found" });

    const { reportedUserId, reason } = req.body || {};
    if (!reportedUserId || !reason) {
      return res.status(400).json({ message: "reportedUserId and reason are required" });
    }

    const mod = moderateText({ text: reason });
    if (mod.severe) {
      return res.status(400).json({ message: "Report reason blocked by safety filter" });
    }

    const report = await reportRepo.create({
      reporterId: req.user._id,
      reportedUserId,
      rideId: ride._id,
      reason: String(reason).slice(0, 300),
      flagged: Boolean(mod.flagged),
      flags: mod.categories || [],
    });
    return res.status(201).json({ success: true, report });
  } catch (e) {
    console.error("❌ reportRideUser Error:", e);
    return res.status(500).json({ message: "Failed to report user" });
  }
};

// =========================================================
// 🆘 SOS
// =========================================================
export const sosRide = async (req, res) => {
  try {
    if (salesforceEnabled()) {
      const ride = await sfRideRepo.findById(req.params.rideId);
      if (!ride) return res.status(404).json({ message: "Ride not found" });
      const reason = String(req.body?.reason || "SOS triggered").slice(0, 300);
      const incidentId = await sfIncidentRepo.createSos({
        rideId: ride.Id,
        reporterId: req.user._id,
        reason,
      });
      await sfEventRepo
        .log({ type: "Safety", actorId: req.user._id, rideId: ride.Id, payload: { action: "sos", incidentId } })
        .catch(() => {});
      const io = req.app.get("io");
      if (io) io.emit("ride:sos", { rideId: ride.Id, reporterId: req.user._id });
      return res.status(201).json({ success: true, incidentId });
    }
    return res.status(501).json({ message: "SOS is available in Salesforce mode only" });
  } catch (e) {
    console.error("❌ sosRide Error:", e);
    return res.status(500).json({ message: "Failed to trigger SOS" });
  }
};
