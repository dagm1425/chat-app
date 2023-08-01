/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { useSelector } from "react-redux";
import { selectChats } from "./chatsSlice";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Avatar from "@mui/material/Avatar";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import { Link } from "react-router-dom";
import { selectUser } from "../user/userSlice";
import { Box, Typography } from "@mui/material";
import { styled } from "styled-components";

function ChatsList({ searchValue }) {
  const chats = useSelector(selectChats);
  const user = useSelector(selectUser);
  const [selectedChatId, setSelectedChatId] = useState("");

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
    const isRecentMsgUnread =
      JSON.stringify(chat.recentMsg) !== "{}"
        ? chat.recentMsg.from.uid !== user.uid && chat.unreadMsg > 0
          ? true
          : false
        : false;

    return (
      <StyledLink
        id={chat.chatId}
        key={chat.chatId}
        to={`/${chat.chatId}`}
        selectedchat={chat.chatId === selectedChatId}
        onClick={() => setSelectedChatId(chat.chatId)}
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
                    sx={{
                      mr: "50%",
                      fontWeight: isRecentMsgUnread ? "bold" : "normal",
                    }}
                    component="span"
                    variant="subtitle1"
                  >
                    {chat.recentMsg.msg
                      ? chat.recentMsg.msg
                      : chat.recentMsg.caption
                      ? chat.recentMsg.caption
                      : chat.recentMsg.fileMsg.fileName}
                  </Typography>
                  <Typography
                    variant="subtitle1"
                    component="span"
                    sx={{
                      color: "rgba(0, 0, 0, 0.45)",
                      fontWeight: isRecentMsgUnread ? "bold" : "normal",
                    }}
                  >
                    {chat.recentMsg.timestamp}
                  </Typography>
                </React.Fragment>
              )
            }
          />
          {isRecentMsgUnread && (
            <Box
              component="span"
              sx={{
                display: "grid",
                placeItems: "center",
                fontWeight: "bold",
                color: "white",
                bgcolor: "#001e80",
                height: 25,
                width: 25,
                p: "0.125rem",
                borderRadius: "50%",
              }}
            >
              {chat.unreadMsg}
            </Box>
          )}
        </ListItem>
      </StyledLink>
    );
  });

  return <>{chats ? <List>{list}</List> : null}</>;
}

const StyledLink = styled(Link)`
  display: block;
  background-color: ${(props) => (props.selectedchat ? "gray" : "lightgray")};
  text-decoration: none;
  &:hover {
    filter: brightness(0.8);
  }
`;

export default ChatsList;
