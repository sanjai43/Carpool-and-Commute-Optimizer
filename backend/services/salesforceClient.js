import { exchangeJwtForAccessToken } from "./salesforceJwt.js";

const API_VERSION = process.env.SF_API_VERSION || "63.0";

let cached = null; // { access_token, instance_url, fetchedAt }

const isEnabled = () =>
  Boolean(process.env.SF_SOURCE_OF_TRUTH) &&
  Boolean(process.env.SF_CLIENT_ID) &&
  Boolean(process.env.SF_USERNAME) &&
  Boolean(process.env.SF_PRIVATE_KEY_PATH);

export const salesforceEnabled = () => isEnabled();

export const getSfConn = async () => {
  if (!isEnabled()) {
    throw new Error("Salesforce source-of-truth is disabled. Set SF_SOURCE_OF_TRUTH=true and JWT env vars.");
  }

  const now = Date.now();
  if (cached && now - cached.fetchedAt < 15 * 60 * 1000) return cached;

  const out = await exchangeJwtForAccessToken();
  cached = { ...out, fetchedAt: now };
  return cached;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const shouldRetry = ({ status, errorMessage }) => {
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  // network-style
  if (typeof errorMessage === "string" && errorMessage.toLowerCase().includes("network error")) return true;
  if (typeof errorMessage === "string" && errorMessage.toLowerCase().includes("econnreset")) return true;
  return false;
};

const parseSalesforceErrorMessage = ({ json, text, status }) => {
  return (
    (Array.isArray(json) ? json?.[0]?.message : json?.message) ||
    json?.error_description ||
    json?.error ||
    text?.slice(0, 240) ||
    `HTTP ${status}`
  );
};

const requestWithRetry = async ({ url, method, headers, body }) => {
  const maxAttempts = Number(process.env.SF_RETRY_ATTEMPTS || 3);

  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(url, { method, headers, body }).catch((e) => {
        const cause = e?.cause?.code || e?.cause?.message || e?.message || String(e);
        throw new Error(`Network error calling Salesforce (${url}): ${cause}`);
      });

      const text = await res.text().catch(() => "");
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      // Token might have expired; clear cache once and retry
      if (res.status === 401 && attempt < maxAttempts) {
        cached = null;
        lastErr = new Error(`Salesforce API error (401): ${parseSalesforceErrorMessage({ json, text, status: res.status })}`);
      } else if (!res.ok) {
        const msg = parseSalesforceErrorMessage({ json, text, status: res.status });
        lastErr = new Error(`Salesforce API error (${res.status}): ${msg}`);
      } else {
        return { json };
      }

      if (!shouldRetry({ status: res.status, errorMessage: lastErr?.message })) throw lastErr;
    } catch (e) {
      lastErr = e;
      if (!shouldRetry({ status: 0, errorMessage: e?.message })) throw e;
    }

    const baseDelay = 250 * 2 ** (attempt - 1);
    const jitter = Math.floor(Math.random() * 150);
    await sleep(Math.min(2500, baseDelay + jitter));
  }

  throw lastErr || new Error("Salesforce request failed");
};

export const sfRequest = async ({ method = "GET", path, query, body }) => {
  const conn = await getSfConn();
  const base = `${conn.instance_url}/services/data/v${API_VERSION}`;
  const url = new URL(`${base}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const out = await requestWithRetry({
    url: url.toString(),
    method,
    headers: {
      Authorization: `Bearer ${conn.access_token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return out.json;
};

export const sfApexRestRequest = async ({ method = "GET", path, query, body }) => {
  const conn = await getSfConn();
  const url = new URL(`${conn.instance_url}/services/apexrest${path.startsWith("/") ? "" : "/"}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const out = await requestWithRetry({
    url: url.toString(),
    method,
    headers: {
      Authorization: `Bearer ${conn.access_token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return out.json;
};

export const soql = async (query) => {
  return sfRequest({ path: "/query", query: { q: query } });
};

export const createSObject = async (sobject, fields) => {
  return sfRequest({ method: "POST", path: `/sobjects/${sobject}`, body: fields });
};

export const updateSObject = async (sobject, id, fields) => {
  await sfRequest({ method: "PATCH", path: `/sobjects/${sobject}/${id}`, body: fields });
  return { id };
};

export const deleteSObject = async (sobject, id) => {
  await sfRequest({ method: "DELETE", path: `/sobjects/${sobject}/${id}` });
  return { id };
};
