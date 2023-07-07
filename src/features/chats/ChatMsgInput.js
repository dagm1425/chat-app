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
import { IconButton } from "@mui/material";

function ChatMsgInput({ chatId }) {
  const user = useSelector(selectUser);
  const [msg, setMsg] = useState("");

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

  return (
    <Box
      sx={{
        width: "inherit",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "fixed",
        bottom: "0",
        fontSize: "1.125rem",
        bgcolor: "#eee",
        py: "1.5rem",
      }}
    >
      <input
        type="text"
        placeholder="Enter msg"
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        style={{
          font: "inherit",
          padding: "1rem 1.75rem",
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
