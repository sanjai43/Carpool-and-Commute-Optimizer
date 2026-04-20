import crypto from "node:crypto";
import fs from "node:fs/promises";

const base64url = (input) =>
  Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const signRs256 = (data, privateKeyPem) => {
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  const sig = signer.sign(privateKeyPem);
  return base64url(sig);
};

export const buildJwtAssertion = async ({
  clientId,
  username,
  audience,
  privateKeyPath,
  expiresInSec = 180,
}) => {
  if (!clientId) throw new Error("Missing SF_CLIENT_ID");
  if (!username) throw new Error("Missing SF_USERNAME");
  if (!audience) throw new Error("Missing SF_AUDIENCE");
  if (!privateKeyPath) throw new Error("Missing SF_PRIVATE_KEY_PATH");

  const privateKeyPem = await fs.readFile(privateKeyPath, "utf8");
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientId,
    sub: username,
    aud: audience,
    exp: now + expiresInSec,
    iat: now,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = signRs256(signingInput, privateKeyPem);
  return `${signingInput}.${signature}`;
};

export const exchangeJwtForAccessToken = async () => {
  const loginUrl = process.env.SF_LOGIN_URL || "https://login.salesforce.com";
  const audience = process.env.SF_AUDIENCE || loginUrl;
  const assertion = await buildJwtAssertion({
    clientId: process.env.SF_CLIENT_ID,
    username: process.env.SF_USERNAME,
    audience,
    privateKeyPath: process.env.SF_PRIVATE_KEY_PATH,
  });

  const tokenUrl = `${loginUrl.replace(/\/$/, "")}/services/oauth2/token`;
  const body = new URLSearchParams();
  body.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  body.set("assertion", assertion);

  let res;
  try {
    res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch (e) {
    const cause = e?.cause?.code || e?.cause?.message || e?.message || String(e);
    throw new Error(`Network error calling Salesforce token endpoint (${tokenUrl}): ${cause}`);
  }

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-json error
  }

  if (!res.ok) {
    const msg =
      json?.error_description ||
      json?.error ||
      text?.slice(0, 220) ||
      `HTTP ${res.status}`;
    throw new Error(`Salesforce token exchange failed: ${msg}`);
  }

  return {
    access_token: json?.access_token,
    instance_url: json?.instance_url,
    id: json?.id,
    issued_at: json?.issued_at,
    signature: json?.signature,
    token_type: json?.token_type,
  };
};
