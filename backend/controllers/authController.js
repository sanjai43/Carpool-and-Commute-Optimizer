import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { userRepo } from "../storage/store.js";
import { salesforceEnabled } from "../services/salesforceClient.js";
import { sfUserRepo } from "../repos/sfUserRepo.js";
import { sfEventRepo } from "../repos/sfEventRepo.js";

const isSfSchemaMismatch = (err) =>
  Boolean(
    err &&
      typeof err.message === "string" &&
      (err.message.includes("No such column") || err.message.includes("No such field")) &&
      err.message.includes("AppUser__c")
  );

const setAuthCookie = (res, token) => {
  const secure = process.env.NODE_ENV === "production";
  res.cookie("carshary_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

// 🟩 Register a new user
export const registerUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const repo = salesforceEnabled() ? sfUserRepo : userRepo;
    const existingUser = await repo.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await repo.create({ name, email, password, role });
    const id = salesforceEnabled() ? user.Id : user._id;

    const token = jwt.sign(
      { id, role: salesforceEnabled() ? user.Role__c : user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    if (salesforceEnabled()) {
      await sfEventRepo
        .log({ type: "Auth", actorId: id, payload: { action: "register", role } })
        .catch(() => {});
    }
    setAuthCookie(res, token);
    res.status(201).json({
      token,
      user: {
        id,
        name: salesforceEnabled() ? user.Name : user.name,
        email: salesforceEnabled() ? user.Email__c : user.email,
        role: salesforceEnabled() ? user.Role__c : user.role,
      },
    });
  } catch (error) {
    console.error("Register error:", error?.message || error);
    if (salesforceEnabled() && isSfSchemaMismatch(error)) {
      return res.status(500).json({
        message:
          "Salesforce schema mismatch or missing Field-Level Security (FLS). Even if the field exists, Salesforce returns 'No such column' when your JWT user can't access it. Deploy the CarShary metadata + permission set, assign `CarShary Integration Access` to the same user as `SF_USERNAME`, then restart the backend.",
        error: error.message,
      });
    }
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
};

// 🟦 Login existing user
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const repo = salesforceEnabled() ? sfUserRepo : userRepo;
    if (salesforceEnabled()) {
      await sfUserRepo.ensureDefaultAdmin().catch(() => {});
    }
    const user = await repo.findByEmail(email);
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const storedHash = salesforceEnabled() ? user.PasswordHash__c : user.password;
    const isMatch = await bcrypt.compare(password, storedHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: salesforceEnabled() ? user.Id : user._id, role: salesforceEnabled() ? user.Role__c : user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    setAuthCookie(res, token);
    if (salesforceEnabled()) {
      await sfEventRepo.log({ type: "Auth", actorId: salesforceEnabled() ? user.Id : user._id, payload: { action: "login" } }).catch(() => {});
    }
    res.json({
      token,
      user: {
        id: salesforceEnabled() ? user.Id : user._id,
        name: salesforceEnabled() ? user.Name : user.name,
        email: salesforceEnabled() ? user.Email__c : user.email,
        role: salesforceEnabled() ? user.Role__c : user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error?.message || error);
    if (salesforceEnabled() && isSfSchemaMismatch(error)) {
      return res.status(500).json({
        message:
          "Salesforce schema mismatch or missing Field-Level Security (FLS). Even if the field exists, Salesforce returns 'No such column' when your JWT user can't access it. Deploy the CarShary metadata + permission set, assign `CarShary Integration Access` to the same user as `SF_USERNAME`, then restart the backend.",
        error: error.message,
      });
    }
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

export const logoutUser = async (_req, res) => {
  res.clearCookie("carshary_token", { path: "/" });
  return res.json({ ok: true });
};
