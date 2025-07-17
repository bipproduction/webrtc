import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useSnapshot } from "valtio";
import { authState } from "./state-login";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user } = useSnapshot(authState);

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
