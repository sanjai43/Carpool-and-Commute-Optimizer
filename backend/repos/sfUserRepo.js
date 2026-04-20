import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { createSObject, soql, updateSObject } from "../services/salesforceClient.js";

const esc = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const ratingAvg = (sum, count) => (count > 0 ? +(sum / count).toFixed(2) : 0);

export const sfUserRepo = {
  async listAll(limit = 200) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 200));
    const q =
      "SELECT Id, Name, Email__c, Role__c, Verified__c, VerificationStatus__c, VerificationDocUrl__c, RatingSum__c, RatingCount__c, CreatedDate " +
      `FROM AppUser__c ORDER BY CreatedDate DESC LIMIT ${safeLimit}`;
    const res = await soql(q);
    return res?.records || [];
  },

  async findByEmail(email) {
    const normalized = String(email || "").trim().toLowerCase();
    if (!normalized) return null;
    const q =
      `SELECT Id, Name, Email__c, Role__c, Verified__c, VerificationStatus__c, VerificationDocUrl__c, VerificationNotes__c, RatingSum__c, RatingCount__c, PasswordHash__c, CreatedDate ` +
      `FROM AppUser__c WHERE Email__c='${esc(normalized)}' LIMIT 1`;
    const res = await soql(q);
    return res?.records?.[0] || null;
  },

  async findById(id) {
    if (!id) return null;
    const q =
      `SELECT Id, Name, Email__c, Role__c, Verified__c, VerificationStatus__c, VerificationDocUrl__c, VerificationNotes__c, RatingSum__c, RatingCount__c, PasswordHash__c, CreatedDate ` +
      `FROM AppUser__c WHERE Id='${esc(id)}' LIMIT 1`;
    const res = await soql(q);
    return res?.records?.[0] || null;
  },

  async ensureDefaultAdmin() {
    const email = "admin@carshary.local";
    const existing = await this.findByEmail(email);
    if (existing) return existing;
    const passwordHash = await bcrypt.hash("admin123", 10);
    const out = await createSObject("AppUser__c", {
      ExternalUserId__c: crypto.randomUUID(),
      Name: "Admin",
      Email__c: email,
      Role__c: "Admin",
      Verified__c: true,
      RatingSum__c: 0,
      RatingCount__c: 0,
      PasswordHash__c: passwordHash,
    });
    return this.findById(out?.id);
  },

  async create({ name, email, password, role }) {
    const passwordHash = await bcrypt.hash(String(password), 10);
    const safeRole = role || "Rider";
    const isDriver = String(safeRole) === "Driver";
    const out = await createSObject("AppUser__c", {
      ExternalUserId__c: crypto.randomUUID(),
      Name: String(name || "").trim(),
      Email__c: String(email || "").trim().toLowerCase(),
      Role__c: safeRole,
      // Drivers must be verified via admin workflow; others default verified.
      Verified__c: isDriver ? false : true,
      VerificationStatus__c: isDriver ? "Pending" : "None",
      RatingSum__c: 0,
      RatingCount__c: 0,
      PasswordHash__c: passwordHash,
    });
    return this.findById(out?.id);
  },

  toApiUser(u) {
    if (!u) return null;
    const sum = Number(u.RatingSum__c || 0);
    const count = Number(u.RatingCount__c || 0);
    return {
      _id: u.Id,
      id: u.Id,
      name: u.Name,
      email: u.Email__c,
      role: u.Role__c,
      verified: Boolean(u.Verified__c),
      verificationStatus: u.VerificationStatus__c || null,
      verificationDocUrl: u.VerificationDocUrl__c || null,
      ratingAvg: ratingAvg(sum, count),
      ratingCount: count,
      createdAt: u.CreatedDate,
    };
  },

  async submitVerification({ userId, docUrl }) {
    await updateSObject("AppUser__c", userId, {
      VerificationDocUrl__c: docUrl || null,
      VerificationStatus__c: "Pending",
      Verified__c: false,
    });
    return this.findById(userId);
  },

  async setVerification({ userId, status, notes }) {
    const approved = String(status) === "Approved";
    await updateSObject("AppUser__c", userId, {
      VerificationStatus__c: status,
      VerificationNotes__c: notes || null,
      Verified__c: approved,
    });
    return this.findById(userId);
  },

  async addRating({ userId, stars }) {
    const u = await this.findById(userId);
    if (!u) return null;
    const sum = Number(u.RatingSum__c || 0) + Number(stars);
    const count = Number(u.RatingCount__c || 0) + 1;
    await updateSObject("AppUser__c", u.Id, {
      RatingSum__c: sum,
      RatingCount__c: count,
    });
    return this.findById(u.Id);
  },
};
