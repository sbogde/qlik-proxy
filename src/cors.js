import cors from "cors";

export function buildCors() {
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // allow server-to-server / curl
      if (allowed.includes(origin)) return cb(null, true);
      cb(new Error(`CORS blocked: ${origin} not in allowlist`));
    },
    credentials: true,
    exposedHeaders: ["Content-Length", "X-Request-Id"],
  });
}
