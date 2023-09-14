import React from "react";
import PropTypes from "prop-types";
import { useSelector } from "react-redux";
import { selectChats } from "./chatsSlice";
import List from "@mui/material/List";
import ChatLink from "./ChatLink";
import { selectUser } from "../user/userSlice";

function ChatsList({ searchValue, selectedChatId, setSelectedChatId }) {
  const user = useSelector(selectUser);
  const chatsState = useSelector(selectChats);

  const chats = chatsState.map((chat) => {
    if (chat.type === "private") {
      const displayName = chat.members.find(
        (member) => member.uid !== user.uid
      ).displayName;
      return { ...chat, displayName };
    }
    return chat;
  });

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
