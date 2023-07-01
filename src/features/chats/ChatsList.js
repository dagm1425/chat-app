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
import { selectUser } from "../user/userSlice";

function ChatsList() {
  const chats = useSelector(selectChats);
  const user = useSelector(selectUser);

  const list = chats.map((chat) => {
    const otherMember = chat.members.find((member) => member.uid !== user.uid);

    return (
      <Link
        key={chat.chatId}
        style={{
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
        }}
        to={`/${chat.chatId}`}
      >
        <ListItem sx={{ bgcolor: "#9dad99", cursor: "pointer" }}>
          <ListItemAvatar>
            <Avatar src={chat.photoURL} />
          </ListItemAvatar>
          <Box>
            <ListItemText primary={otherMember.displayName} />
            <ListItemText primary={chat.recentMsg} />
          </Box>
        </ListItem>
      </Link>
    );
  });

  return chats ? <List>{list}</List> : null;
}

export default ChatsList;
