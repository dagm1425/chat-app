import { createSlice } from "@reduxjs/toolkit";

export const usersSlice = createSlice({
  name: "users",
  initialState: null,
  reducers: {
    setUsers: (state, action) => {
      return action.payload;
    },
  },
});

export const { setUsers } = usersSlice.actions;

export const selectAllUsers = (state) => state.user;

export const selectUserById = (state, id) =>
  state.user.find((user) => user.uid == id);

export default usersSlice.reducer;
