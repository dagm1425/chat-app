const cheerio = require("cheerio");
const { createError } = require("./errors");

const normalizeWhitespace = (value) =>
  (value || "").replace(/\s+/g, " ").trim();

const truncate = (value, maxLen) => {
  const safe = value || "";
  return safe.length > maxLen ? safe.slice(0, maxLen) : safe;
};

const pickMetaContent = ($, selectors) => {
  for (const selector of selectors) {
    const value = normalizeWhitespace($(selector).attr("content"));
    if (value) return value;
  }
  return "";
};

const extractPreview = (html, pageUrl) => {
  const $ = cheerio.load(html);
  const page = new URL(pageUrl);
  const domain = page.hostname.replace(/^www\./i, "");

  const title = truncate(
    normalizeWhitespace(
      pickMetaContent($, [
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
      ]) || $("title").first().text()
    ),
    200
  );
  const description = truncate(
    normalizeWhitespace(
      pickMetaContent($, [
        'meta[property="og:description"]',
        'meta[name="twitter:description"]',
        'meta[name="description"]',
      ])
    ),
    400
  );
  const siteName = truncate(
    normalizeWhitespace(
      pickMetaContent($, ['meta[property="og:site_name"]']) || domain
    ),
    80
  );

  let imageUrl = truncate(
    normalizeWhitespace(
      pickMetaContent($, [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
      ])
    ),
    1000
  );
  if (imageUrl) {
    try {
      // Resolve relative image paths against the page URL into absolute URLs.
      imageUrl = new URL(imageUrl, pageUrl).toString();
    } catch (_) {
      imageUrl = "";
    }
  }

  const resolvedTitle = title || siteName || domain;
  if (!resolvedTitle) {
    throw createError("missing_preview_title");
  }

  return {
    title: resolvedTitle,
    description: description || null,
    imageUrl: imageUrl || null,
    siteName: siteName || null,
    domain,
    url: pageUrl,
  };
};

module.exports = {
  extractPreview,
};
