import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exchangeJwtForAccessToken } from "../services/salesforceJwt.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

try {
  const out = await exchangeJwtForAccessToken();
  const token = out.access_token || "";
  console.log("✅ JWT OAuth OK");
  console.log("instance_url:", out.instance_url);
  console.log("access_token:", token ? `${token.slice(0, 10)}…${token.slice(-6)}` : "(missing)");
  console.log("token_length:", token.length);
} catch (e) {
  console.error("❌ JWT OAuth FAILED");
  console.error(e.message || e);
  process.exit(1);
}
