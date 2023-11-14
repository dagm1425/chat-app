import React, { useRef, useState } from "react";
import PropTypes from "prop-types";
import Box from "@mui/material/Box";
import { useLocation, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectChatById } from "./chatsSlice";
import ChatHeader from "./ChatHeader";
import ChatMsgDisp from "./ChatMsgDisp";
import ChatMsgInput from "./ChatMsgInput";
import { useMediaQuery } from "@mui/material";

function ChatsSection({ setSelectedChatId, userStatuses }) {
  const { id } = useParams();
  const chat = useSelector((state) => selectChatById(state, id));
  const [uploadTask, setUploadTask] = useState(null);
  const [msgReply, setMsgReply] = useState(null);
  const scroll = useRef();

  const location = useLocation();
  const isMobile = useMediaQuery("(max-width:600px)");

  return !isMobile || (isMobile && location.pathname !== "/") ? (
    <Box
      sx={{
        ml: { xs: "0", sm: "35%", lg: "23%" },
        width: { xs: "100%", sm: "65%", lg: "77%" },
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        height: "100%",
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
        userStatuses={userStatuses}
      />
      <ChatMsgInput
        chat={chat}
        setUploadTask={setUploadTask}
        msgReply={msgReply}
        setMsgReply={setMsgReply}
        scroll={scroll}
      />
    </Box>
  ) : null;
}

export default ChatsSection;

ChatsSection.propTypes = {
  setSelectedChatId: PropTypes.func,
  userStatuses: PropTypes.objectOf(PropTypes.string),
};
