import React from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { selectChats } from "./chatsSlice";
import List from "@mui/material/List";
import ChatLink from "./ChatLink";

function ChatsList({ searchValue, selectedChatId, setSelectedChatId }) {
  const chats = useSelector(selectChats);

  const filteredChats = () => {
    if (searchValue === "") return chats;

    const re = new RegExp(searchValue, "gi");

    return chats.filter((chat) => {
      return chat.displayName.match(re);
    });
  };

  const list = filteredChats().map((chat) => {
    return (
      <ChatLink
        key={chat.chatId}
        chat={chat}
        selectedChatId={selectedChatId}
        setSelectedChatId={setSelectedChatId}
      />
    );
  });

  return <>{chats ? <List disablePadding>{list}</List> : null}</>;
}

export default ChatsList;

ChatsList.propTypes = {
  searchValue: PropTypes.string,
  selectedChatId: PropTypes.string,
  setSelectedChatId: PropTypes.func,
};
