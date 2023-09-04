import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./app/store";
import App from "./app/App";
import "./index.css";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { ThemeProvider as SCThemeProvider } from "styled-components";

const container = document.getElementById("root");
const root = createRoot(container);

let theme = createTheme({
  palette: {
    background: {
      paper: "#E8E8E8",
    },
    text: {
      secondary: "#A9A9A9",
    },
    primary: {
      main: "#1976d2",
      light: "#ccf7ff",
    },
  },
});

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <SCThemeProvider theme={theme}>
          <App />
        </SCThemeProvider>
      </ThemeProvider>
    </Provider>
  </React.StrictMode>
);
