const crypto = require("crypto");
const { TRACKING_PARAM_NAMES } = require("./constants");
const { createError } = require("./errors");

const cleanCandidateUrl = (value) => {
  let url = (value || "").trim();
  while (/[),.!?;:\]}]$/.test(url)) {
    url = url.slice(0, -1);
  }
  return url;
};

const extractFirstUrl = (text) => {
  if (typeof text !== "string") return null;
  const match = text.match(/https?:\/\/[^\s<>"'`]+/i);
  if (!match) return null;
  const cleaned = cleanCandidateUrl(match[0]);
  return cleaned || null;
};

const removeTrackingParams = (urlObj) => {
  for (const key of Array.from(urlObj.searchParams.keys())) {
    if (TRACKING_PARAM_NAMES.has(key) || key.toLowerCase().startsWith("utm_")) {
      urlObj.searchParams.delete(key);
    }
  }
};

const normalizeUrl = (rawUrl) => {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (_) {
    throw createError("invalid_url");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw createError("invalid_protocol");
  }

  // Canonicalize host casing so equivalent URLs share one cache key.
  parsed.hostname = parsed.hostname.toLowerCase();
  // Drop fragment anchors (e.g. #pricing); they do not change server content.
  parsed.hash = "";
  // Remove tracking query params to avoid duplicate previews for the same page.
  removeTrackingParams(parsed);
  return parsed.toString();
};

const hashUrl = (normalizedUrl) =>
  crypto.createHash("sha256").update(normalizedUrl).digest("hex");

module.exports = {
  extractFirstUrl,
  normalizeUrl,
  hashUrl,
};
