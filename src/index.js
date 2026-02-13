import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./app/store";
import App from "./app/App";
import "./index.css";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import ToastProvider from "./common/toast/ToastProvider";

const container = document.getElementById("root");
const root = createRoot(container);

export const ColorModeContext = React.createContext({
  toggleColorMode: () => {},
});

const CustomThemeProvider = () => {
  const [mode, setMode] = React.useState("light");
  const colorMode = React.useMemo(
    () => ({
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
      },
    }),
    []
  );

  const getDesignTokens = (mode) => ({
    palette: {
      mode,
      ...(mode === "light"
        ? {
            background: {
              paper: "#f2f2f2",
            },
            primary: {
              main: "#1976d2",
              light: "#ccf7ff",
            },
          }
        : {
            background: {
              paper: "#262626",
              default: "#333333",
            },
            primary: {
              main: "#1976d2",
              light: "#115293",
            },
          }),
    },
  });

  const theme = React.useMemo(() => createTheme(getDesignTokens(mode)), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ColorModeContext.Provider value={colorMode}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ColorModeContext.Provider>
    </ThemeProvider>
  );
};

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <CustomThemeProvider />
    </Provider>
  </React.StrictMode>
);
