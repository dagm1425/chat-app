import { createSlice } from "@reduxjs/toolkit";

export const chatsSlice = createSlice({
  name: "chats",
  initialState: {
    chats: [],
    chatMessages: {},
    call: { isActive: false, callData: {}, status: "" },
  },
  reducers: {
    setChats: (state, action) => {
      state.chats = action.payload;
    },
    setChatMsgs: (state, action) => {
      const { chatId, chatMsg } = action.payload;
      state.chatMessages[chatId] = chatMsg;
    },
    setCall: (state, action) => {
      const { isActive, callData, status } = action.payload;
      state.call.isActive = isActive;
      state.call.callData = callData;
      state.call.status = status;
    },
  },
});

export const { setChats, setChatMsgs, setCall } = chatsSlice.actions;

export const selectChats = (state) => state.chats.chats;

export const selectChatById = (state, chatId) =>
  state.chats.chats.find((chat) => chat.chatId === chatId);

export const selectChatMsgs = (state, chatId) =>
  state.chats.chatMessages[chatId];

export const selectCall = (state) => state.chats.call;

export default chatsSlice.reducer;
