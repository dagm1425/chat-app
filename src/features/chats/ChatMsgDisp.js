/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { format } from "date-fns";

function ChatMsgDisp({ chatId }) {
  const user = useSelector(selectUser);
  const [chatMsg, setChatMsg] = useState([]);

  useEffect(() => {
    const unsub = subscribeChatMsg();

    return () => {
      unsub();
    };
  }, [chatId]);

  const subscribeChatMsg = () => {
    return onSnapshot(
      collection(db, "chats", `${chatId}`, "chatMessages"),
      (snap) => {
        const messages = [];
        snap.forEach((doc) => messages.push(doc.data()));
        setChatMsg(messages);
      }
    );
  };

  const msgList = chatMsg.map((message) => {
    const formattedDate = format(message.timestamp.toDate(), "hh:mm a");

    return (
      <Box
        key={message.msgId}
        id={message.msgId}
        sx={{
          alignSelf: message.from.uid === user.uid ? "flex-end" : "flex-start",
          backgroundColor: "lightblue",
        }}
      >
        {message.msg}
        <Box component="span">
          {message.timestamp == null ? "" : formattedDate}
        </Box>
      </Box>
    );
  });

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      {msgList.length > 0 ? msgList : null}
    </Box>
  );
}

export default ChatMsgDisp;
