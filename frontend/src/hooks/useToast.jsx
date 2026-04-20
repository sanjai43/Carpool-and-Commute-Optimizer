import { useCallback, useMemo, useState } from "react";

export default function useToast() {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "info") => {
    if (!message) return;
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const ToastContainer = useMemo(() => {
    return function ToastContainer() {
      return (
        <div
          style={{
            position: "fixed",
            top: 20,
            right: 20,
            zIndex: 9999,
          }}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              style={{
                marginBottom: "10px",
                padding: "10px 16px",
                borderRadius: "8px",
                background:
                  t.type === "success"
                    ? "#00b96f"
                    : t.type === "error"
                    ? "#d33"
                    : "#444",
                color: "#fff",
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                fontSize: "14px",
                animation: "fadeIn 0.3s ease-out",
              }}
            >
              {t.message}
            </div>
          ))}
        </div>
      );
    };
  }, [toasts]);

  return { showToast, ToastContainer };
}
