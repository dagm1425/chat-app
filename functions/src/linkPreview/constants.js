const REGION = "europe-west1";
const CACHE_COLLECTION = "linkPreviewCache";
const FETCH_TIMEOUT_MS = 5000;
const MAX_HTML_BYTES = 2 * 1024 * 1024;
const SUCCESS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TRACKING_PARAM_NAMES = new Set(["fbclid", "gclid"]);
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

module.exports = {
  REGION,
  CACHE_COLLECTION,
  FETCH_TIMEOUT_MS,
  MAX_HTML_BYTES,
  SUCCESS_CACHE_TTL_MS,
  TRACKING_PARAM_NAMES,
  USER_AGENT,
};
