import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { listMyPromos } from "../controllers/promoController.js";

const router = express.Router();

router.get("/mine", protect, authorizeRoles("Rider", "Driver", "Admin"), listMyPromos);

export default router;

