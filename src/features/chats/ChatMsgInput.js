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
        width: "78%",
        display: "flex",
        position: "fixed",
        bottom: "0",
        fontSize: "1.125rem",
      }}
    >
      <input
        type="text"
        placeholder="Enter msg"
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
        style={{ font: "inherit", padding: "1rem 0.75rem", width: "90%" }}
        autoFocus
      />
      <button
        type="button"
        style={{ font: "inherit", padding: "1rem 0", width: "10%" }}
        onClick={handleSendMsg}
      >
        Send Msg
      </button>
    </Box>
  );
}

export default ChatMsgInput;
