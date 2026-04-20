const nowMs = () => Date.now();

export const rateLimit = ({ windowMs = 60_000, max = 20, message = "Too many requests" } = {}) => {
  // Simple in-memory limiter (demo-grade).
  const hits = new Map(); // key -> { count, resetAt }

  return (req, res, next) => {
    const key = `${req.ip || "ip"}:${req.baseUrl || ""}:${req.path || ""}`;
    const t = nowMs();

    const existing = hits.get(key);
    if (!existing || existing.resetAt <= t) {
      hits.set(key, { count: 1, resetAt: t + windowMs });
      return next();
    }

    existing.count += 1;
    if (existing.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((existing.resetAt - t) / 1000)));
      return res.status(429).json({ message });
    }

    return next();
  };
};

