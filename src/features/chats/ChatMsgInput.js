import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { db } from "../../firebase";
import {
  doc,
  // increment,
  // updateDoc,
  // arrayUnion,
  serverTimestamp,
  // getDoc,
  setDoc,
  // updateDoc,
} from "firebase/firestore";
import { v4 as uuid } from "uuid";
import SendIcon from "@mui/icons-material/Send";
import {
  Box,
  Dialog,
  DialogTitle,
  IconButton,
  Popover,
  Typography,
} from "@mui/material";
import AttachmentIcon from "@mui/icons-material/Attachment";
import EmojiPicker from "emoji-picker-react";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";
import FileMsgDialogContent from "./FileMsgDialogContent";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CloseIcon from "@mui/icons-material/Close";
import { formatFilename } from "../../common/utils";

function ChatMsgInput({ chat, setUploadTask, msgReply, setMsgReply, scroll }) {
  const user = useSelector(selectUser);
  const chatId = chat.chatId;
  const [msg, setMsg] = useState("");
  const [anchorEl, setAnchorEl] = useState(null);
  const fileInput = useRef(null);
  const msgInputForm = useRef(null);
  const [file, setFile] = useState(null);
  const [isFileMsgDialogOpen, setIsFileMsgDialogOpen] = useState(false);

  useEffect(() => {
    const listener = (e) => {
      if (
        (e.code === "Enter" || e.code === "NumpadEnter") &&
        e.target.nodeName == "INPUT" &&
        e.target.type == "text"
      ) {
        e.preventDefault();
        msgInputForm.current.requestSubmit();
      }
    };

    document.addEventListener("keydown", listener);

    return () => {
      document.removeEventListener("keydown", listener);
    };
  }, []);

  const handleSendMsg = async (e) => {
    e.preventDefault();

    if (msg === "") return;

    const msgId = uuid();
    const msgRef = doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`);
    const lastMmsg = scroll.current.lastElementChild;
    // const chatRef = doc(db, "chats", `${chatId}`);
    const message = {
      msgId,
      from: user,
      msg: msg,
      msgReply,
      isMsgRead: chat.type === "private" ? false : [],
      timestamp: serverTimestamp(),
    };

    await setDoc(msgRef, message);

    // await updateDoc(chatRef, {
    //   recentMsg: { ...message, msgReply: null },
    //   unreadMsg: increment(1),
    // });

    if (msgReply) setMsgReply(null);

    lastMmsg.scrollIntoView({ behavior: "smooth" });

    setMsg("");
  };

  const openEmojiPicker = (e) => {
    setAnchorEl(e.currentTarget);
  };

  const closeEmojiPicker = () => {
    setAnchorEl(null);
  };

  const addEmoji = (emojiData) => {
    setMsg(msg + emojiData.emoji);
    closeEmojiPicker();
  };

  const handleFileSelectClick = () => {
    fileInput.current.click();
  };

  const handleFileMsgDialogOpen = () => {
    setIsFileMsgDialogOpen(true);
  };

  const handleFileMsgDialogClose = () => {
    setIsFileMsgDialogOpen(false);
    fileInput.current.value = "";
  };

  const reviewFileMsg = async (e) => {
    e.preventDefault();

    const file = e.target.files[0];
    const maxFileSize = 5000000;

    if (file.size > maxFileSize) {
      alert("File size should not exceed 5 MB");
      fileInput.current.value = "";
      return;
    }

    setFile(file);
    handleFileMsgDialogOpen();
  };

  return (
    <Box
      sx={{
        flex: "0 1 auto",
        position: "sticky",
        bottom: "0",
        bgcolor: "#eee",
        py: "1.5rem",
      }}
    >
      <Box
        sx={{
          height: "100%",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",

          fontSize: "1.125rem",

          // mt: "1rem",
        }}
      >
        <IconButton
          sx={{
            size: "large",
            "&.MuiButtonBase-root:hover": {
              bgcolor: "transparent",
            },
          }}
          onClick={openEmojiPicker}
        >
          <EmojiEmotionsIcon sx={{ fontSize: "inherit" }} />
        </IconButton>

        <Popover
          anchorEl={anchorEl}
          keepMounted
          open={Boolean(anchorEl)}
          onClose={closeEmojiPicker}
        >
          <EmojiPicker onEmojiClick={addEmoji} />
        </Popover>

        <input
          type="file"
          id="fileElem"
          onChange={reviewFileMsg}
          style={{ display: "none" }}
          ref={fileInput}
        />

        <IconButton onClick={handleFileSelectClick}>
          <AttachmentIcon />
        </IconButton>

        <Dialog open={isFileMsgDialogOpen} onClose={handleFileMsgDialogClose}>
          <DialogTitle>Send as a file</DialogTitle>
          <FileMsgDialogContent
            chat={chat}
            user={user}
            file={file}
            setUploadTask={setUploadTask}
            onClose={handleFileMsgDialogClose}
            msgReply={msgReply}
            setMsgReply={setMsgReply}
          ></FileMsgDialogContent>
        </Dialog>

        <Box
          sx={{
            width: "65%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {msgReply && (
            <Box
              sx={{
                width: "100%",
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "0.75rem",
                background: "#fff",
                p: "0.5rem 1.25rem",
                boxSizing: "border-box",
                boxShadow:
                  "rgba(50, 50, 93, 0.25) 0px 2px 5px -1px, rgba(0, 0, 0, 0.3) 0px 1px 3px -1px",
                borderRadius: "30px 30px 0 0",
              }}
            >
              {msgReply.fileMsg && <InsertDriveFileIcon fontSize="medium" />}
              <div>
                <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                  {msgReply.from.displayName}
                </Typography>
                <Typography variant="subtitle1">
                  {msgReply.msg
                    ? msgReply.msg
                    : msgReply.caption
                    ? msgReply.caption
                    : formatFilename(msgReply.fileMsg.fileName)}
                </Typography>
              </div>
              <IconButton onClick={() => setMsgReply(null)}>
                <CloseIcon />
              </IconButton>
            </Box>
          )}
          <form
            style={{ width: "100%" }}
            onSubmit={handleSendMsg}
            ref={msgInputForm}
          >
            <input
              type="text"
              placeholder="Message"
              value={msg}
              onChange={(e) => setMsg(e.target.value)}
              style={{
                font: "inherit",
                padding: "1rem 1.25rem",
                // margin: "0 auto",
                width: "100%",
                border: "none",
                outline: "none",
                boxShadow:
                  "rgba(50, 50, 93, 0.25) 0px 2px 5px -1px, rgba(0, 0, 0, 0.3) 0px 1px 3px -1px",
                borderRadius: msgReply ? "0 0 30px 30px" : "30px",
                boxSizing: "border-box",
              }}
              autoFocus
            />
          </form>
        </Box>

        <IconButton
          size="large"
          sx={{
            "&.MuiButtonBase-root:hover": {
              bgcolor: "transparent",
            },
          }}
          onClick={() => msgInputForm.current.requestSubmit()}
        >
          <SendIcon fontSize="inherit" />
        </IconButton>
      </Box>
    </Box>
  );
}

export default ChatMsgInput;

ChatMsgInput.propTypes = {
  chat: PropTypes.object,
  setUploadTask: PropTypes.func,
  msgReply: PropTypes.object,
  setMsgReply: PropTypes.func,
  scroll: PropTypes.oneOfType([
    PropTypes.func,
    PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
  ]),
};
