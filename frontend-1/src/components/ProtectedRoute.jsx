import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, adminOnly = false, superAdminOnly = false }) {
  const { user, token, loading } = useAuth();

  if (loading) {
    return null;
  }

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (superAdminOnly && user.role !== "SUPER_ADMIN") {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
    return <Navigate to="/login" replace />;
  }

  return children;
}
