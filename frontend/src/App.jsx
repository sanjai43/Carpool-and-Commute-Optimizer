import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import RideMatch from "./pages/RideMatch";
import RideForm from "./pages/RideForm";
import EcoDashboard from "./pages/EcoDashboard";
import MyRidesPage from "./pages/MyRidesPage";
import JoinedRidesPage from "./pages/JoinedRidesPage"   
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import PromosPage from "./pages/PromosPage.jsx";
import EarningsPage from "./pages/EarningsPage.jsx";
import DemoGuidePage from "./pages/DemoGuidePage.jsx";

export default function App() {
  return (
    <SocketProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute element={<HomePage />} />} />
          <Route
            path="/match"
            element={<ProtectedRoute element={<RideMatch />} allowedRoles={["Rider"]} />}
          />
          <Route
            path="/new"
            element={<ProtectedRoute element={<RideForm />} allowedRoles={["Driver"]} />}
          />
          <Route
            path="/eco"
            element={<ProtectedRoute element={<EcoDashboard />} allowedRoles={["Rider", "Driver"]} />}
          />
          <Route
            path="/myrides"
            element={<ProtectedRoute element={<MyRidesPage />} allowedRoles={["Driver"]} />}
          />
          <Route
            path="/joined"
            element={<ProtectedRoute element={<JoinedRidesPage />} allowedRoles={["Rider"]} />}
          />
          <Route
            path="/admin"
            element={<ProtectedRoute element={<AdminPage />} allowedRoles={["Admin"]} />}
          />
          <Route
            path="/notifications"
            element={<ProtectedRoute element={<NotificationsPage />} />}
          />
          <Route
            path="/promos"
            element={<ProtectedRoute element={<PromosPage />} allowedRoles={["Rider", "Driver", "Admin"]} />}
          />
          <Route
            path="/earnings"
            element={<ProtectedRoute element={<EarningsPage />} allowedRoles={["Driver"]} />}
          />
          <Route
            path="/demo"
            element={<ProtectedRoute element={<DemoGuidePage />} allowedRoles={["Rider", "Driver", "Admin"]} />}
          />
        </Routes>
      </Router>
    </SocketProvider>
  );
}
