import React from "react";
import PropTypes from "prop-types";
import { Box, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

function ChatMsgImgDisp({ imgData, downloadFile, onClose }) {
  return (
    <TransformWrapper disablePadding={true}>
      {({ zoomIn, zoomOut }) => (
        <>
          <Box
            sx={{
              position: "absolute",
              top: "4%",
              right: "4%",
            }}
          >
            <IconButton
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
              onClick={() => zoomIn()}
            >
              <ZoomInIcon fontSize="medium" sx={{ color: "#eee" }} />
            </IconButton>
            <IconButton
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
              onClick={() => zoomOut()}
            >
              <ZoomOutIcon fontSize="medium" sx={{ color: "#eee" }} />
            </IconButton>
            <IconButton
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
              onClick={(imgData) => downloadFile(imgData.url)}
            >
              <DownloadIcon fontSize="medium" sx={{ color: "#eee" }} />
            </IconButton>
            <IconButton
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
              <CloseIcon fontSize="medium" sx={{ color: "#eee" }} />
            </IconButton>
          </Box>
          <TransformComponent>
            <img
              src={imgData.url}
              style={{
                maxWidth: "80%",
                height: "auto",
                margin: "0 auto",
              }}
            />
          </TransformComponent>
        </>
      )}
    </TransformWrapper>
  );
}

export default ChatMsgImgDisp;

ChatMsgImgDisp.propTypes = {
  imgData: PropTypes.shape({
    fileName: PropTypes.string,
    url: PropTypes.string,
  }),
  downloadFile: PropTypes.func,
  onClose: PropTypes.func,
};
