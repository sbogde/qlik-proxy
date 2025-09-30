import helmet from "helmet";

export function harden(app) {
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  const token = process.env.PROXY_TOKEN;
  if (!token) {
    // dev convenience – DO NOT ship like this
    console.warn("⚠️  PROXY_TOKEN not set – auth is disabled (dev mode).");
    return;
  }

  app.use((req, res, next) => {
    const t = req.header("x-proxy-token");
    if (t !== token) return res.status(401).json({ error: "unauthorised" });
    next();
  });
}
