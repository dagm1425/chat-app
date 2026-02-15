import React, { useEffect, useMemo, useRef, useState } from "react";
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

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};
const videoMetaByUrlCache = new Map();

function VideoMsg({
  message,
  isMobile,
  containerWidth,
  cancelUpload,
  openVideoModal,
  isActive,
}) {
  const fileMsg = message.fileMsg || {};
  const hasVideoUrl = !!fileMsg.fileUrl;
  const videoRef = useRef(null);
  const lastKnownContainerWidthRef = useRef(null);
  const lastKnownVideoMetaRef = useRef({ width: null, height: null });
  const [urlVideoMeta, setUrlVideoMeta] = useState({
    width: null,
    height: null,
  });
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const [progressPct, setProgressPct] = useState(0);

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

  useEffect(() => {
    if (!hasVideoUrl) return;
    const cachedMeta = videoMetaByUrlCache.get(fileMsg.fileUrl);
    if (!cachedMeta) return;
    setUrlVideoMeta(cachedMeta);
  }, [hasVideoUrl, fileMsg.fileUrl]);

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

  useEffect(() => {
    if (!hasVideoUrl) return;

    setIsVideoReady(false);
    setHasPlaybackError(false);
    setProgressPct(0);
  }, [hasVideoUrl, fileMsg.fileUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!isActive) {
      video.pause();
      return;
    }

    if (!hasVideoUrl || !isVideoReady) return;

    const playPromise = video.play();
    if (typeof playPromise?.catch === "function") {
      playPromise.catch(() => {});
    }
  }, [hasVideoUrl, isActive, isVideoReady]);

  const handleTimeUpdate = (event) => {
    const video = event.currentTarget;
    const fallbackDuration = Number(fileMsg.videoDurationSec) || 0;
    const duration =
      Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : fallbackDuration;
    if (!duration) return;
    setProgressPct((video.currentTime / duration) * 100);
  };

  const handleOpenModal = () => {
    if (!hasVideoUrl || hasPlaybackError) return;
    openVideoModal({
      fileName: fileMsg.fileName,
      url: fileMsg.fileUrl,
    });
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
            hasVideoUrl && isVideoReady && !hasPlaybackError
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
              display: "grid",
              placeItems: "center",
              bgcolor: "rgba(0,0,0,0.04)",
            }}
          >
            <Box sx={{ display: "grid" }}>
              <CircularProgress sx={{ gridColumn: 1, gridRow: 1 }} />
              <IconButton
                sx={{ gridColumn: 1, gridRow: 1 }}
                onClick={(event) => {
                  event.stopPropagation();
                  cancelUpload(message.msgId);
                }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
            <Typography
              variant="caption"
              sx={{ position: "absolute", bottom: 8, color: "text.secondary" }}
            >
              {`${Math.round(fileMsg.progress || 0)}% done`}
            </Typography>
          </Box>
        ) : (
          <>
            {!isVideoReady && !hasPlaybackError && (
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
              onLoadedData={() => setIsVideoReady(true)}
              onTimeUpdate={handleTimeUpdate}
              onError={() => {
                setHasPlaybackError(true);
                setIsVideoReady(true);
              }}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "cover",
                opacity: isVideoReady ? 1 : 0,
              }}
            />
            {isVideoReady && !hasPlaybackError && (
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
  isActive: PropTypes.bool.isRequired,
};
