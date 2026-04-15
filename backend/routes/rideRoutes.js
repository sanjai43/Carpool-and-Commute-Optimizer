import express from "express";
import {
  createRide,
  getRides,
  matchRides,
  joinRide,
  completeRide,
  getMyRides,
  acceptRequest,
  rejectRequest,
  getJoinedRides
} from "../controllers/rideController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

// ==========================
// 🚗 DRIVER ROUTES
// ==========================

// ✅ Multi-parameter routes must come first
router.patch("/:rideId/accept/:riderId", protect, authorizeRoles("Driver"), acceptRequest);
router.patch("/:rideId/reject/:riderId", protect, authorizeRoles("Driver"), rejectRequest);

// ✅ Complete ride
router.patch("/:rideId/complete", protect, authorizeRoles("Driver"), completeRide);

// ✅ Driver creates & views rides
router.post("/", protect, authorizeRoles("Driver"), createRide);
router.get("/mine", protect, authorizeRoles("Driver"), getMyRides);

// ==========================
// 🚴 RIDER ROUTES
// ==========================
router.post("/:rideId/join", protect, authorizeRoles("Rider"), joinRide);
router.get("/joined", protect, authorizeRoles("Rider"), getJoinedRides);

// ==========================
// 🚘 COMMON ROUTES
// ==========================
router.post("/match", protect, authorizeRoles("Rider", "Driver"), matchRides);
router.get("/", protect, getRides);

export default router;
