import { soql } from "../services/salesforceClient.js";

const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

export const sfPromoRepo = {
  async findActiveByCode(code) {
    const c = String(code || "").trim();
    if (!c) return null;
    const q =
      "SELECT Id, Name, Code__c, Value__c, DiscountType__c, EligibleRole__c, Active__c, MaxUses__c, UsedCount__c, ExpiresAt__c, Ride__c, Rider__c, CreatedDate " +
      `FROM PromoCode__c WHERE Code__c='${esc(c)}' LIMIT 1`;
    const res = await soql(q);
    return res?.records?.[0] || null;
  },

  async listForRider(riderId, limit = 50) {
    const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
    const q =
      "SELECT Id, Name, Code__c, Value__c, DiscountType__c, EligibleRole__c, Active__c, MaxUses__c, UsedCount__c, ExpiresAt__c, Ride__c, Rider__c, CreatedDate " +
      `FROM PromoCode__c WHERE Rider__c='${esc(riderId)}' ORDER BY CreatedDate DESC LIMIT ${safeLimit}`;
    const res = await soql(q);
    return res?.records || [];
  },

  toApiPromo(p) {
    return {
      _id: p.Id,
      id: p.Id,
      name: p.Name,
      code: p.Code__c,
      value: Number(p.Value__c || 0),
      discountType: p.DiscountType__c,
      eligibleRole: p.EligibleRole__c,
      active: Boolean(p.Active__c),
      maxUses: Number(p.MaxUses__c || 0),
      usedCount: Number(p.UsedCount__c || 0),
      expiresAt: p.ExpiresAt__c || null,
      rideId: p.Ride__c || null,
      riderId: p.Rider__c || null,
      createdAt: p.CreatedDate,
    };
  },
};
