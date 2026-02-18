import React from "react";
import PropTypes from "prop-types";
import { Avatar, Box, Typography, useMediaQuery } from "@mui/material";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { formatFilename, formatTime } from "../../common/utils";
import TextMsg from "./TextMsg";
import ImageMsg from "./ImageMsg";
import VideoMsg from "./VideoMsg";
import FileMsg from "./FileMsg";
import CallMsg from "./CallMsg";

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
  openVideoModal,
  cancelUpload,
  downloadFile,
  scroll,
  scrollToMsg,
  makeCall,
  isActive,
}) {
  const isSentFromUser = message.from.uid === user.uid;
  const isMsgFromOtherPublicChatMembers =
    chat.type === "public" && message.from.uid !== user.uid;
  const senderInfo =
    chat.members?.find((member) => member.uid === message.from.uid) ||
    message.from;
  const senderDisplayName = senderInfo?.displayName || message.from.displayName;
  const senderPhotoURL = senderInfo?.photoURL || message.from.photoURL;
  const msgTime = formatTime(message.timestamp);
  const isMobile = useMediaQuery("(max-width:600px)");
  const forwardedFrom = message.forwardedFrom || null;
  const shouldShowForwardedMeta = !!(
    message.isForwarded &&
    forwardedFrom &&
    forwardedFrom.displayName
  );

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
          src={senderPhotoURL}
          sx={{ width: 28, height: 28, alignSelf: "flex-end" }}
        />
      )}
      <Box
        onClick={handleMsgClick}
        onContextMenu={handleMsgClick}
        sx={{
          p:
            message.type === "call"
              ? "0 0.325rem 0 0"
              : "0.5rem 0.5rem 0.25rem",
          mb: "0.75rem",
          bgcolor: isSentFromUser ? "primary.light" : "background.default",
          borderRadius: isSentFromUser
            ? "1.125rem 1.125rem 0 1.125rem"
            : "1.125rem 1.125rem 1.125rem 0",
          boxSizing: "border-box",
          boxShadow: (theme) =>
            theme.palette.mode === "light"
              ? "0 1px 0.5px rgba(11, 20, 26, 0.13), 0 2px 3px rgba(11, 20, 26, 0.08)"
              : "0 1px 0.5px rgba(0, 0, 0, 0.36), 0 2px 4px rgba(0, 0, 0, 0.24)",
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
            {message.from.uid === user.uid ? "You" : senderDisplayName}
          </Typography>
        )}
        {shouldShowForwardedMeta && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              ml: "0.25rem",
              mb: "0.25rem",
            }}
          >
            <Avatar
              src={forwardedFrom.photoURL}
              sx={{ width: 18, height: 18, fontSize: "0.625rem" }}
            />
            <Typography
              variant="body2"
              sx={{
                fontSize: "0.775rem",
                color: "primary.main",
                fontWeight: 500,
                lineHeight: 1.2,
              }}
            >
              Forwarded from {forwardedFrom.displayName}
            </Typography>
          </Box>
        )}
        {message.msgReply &&
          chatMsg.find((msg) => msg.msgId === message.msgReply.msgId) && (
            <MsgReply message={message} user={user} scrollToMsg={scrollToMsg} />
          )}
        {message.type === "text" && <TextMsg message={message} />}
        {message.type === "image" && (
          <ImageMsg
            message={message}
            chatId={chat.chatId}
            isMobile={isMobile}
            screen={screen}
            scroll={scroll}
            openImgModal={openImgModal}
            cancelUpload={cancelUpload}
          />
        )}
        {message.type === "video" && (
          <VideoMsg
            message={message}
            isMobile={isMobile}
            containerWidth={
              isMobile
                ? typeof window !== "undefined"
                  ? window.innerWidth
                  : 360
                : scroll?.current?.offsetWidth
            }
            cancelUpload={cancelUpload}
            openVideoModal={openVideoModal}
            isActive={isActive}
          />
        )}
        {message.type === "file" && (
          <FileMsg
            message={message}
            isSentFromUser={isSentFromUser}
            isMobile={isMobile}
            fileMsgId={fileMsgId}
            setFileMsgId={setFileMsgId}
            cancelUpload={cancelUpload}
            downloadFile={downloadFile}
          />
        )}
        {message.type === "call" && (
          <CallMsg message={message} makeCall={makeCall} />
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
            pr: renderReadSign(message) ? "0rem" : "0.325rem",
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
  openVideoModal: PropTypes.func,
  cancelUpload: PropTypes.func,
  downloadFile: PropTypes.func,
  scroll: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]),
  scrollToMsg: PropTypes.func,
  makeCall: PropTypes.func.isRequired,
  isActive: PropTypes.bool.isRequired,
};

function MsgReply({ message, user, scrollToMsg }) {
  const replyText = message.msgReply.msg
    ? message.msgReply.msg
    : message.msgReply.caption
    ? message.msgReply.caption
    : message.msgReply.type === "video"
    ? "Video"
    : formatFilename(message.msgReply.fileMsg.fileName);

  return (
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
      {message.msgReply.fileMsg && <InsertDriveFileIcon fontSize="small" />}
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
          {replyText}
        </Typography>
      </Box>
    </Box>
  );
}

MsgReply.propTypes = {
  message: PropTypes.object.isRequired,
  user: PropTypes.shape({
    uid: PropTypes.string,
    displayName: PropTypes.string,
    photoURL: PropTypes.string,
  }).isRequired,
  scrollToMsg: PropTypes.func.isRequired,
};
