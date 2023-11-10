import React, { useState } from "react";
import PropTypes from "prop-types";
import { Box, Skeleton, useMediaQuery } from "@mui/material";

function ChatImg({
  src,
  width,
  height,
  containerWidth,
  openImgModal,
  fileName,
  url,
}) {
  const [loading, setLoading] = useState(true);
  const isMobile = useMediaQuery("(max-width: 600px)");
  const maxWidth = isMobile ? 0.75 : 0.45;
  const padding = isMobile ? 64 : 128;
  const maxContainerWidth = containerWidth * maxWidth - padding;

  const handleImageLoad = () => {
    setLoading(false);
  };

  const computeRenderedDimensions = () => {
    const renderedWidth = Math.min(maxContainerWidth, width);
    const renderedHeight = (renderedWidth / width) * height;
    return {
      width: `${renderedWidth}px`,
      height: `${renderedHeight}px`,
    };
  };

  return (
    <Box
      sx={computeRenderedDimensions}
      mb="0.125rem"
      onClick={() =>
        openImgModal({
          fileName,
          url,
        })
      }
    >
      {loading && (
        <Skeleton
          variant="rectangular"
          animation="wave"
          sx={{ width: "100%", height: "100%" }}
        />
      )}
      <img
        src={src}
        onLoad={handleImageLoad}
        style={{
          width: "100%",
          height: "auto",
          opacity: loading ? 0 : 1,
          transition: "opacity 0.3s ease-in-out",
          cursor: "pointer",
        }}
        loading="lazy"
        alt=""
      />
    </Box>
  );
}

export default ChatImg;

ChatImg.propTypes = {
  src: PropTypes.string,
  width: PropTypes.number,
  height: PropTypes.number,
  containerWidth: PropTypes.number,
  openImgModal: PropTypes.func,
  fileName: PropTypes.string,
  url: PropTypes.string,
  caption: PropTypes.string,
};
