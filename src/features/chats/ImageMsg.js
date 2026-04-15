import React, { useMemo } from "react";
import PropTypes from "prop-types";
import { Box, CircularProgress, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChatImg from "./ChatImg";
import { getLocalImagePreview } from "./localImagePreviewCache";

const ImageMsg = ({
  message,
  chatId,
  isMobile,
  screen,
  scroll,
  openImgModal,
  cancelUpload,
}) => {
  const fileMsg = message.fileMsg || {};
  const msgId = message.msgId;
  const hasImageUrl = !!fileMsg.fileUrl;
  const effectivePreviewSrc = useMemo(
    () => getLocalImagePreview(msgId),
    [msgId]
  );

  return (
    <>
      <Box sx={{ position: "relative", width: "fit-content" }}>
        <ChatImg
          previewSrc={effectivePreviewSrc}
          src={fileMsg.fileUrl}
          chatId={chatId}
          width={fileMsg.imgWidth}
          height={fileMsg.imgHeight}
          containerWidth={
            isMobile ? screen.width : scroll?.current?.offsetWidth
          }
          openImgModal={hasImageUrl ? openImgModal : undefined}
          fileName={fileMsg.fileName}
          url={fileMsg.fileUrl}
        />
        {!hasImageUrl && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
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
                bgcolor: "rgba(68, 72, 79, 0.68)",
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
          </Box>
        )}
      </Box>
      <Typography variant="body2" sx={{ ml: "0.25rem" }}>
        {message.caption}
      </Typography>
    </>
  );
};

ImageMsg.propTypes = {
  message: PropTypes.object.isRequired,
  chatId: PropTypes.string,
  isMobile: PropTypes.bool.isRequired,
  screen: PropTypes.object.isRequired, // Assuming 'screen' is a window.screen object or similar
  scroll: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]),
  openImgModal: PropTypes.func.isRequired,
  cancelUpload: PropTypes.func.isRequired,
};

export default ImageMsg;
