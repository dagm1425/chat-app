import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Box, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import VolumeOffRoundedIcon from "@mui/icons-material/VolumeOffRounded";

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

function ChatMsgVideoDisp({ videoData, downloadFile, onClose }) {
  const videoRef = useRef(null);
  const [isChromeVisible, setIsChromeVisible] = useState(true);
  const videoUrl = videoData?.url || "";
  const videoFileName = videoData?.fileName || "video";
  const videoWidth = toPositiveNumber(videoData?.videoWidth);
  const videoHeight = toPositiveNumber(videoData?.videoHeight);
  const hasNativeDimensions = !!(videoWidth && videoHeight);
  const aspectRatio =
    videoWidth && videoHeight ? videoWidth / videoHeight : 16 / 9;
  const frameWidth = hasNativeDimensions
    ? `min(${videoWidth}px, 92vw, calc(92vh * ${aspectRatio}))`
    : `min(92vw, calc(92vh * ${aspectRatio}))`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    const playPromise = video.play();
    if (typeof playPromise?.catch === "function") {
      playPromise.catch(() => {});
    }
  }, [videoUrl]);

  return (
    <Box
      sx={{
        position: "relative",
        width: frameWidth,
        maxWidth: "92vw",
        maxHeight: "92vh",
        aspectRatio: `${aspectRatio}`,
        bgcolor: "#000",
        borderRadius: 2,
      }}
      onMouseEnter={() => setIsChromeVisible(true)}
      onMouseLeave={() => setIsChromeVisible(false)}
    >
      <Box
        sx={{
          position: "fixed",
          top: "4%",
          right: "4%",
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          zIndex: 1301,
        }}
      >
        <IconButton
          aria-label="download video"
          sx={{
            size: "medium",
            opacity: "0.5",
            transition: "opacity 100ms ease-in",
            "&:hover": {
              opacity: "1",
            },
            "&.MuiButtonBase-root:hover": {
              bgcolor: "transparent",
            },
          }}
          onClick={() => downloadFile(videoUrl, videoFileName)}
          disabled={!videoUrl}
        >
          <DownloadIcon sx={{ color: "#eee" }} />
        </IconButton>
        <IconButton
          aria-label="close video"
          sx={{
            size: "medium",
            opacity: "0.5",
            transition: "opacity 100ms ease-in",
            "&:hover": {
              opacity: "1",
            },
            "&.MuiButtonBase-root:hover": {
              bgcolor: "transparent",
            },
          }}
          onClick={onClose}
        >
          <CloseIcon sx={{ color: "#eee" }} />
        </IconButton>
      </Box>

      <Box
        sx={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 2,
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.5,
          borderRadius: "999px",
          bgcolor: "rgba(0,0,0,0.5)",
          color: "#eee",
          opacity: isChromeVisible ? 1 : 0,
          transition: "opacity 180ms ease",
          pointerEvents: "none",
        }}
      >
        <VolumeOffRoundedIcon sx={{ fontSize: 16 }} />
        <Box component="span" sx={{ fontSize: 12 }}>
          Muted
        </Box>
      </Box>

      <video
        ref={videoRef}
        src={videoUrl}
        aria-label={videoFileName}
        muted
        autoPlay
        playsInline
        controls={isChromeVisible}
        onFocus={() => setIsChromeVisible(true)}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          borderRadius: 8,
          backgroundColor: "#000",
        }}
      />
    </Box>
  );
}

export default ChatMsgVideoDisp;

ChatMsgVideoDisp.propTypes = {
  videoData: PropTypes.shape({
    fileName: PropTypes.string,
    url: PropTypes.string,
    videoWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    videoHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  downloadFile: PropTypes.func,
  onClose: PropTypes.func,
};
