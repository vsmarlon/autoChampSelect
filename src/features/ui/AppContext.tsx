import React, { createContext, useContext } from "react";
import { AppContextValue } from "../../utils/types";

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{
  value: AppContextValue;
  children: React.ReactNode;
}> = ({ value, children }) => {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
