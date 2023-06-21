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
    <Box>
      <ChatHeader chat={chat} />
      <ChatMsgDisp chat={chat} />
      <ChatMsgInput chatId={id} />
    </Box>
  );
}

export default ChatsSection;
