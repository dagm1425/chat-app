import React from "react";
import { useSelector } from "react-redux";
import { selectChats } from "./chatsSlice";
import List from "@mui/material/List";
import Box from "@mui/material/Box";
import ListItem from "@mui/material/ListItem";
import Avatar from "@mui/material/Avatar";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import { Link } from "react-router-dom";

function ChatsList() {
  const chats = useSelector(selectChats);

  const list = chats.map((chat) => {
    return (
      <ListItem key={chat.chatId}>
        <Link
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
          }}
          to={`/${chat.chatId}`}
        >
          <ListItemAvatar>
            <Avatar src={chat.photoURL} />
          </ListItemAvatar>
          <Box>
            <ListItemText primary={chat.displayName} />
            <ListItemText primary={chat.recentMsg} />
          </Box>
        </Link>
      </ListItem>
    );
  });

  return chats ? <List>{list}</List> : null;
}

export default ChatsList;
