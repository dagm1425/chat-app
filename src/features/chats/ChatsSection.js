import React, { useRef, useState } from "react";
import PropTypes from "prop-types";
import Box from "@mui/material/Box";
import { useLocation, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectChatById } from "./chatsSlice";
import ChatHeader from "./ChatHeader";
import ChatMsgDisp from "./ChatMsgDisp";
import ChatMsgInput from "./ChatMsgInput";

function ChatsSection({ setSelectedChatId, userStatuses }) {
  const { id } = useParams();
  const chat = useSelector((state) => selectChatById(state, id));
  const [uploadTask, setUploadTask] = useState(null);
  const [msgReply, setMsgReply] = useState(null);
  const scroll = useRef();
  const location = useLocation();

  return (
    <Box
      sx={{
        ml: "23%",
        width: "77%",
        display: "flex",
        flexDirection: "column",
        height: "100vh",

        "@media (max-width: 480px)": {
          ml: "0",
          width: location.pathname !== "/" ? "100%" : "0",
        },
      }}
    >
      <ChatHeader chat={chat} userStatuses={userStatuses} />
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

ChatsSection.propTypes = {
  setSelectedChatId: PropTypes.func,
  userStatuses: PropTypes.objectOf(PropTypes.string),
};
