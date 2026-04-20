import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { getDriverEarnings } from "../controllers/driverController.js";

const router = express.Router();

router.get("/earnings", protect, authorizeRoles("Driver"), getDriverEarnings);

export default router;

