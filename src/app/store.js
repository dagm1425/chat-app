import { configureStore } from "@reduxjs/toolkit";
import userReducer from "../features/user/userSlice";
import chatsReducer from "../features/chats/chatsSlice";

export const store = configureStore({
  reducer: {
    user: userReducer,
    chats: chatsReducer,
  },
});
