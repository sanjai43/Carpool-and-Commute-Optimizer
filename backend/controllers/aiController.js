import { store } from "../storage/store.js";
import { salesforceEnabled } from "../services/salesforceClient.js";
import { sfIncidentRepo } from "../repos/sfIncidentRepo.js";
import { sfUserRepo } from "../repos/sfUserRepo.js";
import {
  adminInsights,
  composeRideRequestMessage,
  ecoCoach,
  explainMatch,
  estimateContribution,
  moderateText,
  parseSchedule,
  suggestReplies,
} from "../services/aiService.js";

export const explainMatchController = async (req, res) => {
  const { ride, query } = req.body || {};
  const out = await explainMatch({ ride, query });
  res.json(out);
};

export const requestMessageController = async (req, res) => {
  const { ride, pickupLabel, dropLabel } = req.body || {};
  const riderName = req.user?.name || "";
  const out = await composeRideRequestMessage({ riderName, ride, pickupLabel, dropLabel });
  res.json(out);
};

export const moderateController = async (req, res) => {
  const { text } = req.body || {};
  res.json(moderateText({ text }));
};

export const scheduleParseController = async (req, res) => {
  const { text } = req.body || {};
  res.json(parseSchedule({ text }));
};

export const chatSuggestController = async (req, res) => {
  const { lastMessages } = req.body || {};
  const out = await suggestReplies({ lastMessages: Array.isArray(lastMessages) ? lastMessages : [], myName: req.user?.name || "" });
  res.json(out);
};

export const ecoCoachController = async (req, res) => {
  const { stats } = req.body || {};
  const out = await ecoCoach({ stats });
  res.json(out);
};

export const adminInsightsController = async (_req, res) => {
  const reports = salesforceEnabled()
    ? sfIncidentRepo.toApiReports(await sfIncidentRepo.listReports(200))
    : store.reports || [];
  const users = salesforceEnabled()
    ? (await sfUserRepo.listAll(300)).map((u) => sfUserRepo.toApiUser(u))
    : store.users || [];
  const out = await adminInsights({ reports, users });
  res.json(out);
};

export const contributionController = async (req, res) => {
  const { ride } = req.body || {};
  res.json(estimateContribution({ ride }));
};

export const aiStatusController = async (_req, res) => {
  const enabled = Boolean(process.env.OPENAI_API_KEY);
  res.json({
    openaiEnabled: enabled,
    mode: enabled ? "openai" : "heuristic",
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
  });
};
