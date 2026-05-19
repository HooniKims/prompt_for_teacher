import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const HOST = "127.0.0.1";
const PORT = 5173;
const WEB_ROOT = resolve("webapp");
const LLM_ORIGIN = "http://lm.alluser.site:1234";
const OPENAI_ORIGIN = "https://api.openai.com";

async function loadEnvFile() {
  try {
    const raw = await readFile(resolve(".env"), "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const separator = trimmed.indexOf("=");
      if (separator === -1) return;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (key && process.env[key] === undefined) process.env[key] = value;
    });
  } catch {
    // .env is optional; local AI can still be used without it.
  }
}

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2"
};

function addNoCacheHeaders(response) {
  response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
}

function send(response, status, body, headers = {}) {
  response.writeHead(status, headers);
  response.end(body);
}

async function readRequestBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function resolveStaticPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = normalize(decoded === "/" ? "index.html" : decoded.replace(/^\/+/, ""));
  const filePath = resolve(join(WEB_ROOT, relative));
  return filePath === WEB_ROOT || filePath.startsWith(`${WEB_ROOT}${sep}`) ? filePath : null;
}

async function serveStatic(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
  const filePath = resolveStaticPath(url.pathname);
  if (!filePath) {
    send(response, 403, "Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      send(response, 404, "Not found");
      return;
    }

    addNoCacheHeaders(response);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
      "Content-Length": fileStat.size
    });
    createReadStream(filePath).pipe(response);
  } catch {
    send(response, 404, "Not found");
  }
}

async function proxyLlm(request, response) {
  const incomingUrl = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
  const upstreamUrl = new URL(`${LLM_ORIGIN}${incomingUrl.pathname}${incomingUrl.search}`);
  const headers = { ...request.headers, host: upstreamUrl.host, origin: LLM_ORIGIN };
  delete headers.connection;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request,
      duplex: "half"
    });

    response.writeHead(upstream.status, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type, authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8"
    });
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    send(response, 502, JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    });
  }
}

function configuredOpenAiModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.4-nano";
}

async function proxyOpenAi(request, response) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    send(response, 500, JSON.stringify({ error: "OpenAI API key is missing" }), {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    });
    return;
  }

  const incomingUrl = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
  const upstreamPath = incomingUrl.pathname.replace(/^\/openai/, "");

  if (request.method === "GET" && upstreamPath === "/v1/models") {
    send(response, 200, JSON.stringify({ data: [{ id: configuredOpenAiModel(), object: "model" }] }), {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    });
    return;
  }

  const upstreamUrl = new URL(`${OPENAI_ORIGIN}${upstreamPath}${incomingUrl.search}`);
  const headers = {
    "content-type": request.headers["content-type"] || "application/json",
    authorization: `Bearer ${apiKey}`
  };

  try {
    let body = request.method === "GET" || request.method === "HEAD" ? undefined : request;

    if (request.method === "POST" && upstreamPath === "/v1/chat/completions") {
      const rawBody = await readRequestBody(request);
      try {
        const payload = JSON.parse(rawBody.toString("utf8"));
        if (payload && typeof payload === "object" && "max_tokens" in payload) {
          payload.max_completion_tokens = payload.max_tokens;
          delete payload.max_tokens;
        }
        body = JSON.stringify(payload);
      } catch {
        body = rawBody;
      }
    }

    const upstream = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body,
      duplex: "half"
    });

    response.writeHead(upstream.status, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type, authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8"
    });
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    send(response, 502, JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    });
  }
}

const server = createServer((request, response) => {
  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type, authorization",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    });
    response.end();
    return;
  }

  if (request.url?.startsWith("/v1/")) {
    void proxyLlm(request, response);
    return;
  }

  if (request.url?.startsWith("/openai/v1/")) {
    void proxyOpenAi(request, response);
    return;
  }

  void serveStatic(request, response);
});

await loadEnvFile();

server.listen(PORT, HOST, () => {
  console.log(`Serving webapp at http://${HOST}:${PORT}/`);
  console.log(`Proxying /v1/* to ${LLM_ORIGIN}/v1/*`);
  console.log(`Proxying /openai/v1/* to ${OPENAI_ORIGIN}/v1/*`);
});
