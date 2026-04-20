import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSfConn, sfRequest } from "../services/salesforceClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const sobject = process.argv[2] || "AppUser__c";

const requiredByObject = {
  AppUser__c: [
    "Name",
    "Email__c",
    "Role__c",
    "Verified__c",
    "ExternalUserId__c",
    "RatingSum__c",
    "RatingCount__c",
    "PasswordHash__c",
  ],
};

try {
  const conn = await getSfConn();
  console.log("instance_url:", conn.instance_url);
  console.log("sobject:", sobject);

  const desc = await sfRequest({ path: `/sobjects/${encodeURIComponent(sobject)}/describe` });
  const fields = (desc?.fields || []).map((f) => f.name);
  const set = new Set(fields);

  const required = requiredByObject[sobject] || [];
  const missing = required.filter((f) => !set.has(f));

  console.log("field_count:", fields.length);
  console.log("missing_required:", missing.length ? missing.join(", ") : "(none)");

  // Print a small sample for quick debugging
  const sample = fields
    .filter((f) => /__c$/.test(f) || ["Id", "Name"].includes(f))
    .sort()
    .slice(0, 60);
  console.log("fields_sample:", sample.join(", "));
} catch (e) {
  console.error("❌ Describe failed");
  console.error(e?.message || e);
  process.exit(1);
}

