import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { db } from "../../firebase";
import { doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
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
  useMediaQuery,
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
  const userDraft = chat.drafts.find((draft) => draft.from.uid === user.uid);
  const [chatDrafts, setChatDrafts] = useState({
    chatId,
    userDraft,
    drafts: chat.drafts,
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const fileInput = useRef(null);
  const msgInputForm = useRef(null);
  const [fileMsg, setFileMsg] = useState(null);
  const [isFileMsgDialogOpen, setIsFileMsgDialogOpen] = useState(false);
  const inputRef = useRef(null);
  const isMobile = useMediaQuery("(max-width: 600px)");

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
    if (document.activeElement !== inputRef.current && !isMobile)
      inputRef.current.focus();
    setChatDrafts({
      chatId,
      userDraft,
      drafts: chat.drafts,
    });
  }, [chatId]);

  useEffect(() => {
    inputRef.current.value = chatDrafts.userDraft
      ? chatDrafts.userDraft.msg
      : "";
  }, [chatDrafts]);

  useEffect(() => {
    if (msgReply) inputRef.current.focus();
  }, [msgReply]);

  const handleSendMsg = async (e) => {
    e.preventDefault();

    if (!inputRef.current.value) return;

    const msg = inputRef.current.value;
    const msgId = uuid();
    const msgRef = doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`);
    const msgList = scroll.current.children;
    const i = isMobile ? msgList.length - 1 : msgList.length - 2;
    const lastMmsg = msgList.item(i);
    const chatRef = doc(db, "chats", `${chatId}`);
    let unreadCounts = { ...chat.unreadCounts };
    const newMsg = {
      msgId,
      type: "text",
      from: user,
      msg,
      msgReply,
      isMsgRead: chat.type === "private" ? false : [],
      timestamp: serverTimestamp(),
    };

    inputRef.current.value = "";
    if (msgReply) setMsgReply(null);
    lastMmsg.scrollIntoView({ behavior: "smooth" });

    await setDoc(msgRef, newMsg);
    delete newMsg.msgReply;
    await updateDoc(chatRef, { recentMsg: newMsg });
    await updateDoc(chatRef, { timestamp: newMsg.timestamp });

    for (const uid in unreadCounts) {
      if (uid !== user.uid) {
        unreadCounts[uid]++;
      }
    }

    await updateDoc(chatRef, { unreadCounts });
    resetDraft();
  };

  const openEmojiPicker = (e) => {
    setAnchorEl(e.currentTarget);
  };

  const closeEmojiPicker = () => {
    setAnchorEl(null);
  };

  const addEmoji = (emojiData) => {
    inputRef.current.value = inputRef.current.value.concat(emojiData.emoji);
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

  const getImageSize = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = function (e) {
        const img = new Image();
        img.src = e.target.result;

        img.onload = function () {
          const width = this.width;
          const height = this.height;
          resolve({ width, height });
        };
      };

      reader.readAsDataURL(file);
    });
  };

  const handleFileSize = (file) => {
    const MAX_FILE_SIZE = 5000000;
    if (file.size > MAX_FILE_SIZE) {
      alert("File size should not exceed 5 MB");
      resetFileInput();
      throw new Error("File size exceeds the limit");
    }
  };

  const resetFileInput = () => {
    fileInput.current.value = "";
  };

  const getFileData = async (file) => {
    if (file.type.includes("image")) {
      const dimensions = await getImageSize(file);
      return { file, imgSize: dimensions };
    } else {
      return { file };
    }
  };

  const reviewFileMsg = async (e) => {
    try {
      e.preventDefault();

      const file = e.target.files[0];

      handleFileSize(file);
      const fileData = await getFileData(file);

      setFileMsg(fileData);
      resetFileInput();
      handleFileMsgDialogOpen();
    } catch (error) {
      console.error("Error processing file:", error.message);
    }
  };

  const updateDraft = async () => {
    if (!inputRef.current.value) {
      resetDraft();
      return;
    } else if (inputRef.current.value) {
      let draftsUpdate;

      if (!chatDrafts.userDraft) {
        draftsUpdate = [
          ...chatDrafts.drafts,
          { from: user, msg: inputRef.current.value },
        ];
      } else if (
        chatDrafts.userDraft &&
        chatDrafts.userDraft.msg !== inputRef.current.value
      ) {
        draftsUpdate = chatDrafts.drafts.map((draft) => {
          if (draft.from.uid === user.uid) {
            return { ...draft, msg: inputRef.current.value };
          } else return draft;
        });
      }

      if (draftsUpdate)
        await updateDoc(doc(db, "chats", `${chatDrafts.chatId}`), {
          drafts: draftsUpdate,
        });
      return;
    } else return;
  };

  const resetDraft = async () => {
    if (chatDrafts.userDraft) {
      const draftsUpdate = chatDrafts.drafts.filter(
        (draft) => draft.from.uid !== user.uid
      );
      await updateDoc(doc(db, "chats", `${chatDrafts.chatId}`), {
        drafts: draftsUpdate,
      });
      return;
    } else return;
  };

  return (
    <Box
      sx={{
        flex: "0 1 auto",
        position: { xs: "fixed", sm: "sticky" },
        width: { xs: "100%", sm: "initial" },
        bottom: "0",
        py: "0.75rem",
        bgcolor: "background.default",
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
          gap: { xs: "0.25rem", sm: "0.75rem" },
        }}
      >
        <IconButton
          sx={{
            mr: { xs: "-0.625rem", sm: "-0.75rem" },
            "&.MuiButtonBase-root:hover": {
              bgcolor: "transparent",
            },
          }}
          onClick={openEmojiPicker}
        >
          <EmojiEmotionsIcon />
        </IconButton>

        {Boolean(anchorEl) && (
          <Popover
            anchorEl={anchorEl}
            keepMounted
            open={Boolean(anchorEl)}
            onClose={closeEmojiPicker}
          >
            <EmojiPicker onEmojiClick={addEmoji} lazyLoadEmojis={true} />
          </Popover>
        )}

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

        <Dialog
          open={isFileMsgDialogOpen}
          onClose={handleFileMsgDialogClose}
          disableRestoreFocus
        >
          <DialogTitle sx={{ fontWeight: "normal" }}>Send a file</DialogTitle>
          <FileMsgDialogContent
            chat={chat}
            user={user}
            fileMsg={fileMsg}
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
                    {msgReply.from.uid === user.uid
                      ? "You"
                      : msgReply.from.displayName}
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
            <TextareaAutosize
              sx={{
                fontFamily: "inherit",
                color: "text.primary",
                bgcolor: "background.paper",
                p: "0.725rem 1.25rem",
                mb: "-8px",
                width: "100%",
                border: "none",
                outline: "none",
                resize: "none",
                borderRadius: msgReply ? "0 0 20px 20px" : "30px",
                boxSizing: "border-box",
              }}
              ref={inputRef}
              placeholder="Message"
              maxRows={3}
            />
          </form>
        </Box>

        <IconButton
          sx={{
            "&.MuiButtonBase-root:hover": {
              bgcolor: "transparent",
            },
          }}
          onClick={() => msgInputForm.current.requestSubmit()}
        >
          <SendIcon />
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
