import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { listPendingDrivers, setDriverVerification, submitVerification } from "../controllers/verificationController.js";

const router = express.Router();

router.post("/submit", protect, submitVerification);
router.get("/pending", protect, authorizeRoles("Admin"), listPendingDrivers);
router.patch("/drivers/:userId", protect, authorizeRoles("Admin"), setDriverVerification);

export default router;

