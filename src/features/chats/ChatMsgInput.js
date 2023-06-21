/* eslint-disable react/prop-types */
import React, { useState } from "react";
import Box from "@mui/material/Box";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { db } from "../../firebase";
import {
  doc,
  updateDoc,
  arrayUnion,
  // serverTimestamp,
} from "firebase/firestore";

function ChatMsgInput({ chatId }) {
  const user = useSelector(selectUser);
  const [msg, setMsg] = useState("");

  const handleSendMsg = async () => {
    const chatRef = doc(db, "chats", `${chatId}`);

    await updateDoc(chatRef, {
      messages: arrayUnion({
        from: user,
        msg: msg,
        // timestamp: serverTimestamp(),
      }),
    });
  };

  return (
    <Box sx={{ height: "10%" }}>
      <input
        type="text"
        placeholder="Enter msg"
        value={msg}
        onChange={(e) => setMsg(e.target.value)}
      />
      <button type="button" onClick={handleSendMsg}>
        Send Msg
      </button>
    </Box>
  );
}

export default ChatMsgInput;
