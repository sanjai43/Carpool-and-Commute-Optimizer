import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import RideMatch from "./pages/RideMatch";
import RideForm from "./pages/RideForm";
import EcoDashboard from "./pages/EcoDashboard";
import MyRidesPage from "./pages/MyRidesPage";
import JoinedRidesPage from "./pages/JoinedRidesPage"   

export default function App() {
  return (
    <Router>
      <Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/login" element={<LoginPage />} />
  <Route path="/match" element={<RideMatch />} />
  <Route path="/new" element={<RideForm />} />
  <Route path="/eco" element={<EcoDashboard />} />
  <Route path="/myrides" element={<MyRidesPage />} />
  <Route path="/joined" element={<JoinedRidesPage />} />
</Routes>

    </Router>
  );
}
