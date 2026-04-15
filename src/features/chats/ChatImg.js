import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Box, Skeleton, useMediaQuery } from "@mui/material";

const warmImageBySrcCache = new Map();
const WARM_IMAGE_CACHE_LIMIT = 60;

const isPositiveNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const disposeWarmImage = (image) => {
  if (!image) return;
  image.onload = null;
  image.onerror = null;
  image.src = "";
};

const peekWarmImage = (src) => {
  if (!src) return null;
  return warmImageBySrcCache.get(src) || null;
};

const isWarmImageReady = (entry) =>
  Boolean(entry?.image && entry.image.complete && entry.image.naturalWidth > 0);

const getWarmImage = (src) => {
  if (!src) return null;
  const entry = warmImageBySrcCache.get(src);
  if (!entry) return null;
  warmImageBySrcCache.delete(src);
  warmImageBySrcCache.set(src, entry);
  return entry;
};

const ensureWarmImage = (src) => {
  if (!src || typeof Image === "undefined") return null;

  const existingEntry = getWarmImage(src);
  if (existingEntry) return existingEntry;

  const image = new Image();
  image.decoding = "async";
  image.src = src;
  const entry = { image };
  warmImageBySrcCache.set(src, entry);

  while (warmImageBySrcCache.size > WARM_IMAGE_CACHE_LIMIT) {
    const oldestEntry = warmImageBySrcCache.entries().next().value;
    if (!oldestEntry) break;
    const [oldestSrc, oldestValue] = oldestEntry;
    warmImageBySrcCache.delete(oldestSrc);
    disposeWarmImage(oldestValue.image);
  }

  return entry;
};

function ChatImg({
  previewSrc,
  src,
  chatId,
  width,
  height,
  containerWidth,
  openImgModal,
  fileName,
  url,
}) {
  const isMobile = useMediaQuery("(max-width: 600px)");
  const imgRef = useRef(null);
  const previewImgRef = useRef(null);
  const lastKnownContainerWidthRef = useRef(null);

  if (isPositiveNumber(containerWidth)) {
    lastKnownContainerWidthRef.current = containerWidth;
  }

  const [isFullImageReady, setIsFullImageReady] = useState(() => {
    if (!src) return false;
    const warmEntry = peekWarmImage(src);
    return isWarmImageReady(warmEntry);
  });
  const [isPreviewReady, setIsPreviewReady] = useState(false);
  const [hasFullImageError, setHasFullImageError] = useState(false);
  const hasWarmImageReady = !!(src && isWarmImageReady(peekWarmImage(src)));

  useLayoutEffect(() => {
    if (!src) {
      setIsFullImageReady(false);
      setHasFullImageError(false);
      return;
    }

    const img = imgRef.current;
    const elementReadyNow = !!img && img.complete && img.naturalWidth > 0;
    const warmEntry = ensureWarmImage(src);
    const warmReadyNow = isWarmImageReady(warmEntry);

    // Revisits: often ready immediately via current element state or warm cache.
    if (elementReadyNow || warmReadyNow) {
      setIsFullImageReady(true);
      setHasFullImageError(false);
    } else {
      setIsFullImageReady(false);
      setHasFullImageError(false);
    }
  }, [src, chatId]);

  useLayoutEffect(() => {
    if (!previewSrc) {
      setIsPreviewReady(false);
      return;
    }

    const previewImg = previewImgRef.current;
    const elementReadyNow =
      !!previewImg && previewImg.complete && previewImg.naturalWidth > 0;
    setIsPreviewReady(elementReadyNow);
  }, [previewSrc, chatId]);

  const handleFullImageLoad = () => {
    // First load: mostly becomes ready through this onLoad path.
    setIsFullImageReady(true);
    setHasFullImageError(false);
  };

  const computeRenderedDimensions = useMemo(() => {
    const viewportWidth =
      typeof window !== "undefined" && isPositiveNumber(window.innerWidth)
        ? window.innerWidth
        : 1024;
    const fallbackContainerWidth = isMobile
      ? viewportWidth
      : viewportWidth * 0.7;
    const safeContainerWidth = isPositiveNumber(containerWidth)
      ? containerWidth
      : isPositiveNumber(lastKnownContainerWidthRef.current)
      ? lastKnownContainerWidthRef.current
      : fallbackContainerWidth;

    const maxWidthRatio = isMobile ? 0.75 : 0.45;
    const horizontalPadding = isMobile ? 40 : 144;
    const availableWidth = Math.max(
      140,
      safeContainerWidth * maxWidthRatio - horizontalPadding
    );

    const safeWidth = isPositiveNumber(width) ? width : availableWidth;
    const safeHeight = isPositiveNumber(height) ? height : safeWidth * 0.75;

    const renderedWidth = Math.max(140, Math.min(availableWidth, safeWidth));
    const renderedHeight = Math.max(
      100,
      (renderedWidth / safeWidth) * safeHeight
    );

    return { width: `${renderedWidth}px`, height: `${renderedHeight}px` };
  }, [containerWidth, height, isMobile, width]);

  const hasResolvedContainerWidth =
    isMobile ||
    isPositiveNumber(containerWidth) ||
    isPositiveNumber(lastKnownContainerWidthRef.current);
  const hasPreviewForGapCover = Boolean(previewSrc && isPreviewReady);
  const shouldShowSkeleton =
    !hasResolvedContainerWidth ||
    (!hasPreviewForGapCover && !isFullImageReady && !hasFullImageError);
  const canOpenModal = !!src && typeof openImgModal === "function";

  return (
    <Box
      sx={{
        ...computeRenderedDimensions,
        overflow: "hidden",
        position: "relative",
        borderRadius: "8px",
        backgroundColor: "rgba(0,0,0,0.04)",
      }}
      mb="0.125rem"
      onClick={canOpenModal ? () => openImgModal({ fileName, url }) : undefined}
    >
      {shouldShowSkeleton && (
        <Skeleton
          variant="rectangular"
          animation={hasWarmImageReady ? false : "wave"}
          sx={{ width: "100%", height: "100%" }}
        />
      )}

      {!!previewSrc && !isFullImageReady && (
        <img
          ref={previewImgRef}
          src={previewSrc}
          onLoad={() => {
            setIsPreviewReady(true);
          }}
          onError={() => {
            setIsPreviewReady(false);
          }}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(5px)",
            transform: "scale(1.03)",
            opacity: isFullImageReady ? 0 : 1,
            transition: "opacity 120ms ease",
            pointerEvents: "none",
          }}
        />
      )}

      {!!src && (
        <img
          ref={imgRef}
          src={src}
          onLoad={handleFullImageLoad}
          onError={() => {
            setIsFullImageReady(false);
            setHasFullImageError(true);
          }}
          decoding="async"
          loading="eager"
          alt=""
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "contain",
            opacity: isFullImageReady ? 1 : 0,
            transition: "opacity 120ms ease",
            cursor: canOpenModal ? "pointer" : "default",
          }}
        />
      )}
    </Box>
  );
}

export default ChatImg;

ChatImg.propTypes = {
  previewSrc: PropTypes.string,
  src: PropTypes.string,
  chatId: PropTypes.string,
  width: PropTypes.number,
  height: PropTypes.number,
  containerWidth: PropTypes.number,
  openImgModal: PropTypes.func,
  fileName: PropTypes.string,
  url: PropTypes.string,
};
