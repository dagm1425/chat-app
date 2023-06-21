/* eslint-disable react/prop-types */
import React from "react";
import Box from "@mui/material/Box";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";

function ChatMsgDisp({ chat }) {
  const user = useSelector(selectUser);

  const msgList = chat.messages.map((message, i) => {
    return (
      <Box
        key={i}
        sx={{
          alignSelf: message.from.uid === user.uid ? "flex-end" : "flex-start",
          backgroundColor: "lightblue",
        }}
      >
        {message.msg}
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
