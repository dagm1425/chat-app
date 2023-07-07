/* eslint-disable react/prop-types */
import React, { useState } from "react";
import Box from "@mui/material/Box";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { db } from "../../firebase";
import {
  doc,
  // updateDoc,
  // arrayUnion,
  serverTimestamp,
  // getDoc,
  setDoc,
} from "firebase/firestore";
import { v4 as uuid } from "uuid";
import SendIcon from "@mui/icons-material/Send";
import { IconButton, Popover } from "@mui/material";
import EmojiPicker from "emoji-picker-react";
import EmojiEmotionsIcon from "@mui/icons-material/EmojiEmotions";

function ChatMsgInput({ chatId }) {
  const user = useSelector(selectUser);
  const [msg, setMsg] = useState("");
  const [anchorEl, setAnchorEl] = useState(null);

  const handleSendMsg = async () => {
    const msgId = uuid();
    const msgRef = doc(db, "chats", `${chatId}`, "chatMessages", `${msgId}`);

    await setDoc(msgRef, {
      msgId,
      from: user,
      msg: msg,
      timestamp: serverTimestamp(),
    });

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

  return (
    <Box
      sx={{
        width: "inherit",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        position: "fixed",
        bottom: "0",
        fontSize: "1.125rem",
        bgcolor: "#eee",
        py: "1.5rem",
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
        type="text"
        placeholder="Enter msg"
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        style={{
          font: "inherit",
          padding: "1rem 1.25rem",
          width: "65%",
          border: "1px solid #000",
          borderRadius: "50px",
        }}
        autoFocus
      />
      <IconButton
        size="large"
        sx={{
          "&.MuiButtonBase-root:hover": {
            bgcolor: "transparent",
          },
        }}
      >
        <SendIcon fontSize="inherit" onClick={handleSendMsg} />
      </IconButton>
    </Box>
  );
}

export default ChatMsgInput;
