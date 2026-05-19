import { emptyResponse, jsonResponse, responseFromFetch, upstreamPath } from "./proxy-utils.js";

export function localLlmOrigin() {
  const raw = process.env.LMSTUDIO_API_URL || process.env.LOCAL_LLM_ORIGIN || "http://lm.alluser.site:1234";
  return raw.trim().replace(/\/+$/g, "").replace(/\/v1$/i, "");
}

function localLlmHeaders(event) {
  const headers = {
    "content-type": event.headers["content-type"] || event.headers["Content-Type"] || "application/json"
  };
  const apiKey = process.env.LMSTUDIO_API_KEY?.trim();
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  return headers;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return emptyResponse();

  const origin = localLlmOrigin();
  const path = upstreamPath(event, "local-llm");

  try {
    const upstream = await fetch(`${origin}${path}`, {
      method: event.httpMethod,
      headers: localLlmHeaders(event),
      body: event.httpMethod === "GET" || event.httpMethod === "HEAD" ? undefined : event.body
    });

    return responseFromFetch(upstream);
  } catch (error) {
    return jsonResponse(502, { error: error instanceof Error ? error.message : String(error) });
  }
}
