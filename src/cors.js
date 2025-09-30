import cors from "cors";

export function buildCors() {
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const exact = new Set();
  const patterns = [];

  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  allowed.forEach((entry) => {
    if (entry.includes("*")) {
      const regex = new RegExp(
        "^" + entry.split("*").map(escapeRegex).join(".*") + "$"
      );
      patterns.push(regex);
    } else {
      exact.add(entry);
    }
  });

  return cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true); // allow server-to-server / curl
      if (exact.has(origin)) return cb(null, true);
      if (patterns.some((re) => re.test(origin))) return cb(null, true);
      cb(new Error(`CORS blocked: ${origin} not in allowlist`));
    },
    credentials: true,
    exposedHeaders: ["Content-Length", "X-Request-Id"],
  });
}
