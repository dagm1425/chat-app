/* eslint-disable react/prop-types */
import React from "react";
import {
  Avatar,
  Box,
  CircularProgress,
  Fade,
  IconButton,
  Typography,
} from "@mui/material";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import ChatImg from "./ChatImg";
import { formatDate, formatFilename, formatTime } from "../../common/utils";

function ChatMsg({
  message,
  user,
  chat,
  chatMsg,
  renderMsgDate,
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
  const msgTime = formatTime(message.timestamp);
  const msgDate = formatDate(message.timestamp);
  const isMsgFromOtherPublicChatMembers =
    chat.type === "public" && message.from.uid !== user.uid;

  return (
    <React.Fragment key={message.msgId}>
      {renderMsgDate(msgDate)}
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
                fontSize: "0.825rem",
                fontWeight: "bold",
                mb: message.msgReply || message.fileMsg ? "0.25rem" : "0rem",
                ml: "0.25rem",
              }}
            >
              {message.from.displayName}
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
                  borderTopLeftRadius: "0.25rem",
                  borderBottomLeftRadius: "0.25rem",
                  cursor: "pointer",
                }}
                onClick={() => {
                  scrollToMsg(message);
                }}
              >
                {message.msgReply.fileMsg && (
                  <InsertDriveFileIcon fontSize="small" />
                )}
                <Box sx={{ fontSize: "0.825rem" }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: "inherit",
                      fontWeight: "bold",
                      lineHeight: "1.25em",
                    }}
                  >
                    {message.msgReply.from.displayName}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "inherit" }}>
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
            <Typography variant="body2" sx={{ ml: "0.25rem" }}>
              {message.msg}
            </Typography>
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
                        onClick={() =>
                          // const uploadObj = JSON.parse(
                          //   message.fileMsg.uploadTask
                          // );
                          cancelUpload(message.msgId)
                        }
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
                      containerWidth={scroll.current.offsetWidth}
                      openImgModal={openImgModal}
                      fileName={message.fileMsg.fileName}
                      url={message.fileMsg.fileUrl}
                      caption={message.caption}
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
                          onClick={() =>
                            // const uploadObj = JSON.parse(
                            //   message.fileMsg.uploadTask
                            // );
                            cancelUpload(message.msgId)
                          }
                        >
                          <CloseIcon />
                        </IconButton>
                      </Box>
                    ) : (
                      <Box sx={{ display: "grid" }}>
                        <Fade in={message.msgId === fileMsgId}>
                          <IconButton
                            sx={{
                              p: 0,
                              gridColumn: 1,
                              gridRow: 1,
                              width: 34,
                              height: 34,
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
                                fontSize: "20px",
                                color: "text.primary",
                                "&.MuiButtonBase-root:hover": {
                                  bgcolor: "transparent",
                                },
                              }}
                            />
                          </IconButton>
                        </Fade>
                        <Fade in={message.msgId !== fileMsgId}>
                          <IconButton
                            sx={{
                              p: 0,
                              gridColumn: 1,
                              gridRow: 1,
                              width: 34,
                              height: 34,
                              "&.MuiButtonBase-root:hover": {
                                bgcolor: "transparent",
                              },
                            }}
                          >
                            <InsertDriveFileIcon
                              sx={{
                                fontSize: "20px",
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
    </React.Fragment>
  );
}

export default ChatMsg;
