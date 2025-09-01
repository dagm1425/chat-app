import React from "react";
import PropTypes from "prop-types";
import { Avatar, Box, Typography, useMediaQuery } from "@mui/material";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import { formatFilename, formatTime } from "../../common/utils";
import TextMsg from "./TextMsg";
import ImageMsg from "./ImageMsg";
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
  cancelUpload,
  downloadFile,
  scroll,
  scrollToMsg,
  makeCall,
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
          boxShadow:
            "rgba(0, 0, 0, 0.12) 0px 1px 3px, rgba(0, 0, 0, 0.24) 0px 1px 2px;",
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
            <MsgReply message={message} user={user} scrollToMsg={scrollToMsg} />
          )}
        {message.type === "text" && (
          <TextMsg message={message} isMobile={isMobile} scroll={scroll} />
        )}
        {message.type === "image" && (
          <ImageMsg
            message={message}
            isMobile={isMobile}
            screen={screen}
            scroll={scroll}
            openImgModal={openImgModal}
            cancelUpload={cancelUpload}
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
  cancelUpload: PropTypes.func,
  downloadFile: PropTypes.func,
  scroll: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]),
  scrollToMsg: PropTypes.func,
  makeCall: PropTypes.func.isRequired,
};

function MsgReply({ message, user, scrollToMsg }) {
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
          {message.msgReply.msg
            ? message.msgReply.msg
            : message.msgReply.caption
            ? message.msgReply.caption
            : formatFilename(message.msgReply.fileMsg.fileName)}
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
