import { useEffect, useState } from "react";

export default function Toast({ message, type = "success", duration = 2500, onClose }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible) return null;

  const bgColor =
    type === "success"
      ? "linear-gradient(90deg, #00b96f, #007f4e)"
      : type === "error"
      ? "linear-gradient(90deg, #d33, #a00)"
      : "linear-gradient(90deg, #ffaa00, #cc8800)";

  return (
    <div
      style={{
        position: "fixed",
        bottom: "30px",
        right: "30px",
        background: bgColor,
        color: "white",
        padding: "12px 18px",
        borderRadius: "8px",
        fontWeight: "500",
        boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
        zIndex: 9999,
        animation: "slideUp 0.4s ease",
        minWidth: "220px",
        textAlign: "center",
      }}
    >
      {message}
    </div>
  );
}
