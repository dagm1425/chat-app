import React from "react";
import PropTypes from "prop-types";
import {
  Avatar,
  Box,
  CircularProgress,
  Fade,
  IconButton,
  Typography,
  useMediaQuery,
} from "@mui/material";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import ChatImg from "./ChatImg";
import { formatFilename, formatTime } from "../../common/utils";
import { isLink } from "../../common/utils";
import ChatMsgLink from "./ChatMsgLink";

function ChatMsg({
  message,
  user,
  chat,
  chatMsg,
  fileMsgId,
  setFileMsgId,
  renderReadSign,
  handleMsgClick,
  openImgModal,
  cancelUpload,
  downloadFile,
  scroll,
  scrollToMsg,
}) {
  const isSentFromUser = message.from.uid === user.uid;
  const isMsgFromOtherPublicChatMembers =
    chat.type === "public" && message.from.uid !== user.uid;
  const msgTime = formatTime(message.timestamp);
  const isMobile = useMediaQuery("(max-width:600px)");

  return (
    <Box
      id={message.msgId}
      sx={{
        display: isMsgFromOtherPublicChatMembers ? "flex" : "block",
        gap: isMsgFromOtherPublicChatMembers ? "0.5rem" : "block",
        alignSelf: isSentFromUser ? "flex-end" : "flex-start",
        width: "fit-content",
        maxWidth: { xs: "75%", sm: "45%" },
      }}
    >
      {isMsgFromOtherPublicChatMembers && (
        <Avatar
          src={message.from.photoURL}
          sx={{ width: 28, height: 28, alignSelf: "flex-end" }}
        />
      )}
      <Box
        onClick={handleMsgClick}
        onContextMenu={handleMsgClick}
        sx={{
          padding: "0.5rem 0.5rem 0.25rem",
          mb: "0.75rem",
          bgcolor: isSentFromUser ? "primary.light" : "background.default",
          borderRadius: isSentFromUser
            ? "1.125rem 1.125rem 0 1.125rem"
            : "1.125rem 1.125rem 1.125rem 0",
          boxSizing: "border-box",
          boxShadow: 2,
        }}
      >
        {isMsgFromOtherPublicChatMembers && (
          <Typography
            variant="body2"
            sx={{
              fontSize: "0.75rem",
              fontWeight: "bold",
              mb: message.msgReply || message.fileMsg ? "0.25rem" : "0rem",
              ml: "0.25rem",
            }}
          >
            {message.from.uid === user.uid ? "You" : message.from.displayName}
          </Typography>
        )}
        {message.msgReply &&
          chatMsg.find((msg) => msg.msgId === message.msgReply.msgId) && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                px: "0.5rem",
                mb: "0.25rem",
                ml: "0.25rem",
                borderLeft: "4px solid",
                borderColor: "primary.main",
                borderRadius: "0.25rem",
                bgcolor: "inherit",
                filter: (theme) =>
                  theme.palette.mode === "light"
                    ? "brightness(0.94)"
                    : "brightness(1.15)",
                py: "0.125rem",
                cursor: "pointer",
                boxShadow: 2,
              }}
              onClick={() => {
                scrollToMsg(message);
              }}
            >
              {message.msgReply.fileMsg && (
                <InsertDriveFileIcon fontSize="small" />
              )}
              <Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: "0.75rem",
                    fontWeight: "500",
                    lineHeight: "1.25em",
                  }}
                >
                  {message.msgReply.from.uid === user.uid
                    ? "You"
                    : message.msgReply.from.displayName}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: "0.825rem" }}>
                  {message.msgReply.msg
                    ? message.msgReply.msg
                    : message.msgReply.caption
                    ? message.msgReply.caption
                    : formatFilename(message.msgReply.fileMsg.fileName)}
                </Typography>
              </Box>
            </Box>
          )}
        {message.msg ? (
          isLink(message.msg) ? (
            <ChatMsgLink
              url={message.msg}
              containerWidth={
                isMobile ? window.innerWidth : scroll.current.offsetWidth
              }
            />
          ) : (
            <Typography variant="body2" sx={{ ml: "0.25rem" }}>
              {message.msg}
            </Typography>
          )
        ) : (
          <>
            {message.fileMsg.fileType.includes("image") ? (
              message.fileMsg.progress != 100 ? (
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
                    src={message.fileMsg.fileUrl}
                    width={message.fileMsg.imgWidth}
                    height={message.fileMsg.imgHeight}
                    containerWidth={
                      isMobile ? screen.width : scroll.current.offsetWidth
                    }
                    openImgModal={openImgModal}
                    fileName={message.fileMsg.fileName}
                    url={message.fileMsg.fileUrl}
                  />
                </>
              )
            ) : (
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
                    bgcolor: isSentFromUser
                      ? "primary.light"
                      : "background.default",
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
            )}
            <Typography variant="body2" sx={{ ml: "0.25rem" }}>
              {message.caption}
            </Typography>
          </>
        )}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.375rem",
            fontSize: 10,
            color: "text.secondary",
            ml: "1rem",
            pr: renderReadSign(message) ? "0rem" : "0.25rem",
          }}
        >
          <Typography variant="body2" sx={{ font: "inherit" }}>
            {msgTime}
          </Typography>
          {renderReadSign(message)}
        </Box>
      </Box>
    </Box>
  );
}

export default ChatMsg;

ChatMsg.propTypes = {
  message: PropTypes.object,
  chat: PropTypes.object,
  user: PropTypes.shape({
    uid: PropTypes.string,
    displayName: PropTypes.string,
    photoURL: PropTypes.string,
  }),
  chatMsg: PropTypes.arrayOf(
    PropTypes.shape({
      msgId: PropTypes.string.isRequired,
    })
  ),
  fileMsgId: PropTypes.string,
  setFileMsgId: PropTypes.func,
  renderReadSign: PropTypes.func,
  handleMsgClick: PropTypes.func,
  openImgModal: PropTypes.func,
  cancelUpload: PropTypes.func,
  downloadFile: PropTypes.func,
  scroll: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]),
  scrollToMsg: PropTypes.func,
};
