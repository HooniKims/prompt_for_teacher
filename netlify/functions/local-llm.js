import { emptyResponse, jsonResponse, responseFromFetch, upstreamPath } from "./proxy-utils.js";

export function localLlmOrigin() {
  const raw = process.env.LMSTUDIO_API_URL || process.env.LOCAL_LLM_ORIGIN || "https://lm.alluser.site";
  return raw.trim().replace(/\/+$/g, "").replace(/\/v1$/i, "");
}

export function localLlmHeaders(event, origin = localLlmOrigin()) {
  const incomingHeaders = event.headers || {};
  const headers = {
    "content-type": incomingHeaders["content-type"] || incomingHeaders["Content-Type"] || "application/json",
    origin,
    referer: `${origin}/`
  };
  const apiKey = process.env.LMSTUDIO_API_KEY?.trim();
  if (apiKey) headers["x-api-key"] = apiKey;
  return headers;
}

export function localLlmBody(event, path) {
  if (event.httpMethod === "GET" || event.httpMethod === "HEAD") return undefined;
  if (event.httpMethod !== "POST" || !path.startsWith("/v1/chat/completions")) return event.body;

  try {
    const payload = JSON.parse(event.body || "{}");
    if (payload && typeof payload === "object") {
      payload.reasoning_effort = payload.reasoning_effort || "none";
      payload.stream = false;
    }
    return JSON.stringify(payload);
  } catch {
    return event.body;
  }
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return emptyResponse();

  const origin = localLlmOrigin();
  const path = upstreamPath(event, "local-llm");

  try {
    const upstream = await fetch(`${origin}${path}`, {
      method: event.httpMethod,
      headers: localLlmHeaders(event),
      body: localLlmBody(event, path)
    });

    return responseFromFetch(upstream);
  } catch (error) {
    return jsonResponse(502, { error: error instanceof Error ? error.message : String(error) });
  }
}
