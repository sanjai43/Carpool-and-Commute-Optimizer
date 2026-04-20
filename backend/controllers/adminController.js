import { store, populateRide, reportRepo, rideRepo, userRepo } from "../storage/store.js";
import crypto from "node:crypto";
import { salesforceEnabled, soql } from "../services/salesforceClient.js";
import { sfUserRepo } from "../repos/sfUserRepo.js";
import { sfRideRepo } from "../repos/sfRideRepo.js";
import { sfIncidentRepo } from "../repos/sfIncidentRepo.js";
import { sfAdminRepo } from "../repos/sfAdminRepo.js";

const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const randomBetween = (min, max) => min + Math.random() * (max - min);

const randomOffsetDeg = (radiusKm) => {
  // Rough: 1 deg lat ~ 111km.
  const deg = radiusKm / 111;
  return randomBetween(-deg, deg);
};

const haversineKm = (aLat, aLng, bLat, bLng) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const aa = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(aa)));
};

const COIMBATORE_SPOTS = [
  { name: "Gandhipuram", lat: 11.0165, lng: 76.9660 },
  { name: "RS Puram", lat: 11.0109, lng: 76.9568 },
  { name: "Ukkadam", lat: 10.9916, lng: 76.9503 },
  { name: "Town Hall", lat: 10.9951, lng: 76.9624 },
  { name: "Peelamedu", lat: 11.0291, lng: 77.0126 },
  { name: "Hope College", lat: 11.0349, lng: 77.0181 },
  { name: "Singanallur", lat: 11.0006, lng: 77.0288 },
  { name: "Saibaba Colony", lat: 11.0338, lng: 76.9396 },
  { name: "Thudiyalur", lat: 11.0808, lng: 76.9416 },
  { name: "Saravanampatti", lat: 11.0791, lng: 77.0009 },
  { name: "Kovai Medical Center", lat: 11.0434, lng: 77.0871 },
  { name: "Ondipudur", lat: 11.0048, lng: 77.0768 },
  { name: "Airport", lat: 11.0283, lng: 77.0434 },
  { name: "Avinashi Road", lat: 11.0269, lng: 77.0019 },
  { name: "Kalapatti", lat: 11.1167, lng: 77.0400 },
  { name: "Vadavalli", lat: 11.0248, lng: 76.9028 },
  { name: "Kuniyamuthur", lat: 10.9677, lng: 76.9533 },
  { name: "Podanur", lat: 10.9633, lng: 76.9956 },
];

export const listUsers = async (_req, res) => {
  if (salesforceEnabled()) {
    const q = "SELECT Id, Name, Email__c, Role__c, Verified__c, VerificationStatus__c, VerificationDocUrl__c, RatingSum__c, RatingCount__c, CreatedDate FROM AppUser__c ORDER BY CreatedDate DESC LIMIT 200";
    const r = await soql(q);
    const users = (r?.records || []).map((u) => sfUserRepo.toApiUser(u));
    return res.json({ users });
  }
  const users = store.users.map((u) => ({
    _id: u._id,
    id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    ratingAvg: u.ratingCount ? +(u.ratingSum / u.ratingCount).toFixed(2) : 0,
    ratingCount: u.ratingCount || 0,
    createdAt: u.createdAt,
  }));
  res.json({ users });
};

export const listRides = async (_req, res) => {
  if (salesforceEnabled()) {
    const rides = await sfRideRepo.listAll(200);
    return res.json({ rides: rides.map((r) => sfRideRepo.toApiRide(r)) });
  }
  const rides = store.rides.map((r) => populateRide(r, { withPassengers: true, withRequests: true }));
  res.json({ rides });
};

export const listReports = async (_req, res) => {
  if (salesforceEnabled()) {
    const records = await sfIncidentRepo.listReports(200);
    return res.json({ reports: sfIncidentRepo.toApiReports(records) });
  }
  const reports = await reportRepo.listAll();
  res.json({ reports });
};

export const seedRides = async (req, res) => {
  try {
    const preset = String(req.body?.preset || "").trim().toLowerCase();
    const centerLat = toNumber(req.body?.centerLat);
    const centerLng = toNumber(req.body?.centerLng);
    const countRaw = toNumber(req.body?.count);
    const radiusRaw = toNumber(req.body?.radiusKm);

    if (preset !== "coimbatore" && (centerLat === null || centerLng === null)) {
      return res.status(400).json({ message: "centerLat and centerLng are required (or use preset='coimbatore')" });
    }

    const count = Number.isFinite(countRaw) ? Math.max(1, Math.min(40, Math.round(countRaw))) : 10;
    const radiusKm = Number.isFinite(radiusRaw) ? Math.max(1, Math.min(50, radiusRaw)) : 8;

    const demoDrivers = [
      { name: "Demo Driver 1", email: "driver1@carshary.local" },
      { name: "Demo Driver 2", email: "driver2@carshary.local" },
      { name: "Demo Driver 3", email: "driver3@carshary.local" },
    ];

    const driverIds = [];
    if (salesforceEnabled()) {
      for (const d of demoDrivers) {
        const existing = await sfUserRepo.findByEmail(d.email);
        if (existing) {
          driverIds.push(existing.Id);
          continue;
        }
        const created = await sfUserRepo.create({
          name: d.name,
          email: d.email,
          password: "driver123",
          role: "Driver",
        });
        driverIds.push(created.Id);
      }
    } else {
      for (const d of demoDrivers) {
        const existing = await userRepo.findByEmail(d.email);
        if (existing) {
          driverIds.push(existing._id);
          continue;
        }
        const created = await userRepo.create({
          name: d.name,
          email: d.email,
          password: "driver123",
          role: "Driver",
        });
        driverIds.push(created._id);
      }
    }

    const vehicleTypes = ["PetrolCar", "DieselCar", "CNGCar", "TwoWheeler", "EV"];
    const now = Date.now();

    const createdRides = [];
    for (let i = 0; i < count; i += 1) {
      const driverId = driverIds[i % driverIds.length];

      let startLat;
      let startLng;
      let endLat;
      let endLng;
      let startLabel;
      let endLabel;

      if (preset === "coimbatore") {
        const a = COIMBATORE_SPOTS[i % COIMBATORE_SPOTS.length];
        let b = COIMBATORE_SPOTS[(i * 7 + 3) % COIMBATORE_SPOTS.length];
        if (b.name === a.name) b = COIMBATORE_SPOTS[(i * 11 + 5) % COIMBATORE_SPOTS.length];
        startLat = a.lat;
        startLng = a.lng;
        endLat = b.lat;
        endLng = b.lng;
        startLabel = `Coimbatore • ${a.name}`;
        endLabel = `Coimbatore • ${b.name}`;
      } else {
        startLat = centerLat + randomOffsetDeg(radiusKm);
        startLng = centerLng + randomOffsetDeg(radiusKm);
        endLat = centerLat + randomOffsetDeg(radiusKm);
        endLng = centerLng + randomOffsetDeg(radiusKm);
        startLabel = `Point ${i + 1}A`;
        endLabel = `Point ${i + 1}B`;
      }

      const distanceKm = Math.max(3, Math.round(haversineKm(startLat, startLng, endLat, endLng) * randomBetween(1.05, 1.35)));
      const capacity = Math.max(2, Math.round(randomBetween(2, 4)));
      const departureTime = new Date(now + randomBetween(10, 180) * 60 * 1000).toISOString();

      if (salesforceEnabled()) {
        const ride = await sfRideRepo.createRide({
          driverId,
          start: startLabel,
          end: endLabel,
          distanceKm,
          capacity,
          startLat,
          startLng,
          endLat,
          endLng,
          departureTime,
          vehicleType: vehicleTypes[i % vehicleTypes.length],
          externalRideId: `DEMO-${crypto.randomUUID()}`,
        });
        createdRides.push(sfRideRepo.toApiRide(ride));
      } else {
        const ride = await rideRepo.create({
          driverId,
          start: startLabel,
          end: endLabel,
          distanceKm,
          capacity,
          startLocation: { type: "Point", coordinates: [startLng, startLat] },
          endLocation: { type: "Point", coordinates: [endLng, endLat] },
          departureTime,
          recurrence: { frequency: "none", days: [] },
          vehicleType: vehicleTypes[i % vehicleTypes.length],
        });
        createdRides.push(populateRide(ride));
      }
    }

    const io = req.app.get("io");
    if (io) {
      for (const r of createdRides) io.emit("ride:new", r);
    }

    return res.status(201).json({ success: true, count: createdRides.length, rides: createdRides });
  } catch (e) {
    console.error("❌ seedRides Error:", e);
    return res.status(500).json({ message: "Failed to seed rides" });
  }
};

export const resetDemoData = async (_req, res) => {
  try {
    if (!salesforceEnabled()) {
      store.rides = [];
      store.reports = [];
      return res.json({ ok: true, note: "Local demo data cleared" });
    }

    const out = await sfAdminRepo.resetDemoData({ demoPrefix: "DEMO-" });
    return res.json(out);
  } catch (e) {
    console.error("❌ resetDemoData Error:", e);
    return res.status(500).json({ message: "Failed to reset demo data", error: e.message });
  }
};

export const getMetrics = async (_req, res) => {
  try {
    if (salesforceEnabled()) {
      const [rideAgg, incidentAgg, revenueAgg] = await Promise.all([
        soql("SELECT COUNT(Id) total, SUM(CO2SavedKg__c) co2 FROM Ride__c"),
        soql("SELECT Type__c t, COUNT(Id) c FROM Incident__c GROUP BY Type__c"),
        soql("SELECT SUM(FinalFare__c) total FROM RideRequest__c WHERE Status__c='Accepted' AND Ride__r.Status__c='Completed'"),
      ]);

      const totalRides = Number(rideAgg?.records?.[0]?.total || 0);
      const totalCO2 = Number(rideAgg?.records?.[0]?.co2 || 0);
      const incidents = (incidentAgg?.records || []).reduce((acc, r) => {
        acc[r.t] = Number(r.c || 0);
        return acc;
      }, {});
      const totalRevenue = Number(revenueAgg?.records?.[0]?.total || 0);
      return res.json({ totalRides, totalCO2: Number(totalCO2.toFixed(2)), totalRevenue: Number(totalRevenue.toFixed(2)), incidents });
    }

    // Local mode: very small summary
    const totalRides = store.rides.length;
    const totalCO2 = store.rides.reduce((s, r) => s + Number(r.co2SavedKg || 0), 0);
    const totalRevenue = 0;
    const incidents = { Report: store.reports.length, SOS: 0 };
    return res.json({ totalRides, totalCO2: Number(totalCO2.toFixed(2)), totalRevenue, incidents });
  } catch (e) {
    console.error("❌ getMetrics Error:", e);
    return res.status(500).json({ message: "Failed to load metrics", error: e.message });
  }
};
