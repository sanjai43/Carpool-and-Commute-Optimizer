import crypto from "node:crypto";
import { createSObject, soql, updateSObject } from "../services/salesforceClient.js";

const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

	const rideBaseSelect =
	  "Id, Name, ExternalRideId__c, Driver__c, Driver__r.Name, Driver__r.Role__c, Driver__r.Verified__c, Driver__r.RatingSum__c, Driver__r.RatingCount__c, Driver__r.CreatedDate," +
	  " StartText__c, EndText__c, StartLat__c, StartLng__c, EndLat__c, EndLng__c, DepartureTime__c, VehicleType__c, Capacity__c, Status__c, DistanceKm__c, CO2SavedKg__c, CancelReason__c," +
	  " IsTemplate__c, ParentRide__c," +
	  " BaseFare__c, RatePerKm__c, SurgeMultiplier__c, SuggestedFare__c, AcceptedCount__c, PerRiderFare__c, CreatedDate";

const driverObj = (r) => {
  const sum = Number(r?.Driver__r?.RatingSum__c || 0);
  const count = Number(r?.Driver__r?.RatingCount__c || 0);
  const avg = count > 0 ? +(sum / count).toFixed(2) : 0;
  return r.Driver__r
    ? {
        _id: r.Driver__c,
        id: r.Driver__c,
        name: r.Driver__r.Name,
        role: r.Driver__r.Role__c,
        verified: Boolean(r.Driver__r.Verified__c),
        ratingAvg: avg,
        ratingCount: count,
        createdAt: r.Driver__r.CreatedDate,
      }
    : null;
};

	export const sfRideRepo = {
	  async createRide({ driverId, start, end, distanceKm, capacity, startLat, startLng, endLat, endLng, departureTime, vehicleType, externalRideId = null }) {
	    const out = await createSObject("Ride__c", {
	      ExternalRideId__c: externalRideId || crypto.randomUUID(),
	      Name: `${start} → ${end}`.slice(0, 80),
	      Driver__c: driverId,
	      StartText__c: start,
	      EndText__c: end,
	      StartLat__c: toNum(startLat),
	      StartLng__c: toNum(startLng),
	      EndLat__c: toNum(endLat),
	      EndLng__c: toNum(endLng),
	      DepartureTime__c: departureTime || null,
	      VehicleType__c: vehicleType || "PetrolCar",
	      Capacity__c: capacity || 3,
	      Status__c: "Open",
	      IsTemplate__c: false,
	      ParentRide__c: null,
	      DistanceKm__c: toNum(distanceKm),
	      CO2SavedKg__c: 0,
	      CancelReason__c: null,
	    });
	    return this.findById(out?.id);
	  },

  async findById(id) {
    const q = `SELECT ${rideBaseSelect} FROM Ride__c WHERE Id='${esc(id)}' LIMIT 1`;
    const res = await soql(q);
    return res?.records?.[0] || null;
  },

  async listAll(limit = 200) {
    const q = `SELECT ${rideBaseSelect} FROM Ride__c WHERE IsTemplate__c=false ORDER BY CreatedDate DESC LIMIT ${Math.max(1, Math.min(500, limit))}`;
    const res = await soql(q);
    return res?.records || [];
  },

  async listOpen(limit = 200) {
    const q = `SELECT ${rideBaseSelect} FROM Ride__c WHERE Status__c='Open' AND IsTemplate__c=false ORDER BY CreatedDate DESC LIMIT ${Math.max(1, Math.min(500, limit))}`;
    const res = await soql(q);
    return res?.records || [];
  },

  async listByDriver(driverId, limit = 200) {
    const q = `SELECT ${rideBaseSelect} FROM Ride__c WHERE Driver__c='${esc(driverId)}' ORDER BY CreatedDate DESC LIMIT ${Math.max(1, Math.min(500, limit))}`;
    const res = await soql(q);
    return res?.records || [];
  },

  async updateStatus(rideId, status, extra = {}) {
    await updateSObject("Ride__c", rideId, { Status__c: status, ...extra });
    return this.findById(rideId);
  },

	  toApiRide(r) {
	    if (!r) return null;
	    return {
      _id: r.Id,
      id: r.Id,
      start: r.StartText__c || "",
      end: r.EndText__c || "",
      startLocation: {
        type: "Point",
        coordinates: [Number(r.StartLng__c || 0), Number(r.StartLat__c || 0)],
      },
      endLocation: {
        type: "Point",
        coordinates: [Number(r.EndLng__c || 0), Number(r.EndLat__c || 0)],
      },
      distanceKm: Number(r.DistanceKm__c || 0),
      vehicleType: r.VehicleType__c || "PetrolCar",
      departureTime: r.DepartureTime__c || null,
      capacity: Number(r.Capacity__c || 3),
      status: r.Status__c || "Open",
      cancelReason: r.CancelReason__c || null,
      co2SavedKg: Number(r.CO2SavedKg__c || 0),
	      pricing: {
	        baseFare: Number(r.BaseFare__c || 0),
	        ratePerKm: Number(r.RatePerKm__c || 0),
	        surgeMultiplier: Number(r.SurgeMultiplier__c || 1),
	        suggestedFare: Number(r.SuggestedFare__c || 0),
	        acceptedCount: Number(r.AcceptedCount__c || 0),
	        perRiderFare: Number(r.PerRiderFare__c || 0),
	      },
	      createdAt: r.CreatedDate,
	      driver: driverObj(r),
	      passengers: [],
	      requests: [],
	      messages: [],
	    };
	  },
	};
