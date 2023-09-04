import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
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
import { Link } from "react-router-dom";
import { styled } from "styled-components";
import { db } from "../../firebase";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import formatRelative from "date-fns/formatRelative";
import { enUS } from "date-fns/esm/locale";
import PeopleIcon from "@mui/icons-material/People";
import { formatFilename } from "../../common/utils";

function ChatLink({ chat, selectedChatId, setSelectedChatId }) {
  const user = useSelector(selectUser);
  const chatId = chat.chatId;
  const [chatMsg, setChatMsg] = useState([]);
  const [recentMsg, setRecentMsg] = useState(null);
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
    other: "dd/MM/yy",
  };
  const locale = {
    ...enUS,
    formatRelative: (token) => formatRelativeLocale[token],
  };
  const recentMsgTimestamp = !recentMsg
    ? null
    : recentMsg.timestamp == null
    ? formatRelative(new Date(), Timestamp.now().toDate(), {
        locale,
      })
    : formatRelative(recentMsg.timestamp.toDate(), Timestamp.now().toDate(), {
        locale,
      });

  useEffect(() => {
    const unsub = subscribeChatMsg();

    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    updateRecentMsg();
    updateUnreadMsgCount();
  }, [chatMsg]);

  const subscribeChatMsg = () => {
    const q = query(
      collection(db, "chats", `${chatId}`, "chatMessages"),
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

  const updateRecentMsg = () => {
    if (!chatMsg.length) {
      if (recentMsg) {
        setRecentMsg(null);
        return;
      }
      return;
    }

    setRecentMsg(chatMsg[chatMsg.length - 1]);
  };

  const updateUnreadMsgCount = () => {
    let count;

    if (!chatMsg.length) {
      if (unreadMsgCount != 0) {
        setUnreadMsgCount(0);
        return;
      }
      return;
    }

    if (chat.type === "private") {
      count = chatMsg.filter(
        (msg) => msg.from.uid !== user.uid && msg.isMsgRead == false
      ).length;
    } else {
      count = chatMsg.filter(
        (msg) => msg.from.uid !== user.uid && !msg.isMsgRead.includes(user.uid)
      ).length;
    }

    setUnreadMsgCount(count);
  };

  return (
    <StyledLink
      id={chatId}
      key={chatId}
      to={`/${chatId}`}
      $selectedchat={chatId === selectedChatId}
      onClick={() => setSelectedChatId(chatId)}
    >
      <ListItem
        dense
        sx={{
          cursor: "pointer",
          color: "text.primary",
        }}
      >
        <ListItemAvatar>
          {chat.type === "private" ? (
            <Avatar src={otherMember.photoURL} />
          ) : (
            <Avatar sx={{ bgcolor: chat.avatarBgColor }}>
              {chat.displayName.charAt(0).toUpperCase()}
            </Avatar>
          )}
        </ListItemAvatar>
        <ListItemText
          disableTypography
          primary={
            <React.Fragment>
              <Typography
                variant="body2"
                sx={{
                  display: "inline-block",
                  width: "70%",
                  verticalAlign: "middle",
                  fontWeight: "bold",
                }}
              >
                {chat.type === "private"
                  ? otherMember.displayName
                  : chat.displayName}
                {chat.type === "public" && (
                  <PeopleIcon
                    fontSize="small"
                    sx={{ verticalAlign: "middle", ml: "0.5rem" }}
                  />
                )}
              </Typography>
              {recentMsgTimestamp && (
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.secondary",
                    display: "inline-block",
                    width: "20%",
                    verticalAlign: "middle",
                  }}
                >
                  {recentMsgTimestamp}
                </Typography>
              )}
            </React.Fragment>
          }
          secondary={
            !recentMsg ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {chatCreator} created this chat
              </Typography>
            ) : (
              <React.Fragment>
                <Typography
                  sx={{
                    color: "text.secondary",
                    display: "inline-block",
                    width: "70%",
                    pr: "0.5rem",
                    verticalAlign: "middle",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  variant="body2"
                >
                  {recentMsg.msg
                    ? recentMsg.msg
                    : recentMsg.caption
                    ? recentMsg.caption
                    : formatFilename(recentMsg.fileMsg.fileName)}
                </Typography>
                {unreadMsgCount > 0 && (
                  <Box
                    sx={{
                      display: "inline-block",
                      fontWeight: "bold",
                      color: "white",
                      bgcolor: "primary.main",
                      borderRadius: "50%",
                      lineHeight: "0px",

                      "& span": {
                        fontSize: "12px",
                        display: "inline-block",
                        paddingTop: "50%",
                        paddingBottom: "50%",
                        marginLeft: "6px",
                        marginRight: "6px",
                      },
                    }}
                  >
                    <span>{unreadMsgCount}</span>
                  </Box>
                )}
              </React.Fragment>
            )
          }
        />
      </ListItem>
    </StyledLink>
  );
}

const StyledLink = styled(Link)`
  display: block;
  background-color: ${(props) =>
    props.$selectedchat
      ? props.theme.palette.background.paper
      : props.theme.palette.background.default};
  text-decoration: none;
  &:hover {
    filter: brightness(0.8);
  }
`;

export default ChatLink;

ChatLink.propTypes = {
  chat: PropTypes.object,
  selectedChatId: PropTypes.string,
  setSelectedChatId: PropTypes.func,
};
