import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Box, Skeleton, useMediaQuery } from "@mui/material";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";

const PREVIEW_PENDING_FALLBACK_DELAY_MS = 10000;

const PdfFilePreview = ({
  fileUrl,
  previewUrl,
  isPreviewPending,
  onDownload,
}) => {
  const isMobile = useMediaQuery("(max-width:600px)");
  const previewImgRef = useRef(null);
  const [hasPreviewLoadError, setHasPreviewLoadError] = useState(false);
  const [isPreviewLoaded, setIsPreviewLoaded] = useState(false);
  const [hasPendingWaitExpired, setHasPendingWaitExpired] = useState(false);
  const thumbSize = isMobile ? 68 : 72;
  const hasPreviewSrc = typeof previewUrl === "string" && previewUrl.length > 0;
  const showPendingSkeleton =
    isPreviewPending && !hasPreviewSrc && !hasPendingWaitExpired;
  const showLoadingSkeleton =
    showPendingSkeleton ||
    (hasPreviewSrc && !isPreviewLoaded && !hasPreviewLoadError);

  useEffect(() => {
    if (!isPreviewPending || hasPreviewSrc) {
      setHasPendingWaitExpired(false);
      return;
    }
    setHasPendingWaitExpired(false);
    const timeoutId = setTimeout(() => {
      setHasPendingWaitExpired(true);
    }, PREVIEW_PENDING_FALLBACK_DELAY_MS);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasPreviewSrc, isPreviewPending]);

  useLayoutEffect(() => {
    if (!hasPreviewSrc) {
      setHasPreviewLoadError(false);
      setIsPreviewLoaded(false);
      return;
    }
    const img = previewImgRef.current;
    const elementReadyNow = !!img && img.complete && img.naturalWidth > 0;
    setHasPreviewLoadError(false);
    setIsPreviewLoaded(elementReadyNow);
  }, [hasPreviewSrc, previewUrl]);

  const handlePreviewClick = () => {
    if (!fileUrl) return;
    onDownload(fileUrl);
  };

  return (
    <Box
      onClick={handlePreviewClick}
      role={fileUrl ? "button" : undefined}
      tabIndex={fileUrl ? 0 : -1}
      onKeyDown={(event) => {
        if (!fileUrl) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handlePreviewClick();
        }
      }}
      sx={{
        width: thumbSize,
        height: thumbSize,
        borderRadius: "0.35rem",
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
        cursor: fileUrl ? "pointer" : "default",
        bgcolor: (theme) =>
          showLoadingSkeleton
            ? theme.palette.mode === "light"
              ? "rgba(11, 20, 26, 0.04)"
              : "rgba(255, 255, 255, 0.06)"
            : theme.palette.mode === "dark"
            ? "#1e1f22"
            : "#fafafa",
        border: showLoadingSkeleton ? "none" : "1px solid rgba(0, 0, 0, 0.12)",
      }}
    >
      {showLoadingSkeleton && (
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            width: "100%",
            height: "100%",
          }}
        />
      )}

      {hasPreviewSrc && !hasPreviewLoadError && (
        <img
          ref={previewImgRef}
          src={previewUrl}
          alt=""
          onLoad={() => {
            setIsPreviewLoaded(true);
            setHasPreviewLoadError(false);
          }}
          onError={() => {
            setIsPreviewLoaded(false);
            setHasPreviewLoadError(true);
          }}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            opacity: isPreviewLoaded ? 1 : 0,
            transition: "opacity 140ms ease",
          }}
        />
      )}

      {((!hasPreviewSrc && !showPendingSkeleton) || hasPreviewLoadError) && (
        <Box
          sx={{
            height: "100%",
            display: "grid",
            placeItems: "center",
            bgcolor: (theme) =>
              theme.palette.mode === "light"
                ? "rgba(11, 20, 26, 0.03)"
                : "rgba(255, 255, 255, 0.04)",
          }}
        >
          <BrokenImageOutlinedIcon sx={{ fontSize: 22, color: "grey.500" }} />
        </Box>
      )}
    </Box>
  );
};

PdfFilePreview.propTypes = {
  fileUrl: PropTypes.string.isRequired,
  previewUrl: PropTypes.string,
  isPreviewPending: PropTypes.bool,
  onDownload: PropTypes.func.isRequired,
};

export default PdfFilePreview;
