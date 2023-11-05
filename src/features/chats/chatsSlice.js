import { createSlice } from "@reduxjs/toolkit";

export const chatsSlice = createSlice({
  name: "chats",
  initialState: {
    chats: [],
    chatMessages: {},
  },
  reducers: {
    setChats: (state, action) => {
      state.chats = action.payload;
    },
    setChatMsgs: (state, action) => {
      const { chatId, chatMsg } = action.payload;
      state.chatMessages[chatId] = chatMsg;
    },
  },
});

export const { setChats, setChatMsgs } = chatsSlice.actions;

export const selectChats = (state) => state.chats.chats;
export const selectChatById = (state, chatId) =>
  state.chats.chats.find((chat) => chat.chatId === chatId);

export const selectChatMsgs = (state, chatId) =>
  state.chats.chatMessages[chatId];

export default chatsSlice.reducer;
