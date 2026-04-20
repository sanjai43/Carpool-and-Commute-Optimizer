import { useState } from "react";
import API from "../api/axios";

// ✅ Simple built-in toast system
function Toast({ message, type }) {
  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        background: type === "error" ? "#d33" : "#00b96f",
        color: "#fff",
        padding: "10px 16px",
        borderRadius: "6px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        zIndex: 9999,
        transition: "opacity 0.3s ease",
      }}
    >
      {message}
    </div>
  );
}

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "Rider",
  });
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // ✅ show toast for 3 seconds
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    const endpoint = isLogin ? "/auth/login" : "/auth/register";
    const { data } = await API.post(endpoint, form);

    if (!data?.token || !data?.user) throw new Error("Invalid response");

    // Auth token is stored as an httpOnly cookie by the backend (safer than localStorage).
    localStorage.removeItem("token");
    localStorage.setItem("user", JSON.stringify(data.user));
    localStorage.setItem("role", data.user.role);

    showToast("✅ Login successful!", "success");

   const { role } = data.user;
const next =
  role === "Driver"
    ? "/new"
    : role === "Rider"
    ? "/match"
    : "/";
setTimeout(() => (window.location.href = next), 1000);

  } catch (err) {
    showToast(err.response?.data?.message || "Login/Register failed", "error");
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="lowpoly-bg">
      {toast && <Toast message={toast.message} type={toast.type} />}

      <form
        onSubmit={handleSubmit}
        className="container fade-in"
        style={{
          width: "340px",
          background: "rgba(24, 26, 32, 0.85)",
          padding: "25px 30px",
          borderRadius: "10px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.5)",
          backdropFilter: "blur(8px)",
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <h1 style={{ textAlign: "center", color: "#00b96f", marginBottom: "5px" }}>
          CarpoolX
        </h1>
        <p
          style={{
            textAlign: "center",
            color: "#aaa",
            marginTop: "-5px",
            marginBottom: "15px",
          }}
        >
          Smarter, Greener Commutes
        </p>

        <h2
          style={{
            textAlign: "center",
            color: "#00b96f",
            marginBottom: "20px",
          }}
        >
          {isLogin ? "Welcome Back" : "Create Account"}
        </h2>

        {!isLogin && (
          <>
            <label style={{ color: "#aaa", fontSize: "13px" }}>Name</label>
            <input
              type="text"
              placeholder="Enter your name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </>
        )}

        <label style={{ color: "#aaa", fontSize: "13px" }}>Email</label>
        <input
          type="email"
          placeholder="Enter your email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />

        <label style={{ color: "#aaa", fontSize: "13px" }}>Password</label>
        <input
          type="password"
          placeholder="Enter password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />

        {!isLogin && (
          <>
            <label style={{ color: "#aaa", fontSize: "13px" }}>Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #333",
                background: "#131417",
                color: "#fff",
                marginBottom: "10px",
              }}
            >
              <option value="Rider">Rider</option>
              <option value="Driver">Driver</option>
            </select>
          </>
        )}

        <button
          type="submit"
          style={{
            width: "100%",
            background: "#00b96f",
            color: "#fff",
            padding: "10px",
            fontSize: "16px",
            borderRadius: "6px",
            marginTop: "10px",
            opacity: loading ? 0.7 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
          disabled={loading}
        >
          {loading ? "Processing..." : isLogin ? "Login" : "Register"}
        </button>

        <p
          style={{
            textAlign: "center",
            marginTop: "15px",
            color: "#aaa",
            fontSize: "14px",
          }}
        >
          {isLogin ? (
            <>
              New user?{" "}
              <span
                style={{ color: "#00b96f", cursor: "pointer" }}
                onClick={() => setIsLogin(false)}
              >
                Register
              </span>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <span
                style={{ color: "#00b96f", cursor: "pointer" }}
                onClick={() => setIsLogin(true)}
              >
                Login
              </span>
            </>
          )}
        </p>
      </form>
    </div>
  );
}
