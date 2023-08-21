/* eslint-disable react/prop-types */
import React from "react";
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

  return <>{chats ? <List>{list}</List> : null}</>;
}

export default ChatsList;
