import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Box, Skeleton, useMediaQuery } from "@mui/material";

const decodedSrcCache = new Set();

const isPositiveNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

function ChatImg({
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
  const lastKnownContainerWidthRef = useRef(null);

  if (isPositiveNumber(containerWidth)) {
    lastKnownContainerWidthRef.current = containerWidth;
  }

  // ✅ ALWAYS start with placeholder; we’ll turn it off synchronously if the element is already ready.
  const [loading, setLoading] = useState(true);

  const everDecoded = !!(src && decodedSrcCache.has(src));

  // Sync check before paint: if browser already has this element ready, skip placeholder instantly.
  useLayoutEffect(() => {
    if (!src) {
      setLoading(false);
      return;
    }

    const img = imgRef.current;
    const elementReadyNow = !!img && img.complete && img.naturalWidth > 0;

    if (elementReadyNow) {
      // If it’s already ready, it will paint without the empty flash.
      decodedSrcCache.add(src);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }, [src, chatId]);

  const handleLoad = async () => {
    const img = imgRef.current;
    // Decode THIS element to avoid “loaded but not painted yet”
    if (img && typeof img.decode === "function") {
      try {
        await img.decode();
      } catch {
        console.warn("Image decoding failed, but still showing the image", {
          src,
        });
      }
    }
    if (src) decodedSrcCache.add(src);
    setLoading(false);
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
  const shouldShowSkeleton = loading || !hasResolvedContainerWidth;
  return (
    <Box
      sx={{
        ...computeRenderedDimensions,
        overflow: "hidden",
        borderRadius: "8px",
        backgroundColor: "rgba(0,0,0,0.04)", // ✅ never looks empty even for 1 frame
      }}
      mb="0.125rem"
      onClick={() => openImgModal({ fileName, url })}
    >
      {shouldShowSkeleton && (
        <Skeleton
          variant="rectangular"
          animation={everDecoded ? false : "wave"} // ✅ wave only on first time
          sx={{ width: "100%", height: "100%" }}
        />
      )}

      <img
        ref={imgRef}
        src={src}
        onLoad={handleLoad}
        onError={() => setLoading(false)}
        decoding="async"
        loading="eager" // ✅ for in-viewport chat images
        alt=""
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          opacity: shouldShowSkeleton ? 0 : 1,
          transition: "opacity 120ms ease",
          cursor: "pointer",
        }}
      />
    </Box>
  );
}

export default ChatImg;

ChatImg.propTypes = {
  src: PropTypes.string,
  chatId: PropTypes.string,
  width: PropTypes.number,
  height: PropTypes.number,
  containerWidth: PropTypes.number,
  openImgModal: PropTypes.func,
  fileName: PropTypes.string,
  url: PropTypes.string,
};
