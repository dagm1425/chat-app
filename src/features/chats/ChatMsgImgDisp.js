/* eslint-disable react/prop-types */
import { Box, IconButton } from "@mui/material";
import React from "react";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

function ChatMsgImgDisp({ imgUrl, downloadFile, onClose }) {
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
                size: "large",
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
              <ZoomInIcon fontSize="large" sx={{ color: "#eee" }} />
            </IconButton>
            <IconButton
              sx={{
                size: "large",
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
              <ZoomOutIcon fontSize="large" sx={{ color: "#eee" }} />
            </IconButton>
            <IconButton
              sx={{
                size: "large",
                opacity: "0.5",
                transition: "opacity 100ms ease-in",

                "&:hover": {
                  opacity: "1",
                },
                "&.MuiButtonBase-root:hover": {
                  bgcolor: "transparent",
                },
              }}
              onClick={(imgUrl) => downloadFile(imgUrl)}
            >
              <DownloadIcon fontSize="large" sx={{ color: "#eee" }} />
            </IconButton>
            <IconButton
              sx={{
                size: "large",
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
              <CloseIcon fontSize="large" sx={{ color: "#eee" }} />
            </IconButton>
          </Box>
          <TransformComponent>
            <img
              src={imgUrl}
              style={{
                width: "100%",
                height: "auto",
              }}
            />
          </TransformComponent>
        </>
      )}
    </TransformWrapper>
  );
}

export default ChatMsgImgDisp;
