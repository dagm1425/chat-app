import { createSlice } from "@reduxjs/toolkit";

export const usersSlice = createSlice({
  name: "users",
  initialState: [],
  reducers: {
    setUsers: (state, action) => {
      return action.payload;
    },
  },
});

export const { setUsers } = usersSlice.actions;

export const selectAllUsers = (state) => state.users;

export const selectUserById = (state, id) =>
  state.users.find((user) => user.uid == id);

export default usersSlice.reducer;
