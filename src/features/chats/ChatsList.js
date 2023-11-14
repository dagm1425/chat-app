import React from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { selectChats } from "./chatsSlice";
import List from "@mui/material/List";
import ChatLink from "./ChatLink";
import { selectUser } from "../user/userSlice";
import { Typography } from "@mui/material";

function ChatsList({ searchValue, selectedChatId, setSelectedChatId }) {
  const user = useSelector(selectUser);
  const chats = useSelector(selectChats);

  const filteredChats = () => {
    if (searchValue === "") return chats;

    const re = new RegExp(searchValue, "gi");

    return chats.filter((chat) => {
      if (chat.type === "private") {
        const displayName = chat.members.find(
          (member) => member.uid !== user.uid
        ).displayName;
        return displayName.match(re);
      }

      return chat.displayName.match(re);
    });
  };

  const renderChats = () => {
    const filteredChatList = filteredChats();

    if (!filteredChatList.length) {
      return searchValue ? (
        <Typography variant="body2" sx={{ textAlign: "center" }}>
          No chats found.
        </Typography>
      ) : null;
    }

    return (
      <List disablePadding>
        {filteredChatList.map((chat) => (
          <ChatLink
            key={chat.chatId}
            chat={chat}
            selectedChatId={selectedChatId}
            setSelectedChatId={setSelectedChatId}
          />
        ))}
      </List>
    );
  };

  return <>{renderChats()}</>;
}

export default ChatsList;

ChatsList.propTypes = {
  searchValue: PropTypes.string,
  selectedChatId: PropTypes.string,
  setSelectedChatId: PropTypes.func,
};
