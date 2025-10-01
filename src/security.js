import helmet from "helmet";

export function harden(app) {
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  const token = process.env.PROXY_TOKEN;
  const isDev = process.env.NODE_ENV === "development";

  if (!token && isDev) {
    console.warn(
      "⚠️  PROXY_TOKEN not set – auth bypassed because NODE_ENV=development"
    );
    return;
  }

  app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
      return next();
    }

    if (req.method === "GET" && req.path === "/health") {
      return next();
    }

    const isWsUpgrade =
      (req.headers.upgrade || "").toLowerCase() === "websocket";

    let provided = req.header("x-proxy-token");

    if (!provided && isWsUpgrade) {
      try {
        const url = new URL(
          req.originalUrl || req.url,
          `http://${req.headers.host || "localhost"}`
        );
        provided = url.searchParams.get("token");
      } catch (err) {
        console.warn("Failed to parse WS token query:", err?.message || err);
      }
    }

    if (provided !== token) {
      return res.status(401).json({ error: "unauthorised" });
    }
    next();
  });
}
