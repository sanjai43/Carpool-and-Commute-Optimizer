import express from "express";
import { registerUser, loginUser, logoutUser } from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";
import { blockUser, getMe } from "../controllers/userController.js";
import { rateLimit } from "../middleware/rateLimit.js";

const router = express.Router();

router.post("/register", rateLimit({ windowMs: 60_000, max: 10, message: "Too many register attempts" }), registerUser);
router.post("/login", rateLimit({ windowMs: 60_000, max: 20, message: "Too many login attempts" }), loginUser);
router.post("/logout", logoutUser);
router.get("/me", protect, getMe);
router.post("/block/:userId", protect, blockUser);

export default router;
