import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { listIncidents, resolveIncident } from "../controllers/safetyController.js";

const router = express.Router();

router.get("/incidents", protect, authorizeRoles("Admin"), listIncidents);
router.patch("/incidents/:id", protect, authorizeRoles("Admin"), resolveIncident);

export default router;

