import jwt from "jsonwebtoken";
import { userRepo } from "../storage/store.js";
import { salesforceEnabled } from "../services/salesforceClient.js";
import { sfUserRepo } from "../repos/sfUserRepo.js";

const isSfSchemaMismatch = (err) =>
  Boolean(
    err &&
      typeof err.message === "string" &&
      (err.message.includes("No such column") || err.message.includes("No such field")) &&
      err.message.includes("AppUser__c")
  );

export const protect = async (req, res, next) => {
  let token;

  try {
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.carshary_token) {
      token = req.cookies.carshary_token;
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const repo = salesforceEnabled() ? sfUserRepo : userRepo;
      const user = await repo.findById(decoded.id);
      if (!user) return res.status(401).json({ message: "Not authorized, user missing" });
      if (salesforceEnabled()) {
        req.user = {
          _id: user.Id,
          id: user.Id,
          name: user.Name,
          email: user.Email__c || user.Email || null,
          role: user.Role__c,
          verified: Boolean(user.Verified__c),
        };
      } else {
        const { password: _password, ...safeUser } = user;
        req.user = safeUser;
      }
      return next();
    }

    return res.status(401).json({ message: "Not authorized, no token" });
  } catch (error) {
    if (salesforceEnabled() && isSfSchemaMismatch(error)) {
      console.error("Auth middleware error (SF schema mismatch):", error.message || error);
      return res.status(500).json({
        message:
          "Salesforce schema mismatch or missing Field-Level Security (FLS). Even if the field exists in Setup, Salesforce will return 'No such column' if your JWT user can't access it. Deploy the CarShary metadata + permission set, assign `CarShary Integration Access` to the same user as `SF_USERNAME`, then restart the backend.",
      });
    }
    console.error("Auth middleware error:", error);
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};
