import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { getMetrics, listReports, listRides, listUsers, resetDemoData, seedRides } from "../controllers/adminController.js";

const router = express.Router();

router.get("/users", protect, authorizeRoles("Admin"), listUsers);
router.get("/rides", protect, authorizeRoles("Admin"), listRides);
router.get("/reports", protect, authorizeRoles("Admin"), listReports);
router.get("/metrics", protect, authorizeRoles("Admin"), getMetrics);
router.post("/seed-rides", protect, authorizeRoles("Admin"), seedRides);
router.post("/reset-demo", protect, authorizeRoles("Admin"), resetDemoData);

export default router;
