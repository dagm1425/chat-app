/* eslint-disable react/prop-types */
import {
  Avatar,
  Box,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
} from "@mui/material";
import {
  Timestamp,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { styled } from "styled-components";
import { db } from "../../firebase";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import formatRelative from "date-fns/formatRelative";
import { enUS } from "date-fns/esm/locale";

function ChatLink({ chat, selectedChatId, setSelectedChatId }) {
  const user = useSelector(selectUser);
  const [chatMsg, setChatMsg] = useState([]);
  const [recentMsg, setRecentMsg] = useState({});
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const otherMember = chat.members.find((member) => member.uid !== user.uid);
  const chatCreator =
    chat.createdBy.uid === user.uid ? "You" : `${chat.createdBy.displayName}`;
  const formatRelativeLocale = {
    lastWeek: "EEEE",
    yesterday: "'Yesterday'",
    today: "'Today'",
    tomorrow: "EEEE",
    nextWeek: "EEEE",
    other: "dd/MM/yyy",
  };
  const locale = {
    ...enUS,
    formatRelative: (token) => formatRelativeLocale[token],
  };

  useEffect(() => {
    const unsub = subscribeChatMsg();

    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!chatMsg.length) return;

    setRecentMsg(chatMsg[chatMsg.length - 1]);
    updateUnreadMsgCount();
  }, [chatMsg]);

  const subscribeChatMsg = () => {
    const q = query(
      collection(db, "chats", `${chat.chatId}`, "chatMessages"),
      orderBy("timestamp", "desc"),
      limit(30)
    );

    return onSnapshot(q, (querySnap) => {
      const messages = [];
      querySnap.forEach((doc) => messages.push(doc.data()));
      const sortedMessages = messages.sort((a, b) => a.timestamp - b.timestamp);
      setChatMsg(sortedMessages);
    });
  };

  const updateUnreadMsgCount = () => {
    const count = chatMsg.filter(
      (msg) => msg.from.uid !== user.uid && msg.isMsgRead == false
    ).length;

    setUnreadMsgCount(count);
  };

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
            JSON.stringify(recentMsg) === "{}" ? (
              <Typography>{chatCreator} created this chat</Typography>
            ) : (
              <React.Fragment>
                <Typography
                  sx={{
                    mr: "50%",
                    fontWeight: unreadMsgCount ? "bold" : "normal",
                  }}
                  component="span"
                  variant="subtitle1"
                >
                  {recentMsg.msg
                    ? recentMsg.msg
                    : recentMsg.caption
                    ? recentMsg.caption
                    : recentMsg.fileMsg.fileName}
                </Typography>
                {recentMsg.timestamp == null ? null : (
                  <Typography
                    variant="subtitle1"
                    component="span"
                    sx={{
                      color: "rgba(0, 0, 0, 0.45)",
                      fontWeight: unreadMsgCount ? "bold" : "normal",
                    }}
                  >
                    {formatRelative(
                      recentMsg.timestamp.toDate(),
                      Timestamp.now().toDate(),
                      { locale }
                    )}
                  </Typography>
                )}
              </React.Fragment>
            )
          }
        />
        {unreadMsgCount > 0 ? (
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
            {unreadMsgCount}
          </Box>
        ) : null}
      </ListItem>
    </StyledLink>
  );
}

const StyledLink = styled(Link)`
  display: block;
  background-color: ${(props) => (props.selectedchat ? "gray" : "lightgray")};
  text-decoration: none;
  &:hover {
    filter: brightness(0.8);
  }
`;

export default ChatLink;
