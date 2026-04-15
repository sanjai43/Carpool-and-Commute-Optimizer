import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ element, allowedRoles }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  // Not logged in → go to login
  if (!token) {
    return <Navigate to="/login" />;
  }

  // Role not allowed → go to dashboard
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" />;
  }

  // Otherwise render the protected element
  return element;
}
