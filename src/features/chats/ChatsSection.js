import React, { useLayoutEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import Box from "@mui/material/Box";
import { useLocation, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectChatById } from "./chatsSlice";
import ChatHeader from "./ChatHeader";
import ChatMsgDisp from "./ChatMsgDisp";
import ChatMsgInput from "./ChatMsgInput";
import { useMediaQuery } from "@mui/material";

function ChatsSection({ userStatuses, makeCall }) {
  const { id } = useParams();
  const chat = useSelector((state) => selectChatById(state, id));
  const [uploadTask, setUploadTask] = useState(null);
  const [msgReply, setMsgReply] = useState(null);
  const [msgEdit, setMsgEdit] = useState(null);
  const scroll = useRef(null);

  const location = useLocation();
  const isMobile = useMediaQuery("(max-width:600px)");

  useLayoutEffect(() => {
    setMsgReply(null);
    setMsgEdit(null);
  }, [id]);

  return !isMobile || (isMobile && location.pathname !== "/") ? (
    <Box
      sx={{
        ml: { xs: "0", sm: "30%", lg: "23%" },
        width: { xs: "100%", sm: "70%", lg: "77%" },
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        height: "100%",
      }}
    >
      {chat && (
        <ChatHeader
          chat={chat}
          userStatuses={userStatuses}
          makeCall={makeCall}
        />
      )}
      {chat && (
        <ChatMsgDisp
          chat={chat}
          uploadTask={uploadTask}
          setMsgReply={setMsgReply}
          setMsgEdit={setMsgEdit}
          scroll={scroll}
          userStatuses={userStatuses}
          makeCall={makeCall}
          isActive
        />
      )}
      {chat && (
        <ChatMsgInput
          chat={chat}
          setUploadTask={setUploadTask}
          msgReply={msgReply}
          setMsgReply={setMsgReply}
          msgEdit={msgEdit}
          setMsgEdit={setMsgEdit}
          scroll={scroll}
        />
      )}
    </Box>
  ) : null;
}

export default ChatsSection;

ChatsSection.propTypes = {
  userStatuses: PropTypes.objectOf(PropTypes.string),
  makeCall: PropTypes.func,
};
