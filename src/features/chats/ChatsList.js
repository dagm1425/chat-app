import React from "react";
import { useSelector } from "react-redux";
import { selectChats } from "./chatsSlice";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Avatar from "@mui/material/Avatar";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";

function ChatsList() {
  const chats = useSelector(selectChats);

  const list = chats.map((chat) => {
    return (
      <ListItem key={chat.chatId}>
        <ListItemButton>
          <ListItemAvatar>
            <Avatar src={chat.photoURL} />
          </ListItemAvatar>
          <ListItemText primary={chat.displayName} />
          <ListItemText primary={chat.recentMsg} />
        </ListItemButton>
      </ListItem>
    );
  });

  return chats ? <List>{list}</List> : null;
}

export default ChatsList;
