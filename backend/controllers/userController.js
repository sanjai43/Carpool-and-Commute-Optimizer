import { userRepo } from "../storage/store.js";
import { salesforceEnabled } from "../services/salesforceClient.js";

export const getMe = async (req, res) => {
  const { password: _p, ...safe } = req.user || {};
  res.json({ user: safe });
};

export const blockUser = async (req, res) => {
  try {
    if (salesforceEnabled()) {
      return res.status(501).json({ message: "Blocking is not implemented in Salesforce mode yet." });
    }
    const blockedUserId = req.params.userId;
    if (!blockedUserId) return res.status(400).json({ message: "userId is required" });
    if (blockedUserId === req.user._id) {
      return res.status(400).json({ message: "Cannot block yourself" });
    }
    const user = await userRepo.blockUser({ userId: req.user._id, blockedUserId });
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ success: true });
  } catch (e) {
    console.error("❌ blockUser Error:", e);
    return res.status(500).json({ message: "Failed to block user" });
  }
};
