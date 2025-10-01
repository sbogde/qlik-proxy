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

    if (isWsUpgrade) {
      const urlPreview = req.originalUrl || req.url || "";
      console.log(
        `[security] WS upgrade from ${req.headers.origin || req.headers.host} url=${urlPreview}`
      );
      return next();
    }

    const provided = req.header("x-proxy-token");

    if (provided !== token) {
      return res.status(401).json({ error: "unauthorised" });
    }
    next();
  });
}
