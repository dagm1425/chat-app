/* eslint-disable react/prop-types */
import React, { useState } from "react";
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
  const [uploadTask, setUploadTask] = useState(null);

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
      <ChatMsgDisp chatId={id} uploadTask={uploadTask} />
      <ChatMsgInput chatId={id} setUploadTask={setUploadTask} />
    </Box>
  );
}

export default ChatsSection;
