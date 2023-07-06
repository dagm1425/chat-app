/* eslint-disable react/prop-types */
import React from "react";

function ChatsSearchBar({ searchValue, setSearchValue }) {
  return (
    <>
      <input
        style={{
          fontSize: "1rem",
          padding: "0.5rem",
          width: "75%",
          // border: "none",
          borderRadius: "4px",
        }}
        type="text"
        value={searchValue}
        placeholder="Search chats"
        autoFocus
        onChange={(e) => setSearchValue(e.target.value)}
      />
    </>
  );
}

export default ChatsSearchBar;
