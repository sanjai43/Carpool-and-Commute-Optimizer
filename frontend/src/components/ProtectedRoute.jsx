import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ element, allowedRoles }) {
  const user = localStorage.getItem("user");
  const role = localStorage.getItem("role");

  // Not logged in → go to login
  if (!user) {
    return <Navigate to="/login" />;
  }

  // Role not allowed → go to dashboard
  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/" />;
  }

  // Otherwise render the protected element
  return element;
}
