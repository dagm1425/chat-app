/* eslint-disable react/prop-types */
import React from "react";
import { useSelector } from "react-redux";
import { selectChats } from "./chatsSlice";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Avatar from "@mui/material/Avatar";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import { Link } from "react-router-dom";
import { selectUser } from "../user/userSlice";
import { Typography } from "@mui/material";

function ChatsList({ searchValue }) {
  const chats = useSelector(selectChats);
  const user = useSelector(selectUser);

  const filteredChats = () => {
    if (searchValue === "") return chats;

    const re = new RegExp(searchValue, "gi");

    return chats.filter((chat) => {
      return chat.displayName.match(re);
    });
  };

  const list = filteredChats().map((chat) => {
    const otherMember = chat.members.find((member) => member.uid !== user.uid);
    const chatCreator =
      chat.createdBy.uid === user.uid ? "You" : `${chat.createdBy.displayName}`;

    return (
      <Link
        key={chat.chatId}
        style={{
          textDecoration: "none",
        }}
        to={`/${chat.chatId}`}
      >
        <ListItem
          sx={{
            cursor: "pointer",
          }}
        >
          <ListItemAvatar>
            <Avatar src={chat.photoURL} />
          </ListItemAvatar>
          <ListItemText
            disableTypography
            primary={
              <Typography variant="h6">
                {chat.type === "private"
                  ? otherMember.displayName
                  : chat.displayName}
              </Typography>
            }
            secondary={
              JSON.stringify(chat.recentMsg) === "{}" ? (
                <Typography>{chatCreator} created this chat</Typography>
              ) : (
                <React.Fragment>
                  <Typography
                    sx={{ mr: "50%" }}
                    component="span"
                    variant="subtitle1"
                  >
                    {chat.recentMsg.msg}
                  </Typography>
                  <Typography
                    variant="subtitle1"
                    component="span"
                    sx={{ color: "rgba(0, 0, 0, 0.45)" }}
                  >
                    {chat.recentMsg.timestamp}
                  </Typography>
                </React.Fragment>
              )
            }
          />
        </ListItem>
      </Link>
    );
  });

  return <>{chats ? <List>{list}</List> : null}</>;
}

export default ChatsList;
