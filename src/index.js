import "dotenv/config";
import express from "express";
import http from "http";
import httpProxy from "http-proxy";
import { buildCors } from "./cors.js";
import { harden } from "./security.js";
import { httpLogger } from "./logger.js";

const PORT = process.env.PORT || 3000;
const TARGET_HOST = process.env.TARGET_HOST || "https://sense-demo.qlik.com";
const PROXY_TOKEN = process.env.PROXY_TOKEN;
const DEV_BYPASS = !PROXY_TOKEN && process.env.NODE_ENV === "development";

const app = express();
const server = http.createServer(app);

const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  secure: true, // validate TLS of target
  xfwd: true, // add X-Forwarded-* headers
});

const swallowStreamError = (label) => (error) => {
  if (!error) return;
  console.error(`${label} stream error:`, error?.message || error);
};

proxy.on("error", (err, req, res) => {
  const message = err?.message || err;
  console.error("Proxy error:", message);

  if (res) {
    if (typeof res.writeHead === "function" && !res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
      res.end("Proxy error");
    } else if (typeof res.end === "function") {
      try {
        res.end();
      } catch (_) {}
    }

    if (typeof res.destroy === "function") {
      try {
        res.destroy();
      } catch (_) {}
    }
  }

  if (req && typeof req.destroy === "function") {
    try {
      req.destroy();
    } catch (_) {}
  }
});

proxy.on("proxyRes", (proxyRes, req, res) => {
    proxyRes.on("error", swallowStreamError("proxyRes"));
    req?.on("error", swallowStreamError("proxyReq"));
    res?.on("error", swallowStreamError("proxyClient"));
});

// ----------- middleware
app.use(httpLogger);
app.use(express.json({ limit: "512kb" }));
app.use(buildCors());
harden(app);

// Health
app.get("/health", (_, res) => res.json({ ok: true, target: TARGET_HOST }));

// ---- HTTP proxy: prefix /api -> TARGET_HOST
app.use("/api", (req, res) => {
  const target = TARGET_HOST + req.originalUrl.replace(/^\/api/, "");
  req.on("error", swallowStreamError("clientReq"));
  res.on("error", swallowStreamError("clientRes"));

  proxy.web(req, res, { target }, (err) => {
    console.error("HTTP proxy error:", err?.message);
    if (!res.headersSent) res.status(502).send("Proxy error");
  });
});

// ---- OPTIONAL: sanity endpoint to show which host we proxy
app.get("/", (_, res) =>
  res.type("text").send(`qlik-proxy → ${TARGET_HOST}\n`)
);

// ---- WebSocket proxy: forward engine connections
server.on("upgrade", (req, socket, head) => {
  // Convert https:// -> wss://
  const targetWs = TARGET_HOST.replace(/^http/i, "ws");

  // Tip: if a target insists on an Origin, uncomment next line:
  // req.headers.origin = TARGET_HOST;

  let queryToken;
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    queryToken = url.searchParams.get("token");
    if (queryToken) {
      url.searchParams.delete("token");
      req.url =
        url.pathname +
        (url.searchParams.size
          ? `?${url.searchParams.toString()}`
          : "");
    }
  } catch (err) {
    console.warn("Failed to parse WS request URL:", err?.message || err);
  }

  const headerToken = req.headers["x-proxy-token"];
  const providedToken = headerToken || queryToken;

  if (!DEV_BYPASS && PROXY_TOKEN) {
    if (providedToken !== PROXY_TOKEN) {
      console.warn(
        "WebSocket upgrade rejected: missing or invalid token from",
        req.headers.origin || req.headers.host
      );
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
  }

  try {
    req.headers.origin = TARGET_HOST;
  } catch (err) {
    console.warn("Failed to set Origin header for WS request:", err?.message || err);
  }

  socket.on("error", swallowStreamError("wsClient"));
  req.on("error", swallowStreamError("wsReq"));

  proxy.ws(req, socket, head, { target: targetWs }, (err) => {
    console.error("WS proxy error:", err?.message);
    try {
      socket.destroy();
    } catch (_) {}
  });
});

// ---- start
server.listen(PORT, () => {
  console.log(`qlik-proxy listening on :${PORT}`);
  console.log(
    `→ forwarding HTTP under /api/* and WS upgrades to ${TARGET_HOST}`
  );
});
