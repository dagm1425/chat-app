import React, { useEffect } from "react";
import PropTypes from "prop-types";
import {
  Avatar,
  Box,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { doc, updateDoc } from "firebase/firestore";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { useSelector } from "react-redux";
import { selectUser } from "../user/userSlice";
import PeopleIcon from "@mui/icons-material/People";
import { formatFilename } from "../../common/utils";
import { db } from "../../firebase";

function ChatLink({ chat, selectedChatId, setSelectedChatId }) {
  const user = useSelector(selectUser);
  const chatId = chat.chatId;
  const recentMsg = chat.recentMsg;
  const unreadMsgCount = chat.unreadCounts[user.uid];
  const draft = chat.drafts.find((draft) => draft.from.uid === user.uid);
  const otherMember = chat.members.find((member) => member.uid !== user.uid);
  const chatCreator =
    chat.createdBy.uid === user.uid ? "You" : `${chat.createdBy.displayName}`;

  const recentMsgTimestamp = !recentMsg ? null : recentMsg.timestamp;
  const isMobile = useMediaQuery("(max-width: 600px)");

  useEffect(() => {
    if (selectedChatId === chatId && unreadMsgCount > 0) resetUnreadCount();
  }, [unreadMsgCount]);

  const handleLinkClick = () => {
    setSelectedChatId(chatId);
    resetUnreadCount();
  };

  const resetUnreadCount = async () => {
    const unreadCounts = chat.unreadCounts;

    if (unreadCounts[user.uid] === 0) return;

    await updateDoc(doc(db, "chats", `${chatId}`), {
      unreadCounts: { ...unreadCounts, [user.uid]: 0 },
    });
  };

  const returnRecentMsg = () => {
    if (recentMsg.msg) return recentMsg.msg;
    if (recentMsg.caption) return recentMsg.caption;
    if (recentMsg.fileMsg) return formatFilename(recentMsg.fileMsg.fileName);
    if (recentMsg.callData) return recentMsg.callData.status[user.uid];
  };

  return (
    <StyledLink
      id={chatId}
      key={chatId}
      to={`/${chatId}`}
      $selectedchat={chatId === selectedChatId && !isMobile}
      onClick={handleLinkClick}
    >
      <ListItem
        dense
        sx={{
          cursor: "pointer",
          color: "text.primary",
          px: { xs: "1rem", sm: "0.65rem", lg: "1rem" },
        }}
      >
        <ListItemAvatar
          sx={{ minWidth: { xs: "56px", sm: "49px", lg: "56px" } }}
        >
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
                  fontSize: { xs: "1rem", sm: "inherit" },
                  display: "inline-block",
                  width: { xs: "78%", sm: "68%", lg: "78%" },
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
              {recentMsgTimestamp && !draft && (
                <Typography
                  variant="body2"
                  sx={{
                    fontSize: { xs: "1rem", sm: "0.8rem", lg: "0.85rem" },
                    color: "text.secondary",
                    display: "inline-block",
                    width: "20%",
                  }}
                >
                  {recentMsgTimestamp}
                </Typography>
              )}
            </React.Fragment>
          }
          secondary={
            !recentMsg && !draft ? (
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                {chatCreator} created this chat
              </Typography>
            ) : (
              <React.Fragment>
                <Typography
                  sx={{
                    color: "text.secondary",
                    fontSize: { xs: "1rem", sm: "inherit" },
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
                  {recentMsg && chat.type === "public" && !draft && (
                    <Typography
                      component="span"
                      sx={{ font: "inherit", color: "primary.main" }}
                    >
                      {recentMsg.from.uid === user.uid
                        ? "You"
                        : recentMsg.from.displayName}
                      {": "}
                    </Typography>
                  )}
                  {draft ? (
                    <>
                      <Typography
                        component="span"
                        sx={{ font: "inherit", color: "primary.main" }}
                      >
                        Draft:{" "}
                      </Typography>
                      {draft.msg}
                    </>
                  ) : (
                    <Typography
                      sx={{
                        fontSize: ".975rem",
                        color: "text.secondary",
                        display: "inline",
                      }}
                    >
                      {returnRecentMsg()}
                    </Typography>
                  )}
                </Typography>
                {unreadMsgCount > 0 && selectedChatId !== chatId && (
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
