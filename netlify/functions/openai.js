import { emptyResponse, jsonResponse, responseFromFetch, upstreamPath } from "./proxy-utils.js";

const OPENAI_ORIGIN = "https://api.openai.com";

function configuredOpenAiModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.4-nano";
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return emptyResponse();

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return jsonResponse(500, { error: "OpenAI API key is missing" });
  }

  const path = upstreamPath(event, "openai", "/openai");

  if (event.httpMethod === "GET" && path === "/v1/models") {
    return jsonResponse(200, { data: [{ id: configuredOpenAiModel(), object: "model" }] });
  }

  let body = event.httpMethod === "GET" || event.httpMethod === "HEAD" ? undefined : event.body;

  if (event.httpMethod === "POST" && path === "/v1/chat/completions" && body) {
    try {
      const payload = JSON.parse(event.isBase64Encoded ? Buffer.from(body, "base64").toString("utf8") : body);
      if (payload && typeof payload === "object" && "max_tokens" in payload) {
        payload.max_completion_tokens = payload.max_tokens;
        delete payload.max_tokens;
      }
      body = JSON.stringify(payload);
    } catch {
      // Forward the original body if it is not JSON.
    }
  }

  try {
    const upstream = await fetch(`${OPENAI_ORIGIN}${path}`, {
      method: event.httpMethod,
      headers: {
        "content-type": event.headers["content-type"] || event.headers["Content-Type"] || "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body
    });

    return responseFromFetch(upstream);
  } catch (error) {
    return jsonResponse(502, { error: error instanceof Error ? error.message : String(error) });
  }
}

