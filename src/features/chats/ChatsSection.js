/* eslint-disable react/prop-types */
import React from "react";
import Box from "@mui/material/Box";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectChatById } from "./chatsSlice";
import ChatHeader from "./ChatHeader";
import ChatMsgDisp from "./ChatMsgDisp";
import ChatMsgInput from "./ChatMsgInput";

function ChatsSection() {
  const { id } = useParams();
  const chat = useSelector((state) => selectChatById(state, id));

  return (
    <Box
      sx={{
        ml: "22%",
        width: "78%",
        height: "100vh",
        bgcolor: "secondary.main",
      }}
    >
      <ChatHeader chat={chat} />
      <ChatMsgDisp chatId={id} />
      <ChatMsgInput chatId={id} />
    </Box>
  );
}

export default ChatsSection;
