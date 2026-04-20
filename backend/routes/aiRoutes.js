import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import {
  adminInsightsController,
  aiStatusController,
  chatSuggestController,
  contributionController,
  ecoCoachController,
  explainMatchController,
  moderateController,
  requestMessageController,
  scheduleParseController,
} from "../controllers/aiController.js";

const router = express.Router();

router.get("/status", protect, aiStatusController);
router.post("/match-explain", protect, explainMatchController);
router.post("/request-message", protect, requestMessageController);
router.post("/moderate", protect, moderateController);
router.post("/schedule-parse", protect, scheduleParseController);
router.post("/chat-suggest", protect, chatSuggestController);
router.post("/eco-coach", protect, ecoCoachController);
router.post("/contribution", protect, contributionController);
router.get("/admin-insights", protect, authorizeRoles("Admin"), adminInsightsController);

export default router;
