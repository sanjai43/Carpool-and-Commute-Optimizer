import express from "express";
import {
  createRide,
  getRides,
  matchRides,
  joinRide,
  leaveRide,
  completeRide,
  cancelRide,
  getMyRides,
  acceptRequest,
  rejectRequest,
  getJoinedRides,
  getRideMessages,
  postRideMessage,
  rateDriver,
  reportRideUser,
  sosRide
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
router.patch("/:rideId/cancel", protect, authorizeRoles("Driver"), cancelRide);

// ✅ Driver creates & views rides
router.post("/", protect, authorizeRoles("Driver"), createRide);
router.get("/mine", protect, authorizeRoles("Driver"), getMyRides);

// ==========================
// 🚴 RIDER ROUTES
// ==========================
router.post("/:rideId/join", protect, authorizeRoles("Rider"), joinRide);
router.delete("/:rideId/leave", protect, authorizeRoles("Rider"), leaveRide);
router.get("/joined", protect, authorizeRoles("Rider"), getJoinedRides);

// ==========================
// 🚘 COMMON ROUTES
// ==========================
router.post("/match", protect, authorizeRoles("Rider", "Driver"), matchRides);
router.get("/", protect, getRides);

// 💬 Messages
router.get("/:rideId/messages", protect, getRideMessages);
router.post("/:rideId/messages", protect, postRideMessage);

// ⭐ Rating + reports
router.post("/:rideId/rate", protect, authorizeRoles("Rider"), rateDriver);
router.post("/:rideId/report", protect, reportRideUser);
router.post("/:rideId/sos", protect, authorizeRoles("Rider", "Driver"), sosRide);

export default router;
