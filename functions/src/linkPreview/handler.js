/* eslint-env node */
const { CACHE_COLLECTION, SUCCESS_CACHE_TTL_MS } = require("./constants");
const { toErrorCode } = require("./errors");
const { extractFirstUrl, normalizeUrl, hashUrl } = require("./url");
const { fetchHtml } = require("./fetchHtml");
const { extractPreview } = require("./parse");
const { fetchOEmbedPreview, shouldBypassCachedPreview } = require("./oembed");
const {
  writeMessageReady,
  writeMessageFailed,
  writeSuccessCache,
} = require("./store");

const BLOCKED_FALLBACK_ERROR_CODES = new Set([
  "http_status_401",
  "http_status_403",
  "http_status_429",
]);

const buildDomainFallbackPreview = (urlString) => {
  try {
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();
    return {
      title: host,
      description: urlString,
      imageUrl: null,
      siteName: host,
      domain: host.replace(/^www\./i, ""),
      url: urlString,
      provider: "fallback",
    };
  } catch (_) {
    return null;
  }
};

const buildLinkPreviewHandler =
  ({ admin, db, logger }) =>
  async (event) => {
    const startMs = Date.now();
    const snapshot = event.data;
    if (!snapshot) return;

    const message = snapshot.data() || {};
    if (message.type !== "text" || typeof message.msg !== "string") return;

    const firstUrl = extractFirstUrl(message.msg);
    if (!firstUrl) {
      return;
    }

    let normalizedUrl = "";
    try {
      normalizedUrl = normalizeUrl(firstUrl);
    } catch (error) {
      await writeMessageFailed({
        admin,
        messageRef: snapshot.ref,
        normalizedUrl: "",
        errorCode: toErrorCode(error, "invalid_url"),
      });
      return;
    }

    const urlHash = hashUrl(normalizedUrl);
    const cacheRef = db.collection(CACHE_COLLECTION).doc(urlHash);

    try {
      const cacheDoc = await cacheRef.get();
      const nowMs = Date.now();

      if (cacheDoc.exists) {
        const cacheData = cacheDoc.data() || {};
        const expiresAtMs = cacheData.expiresAt?.toMillis?.() || 0;
        const cacheLive = expiresAtMs > nowMs;
        const skipCache = shouldBypassCachedPreview(
          normalizedUrl,
          cacheData.preview
        );

        if (
          cacheLive &&
          !skipCache &&
          cacheData.lastStatus === "ready" &&
          cacheData.preview
        ) {
          await writeMessageReady({
            admin,
            messageRef: snapshot.ref,
            normalizedUrl,
            preview: cacheData.preview,
          });
          logger.info("buildLinkPreview", {
            status: "ready",
            source: "cache",
            chatId: event.params.chatId,
            msgId: event.params.msgId,
            urlHash,
            durationMs: Date.now() - startMs,
          });
          return;
        }
      }

      let normalizedFinalUrl = normalizedUrl;
      let preview = null;
      let source = "oembed";

      try {
        preview = await fetchOEmbedPreview(normalizedUrl);
      } catch (_) {
        // Best effort: fall through to HTML metadata scraping.
      }

      if (!preview) {
        source = "fetch";
        const { html, finalUrl } = await fetchHtml(normalizedUrl);
        preview = extractPreview(html, finalUrl);
        try {
          normalizedFinalUrl = normalizeUrl(finalUrl);
        } catch (_) {
          normalizedFinalUrl = normalizedUrl;
        }
      }

      await writeMessageReady({
        admin,
        messageRef: snapshot.ref,
        normalizedUrl: normalizedFinalUrl,
        preview,
      });

      await writeSuccessCache({
        admin,
        cacheRef,
        urlHash,
        normalizedUrl: normalizedFinalUrl,
        preview,
        ttlMs: SUCCESS_CACHE_TTL_MS,
      });

      logger.info("buildLinkPreview", {
        status: "ready",
        source,
        chatId: event.params.chatId,
        msgId: event.params.msgId,
        urlHash,
        durationMs: Date.now() - startMs,
      });
    } catch (error) {
      const errorCode = toErrorCode(error, "preview_failed");
      const fallbackPreview = BLOCKED_FALLBACK_ERROR_CODES.has(errorCode)
        ? buildDomainFallbackPreview(normalizedUrl || firstUrl)
        : null;

      if (fallbackPreview) {
        await writeMessageReady({
          admin,
          messageRef: snapshot.ref,
          normalizedUrl: normalizedUrl || firstUrl,
          preview: fallbackPreview,
        });

        logger.info("buildLinkPreview", {
          status: "ready",
          source: "fallback-blocked",
          chatId: event.params.chatId,
          msgId: event.params.msgId,
          urlHash,
          errorCode,
          durationMs: Date.now() - startMs,
        });
        return;
      }

      const rawErrorMessage =
        error instanceof Error ? error.message : String(error || "");
      const rawErrorCode =
        typeof error?.code === "string" && error.code.trim()
          ? error.code
          : null;
      const rawErrorName =
        typeof error?.name === "string" && error.name.trim()
          ? error.name
          : null;
      await writeMessageFailed({
        admin,
        messageRef: snapshot.ref,
        normalizedUrl,
        errorCode,
      });

      logger.error("buildLinkPreview", {
        status: "failed",
        chatId: event.params.chatId,
        msgId: event.params.msgId,
        urlHash,
        errorCode,
        rawErrorCode,
        rawErrorName,
        rawErrorMessage,
        durationMs: Date.now() - startMs,
      });
    }
  };

module.exports = {
  buildLinkPreviewHandler,
};
