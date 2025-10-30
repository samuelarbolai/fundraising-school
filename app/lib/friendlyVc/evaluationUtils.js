const FIT_LABELS = ["Strong Fit", "Promising", "Monitor", "Not a Fit"];

function pickString(source, keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return "";
}

function normalizeFitLabel(value) {
  if (!value) return "";
  const normalized = value.trim().toLowerCase();
  for (const label of FIT_LABELS) {
    if (label.toLowerCase() === normalized) {
      return label;
    }
  }
  const match = FIT_LABELS.find(label => label.toLowerCase().startsWith(normalized));
  return match || "";
}

function normalizeConnectors(connectors) {
  if (!connectors) return { text: "", list: [] };

  const toEntry = entry => {
    if (!entry) return null;
    if (typeof entry === "string") {
      const trimmed = entry.trim();
      if (!trimmed) return null;
      const [name, ...rest] = trimmed.split(/(?:—|-|:)/);
      if (!name) return null;
      const why = rest.join(" ").trim();
      return { name: name.trim(), why: why || undefined };
    }
    if (typeof entry === "object") {
      const name = entry.name?.toString().trim();
      const why = entry.why?.toString().trim();
      if (!name && !why) return null;
      return { name: name || undefined, why: why || undefined };
    }
    return null;
  };

  let array = connectors;
  if (typeof connectors === "string") {
    array = connectors.split(/\n|;/).map(item => item.trim()).filter(Boolean);
  }

  if (!Array.isArray(array)) {
    return { text: "", list: [] };
  }

  const normalized = array.map(toEntry).filter(Boolean);
  const text = normalized
    .map(item => {
      const name = item.name || "";
      const why = item.why || "";
      if (name && why) return `${name} — ${why}`;
      return name || why;
    })
    .filter(Boolean)
    .join("\n");

  return { text, list: normalized };
}

function normalizeSignals(signals) {
  if (!Array.isArray(signals)) return [];
  return signals
    .map(item => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function normalizeEvaluationResult(evaluation, { fallbackSummary = "Summary unavailable." } = {}) {
  const summary = pickString(evaluation, ["summary", "summaryText", "summary_text"]) || fallbackSummary;
  const companyName = pickString(evaluation, ["companyName", "company_name"]);
  const founderName = pickString(evaluation, ["founderName", "founder_name"]);
  const founderEmail = pickString(evaluation, ["founderEmail", "founder_email"]);
  const founderPhone = pickString(evaluation, ["founderPhone", "founder_phone"]);
  const fitLabel = normalizeFitLabel(pickString(evaluation, ["fitLabel", "fit_label"]));
  const signals = normalizeSignals(evaluation?.signals);
  const connectors = normalizeConnectors(evaluation?.connectors);

  return {
    summary,
    companyName,
    founderName,
    founderEmail,
    founderPhone,
    fitLabel,
    connectorsText: connectors.text,
    connectorsList: connectors.list,
    signals,
    raw: evaluation,
  };
}
