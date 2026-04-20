const OPENAI_URL = "https://api.openai.com/v1/responses";

const extractText = (json) => {
  if (!json) return "";
  if (typeof json.output_text === "string" && json.output_text.trim()) return json.output_text.trim();
  const out = json.output;
  if (!Array.isArray(out)) return "";
  const parts = [];
  for (const item of out) {
    const content = item?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (typeof c?.text === "string") parts.push(c.text);
      if (typeof c?.content === "string") parts.push(c.content);
    }
  }
  return parts.join("\n").trim();
};

export const openaiText = async ({
  input,
  instructions,
  model = process.env.OPENAI_MODEL || "gpt-4.1-mini",
  temperature = 0.4,
  maxOutputTokens = 300,
}) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, text: "", error: "OPENAI_API_KEY not set" };

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      temperature,
      max_output_tokens: maxOutputTokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return { ok: false, text: "", error: `OpenAI error (${res.status}): ${errText.slice(0, 200)}` };
  }

  const json = await res.json();
  const text = extractText(json);
  return { ok: true, text, raw: json };
};

