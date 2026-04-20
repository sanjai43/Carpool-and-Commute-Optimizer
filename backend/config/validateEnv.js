export const validateEnv = () => {
  const issues = [];

  if (!process.env.JWT_SECRET) {
    issues.push("Missing JWT_SECRET (backend will use an insecure dev default).");
  }

  const sfEnabled = String(process.env.SF_SOURCE_OF_TRUTH || "").toLowerCase() === "true";
  if (sfEnabled) {
    const required = ["SF_CLIENT_ID", "SF_USERNAME", "SF_PRIVATE_KEY_PATH"];
    for (const k of required) {
      if (!process.env[k]) issues.push(`Salesforce enabled but missing ${k}`);
    }
  }

  if (issues.length > 0) {
    console.warn("⚠️ Env validation warnings:");
    for (const m of issues) console.warn(`- ${m}`);
  }
};

