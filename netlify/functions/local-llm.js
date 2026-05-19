import { emptyResponse, jsonResponse, responseFromFetch, upstreamPath } from "./proxy-utils.js";

function localLlmOrigin() {
  return (process.env.LOCAL_LLM_ORIGIN || "http://lm.alluser.site:1234").replace(/\/+$/g, "");
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return emptyResponse();

  const origin = localLlmOrigin();
  const path = upstreamPath(event, "local-llm");

  try {
    const upstream = await fetch(`${origin}${path}`, {
      method: event.httpMethod,
      headers: {
        "content-type": event.headers["content-type"] || event.headers["Content-Type"] || "application/json"
      },
      body: event.httpMethod === "GET" || event.httpMethod === "HEAD" ? undefined : event.body
    });

    return responseFromFetch(upstream);
  } catch (error) {
    return jsonResponse(502, { error: error instanceof Error ? error.message : String(error) });
  }
}

