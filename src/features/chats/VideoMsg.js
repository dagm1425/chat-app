import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import PropTypes from "prop-types";
import {
  Box,
  CircularProgress,
  IconButton,
  Skeleton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import VolumeOffRoundedIcon from "@mui/icons-material/VolumeOffRounded";
import {
  clearLocalVideoPoster,
  getLocalVideoPoster,
} from "./localVideoPosterCache";

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const videoMetaByUrlCache = new Map();
const warmVideoFrameByUrlCache = new Map();
const WARM_VIDEO_FRAME_CACHE_LIMIT = 16;
const WARM_VIDEO_FRAME_CACHE_MAX_BYTES = 24 * 1024 * 1024;
const WARM_VIDEO_FRAME_MAX_EDGE = 540;
const WARM_VIDEO_FRAME_JPEG_QUALITY = 0.78;
const OVERLAY_MIN_HOLD_MS = 100;
const OVERLAY_FADE_MS = 120;
const UPLOAD_CHIP_BG = "rgba(68, 72, 79, 0.68)";
let warmVideoFrameCacheBytes = 0;

const formatUploadBytes = (bytes) => {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const fractionDigits = unitIndex === 0 ? 0 : value >= 100 ? 0 : 1;
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
};

const revokeObjectUrl = (objectUrl) => {
  if (!objectUrl || typeof URL === "undefined") return;
  URL.revokeObjectURL(objectUrl);
};

const getWarmVideoFrame = (url) => {
  if (!url) return null;
  const entry = warmVideoFrameByUrlCache.get(url);
  if (!entry) return null;
  warmVideoFrameByUrlCache.delete(url);
  warmVideoFrameByUrlCache.set(url, entry);
  return entry;
};

const peekWarmVideoFrame = (url) => {
  if (!url) return null;
  return warmVideoFrameByUrlCache.get(url) || null;
};

const disposeWarmFrameImage = (image) => {
  if (!image) return;
  // Defensive cleanup: in the decode() path handlers are already null, but in
  // the onload/onerror fallback they can still be pending at eviction time.
  image.onload = null;
  image.onerror = null;
  // Detach this Image from the blob URL. Blob memory becomes truly releasable
  // once URL.revokeObjectURL(...) is also called for the same URL.
  image.src = "";
};

const createPersistentWarmFrameImage = (objectUrl) => {
  if (!objectUrl || typeof Image === "undefined") return;
  const image = new Image();
  image.decoding = "async";
  image.src = objectUrl;

  if (typeof image.decode === "function") {
    image.decode().catch(() => {});
    return image;
  }

  image.onload = () => {
    image.onload = null;
    image.onerror = null;
  };
  image.onerror = () => {
    image.onload = null;
    image.onerror = null;
  };
  return image;
};

const setWarmVideoFrame = (url, blob) => {
  if (!url || !blob || !blob.size || typeof URL === "undefined") return;

  const previousEntry = warmVideoFrameByUrlCache.get(url);
  if (previousEntry) {
    warmVideoFrameByUrlCache.delete(url);
    warmVideoFrameCacheBytes = Math.max(
      0,
      warmVideoFrameCacheBytes - previousEntry.bytes
    );
    disposeWarmFrameImage(previousEntry.image);
    revokeObjectUrl(previousEntry.objectUrl);
  }

  const objectUrl = URL.createObjectURL(blob);
  const image = createPersistentWarmFrameImage(objectUrl) || null;
  const entry = { objectUrl, bytes: blob.size, image };
  warmVideoFrameByUrlCache.set(url, entry);
  warmVideoFrameCacheBytes += entry.bytes;

  while (
    warmVideoFrameByUrlCache.size > WARM_VIDEO_FRAME_CACHE_LIMIT ||
    warmVideoFrameCacheBytes > WARM_VIDEO_FRAME_CACHE_MAX_BYTES
  ) {
    const oldestEntry = warmVideoFrameByUrlCache.entries().next().value;
    if (!oldestEntry) break;
    const [oldestUrl, oldestValue] = oldestEntry;
    warmVideoFrameByUrlCache.delete(oldestUrl);
    warmVideoFrameCacheBytes = Math.max(
      0,
      warmVideoFrameCacheBytes - oldestValue.bytes
    );
    disposeWarmFrameImage(oldestValue.image);
    revokeObjectUrl(oldestValue.objectUrl);
  }
};

const captureWarmVideoFrame = async (video, url) => {
  if (!video || !url || warmVideoFrameByUrlCache.has(url)) return;

  const sourceWidth = toPositiveNumber(video.videoWidth);
  const sourceHeight = toPositiveNumber(video.videoHeight);
  if (!sourceWidth || !sourceHeight) return;

  const scale = Math.min(
    1,
    WARM_VIDEO_FRAME_MAX_EDGE / Math.max(sourceWidth, sourceHeight)
  );
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) return;

  try {
    context.drawImage(video, 0, 0, targetWidth, targetHeight);
  } catch (error) {
    return;
  }

  const blob = await new Promise((resolve) => {
    canvas.toBlob(
      (nextBlob) => resolve(nextBlob),
      "image/jpeg",
      WARM_VIDEO_FRAME_JPEG_QUALITY
    );
  });
  if (!blob) return;
  setWarmVideoFrame(url, blob);
};

function VideoMsg({
  message,
  isMobile,
  containerWidth,
  cancelUpload,
  openVideoModal,
}) {
  const fileMsg = message.fileMsg || {};
  const msgId = message.msgId;
  const hasVideoUrl = !!fileMsg.fileUrl;
  const effectivePosterSrc = useMemo(
    () => fileMsg.videoPosterUrl || getLocalVideoPoster(msgId),
    [fileMsg.videoPosterUrl, msgId]
  );
  const videoRef = useRef(null);
  const videoFrameCallbackIdRef = useRef(null);
  const fallbackRafIdsRef = useRef([]);
  const overlayHoldTimeoutRef = useRef(null);
  const overlayFadeTimeoutRef = useRef(null);
  const hasHandledFirstFrameRef = useRef(false);
  const lastKnownContainerWidthRef = useRef(null);
  const lastKnownVideoMetaRef = useRef({ width: null, height: null });
  const warmOverlayImgRef = useRef(null);
  const [urlVideoMeta, setUrlVideoMeta] = useState({
    width: null,
    height: null,
  });
  const [hasPaintedFirstFrame, setHasPaintedFirstFrame] = useState(false);
  const [overlayStage, setOverlayStage] = useState(() => {
    if (!hasVideoUrl) return "hidden";
    const hasWarmFrame = Boolean(peekWarmVideoFrame(fileMsg.fileUrl));
    return hasWarmFrame || Boolean(effectivePosterSrc) ? "visible" : "hidden";
  });
  const [warmFrameSrc, setWarmFrameSrc] = useState(() => {
    if (!hasVideoUrl) return "";
    const cachedFrame = peekWarmVideoFrame(fileMsg.fileUrl);
    return cachedFrame ? cachedFrame.objectUrl : "";
  });
  const [isPosterLoaded, setIsPosterLoaded] = useState(false);
  const [isWarmFrameLoaded, setIsWarmFrameLoaded] = useState(false);
  const [hasPosterLoadError, setHasPosterLoadError] = useState(false);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const uploadProgressPct = Math.max(
    0,
    Math.min(100, Number(fileMsg.progress) || 0)
  );
  const uploadSizeBytes = toPositiveNumber(fileMsg.fileSizeBytes);
  const uploadedBytes = uploadSizeBytes
    ? Math.min(
        uploadSizeBytes,
        Math.round((uploadProgressPct / 100) * uploadSizeBytes)
      )
    : null;
  let uploadProgressLabel = `${Math.round(uploadProgressPct)}%`;
  if (uploadSizeBytes) {
    uploadProgressLabel = `${formatUploadBytes(
      uploadedBytes || 0
    )} / ${formatUploadBytes(uploadSizeBytes)}`;
  }

  const clearOverlayTimers = () => {
    if (overlayHoldTimeoutRef.current !== null) {
      clearTimeout(overlayHoldTimeoutRef.current);
      overlayHoldTimeoutRef.current = null;
    }
    if (overlayFadeTimeoutRef.current !== null) {
      clearTimeout(overlayFadeTimeoutRef.current);
      overlayFadeTimeoutRef.current = null;
    }
  };

  const parsedContainerWidth = toPositiveNumber(containerWidth);
  if (parsedContainerWidth) {
    lastKnownContainerWidthRef.current = parsedContainerWidth;
  }

  const parsedVideoWidth = toPositiveNumber(fileMsg.videoWidth);
  const parsedVideoHeight = toPositiveNumber(fileMsg.videoHeight);
  if (hasVideoUrl && parsedVideoWidth && parsedVideoHeight) {
    videoMetaByUrlCache.set(fileMsg.fileUrl, {
      width: parsedVideoWidth,
      height: parsedVideoHeight,
    });
  }
  if (parsedVideoWidth && parsedVideoHeight) {
    lastKnownVideoMetaRef.current = {
      width: parsedVideoWidth,
      height: parsedVideoHeight,
    };
  }

  // Once canonical poster URL from Firetore is available, clear sender-only local poster URL.
  useEffect(() => {
    if (!msgId || !fileMsg.videoPosterUrl) return;
    clearLocalVideoPoster(msgId);
  }, [fileMsg.videoPosterUrl, msgId]);

  useEffect(() => {
    if (!hasVideoUrl) return;
    const cachedMeta = videoMetaByUrlCache.get(fileMsg.fileUrl);
    if (!cachedMeta) return;
    setUrlVideoMeta(cachedMeta);
  }, [fileMsg.fileUrl, hasVideoUrl]);

  // If metadata is not already known for this URL, probe it with an off-DOM video.
  useEffect(() => {
    if (!hasVideoUrl || (parsedVideoWidth && parsedVideoHeight)) return;
    if (urlVideoMeta.width && urlVideoMeta.height) return;

    let isCancelled = false;
    const probeVideo = document.createElement("video");
    probeVideo.preload = "metadata";
    probeVideo.muted = true;
    probeVideo.playsInline = true;
    probeVideo.onloadedmetadata = () => {
      if (isCancelled) return;
      const width = toPositiveNumber(probeVideo.videoWidth);
      const height = toPositiveNumber(probeVideo.videoHeight);
      if (!width || !height) return;
      const metadata = { width, height };
      videoMetaByUrlCache.set(fileMsg.fileUrl, metadata);
      setUrlVideoMeta(metadata);
      lastKnownVideoMetaRef.current = metadata;
    };
    probeVideo.onerror = () => {
      if (isCancelled) return;
    };
    probeVideo.src = fileMsg.fileUrl;

    return () => {
      isCancelled = true;
      probeVideo.removeAttribute("src");
      probeVideo.load();
    };
  }, [
    fileMsg.fileUrl,
    hasVideoUrl,
    parsedVideoHeight,
    parsedVideoWidth,
    urlVideoMeta.height,
    urlVideoMeta.width,
  ]);

  const computeRenderedDimensions = useMemo(() => {
    const viewportWidth =
      typeof window !== "undefined" && toPositiveNumber(window.innerWidth)
        ? window.innerWidth
        : 1024;
    const fallbackContainerWidth = isMobile
      ? viewportWidth
      : viewportWidth * 0.7;
    const safeContainerWidth = parsedContainerWidth
      ? parsedContainerWidth
      : lastKnownContainerWidthRef.current
      ? lastKnownContainerWidthRef.current
      : isMobile
      ? fallbackContainerWidth
      : 720;
    const maxWidthRatio = isMobile ? 0.75 : 0.45;
    const horizontalPadding = isMobile ? 40 : 144;
    const availableWidth = Math.max(
      140,
      safeContainerWidth * maxWidthRatio - horizontalPadding
    );

    const inferredVideoWidth = toPositiveNumber(urlVideoMeta.width);
    const inferredVideoHeight = toPositiveNumber(urlVideoMeta.height);
    const safeWidth = parsedVideoWidth
      ? parsedVideoWidth
      : inferredVideoWidth
      ? inferredVideoWidth
      : lastKnownVideoMetaRef.current.width
      ? lastKnownVideoMetaRef.current.width
      : availableWidth;
    const safeHeight = parsedVideoHeight
      ? parsedVideoHeight
      : inferredVideoHeight
      ? inferredVideoHeight
      : lastKnownVideoMetaRef.current.height
      ? lastKnownVideoMetaRef.current.height
      : safeWidth * 0.75;
    const renderedWidth = Math.max(140, Math.min(availableWidth, safeWidth));
    const renderedHeight = Math.max(
      100,
      (renderedWidth / safeWidth) * safeHeight
    );

    return { width: `${renderedWidth}px`, height: `${renderedHeight}px` };
  }, [
    isMobile,
    parsedContainerWidth,
    parsedVideoHeight,
    parsedVideoWidth,
    urlVideoMeta.height,
    urlVideoMeta.width,
  ]);

  useLayoutEffect(() => {
    if (!hasVideoUrl) return;

    // A VideoMsg instance can be reused for a different message without a full
    // unmount. Reset all per-session flags here so stale state from a previous
    // video does not leak into the next one.
    hasHandledFirstFrameRef.current = false;
    clearOverlayTimers();
    const cachedFrame = getWarmVideoFrame(fileMsg.fileUrl);
    const nextWarmFrameSrc = cachedFrame ? cachedFrame.objectUrl : "";
    const hasPreviewOnReset = Boolean(nextWarmFrameSrc || effectivePosterSrc);
    setWarmFrameSrc(nextWarmFrameSrc);
    setIsPosterLoaded(false);
    setIsWarmFrameLoaded(false);
    setHasPosterLoadError(false);
    setHasPaintedFirstFrame(false);
    setOverlayStage(hasPreviewOnReset ? "visible" : "hidden");
    setHasPlaybackError(false);
    setProgressPct(0);
  }, [effectivePosterSrc, fileMsg.fileUrl, hasVideoUrl]);

  useEffect(() => {
    return () => {
      // Cancel async frame/timer work on unmount to avoid callbacks from an old
      // VideoMsg instance mutating state/logs after this message leaves the tree.
      const video = videoRef.current;
      if (
        video &&
        typeof video.cancelVideoFrameCallback === "function" &&
        videoFrameCallbackIdRef.current !== null
      ) {
        video.cancelVideoFrameCallback(videoFrameCallbackIdRef.current);
      }
      videoFrameCallbackIdRef.current = null;
      fallbackRafIdsRef.current.forEach((rafId) => cancelAnimationFrame(rafId));
      fallbackRafIdsRef.current = [];
      clearOverlayTimers();
    };
  }, [fileMsg.fileUrl]);

  const handleTimeUpdate = (event) => {
    const video = event.currentTarget;
    const duration =
      Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : 0;
    if (!duration) return;
    setProgressPct((video.currentTime / duration) * 100);
  };

  const handleOpenModal = () => {
    if (!hasVideoUrl || hasPlaybackError) return;
    const modalVideoWidth =
      parsedVideoWidth || toPositiveNumber(urlVideoMeta.width);
    const modalVideoHeight =
      parsedVideoHeight || toPositiveNumber(urlVideoMeta.height);
    openVideoModal({
      fileName: fileMsg.fileName,
      url: fileMsg.fileUrl,
      videoWidth: modalVideoWidth,
      videoHeight: modalVideoHeight,
    });
  };
  const hasOverlayPreview = Boolean(warmFrameSrc || effectivePosterSrc);
  const hasPreviewForGapCover = Boolean(
    (warmFrameSrc && isWarmFrameLoaded) ||
      (effectivePosterSrc && isPosterLoaded && !hasPosterLoadError)
  );
  const isOverlayVisible =
    hasOverlayPreview && overlayStage !== "hidden" && !hasPlaybackError;

  // Initializer inside state definition handles first render baseline cheaply.
  // useLayoutEffect guarantees runtime correction for changing conditions.
  useLayoutEffect(() => {
    if (!hasVideoUrl || hasPlaybackError) {
      clearOverlayTimers();
      setOverlayStage("hidden");
      return;
    }

    if (!hasPaintedFirstFrame) {
      setOverlayStage(hasOverlayPreview ? "visible" : "hidden");
    }
  }, [hasVideoUrl, hasPlaybackError, hasPaintedFirstFrame, hasOverlayPreview]);

  useLayoutEffect(() => {
    if (
      !hasVideoUrl ||
      !warmFrameSrc ||
      isWarmFrameLoaded ||
      !isOverlayVisible
    ) {
      return;
    }
    const warmOverlayImg = warmOverlayImgRef.current;
    const isElementReadyNow = Boolean(
      warmOverlayImg &&
        warmOverlayImg.complete &&
        warmOverlayImg.naturalWidth > 0
    );
    if (!isElementReadyNow) return;
    setIsWarmFrameLoaded(true);
  }, [hasVideoUrl, isOverlayVisible, isWarmFrameLoaded, warmFrameSrc]);

  const shouldShowSkeleton =
    !hasPreviewForGapCover && !hasPaintedFirstFrame && !hasPlaybackError;

  const markFirstFramePainted = (video) => {
    if (hasHandledFirstFrameRef.current) return;

    hasHandledFirstFrameRef.current = true;
    setHasPaintedFirstFrame(true);
    captureWarmVideoFrame(video, fileMsg.fileUrl);

    if (!hasOverlayPreview) {
      setOverlayStage("hidden");
      return;
    }

    clearOverlayTimers();
    // Keep overlay briefly, then start fade, then hide after fade duration.
    overlayHoldTimeoutRef.current = setTimeout(() => {
      setOverlayStage("fading");
      overlayFadeTimeoutRef.current = setTimeout(() => {
        setOverlayStage("hidden");
      }, OVERLAY_FADE_MS);
    }, OVERLAY_MIN_HOLD_MS);
  };

  return (
    <>
      <Box
        sx={{
          ...computeRenderedDimensions,
          position: "relative",
          overflow: "hidden",
          borderRadius: "8px",
          backgroundColor:
            hasVideoUrl && hasPaintedFirstFrame && !hasPlaybackError
              ? "#000"
              : "rgba(0,0,0,0.04)",
          mb: "0.125rem",
          cursor: hasVideoUrl && !hasPlaybackError ? "pointer" : "default",
        }}
        onClick={handleOpenModal}
      >
        {!hasVideoUrl ? (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              bgcolor: "rgba(0,0,0,0.04)",
            }}
          >
            {Boolean(effectivePosterSrc) && (
              <img
                src={effectivePosterSrc}
                alt=""
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "blur(5px)",
                  transform: "scale(1.03)",
                }}
              />
            )}
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                bgcolor: effectivePosterSrc
                  ? "rgba(0,0,0,0.14)"
                  : "transparent",
              }}
            >
              <Box
                sx={{
                  position: "relative",
                  width: 46,
                  height: 46,
                  borderRadius: "999px",
                  display: "grid",
                  placeItems: "center",
                  bgcolor: UPLOAD_CHIP_BG,
                }}
              >
                <CircularProgress
                  size={46}
                  thickness={2.4}
                  sx={{
                    position: "absolute",
                    color: "rgba(255,255,255,0.8)",
                  }}
                />
                <IconButton
                  sx={{
                    width: 46,
                    height: 46,
                    color: "#fff",
                    "&:hover": {
                      bgcolor: "transparent",
                    },
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    cancelUpload(message.msgId);
                  }}
                >
                  <CloseIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Box>
              <Typography
                variant="caption"
                sx={{
                  position: "absolute",
                  top: 8,
                  left: 8,
                  px: "0.45rem",
                  py: "0.1rem",
                  borderRadius: "999px",
                  fontWeight: 500,
                  lineHeight: 1.2,
                  letterSpacing: "0.01em",
                  color: "#fff",
                  bgcolor: UPLOAD_CHIP_BG,
                }}
              >
                {uploadProgressLabel}
              </Typography>
            </Box>
          </Box>
        ) : (
          <>
            {isOverlayVisible && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  opacity: overlayStage === "fading" ? 0 : 1,
                  transition: `opacity ${OVERLAY_FADE_MS}ms ease`,
                }}
              >
                {Boolean(effectivePosterSrc) && (
                  <img
                    src={effectivePosterSrc}
                    alt=""
                    onLoad={() => {
                      setIsPosterLoaded(true);
                      setHasPosterLoadError(false);
                    }}
                    onError={() => {
                      setIsPosterLoaded(false);
                      setHasPosterLoadError(true);
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      filter: "blur(5px)",
                      transform: "scale(1.03)",
                    }}
                  />
                )}
                {Boolean(warmFrameSrc) && (
                  <img
                    ref={warmOverlayImgRef}
                    src={warmFrameSrc}
                    alt=""
                    onLoad={(event) => {
                      const loadedSrc =
                        event.currentTarget.currentSrc ||
                        event.currentTarget.src;
                      if (loadedSrc !== warmFrameSrc) return;
                      setIsWarmFrameLoaded(true);
                    }}
                    onError={() => {
                      setIsWarmFrameLoaded(false);
                      setWarmFrameSrc("");
                    }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                )}
              </Box>
            )}
            {shouldShowSkeleton && (
              <Box sx={{ position: "absolute", inset: 0 }}>
                <Skeleton
                  variant="rectangular"
                  animation="wave"
                  sx={{ width: "100%", height: "100%" }}
                />
              </Box>
            )}
            {hasPlaybackError && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  px: 2,
                  textAlign: "center",
                  color: "#fff",
                  bgcolor: "rgba(0,0,0,0.45)",
                }}
              >
                <Typography variant="body2">Unable to preview video</Typography>
              </Box>
            )}
            <video
              ref={videoRef}
              src={fileMsg.fileUrl}
              muted
              autoPlay
              loop
              playsInline
              preload="metadata"
              crossOrigin="anonymous"
              onLoadedData={(event) => {
                const video = event.currentTarget;

                // Cancel old pending callbacks first.
                // If a previous "wait for frame" callback exists, remove it:
                // - cancelVideoFrameCallback(...) for RVFC path
                // - cancelAnimationFrame(...) for RAF fallback path
                // This avoids duplicate/stale callbacks.
                if (
                  typeof video.cancelVideoFrameCallback === "function" &&
                  videoFrameCallbackIdRef.current !== null
                ) {
                  video.cancelVideoFrameCallback(
                    videoFrameCallbackIdRef.current
                  );
                  videoFrameCallbackIdRef.current = null;
                }
                fallbackRafIdsRef.current.forEach((rafId) =>
                  cancelAnimationFrame(rafId)
                );
                fallbackRafIdsRef.current = [];

                // Prefer requestVideoFrameCallback if browser supports it:
                // "call me when a video frame is actually ready",
                // then run markFirstFramePainted(video).
                if (typeof video.requestVideoFrameCallback === "function") {
                  videoFrameCallbackIdRef.current =
                    video.requestVideoFrameCallback(() => {
                      videoFrameCallbackIdRef.current = null;
                      markFirstFramePainted(video);
                    });
                } else {
                  // Fallback if RVFC is not supported:
                  // use two nested requestAnimationFrame(...) calls,
                  // wait a couple paint ticks, then run markFirstFramePainted(video).
                  // This is an approximation for older browsers.
                  const rafOne = requestAnimationFrame(() => {
                    const rafTwo = requestAnimationFrame(() => {
                      markFirstFramePainted(video);
                    });
                    fallbackRafIdsRef.current.push(rafTwo);
                  });
                  fallbackRafIdsRef.current.push(rafOne);
                }
              }}
              onTimeUpdate={handleTimeUpdate}
              onError={() => {
                setHasPlaybackError(true);
              }}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: hasPaintedFirstFrame ? 1 : 0,
              }}
            />
            {hasPaintedFirstFrame && !hasPlaybackError && (
              <>
                <Box
                  sx={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    width: 24,
                    height: 24,
                    borderRadius: "999px",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: "rgba(0,0,0,0.45)",
                  }}
                >
                  <VolumeOffRoundedIcon sx={{ fontSize: 16, color: "#fff" }} />
                </Box>
                <Box
                  sx={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 3,
                    bgcolor: "rgba(255,255,255,0.24)",
                  }}
                >
                  <Box
                    sx={{
                      width: `${Math.max(0, Math.min(100, progressPct))}%`,
                      height: "100%",
                      bgcolor: "primary.main",
                      transition: "width 80ms linear",
                    }}
                  />
                </Box>
              </>
            )}
          </>
        )}
      </Box>
      <Typography variant="body2" sx={{ ml: "0.25rem" }}>
        {message.caption}
      </Typography>
    </>
  );
}

export default VideoMsg;

VideoMsg.propTypes = {
  message: PropTypes.object.isRequired,
  isMobile: PropTypes.bool.isRequired,
  containerWidth: PropTypes.number,
  cancelUpload: PropTypes.func.isRequired,
  openVideoModal: PropTypes.func.isRequired,
};
