/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../../firebase";
import { format } from "date-fns";
import {
  Box,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DeleteMsgDialogContent from "./DeleteMsgDialogContent";

function ChatMsgDisp({ chatId }) {
  const user = useSelector(selectUser);
  const [chatMsg, setChatMsg] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [isDeleteMsgOpen, setIsDeleteMsgOpen] = useState(false);
  const [msgId, setMsgId] = useState("");

  useEffect(() => {
    const unsub = subscribeChatMsg();

    return () => {
      unsub();
    };
  }, [chatId]);

  const subscribeChatMsg = () => {
    const q = query(
      collection(db, "chats", `${chatId}`, "chatMessages"),
      orderBy("timestamp", "asc"),
      limit(30)
    );

    return onSnapshot(q, (querySnap) => {
      const messages = [];
      querySnap.forEach((doc) => messages.push(doc.data()));
      setChatMsg(messages);
    });
  };

  const handleMsgOptionsOpen = (e) => {
    setAnchorEl(e.currentTarget);
    setMsgId(e.currentTarget.id);
  };

  const handleMsgOptionsClose = () => {
    setAnchorEl(null);
  };

  const handleMsgClick = (e) => {
    if (e.type === "contextmenu") {
      e.preventDefault();
      handleMsgOptionsOpen(e);
    }
    return;
  };

  const handleDeleteMsgOpen = () => {
    handleMsgOptionsClose();
    setIsDeleteMsgOpen(true);
  };

  const handleDeleteMsgClose = () => {
    setIsDeleteMsgOpen(false);
  };

  const msgList = chatMsg.map((message) => {
    const isSentFromUser = message.from.uid === user.uid;
    const time =
      message.timestamp == null
        ? ""
        : format(message.timestamp.toDate(), "hh:mm a");

    return (
      <Box
        key={message.msgId}
        id={message.msgId}
        onClick={handleMsgClick}
        onContextMenu={handleMsgClick}
        sx={{
          alignSelf: isSentFromUser ? "flex-end" : "flex-start",
          padding: "0.75rem 1rem",
          margin: "1rem",
          background: "#FFF",
          borderRadius: isSentFromUser
            ? "1.125rem 1.125rem 0 1.125rem"
            : "1.125rem 1.125rem 1.125rem 0",
          width: "fit-content",
          maxWidth: "66%",
          boxShadow: 2,
        }}
      >
        {message.msg}
        <Box
          component="span"
          sx={{
            position: "relative",
            top: "6px",
            color: "rgba(0, 0, 0, 0.45)",
            display: "inline-block",
            ml: "1rem",
          }}
        >
          {time}
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

      <Menu
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleMsgOptionsClose}
      >
        <MenuItem onClick={handleDeleteMsgOpen}>
          <ListItemIcon>
            <DeleteIcon />
          </ListItemIcon>
          <ListItemText primary="Delete" />
        </MenuItem>
      </Menu>

      <Dialog open={isDeleteMsgOpen} onClose={handleDeleteMsgClose}>
        <DialogTitle>Confirm chat deletion</DialogTitle>
        <DeleteMsgDialogContent
          onClose={handleDeleteMsgClose}
          chatId={chatId}
          msgId={msgId}
        />
      </Dialog>
    </Box>
  );
}

export default ChatMsgDisp;
