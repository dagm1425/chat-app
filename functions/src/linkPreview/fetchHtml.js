const { FETCH_TIMEOUT_MS, MAX_HTML_BYTES, USER_AGENT } = require("./constants");
const { createError } = require("./errors");
const { assertSafeTarget } = require("./safety");

const fetchHtml = async (normalizedUrl) => {
  await assertSafeTarget(normalizedUrl);

  // AbortController lets us cancel fetch when timeout elapses.
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response;
  try {
    // Follow HTTP redirects (301/302/307/308) to the final destination URL.
    response = await fetch(normalizedUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        // Browser-like headers reduce 403/challenge responses on some sites.
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "accept-language": "en-US,en;q=0.9",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "upgrade-insecure-requests": "1",
      },
    });
  } catch (error) {
    clearTimeout(timeoutHandle);
    if (error?.name === "AbortError") throw createError("fetch_timeout");
    throw createError("fetch_failed");
  }
  clearTimeout(timeoutHandle);

  if (!response.ok) {
    throw createError(`http_status_${response.status}`);
  }

  const finalUrl = response.url || normalizedUrl;
  await assertSafeTarget(finalUrl);

  const contentType = (
    response.headers.get("content-type") || ""
  ).toLowerCase();
  if (
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml")
  ) {
    throw createError("non_html_content");
  }

  const contentLength = Number(response.headers.get("content-length") || "");
  if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
    throw createError("html_too_large");
  }

  const html = await response.text();
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    throw createError("html_too_large");
  }

  return { html, finalUrl };
};

module.exports = {
  fetchHtml,
};
