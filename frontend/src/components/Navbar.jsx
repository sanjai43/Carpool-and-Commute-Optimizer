import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [userName, setUserName] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user?.name) setUserName(user.name.split(" ")[0]);
    if (user?.role) setRole(user.role);

    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const logout = () => {
    localStorage.clear();
    navigate("/login");
  };

  const navButtonStyle = {
    background: "transparent",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    fontSize: "15px",
    transition: "0.3s",
  };

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: scrolled ? "55px" : "70px",
        background: scrolled
          ? "rgba(18, 20, 25, 0.9)"
          : "rgba(18, 20, 25, 0.6)",
        backdropFilter: "blur(10px)",
        boxShadow: scrolled
          ? "0 0 15px rgba(0,185,111,0.3)"
          : "0 0 0 transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 25px",
        transition: "all 0.3s ease",
        zIndex: 1000,
      }}
    >
      {/* 🚗 Logo */}
      <div
        style={{
          color: "#00b96f",
          fontWeight: "700",
          fontSize: scrolled ? "1.3rem" : "1.5rem",
          letterSpacing: "0.5px",
          cursor: "pointer",
        }}
        onClick={() => navigate("/")}
      >
        CarShary
      </div>

      {/* 🧭 Navigation Buttons */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}
      >
        {/* Common Nav Options */}
        <button
          style={navButtonStyle}
          onClick={() => navigate("/")}
          onMouseOver={(e) => (e.target.style.color = "#00b96f")}
          onMouseOut={(e) => (e.target.style.color = "#fff")}
        >
          Home
        </button>

        <button
          style={navButtonStyle}
          onClick={() => navigate("/match")}
          onMouseOver={(e) => (e.target.style.color = "#00b96f")}
          onMouseOut={(e) => (e.target.style.color = "#fff")}
        >
          Find Ride
        </button>

        <button
          style={navButtonStyle}
          onClick={() => navigate("/new")}
          onMouseOver={(e) => (e.target.style.color = "#00b96f")}
          onMouseOut={(e) => (e.target.style.color = "#fff")}
        >
          Offer Ride
        </button>

        <button
          style={navButtonStyle}
          onClick={() => navigate("/eco")}
          onMouseOver={(e) => (e.target.style.color = "#00b96f")}
          onMouseOut={(e) => (e.target.style.color = "#fff")}
        >
          Eco Stats
        </button>

        {/* 🧭 Conditional Links by Role */}
        {role === "Driver" && (
          <button
            style={navButtonStyle}
            onClick={() => navigate("/myrides")}
            onMouseOver={(e) => (e.target.style.color = "#00b96f")}
            onMouseOut={(e) => (e.target.style.color = "#fff")}
          >
            My Rides
          </button>
        )}

        {role === "Rider" && (
          <button
            style={navButtonStyle}
            onClick={() => navigate("/joined")}
            onMouseOver={(e) => (e.target.style.color = "#00b96f")}
            onMouseOut={(e) => (e.target.style.color = "#fff")}
          >
            My Joined Rides
          </button>
        )}

        {/* 👋 User Info */}
        <div
          style={{
            color: "#aaa",
            fontSize: "14px",
            borderLeft: "1px solid #333",
            paddingLeft: "15px",
          }}
        >
          👋 {userName || "User"}
        </div>

        {/* 🚪 Logout */}
        <button
          onClick={logout}
          style={{
            background: "#d33",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            padding: "6px 10px",
            cursor: "pointer",
            fontSize: "14px",
            transition: "0.3s",
          }}
          onMouseOver={(e) => (e.target.style.background = "#b22")}
          onMouseOut={(e) => (e.target.style.background = "#d33")}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
