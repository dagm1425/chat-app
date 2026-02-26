import React from "react";
import PropTypes from "prop-types";
import {
  Box,
  CircularProgress,
  IconButton,
  Typography,
  Fade,
  Skeleton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import PdfFilePreview from "./PdfFilePreview";

const FileMsg = ({
  message,
  isSentFromUser,
  isMobile,
  fileMsgId,
  setFileMsgId,
  cancelUpload,
  downloadFile,
}) => {
  const fileMsg = message.fileMsg || {};
  const fileName = fileMsg.fileName || "";
  const fileType = fileMsg.fileType || "";
  const fileUrl = fileMsg.fileUrl || "";
  const progress = Number(fileMsg.progress);
  const isUploadComplete =
    Boolean(fileUrl) && (!Number.isFinite(progress) || progress >= 100);
  const isUploadPending = !isUploadComplete;
  const isPdf =
    fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");
  const isPdfUploadComplete = isPdf && isUploadComplete;
  const uploadProgress = Number.isFinite(progress) ? progress : 0;

  const pdfThumbSx = {
    width: { xs: 68, sm: 72 },
    height: { xs: 68, sm: 72 },
    borderRadius: "0.35rem",
    overflow: "hidden",
    position: "relative",
    flexShrink: 0,
    bgcolor: (theme) =>
      theme.palette.mode === "light"
        ? "rgba(11, 20, 26, 0.04)"
        : "rgba(255, 255, 255, 0.06)",
    border: "none",
  };

  const handleOpenPdf = () => {
    if (!fileUrl) return;
    window.open(fileUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: isPdf ? "flex-start" : "center",
          pr: "0.5rem",
          ml: "0.25rem",
          gap: "0.55rem",
          minWidth: { xs: "11.6rem", sm: "12.6rem" },
          maxWidth: "100%",
          minHeight: isPdf ? { xs: "4rem", sm: "4.3rem" } : undefined,
          mb: message.caption !== "" ? "0.125rem" : "0rem",
        }}
      >
        {isPdf ? (
          isPdfUploadComplete ? (
            <PdfFilePreview
              fileUrl={fileUrl}
              onDownload={() => downloadFile(fileUrl, fileName)}
            />
          ) : (
            <Box sx={pdfThumbSx}>
              <Skeleton
                variant="rectangular"
                animation="wave"
                sx={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <Box sx={{ display: "grid" }}>
                  <CircularProgress
                    size={24}
                    sx={{ gridColumn: 1, gridRow: 1, color: "text.secondary" }}
                  />
                  <IconButton
                    sx={{
                      gridColumn: 1,
                      gridRow: 1,
                      p: 0,
                      "&.MuiButtonBase-root:hover": {
                        bgcolor: "transparent",
                      },
                    }}
                    onClick={() => cancelUpload(message.msgId)}
                  >
                    <CloseIcon sx={{ fontSize: "1rem" }} />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          )
        ) : (
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
            {isUploadPending ? (
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
                    onClick={() => downloadFile(fileUrl, fileName)}
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
        )}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            justifyContent: isPdf ? "flex-start" : "center",
            minWidth: 0,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            <Box
              component="span"
              sx={{
                display: "block",
                maxWidth: { xs: "11rem", sm: "12.5rem" },
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {fileName}
            </Box>
          </Typography>
          <Box>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "center",
                columnGap: "0.5rem",
                minWidth: 0,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  fontSize: "0.825rem",
                  minWidth: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {fileMsg.fileSize}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  fontSize: "0.825rem",
                  color: "text.secondary",
                  minWidth: "9ch",
                  textAlign: "right",
                  whiteSpace: "nowrap",
                  fontVariantNumeric: "tabular-nums",
                  visibility: isUploadPending ? "visible" : "hidden",
                }}
              >
                {`${uploadProgress.toFixed(0)}% done`}
              </Typography>
            </Box>
            {isPdf && (
              <Typography
                component="button"
                variant="body2"
                onClick={handleOpenPdf}
                sx={{
                  mt: "0rem",
                  p: 0,
                  border: "none",
                  bgcolor: "transparent",
                  color: "primary.main",
                  fontSize: "0.82rem",
                  fontWeight: 500,
                  textTransform: "uppercase",
                  cursor: isPdfUploadComplete ? "pointer" : "default",
                  textAlign: "left",
                  width: "fit-content",
                  visibility: isPdfUploadComplete ? "visible" : "hidden",
                }}
              >
                Open
              </Typography>
            )}
          </Box>
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
