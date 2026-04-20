import { salesforceEnabled, sfApexRestRequest } from "../services/salesforceClient.js";
import { sfPromoRepo } from "../repos/sfPromoRepo.js";

export const listMyPromos = async (req, res) => {
  try {
    if (!salesforceEnabled()) return res.json({ promos: [] });
    const userId = req.user.id || req.user._id;

    try {
      const apex = await sfApexRestRequest({ path: "/carshary/v1/promos", query: { userId } });
      if (apex && Array.isArray(apex.promos)) return res.json(apex);
    } catch {
      // fall back
    }

    const promos = await sfPromoRepo.listForRider(userId, 100);
    return res.json({ promos: promos.map((p) => sfPromoRepo.toApiPromo(p)) });
  } catch (e) {
    return res.status(500).json({ message: "Failed to load promos", error: e.message });
  }
};
