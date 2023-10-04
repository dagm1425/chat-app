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
  TextareaAutosize,
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
import styled from "styled-components";

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
    const msgList = scroll.current.children;
    const lastMmsg = msgList.item(msgList.length - 2);
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
          <DialogTitle sx={{ fontWeight: "normal" }}>Send a file</DialogTitle>
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
                bgcolor: "background.paper",
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "0.75rem",
                px: "1.25rem",
                pt: "0.5rem",
                boxSizing: "border-box",
                borderRadius: "20px 20px 0 0",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.9em",
                  px: "0.5rem",
                  borderLeft: "4px solid",
                  borderColor: "primary.main",
                  borderTopLeftRadius: "0.25rem",
                  borderBottomLeftRadius: "0.25rem",
                }}
              >
                {msgReply.fileMsg && <InsertDriveFileIcon fontSize="small" />}
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
            <StyledTextarea
              value={message.msg}
              onChange={(e) => setMessage({ ...message, msg: e.target.value })}
              placeholder="Message"
              $msgreply={msgReply}
              maxRows={3}
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

const StyledTextarea = styled(TextareaAutosize)`
  font: inherit;
  color: ${({ theme }) => theme.palette.text.primary};
  background-color: ${({ theme }) => theme.palette.background.paper};
  padding: 0.725rem 1.25rem;
  margin-bottom: -8px;
  width: 100%;
  border: none;
  outline: none;
  resize: none;
  border-radius: ${(props) => (props.$msgreply ? "0 0 20px 20px" : "30px")};
  box-sizing: border-box;
`;

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
