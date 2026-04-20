import { openaiText } from "./openaiClient.js";
import { VEHICLE_EMISSIONS_KG_PER_KM } from "../storage/store.js";

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const BAD_WORDS = [
  "idiot",
  "stupid",
  "hate",
  "kill",
  "spam",
  "scam",
  "bitch",
  "bastard",
];

export const moderateText = ({ text }) => {
  const t = String(text || "").toLowerCase();
  const hits = BAD_WORDS.filter((w) => t.includes(w));
  const severe = ["kill"].some((w) => t.includes(w));
  return {
    ok: true,
    flagged: hits.length > 0 || severe,
    severe,
    categories: hits,
    advice: severe ? "blocked" : hits.length ? "warn" : "allow",
  };
};

export const matchExplanationHeuristic = ({ ride, query }) => {
  const parts = [];
  if (typeof ride?._extraKm === "number") {
    parts.push(`Low detour: about +${ride._extraKm} km (~${ride._extraMin} min).`);
  }
  if (ride?.departureTime && query?.departTime) {
    const a = Date.parse(ride.departureTime);
    const b = Date.parse(query.departTime);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      const diffMin = Math.round(Math.abs(a - b) / 60000);
      parts.push(`Time match: ~${diffMin} min difference from your preferred time.`);
    }
  } else if (ride?.departureTime) {
    parts.push(`Departure: ${new Date(ride.departureTime).toLocaleString()}.`);
  }
  if (ride?.driver?.verified) parts.push("Verified driver.");
  if (ride?.driver?.ratingCount) parts.push(`Driver rating: ${ride.driver.ratingAvg} (${ride.driver.ratingCount}).`);
  if (!parts.length) parts.push("Matches your search based on route proximity and availability.");
  return parts.join(" ");
};

export const explainMatch = async ({ ride, query }) => {
  const heuristic = matchExplanationHeuristic({ ride, query });
  const promptInput = {
    ride: {
      start: ride?.start,
      end: ride?.end,
      vehicleType: ride?.vehicleType,
      status: ride?.status,
      departureTime: ride?.departureTime,
      extraKm: ride?._extraKm,
      extraMin: ride?._extraMin,
      seatsTaken: ride?.passengers?.length || 0,
      capacity: ride?.capacity || 3,
      driver: {
        verified: Boolean(ride?.driver?.verified),
        ratingAvg: ride?.driver?.ratingAvg || 0,
        ratingCount: ride?.driver?.ratingCount || 0,
      },
    },
    query: {
      radiusKm: query?.radiusKm,
      windowMin: query?.windowMin,
      maxDetourKm: query?.maxDetourKm,
      departTime: query?.departTime,
    },
  };

  const ai = await openaiText({
    instructions:
      "You are a helpful assistant inside a college project called CarShary. Write a short, friendly, 1-2 sentence explanation of why this ride is a good match. Do not mention that you are an AI. Avoid emojis.",
    input: JSON.stringify(promptInput),
    maxOutputTokens: 120,
  }).catch(() => null);

  if (ai?.ok && ai.text) return { ok: true, text: ai.text, source: "openai" };
  return { ok: true, text: heuristic, source: "heuristic" };
};

export const composeRideRequestMessage = async ({ riderName, ride, pickupLabel, dropLabel }) => {
  const base =
    `Hi ${ride?.driver?.name || "Driver"}, I'm ${riderName || "a rider"}. ` +
    `I'd like to join your ride from ${ride?.start} to ${ride?.end}.` +
    (pickupLabel ? ` Pickup: ${pickupLabel}.` : "") +
    (dropLabel ? ` Drop: ${dropLabel}.` : "") +
    ` Thanks!`;

  const ai = await openaiText({
    instructions:
      "Rewrite this into a polite, concise ride request message. Keep it under 45 words. Keep names and pickup/drop details. No emojis.",
    input: base,
    maxOutputTokens: 90,
  }).catch(() => null);

  return ai?.ok && ai.text ? { ok: true, text: ai.text, source: "openai" } : { ok: true, text: base, source: "heuristic" };
};

export const suggestReplies = async ({ lastMessages = [], myName = "" }) => {
  const safe = lastMessages
    .slice(-6)
    .map((m) => `${m.userName || "User"}: ${String(m.text || "").slice(0, 120)}`)
    .join("\n");

  const heuristic = [
    "Sounds good — what exact pickup point should we meet at?",
    "I can be there in ~10 minutes. Please confirm the location.",
    "Thanks! I’ll join as requested. See you soon.",
  ];

  const ai = await openaiText({
    instructions:
      "Given the chat context, suggest 3 short reply options for the current user. Return as a JSON array of strings only.",
    input: JSON.stringify({ me: myName, chat: safe }),
    maxOutputTokens: 120,
    temperature: 0.6,
  }).catch(() => null);

  if (ai?.ok && ai.text) {
    try {
      const parsed = JSON.parse(ai.text);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
        return { ok: true, suggestions: parsed.slice(0, 3), source: "openai" };
      }
    } catch {
      // ignore
    }
  }

  return { ok: true, suggestions: heuristic, source: "heuristic" };
};

export const parseSchedule = ({ text, now = new Date() }) => {
  const raw = String(text || "").trim();
  if (!raw) return { ok: false, message: "Text is required" };

  const lower = raw.toLowerCase();

  const fromTo = raw.match(/from\s+(.+?)\s+to\s+(.+?)(?:\s+at\s+|$)/i);
  const start = fromTo?.[1]?.trim() || null;
  const end = fromTo?.[2]?.trim() || null;

  let day = new Date(now);
  if (lower.includes("tomorrow")) day.setDate(day.getDate() + 1);
  if (lower.includes("today")) {
    // keep today
  }

  // time: "9am", "9:30 am", "21:10"
  const timeMatch = raw.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (timeMatch) {
    let h = Number(timeMatch[1]);
    const m = timeMatch[2] ? Number(timeMatch[2]) : 0;
    const ampm = timeMatch[3]?.toLowerCase();
    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;
    if (Number.isFinite(h) && Number.isFinite(m)) {
      day.setHours(clamp(h, 0, 23), clamp(m, 0, 59), 0, 0);
    }
  }

  const departureTime = day.toISOString();
  return { ok: true, start, end, departureTime };
};

export const ecoCoach = async ({ stats }) => {
  const totalCO2 = Number(stats?.totalCO2 || 0);
  const totalRides = Number(stats?.totalRides || 0);
  const ecoScore = Number(stats?.ecoScore || 0);

  const heuristic = [
    `You’ve saved about ${totalCO2} kg CO₂ across ${totalRides} rides.`,
    ecoScore >= 70
      ? "Great consistency — try joining rides with low detour to maximize savings."
      : "Try using Nearby mode and a smaller detour filter to find better matches.",
    "Tip: EV and two-wheeler pools reduce emissions fastest for short commutes.",
  ].join(" ");

  const ai = await openaiText({
    instructions:
      "Write a short personalized eco coaching message (2-3 sentences) based on the provided stats. Mention 1 actionable tip. No emojis.",
    input: JSON.stringify({ stats }),
    maxOutputTokens: 160,
  }).catch(() => null);

  return ai?.ok && ai.text ? { ok: true, text: ai.text, source: "openai" } : { ok: true, text: heuristic, source: "heuristic" };
};

export const adminInsights = async ({ reports = [], users = [] }) => {
  const byUser = new Map();
  for (const r of reports) {
    const id = r.reportedUserId;
    byUser.set(id, (byUser.get(id) || 0) + 1);
  }
  const topUsers = [...byUser.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => {
      const u = users.find((x) => x._id === id);
      return { userId: id, name: u?.name || id, count };
    });

  const reasons = reports
    .map((r) => String(r.reason || "").toLowerCase())
    .filter(Boolean);
  const buckets = {
    "late/no-show": 0,
    "unsafe behavior": 0,
    "rude chat": 0,
    "other": 0,
  };
  for (const t of reasons) {
    if (t.includes("late") || t.includes("no show") || t.includes("noshow")) buckets["late/no-show"] += 1;
    else if (t.includes("unsafe") || t.includes("danger") || t.includes("rash")) buckets["unsafe behavior"] += 1;
    else if (t.includes("rude") || t.includes("abuse") || t.includes("harass")) buckets["rude chat"] += 1;
    else buckets.other += 1;
  }

  const summaryHeuristic =
    `Reports: ${reports.length}. Top issue: ` +
    `${Object.entries(buckets).sort((a, b) => b[1] - a[1])[0]?.[0] || "none"}. ` +
    (topUsers[0] ? `Most reported: ${topUsers[0].name} (${topUsers[0].count}).` : "No reported users yet.");

  const ai = await openaiText({
    instructions:
      "Summarize the admin safety insights for this ride-sharing demo in 3 short bullets. Mention top issues and top reported users. No emojis.",
    input: JSON.stringify({ reportCount: reports.length, buckets, topUsers }),
    maxOutputTokens: 180,
  }).catch(() => null);

  const summary = ai?.ok && ai.text ? ai.text : summaryHeuristic;
  return { ok: true, summary, buckets, topUsers, source: ai?.ok ? "openai" : "heuristic" };
};

export const estimateContribution = ({ ride }) => {
  const distanceKm = Number(ride?.distanceKm || 0);
  const vehicleType = ride?.vehicleType || "PetrolCar";
  const base = 4; // ₹ per km baseline (demo)
  const factor = VEHICLE_EMISSIONS_KG_PER_KM[vehicleType] ? VEHICLE_EMISSIONS_KG_PER_KM[vehicleType] / VEHICLE_EMISSIONS_KG_PER_KM.PetrolCar : 1;
  const suggested = Math.round(distanceKm * base * factor);
  return { ok: true, suggestedINR: clamp(suggested, 20, 9999) };
};

