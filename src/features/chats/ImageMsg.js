import React from "react";
import PropTypes from "prop-types";
import { Box, CircularProgress, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ChatImg from "./ChatImg";

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
  const hasImageUrl = !!fileMsg.fileUrl;

  return (
    <>
      {!hasImageUrl ? (
        <Box
          sx={{
            display: "grid",
            placeItems: "center",
            m: "0 auto 0.25rem",
          }}
        >
          <Box sx={{ display: "grid" }}>
            <CircularProgress sx={{ gridColumn: 1, gridRow: 1 }} />
            <IconButton
              sx={{ gridColumn: 1, gridRow: 1 }}
              onClick={() => cancelUpload(message.msgId)}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      ) : (
        <>
          <ChatImg
            src={fileMsg.fileUrl}
            chatId={chatId}
            width={fileMsg.imgWidth}
            height={fileMsg.imgHeight}
            containerWidth={
              isMobile ? screen.width : scroll?.current?.offsetWidth
            }
            openImgModal={openImgModal}
            fileName={fileMsg.fileName}
            url={fileMsg.fileUrl}
          />
        </>
      )}
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
