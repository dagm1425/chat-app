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
  const userDraft = chat.drafts.find((draft) => draft.from.uid === user.uid);
  const [chatDrafts, setChatDrafts] = useState({
    chatId,
    userDraft,
    drafts: chat.drafts,
  });
  const [anchorEl, setAnchorEl] = useState(null);
  const fileInput = useRef(null);
  const msgInputForm = useRef(null);
  const [file, setFile] = useState(null);
  const [isFileMsgDialogOpen, setIsFileMsgDialogOpen] = useState(false);
  const inputRef = useRef(null);

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
    if (document.activeElement !== inputRef.current) inputRef.current.focus();
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

  const handleSendMsg = async (e) => {
    e.preventDefault();

    if (!inputRef.current.value) return;

    const msgId = uuid();
    const msgRef = doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`);
    const msgList = scroll.current.children;
    const lastMmsg = msgList.item(msgList.length - 2);
    const chatRef = doc(db, "chats", `${chatId}`);
    let unreadCounts = { ...chat.unreadCounts };

    const newMsg = {
      msgId,
      from: user,
      msg: inputRef.current.value,
      msgReply,
      isMsgRead: chat.type === "private" ? false : [],
      timestamp: serverTimestamp(),
    };

    for (const uid in unreadCounts) {
      if (uid !== user.uid) {
        unreadCounts[uid]++;
      }
    }

    await setDoc(msgRef, newMsg);
    await updateDoc(chatRef, { unreadCounts });
    delete newMsg.msgReply;
    await updateDoc(chatRef, { recentMsg: newMsg });

    if (msgReply) setMsgReply(null);

    lastMmsg.scrollIntoView({ behavior: "smooth" });
    resetDraft();
    inputRef.current.value = "";
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
          "@media (max-width: 480px)": {
            gap: "0rem",
          },
        }}
      >
        <IconButton
          sx={{
            "&.MuiButtonBase-root:hover": {
              bgcolor: "transparent",
            },
          }}
          onClick={openEmojiPicker}
        >
          <EmojiEmotionsIcon />
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
            "@media (max-width: 480px)": {
              pr: "0.75rem",
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
              ref={inputRef}
              placeholder="Message"
              $msgreply={msgReply}
              maxRows={3}
            />
          </form>
        </Box>

        <IconButton
          sx={{
            "&.MuiButtonBase-root:hover": {
              bgcolor: "transparent",
            },
            "@media (max-width: 480px)": {
              pl: "0.75rem",
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
