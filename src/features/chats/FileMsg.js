import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  CircularProgress,
  IconButton,
  Typography,
  Fade,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { formatFilename } from "../../common/utils"; // Assuming formatFilename is in utils

const FileMsg = ({
  message,
  isSentFromUser,
  isMobile,
  fileMsgId,
  setFileMsgId,
  cancelUpload,
  downloadFile,
}) => {
  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          pr: "0.5rem",
          ml: "0.25rem",
          gap: "0.625rem",
          mb: message.caption !== "" ? "0.125rem" : "0rem",
        }}
      >
        <Box
          sx={{
            display: "grid",
            placeItems: "center",
            width: 40,
            height: 40,
            bgcolor: isSentFromUser ? "primary.light" : "background.default",
            filter: "brightness(0.875)",
            border: "none",
            borderRadius: "50%",
          }}
          onMouseOver={() => setFileMsgId(message.msgId)}
          onMouseOut={() => setFileMsgId("")}
        >
          {message.fileMsg.progress != 100 ? (
            <Box sx={{ display: "grid" }}>
              <CircularProgress sx={{ gridColumn: 1, gridRow: 1 }} />
              <IconButton
                sx={{
                  gridColumn: 1,
                  gridRow: 1,
                  "&.MuiButtonBase-root:hover": {
                    bgcolor: "transparent",
                  },
                }}
                onClick={() => cancelUpload(message.msgId)}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          ) : (
            <Box sx={{ display: "grid" }}>
              <Fade in={isMobile ? true : message.msgId === fileMsgId}>
                <IconButton
                  sx={{
                    gridColumn: 1,
                    gridRow: 1,
                    "&.MuiButtonBase-root:hover": {
                      bgcolor: "transparent",
                    },
                  }}
                  onClick={() =>
                    downloadFile(
                      message.fileMsg.fileUrl,
                      message.fileMsg.fileName
                    )
                  }
                >
                  <DownloadIcon
                    sx={{
                      fontSize: "1.425rem",
                      color: "text.primary",
                      "&.MuiButtonBase-root:hover": {
                        bgcolor: "transparent",
                      },
                    }}
                  />
                </IconButton>
              </Fade>
              <Fade in={isMobile ? false : message.msgId !== fileMsgId}>
                <IconButton
                  sx={{
                    gridColumn: 1,
                    gridRow: 1,
                    "&.MuiButtonBase-root:hover": {
                      bgcolor: "transparent",
                    },
                  }}
                >
                  <InsertDriveFileIcon
                    sx={{
                      fontSize: "1.425rem",
                      color: "text.primary",
                      "&.MuiButtonBase-root:hover": {
                        bgcolor: "transparent",
                      },
                    }}
                  />
                </IconButton>
              </Fade>
            </Box>
          )}
        </Box>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: "bold" }}>
            {formatFilename(message.fileMsg.fileName)}
          </Typography>
          <div>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                fontSize: "0.825rem",
              }}
            >
              {message.fileMsg.fileSize}
              {message.fileMsg.progress != 100 && (
                <Typography
                  component="span"
                  variant="body2"
                  sx={{
                    fontSize: "0.825rem",
                    color: "text.secondary",
                    ml: "0.5rem",
                  }}
                >
                  {`${message.fileMsg.progress.toFixed(0)}% done`}
                </Typography>
              )}
            </Typography>
          </div>
        </Box>
      </Box>
      <Typography variant="body2" sx={{ ml: "0.25rem" }}>
        {message.caption}
      </Typography>
    </>
  );
};

FileMsg.propTypes = {
  message: PropTypes.object.isRequired,
  isSentFromUser: PropTypes.bool.isRequired,
  isMobile: PropTypes.bool.isRequired,
  fileMsgId: PropTypes.string,
  setFileMsgId: PropTypes.func.isRequired,
  cancelUpload: PropTypes.func.isRequired,
  downloadFile: PropTypes.func.isRequired,
};

export default FileMsg;
