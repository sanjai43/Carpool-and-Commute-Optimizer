import express from "express";
import { getEcoStats } from "../controllers/ecoController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", protect, getEcoStats);

export default router;
