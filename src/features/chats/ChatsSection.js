/* eslint-disable react/prop-types */
import React, { useRef, useState } from "react";
import Box from "@mui/material/Box";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectChatById } from "./chatsSlice";
import ChatHeader from "./ChatHeader";
import ChatMsgDisp from "./ChatMsgDisp";
import ChatMsgInput from "./ChatMsgInput";

function ChatsSection({ setSelectedChatId }) {
  const { id } = useParams();
  const chat = useSelector((state) => selectChatById(state, id));
  const [uploadTask, setUploadTask] = useState(null);
  const [msgReply, setMsgReply] = useState(null);
  const scroll = useRef();

  return (
    <Box
      sx={{
        ml: "22%",
        width: "78%",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
      }}
    >
      <ChatHeader chat={chat} />
      <ChatMsgDisp
        chat={chat}
        uploadTask={uploadTask}
        msgReply={msgReply}
        setMsgReply={setMsgReply}
        scroll={scroll}
        setSelectedChatId={setSelectedChatId}
      />
      <ChatMsgInput
        chat={chat}
        setUploadTask={setUploadTask}
        msgReply={msgReply}
        setMsgReply={setMsgReply}
        scroll={scroll}
      />
    </Box>
  );
}

export default ChatsSection;
