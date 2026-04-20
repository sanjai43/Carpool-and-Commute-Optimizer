import crypto from "crypto";
import bcrypt from "bcryptjs";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const nowIso = () => new Date().toISOString();

const createId = () => crypto.randomUUID();

export const store = {
  users: [],
  rides: [],
  reports: [],
};

const dataFilePath = fileURLToPath(new URL("./data.json", import.meta.url));

const loadFromDisk = async () => {
  try {
    const raw = await fs.readFile(dataFilePath, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.users)) store.users = parsed.users;
    if (Array.isArray(parsed?.rides)) store.rides = parsed.rides;
    if (Array.isArray(parsed?.reports)) store.reports = parsed.reports;
  } catch {
    // ignore (first run / bad json)
  }
};

const persistToDisk = async () => {
  const payload = JSON.stringify(
    { users: store.users, rides: store.rides, reports: store.reports },
    null,
    2
  );
  await fs.writeFile(dataFilePath, payload, "utf8");
};

// Fire-and-forget persistence (best-effort)
const persist = () => {
  persistToDisk().catch(() => {});
};

await loadFromDisk();

const ensureUserShape = (u) => {
  if (!u) return u;
  if (!Array.isArray(u.blockedUserIds)) u.blockedUserIds = [];
  if (!Number.isFinite(u.ratingSum)) u.ratingSum = 0;
  if (!Number.isFinite(u.ratingCount)) u.ratingCount = 0;
  if (typeof u.verified !== "boolean") u.verified = true; // demo default
  return u;
};

const ensureRideShape = (r) => {
  if (!r) return r;
  if (!Array.isArray(r.passengers)) r.passengers = [];
  if (!Array.isArray(r.messages)) r.messages = [];
  if (!Array.isArray(r.reports)) r.reports = [];
  if (!Array.isArray(r.waitlist)) r.waitlist = [];

  // Migrate requests from [userId] -> [{ riderId, pickup, drop, createdAt }]
  if (!Array.isArray(r.requests)) r.requests = [];
  if (r.requests.length > 0 && typeof r.requests[0] === "string") {
    r.requests = r.requests.map((id) => ({
      riderId: id,
      pickup: null,
      drop: null,
      createdAt: nowIso(),
    }));
  }

  if (r.waitlist.length > 0 && typeof r.waitlist[0] === "string") {
    r.waitlist = r.waitlist.map((id) => ({
      riderId: id,
      pickup: null,
      drop: null,
      createdAt: nowIso(),
    }));
  }

  if (!r.status) r.status = "Open";
  if (!r.vehicleType) r.vehicleType = "PetrolCar";
  if (!r.recurrence) r.recurrence = { frequency: "none", days: [] };
  if (!("departureTime" in r)) r.departureTime = null;
  if (!("cancelReason" in r)) r.cancelReason = null;
  if (!("cancelledBy" in r)) r.cancelledBy = null;
  return r;
};

for (const u of store.users) ensureUserShape(u);
for (const r of store.rides) ensureRideShape(r);

const adminEmail = "admin@carshary.local";
const hasAdmin = store.users.some((u) => u.role === "Admin");
if (!hasAdmin) {
  const _id = createId();
  const hashed = await bcrypt.hash("admin123", 10);
  store.users.push(
    ensureUserShape({
      _id,
      id: _id,
      name: "Admin",
      email: adminEmail,
      password: hashed,
      role: "Admin",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      blockedUserIds: [],
      ratingSum: 0,
      ratingCount: 0,
    })
  );
  persist();
}

export const userRepo = {
  async findByEmail(email) {
    if (!email) return null;
    const normalized = String(email).trim().toLowerCase();
    return store.users.find((u) => u.email.toLowerCase() === normalized) || null;
  },

  async findById(id) {
    if (!id) return null;
    return store.users.find((u) => u._id === id) || null;
  },

  async create({ name, email, password, role }) {
    const _id = createId();
    const hashed = await bcrypt.hash(password, 10);
    const user = ensureUserShape({
      _id,
      id: _id,
      name,
      email: String(email).trim().toLowerCase(),
      password: hashed,
      role,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.users.push(user);
    persist();
    return user;
  },

  async blockUser({ userId, blockedUserId }) {
    const user = await this.findById(userId);
    if (!user) return null;
    ensureUserShape(user);
    if (!user.blockedUserIds.includes(blockedUserId)) user.blockedUserIds.push(blockedUserId);
    persist();
    return user;
  },

  async addRating({ userId, stars }) {
    const user = await this.findById(userId);
    if (!user) return null;
    ensureUserShape(user);
    user.ratingSum += stars;
    user.ratingCount += 1;
    persist();
    return user;
  },
};

// kg CO2 per km (rough demo factors)
export const VEHICLE_EMISSIONS_KG_PER_KM = {
  PetrolCar: 0.192,
  DieselCar: 0.171,
  CNGCar: 0.132,
  TwoWheeler: 0.090,
  EV: 0.050,
};

export const calcCO2SavedKg = ({ distanceKm, passengerCount = 1, vehicleType = "PetrolCar" }) => {
  const extraPassengers = Math.max(0, passengerCount - 1);
  const factor = VEHICLE_EMISSIONS_KG_PER_KM[vehicleType] ?? VEHICLE_EMISSIONS_KG_PER_KM.PetrolCar;
  return +((distanceKm * factor * extraPassengers).toFixed(2));
};

export const rideRepo = {
  async create({
    driverId,
    start,
    end,
    distanceKm,
    capacity,
    startLocation,
    endLocation,
    departureTime = null,
    recurrence = { frequency: "none", days: [] },
    vehicleType = "PetrolCar",
  }) {
    const _id = createId();
    const ride = ensureRideShape({
      _id,
      id: _id,
      driver: driverId,
      passengers: [],
      requests: [],
      waitlist: [],
      start,
      end,
      startLocation,
      endLocation,
      distanceKm,
      vehicleType,
      departureTime,
      recurrence,
      co2SavedKg: calcCO2SavedKg({ distanceKm, passengerCount: 1, vehicleType }),
      capacity,
      status: "Open",
      cancelReason: null,
      cancelledBy: null,
      messages: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    store.rides.push(ride);
    persist();
    return ride;
  },

  async findById(id) {
    return store.rides.find((r) => r._id === id) || null;
  },

  async listAll() {
    return [...store.rides].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  },

  async listOpen(limit = 50) {
    const now = Date.now();
    const all = await this.listAll();
    for (const r of all) {
      if (r.departureTime && typeof r.departureTime === "string") {
        const t = Date.parse(r.departureTime);
        if (Number.isFinite(t) && t + 2 * 60 * 60 * 1000 < now) {
          r.status = "Expired";
        }
      }
    }
    return all.filter((r) => r.status === "Open").slice(0, limit);
  },

  async listByDriver(driverId) {
    return (await this.listAll()).filter((r) => r.driver === driverId);
  },

  async listJoinedByPassenger(passengerId) {
    return (await this.listAll()).filter((r) => r.passengers.includes(passengerId));
  },

  async listByPassenger(passengerId) {
    return (await this.listAll()).filter(
      (r) => r.passengers.includes(passengerId) || r.requests.includes(passengerId)
    );
  },

  async save(ride) {
    ensureRideShape(ride);
    ride.updatedAt = nowIso();
    if (ride.passengers.length >= ride.capacity) ride.status = "Full";
    if (ride.status === "Full" && ride.passengers.length < ride.capacity) {
      ride.status = "Open";
    }
    ride.co2SavedKg = calcCO2SavedKg({
      distanceKm: ride.distanceKm,
      passengerCount: ride.passengers.length + 1,
      vehicleType: ride.vehicleType,
    });
    persist();
    return ride;
  },
};

export const populateRide = (ride, { withPassengers = false, withRequests = false } = {}) => {
  if (!ride) return ride;
  const driver = store.users.find((u) => u._id === ride.driver);
  const ratingAvg =
    driver && driver.ratingCount > 0 ? +(driver.ratingSum / driver.ratingCount).toFixed(2) : 0;
  const populated = {
    ...ride,
    driver: driver
      ? {
          _id: driver._id,
          id: driver._id,
          name: driver.name,
          role: driver.role,
          verified: driver.verified === true,
          ratingAvg,
          ratingCount: driver.ratingCount || 0,
          createdAt: driver.createdAt,
        }
      : null,
  };

  if (withPassengers) {
    populated.passengers = ride.passengers
      .map((id) => store.users.find((u) => u._id === id))
      .filter(Boolean)
      .map((u) => ({ _id: u._id, id: u._id, name: u.name, email: u.email }));
  }

  if (withRequests) {
    populated.requests = ride.requests
      .map((req) => {
        const u = store.users.find((x) => x._id === req.riderId);
        if (!u) return null;
        return {
          _id: u._id,
          id: u._id,
          name: u.name,
          email: u.email,
          pickup: req.pickup || null,
          drop: req.drop || null,
          createdAt: req.createdAt,
        };
      })
      .filter(Boolean);

    populated.waitlist = (ride.waitlist || [])
      .map((req) => {
        const u = store.users.find((x) => x._id === req.riderId);
        if (!u) return null;
        return {
          _id: u._id,
          id: u._id,
          name: u.name,
          email: u.email,
          pickup: req.pickup || null,
          drop: req.drop || null,
          createdAt: req.createdAt,
          status: "Waitlisted",
        };
      })
      .filter(Boolean);
  }

  return populated;
};

export const reportRepo = {
  async create({ reporterId, reportedUserId, rideId, reason, flagged = false, flags = [] }) {
    const report = {
      _id: createId(),
      reporterId,
      reportedUserId,
      rideId,
      reason,
      flagged,
      flags,
      createdAt: nowIso(),
    };
    store.reports.push(report);
    persist();
    return report;
  },

  async listAll() {
    return [...store.reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
};
