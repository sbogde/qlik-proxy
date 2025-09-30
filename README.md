# qlik-proxy

Reverse proxy for Qlik Sense demo with CORS and WebSocket support.
Use it to let frontends (localhost, lovable.app, your domain) talk to
`sense-demo.qlik.com` **without** browser CORS issues.

## Quick start (local)

```bash
cp .env.example .env
# edit .env: add your origins and a strong PROXY_TOKEN
npm i
npm run dev
```
