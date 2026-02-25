const { FETCH_TIMEOUT_MS, USER_AGENT } = require("./constants");
const { createError } = require("./errors");
const { assertSafeTarget } = require("./safety");

const normalizeWhitespace = (value) =>
  (value || "").replace(/\s+/g, " ").trim();

const truncate = (value, maxLen) => {
  const safe = value || "";
  return safe.length > maxLen ? safe.slice(0, maxLen) : safe;
};

const parseHost = (urlString) => new URL(urlString).hostname.toLowerCase();

const isYouTubeHost = (host) =>
  host === "youtu.be" || host.endsWith("youtube.com");
const isRedditHost = (host) =>
  host === "redd.it" || host.endsWith("reddit.com");
const isXHost = (host) =>
  host === "x.com" ||
  host.endsWith(".x.com") ||
  host === "twitter.com" ||
  host.endsWith(".twitter.com");

const getProviderConfig = (normalizedUrl) => {
  const host = parseHost(normalizedUrl);
  if (isYouTubeHost(host)) {
    return {
      provider: "youtube",
      endpoint: "https://www.youtube.com/oembed",
    };
  }

  if (isRedditHost(host)) {
    return {
      provider: "reddit",
      endpoint: "https://www.reddit.com/oembed",
    };
  }

  if (isXHost(host)) {
    return {
      provider: "x",
      endpoint: "https://publish.twitter.com/oembed",
    };
  }

  return null;
};

const fetchJson = async (targetUrl) => {
  await assertSafeTarget(targetUrl);

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "application/json;q=1,*/*;q=0.1",
      },
    });
  } catch (error) {
    clearTimeout(timeoutHandle);
    if (error?.name === "AbortError") throw createError("oembed_timeout");
    throw createError("oembed_fetch_failed");
  }
  clearTimeout(timeoutHandle);

  if (!response.ok) {
    throw createError(`oembed_http_status_${response.status}`);
  }

  let payload;
  try {
    payload = await response.json();
  } catch (_) {
    throw createError("oembed_invalid_json");
  }

  if (!payload || typeof payload !== "object") {
    throw createError("oembed_invalid_payload");
  }

  return payload;
};

const mapOEmbedToPreview = ({ normalizedUrl, provider, data }) => {
  const page = new URL(normalizedUrl);
  const domain = page.hostname.replace(/^www\./i, "");

  const title = truncate(normalizeWhitespace(data.title), 200);
  if (!title) throw createError("oembed_missing_title");

  const siteName = truncate(
    normalizeWhitespace(data.provider_name || domain),
    80
  );

  // Most oEmbed providers do not return a useful description; keep it empty.
  const description = null;

  let imageUrl = truncate(
    normalizeWhitespace(
      data.thumbnail_url || data.thumbnail_url_with_play_button
    ),
    1000
  );
  if (imageUrl) {
    try {
      imageUrl = new URL(imageUrl, normalizedUrl).toString();
    } catch (_) {
      imageUrl = "";
    }
  }

  return {
    title,
    description,
    imageUrl: imageUrl || null,
    siteName: siteName || null,
    domain,
    url: normalizedUrl,
    provider,
  };
};

const fetchOEmbedPreview = async (normalizedUrl) => {
  const config = getProviderConfig(normalizedUrl);
  if (!config) return null;

  const query = new URLSearchParams({
    url: normalizedUrl,
    format: "json",
  });

  // Twitter/X oEmbed supports script omission and returns cleaner payload.
  if (config.provider === "x") {
    query.set("omit_script", "true");
  }

  const endpointUrl = `${config.endpoint}?${query.toString()}`;
  const payload = await fetchJson(endpointUrl);
  return mapOEmbedToPreview({
    normalizedUrl,
    provider: config.provider,
    data: payload,
  });
};

const shouldBypassCachedPreview = (normalizedUrl, preview) => {
  if (!preview || typeof preview !== "object") return false;

  const host = parseHost(normalizedUrl);
  if (!isYouTubeHost(host)) return false;

  const title = normalizeWhitespace(preview.title);
  const hasImage = Boolean(normalizeWhitespace(preview.imageUrl));

  // Old YouTube scrape cache can be generic ("- YouTube" + no thumbnail).
  if (!hasImage) return true;
  if (title === "- YouTube") return true;
  return false;
};

module.exports = {
  fetchOEmbedPreview,
  shouldBypassCachedPreview,
};
