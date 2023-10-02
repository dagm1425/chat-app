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
  updateDoc,
  // updateDoc,
} from "firebase/firestore";
import { v4 as uuid } from "uuid";
import SendIcon from "@mui/icons-material/Send";
import {
  Box,
  Dialog,
  DialogTitle,
  IconButton,
  Input,
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
  const [message, setMessage] = useState({
    msg: "",
    chat,
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const fileInput = useRef(null);
  const msgInputForm = useRef(null);
  const [file, setFile] = useState(null);
  const [isFileMsgDialogOpen, setIsFileMsgDialogOpen] = useState(false);

  useEffect(() => {
    const listener = (e) => {
      if (
        (e.code === "Enter" || e.code === "NumpadEnter") &&
        e.ctrlKey &&
        e.target.nodeName == "TEXTAREA"
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

  useEffect(() => {
    updateDraft();
    setMessage({ msg: chat.draft ? chat.draft : "", chat });

    return () => {
      updateDraft();
    };
  }, [chatId]);

  const handleSendMsg = async (e) => {
    e.preventDefault();

    if (!message.msg) return;

    const msgId = uuid();
    const msgRef = doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`);
    const lastMmsg = scroll.current.lastElementChild;
    // const chatRef = doc(db, "chats", `${chatId}`);
    const newMsg = {
      msgId,
      from: user,
      msg: message.msg,
      msgReply,
      isMsgRead: chat.type === "private" ? false : [],
      timestamp: serverTimestamp(),
    };

    await setDoc(msgRef, newMsg);

    // await updateDoc(chatRef, {
    //   recentMsg: { ...message, msgReply: null },
    //   unreadMsg: increment(1),
    // });

    if (msgReply) setMsgReply(null);

    lastMmsg.scrollIntoView({ behavior: "smooth" });
    resetDraft();
    setMessage({ ...message, msg: "" });
  };

  const openEmojiPicker = (e) => {
    setAnchorEl(e.currentTarget);
  };

  const closeEmojiPicker = () => {
    setAnchorEl(null);
  };

  const addEmoji = (emojiData) => {
    setMessage({ ...message, msg: message.msg.concat(emojiData.emoji) });
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

  const updateDraft = async () => {
    if (!message.msg && message.chat.draft) {
      resetDraft();
      return;
    } else if (
      message.msg &&
      (!message.chat.draft ||
        (message.chat.draft && message.chat.draft !== message.msg))
    ) {
      await updateDoc(doc(db, "chats", `${message.chat.chatId}`), {
        draft: message.msg,
      });
      return;
    } else return;
  };

  const resetDraft = async () => {
    if (!message.chat.draft) return;

    await updateDoc(doc(db, "chats", `${message.chat.chatId}`), {
      draft: "",
    });
  };

  return (
    <Box
      sx={{
        flex: "0 1 auto",
        position: "sticky",
        bottom: "0",
        py: "0.75rem",
        borderTop: "2px solid",
        borderColor: "background.paper",
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

        <IconButton
          onClick={handleFileSelectClick}
          sx={{
            "&.MuiButtonBase-root:hover": {
              bgcolor: "transparent",
            },
          }}
        >
          <AttachmentIcon />
        </IconButton>

        <Dialog open={isFileMsgDialogOpen} onClose={handleFileMsgDialogClose}>
          <DialogTitle>Send a file</DialogTitle>
          <FileMsgDialogContent
            chat={chat}
            user={user}
            file={file}
            setUploadTask={setUploadTask}
            onClose={handleFileMsgDialogClose}
            msgReply={msgReply}
            setMsgReply={setMsgReply}
            scroll={scroll}
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
                p: "0.5rem 1.25rem",
                boxSizing: "border-box",
                boxShadow:
                  "rgba(50, 50, 93, 0.25) 0px 2px 5px -1px, rgba(0, 0, 0, 0.3) 0px 1px 3px -1px",
                borderRadius: "20px 20px 0 0",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.9em",
                  padding: "0 0.5rem",
                  borderLeft: "4px solid",
                  borderColor: "primary.main",
                  borderTopLeftRadius: "0.25rem",
                  borderBottomLeftRadius: "0.25rem",
                }}
              >
                {msgReply.fileMsg && <InsertDriveFileIcon fontSize="medium" />}
                <div>
                  <Typography
                    variant="body1"
                    sx={{
                      fontSize: "inherit",
                      fontWeight: "bold",
                      lineHeight: "1.125rem",
                    }}
                  >
                    {msgReply.from.displayName}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{ fontSize: "inherit", lineHeight: "1.125rem" }}
                  >
                    {msgReply.msg
                      ? msgReply.msg
                      : msgReply.caption
                      ? msgReply.caption
                      : formatFilename(msgReply.fileMsg.fileName)}
                  </Typography>
                </div>
              </Box>
              <IconButton
                onClick={() => setMsgReply(null)}
                sx={{
                  marginLeft: "auto",
                  "&.MuiButtonBase-root:hover": {
                    bgcolor: "transparent",
                  },
                }}
              >
                <CloseIcon sx={{ marginLeft: "auto" }} />
              </IconButton>
            </Box>
          )}
          <form
            style={{ width: "100%" }}
            onSubmit={handleSendMsg}
            ref={msgInputForm}
          >
            <Input
              value={message.msg}
              onChange={(e) => setMessage({ ...message, msg: e.target.value })}
              placeholder="Message"
              maxRows={3}
              disableUnderline
              sx={{
                bgcolor: "background.paper",
                p: "0.5rem 1.25rem",
                width: "100%",
                border: "none",
                outline: "none",
                resize: "none",
                // boxShadow:
                // "rgba(60, 64, 67, 0.3) 0px 1px 2px 0px, rgba(60, 64, 67, 0.15) 0px 1px 3px 1px",
                borderRadius: msgReply ? "0 0 20px 20px" : "30px",
                boxSizing: "border-box",
              }}
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
