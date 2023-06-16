import { createSlice } from "@reduxjs/toolkit";

export const chatsSlice = createSlice({
  name: "chats",
  initialState: [],
  reducers: {
    setChats: (state, action) => {
      return action.payload;
    },
  },
});

export const { setChats } = chatsSlice.actions;

export const selectChats = (state) => state.chats;

export default chatsSlice.reducer;
