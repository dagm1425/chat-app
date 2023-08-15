import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./app/store";
import App from "./app/App";
import "./index.css";
import { ThemeProvider, createTheme } from "@mui/material/styles";

const container = document.getElementById("root");
const root = createRoot(container);

let theme = createTheme({
  palette: {
    // primary: {
    //   main: "#f8ebd3",
    // },
    secondary: {
      main: "#fcf7ed",
    },
    header: {
      main: "#d1f5ea",
    },
  },
});

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <App />
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);
