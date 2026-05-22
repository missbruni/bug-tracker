import React from "react"
import { AuthContext } from "./auth-context";

export { getUserDisplayName } from "./userDisplayName";

export function useAuth() {
  const context = React.useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
