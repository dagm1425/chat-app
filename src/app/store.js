import { configureStore } from "@reduxjs/toolkit";
import usersReducer from "../features/user/userSlice";
import chatsReducer from "../features/chats/chatsSlice";

export const store = configureStore({
  reducer: {
    users: usersReducer,
    chats: chatsReducer,
  },
});
