/* eslint-disable react/prop-types */
import React from "react";
import { Box, Input } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

function UsersSearchBar({ searchValue, setSearchValue }) {
  return (
    <Input
      type="text"
      value={searchValue}
      sx={{ fontSize: "18px", width: 280, mx: "1.25rem", px: "6px" }}
      onChange={(e) => setSearchValue(e.target.value)}
      startAdornment={
        <Box
          sx={{
            m: "8px 8px 8px 0",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <SearchIcon />
        </Box>
      }
      inputRef={(input) => input && input.focus()}
    />
  );
}

export default UsersSearchBar;
