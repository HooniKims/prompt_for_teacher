export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

export function jsonResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      ...headers
    },
    body: JSON.stringify(body)
  };
}

export function emptyResponse(statusCode = 204) {
  return {
    statusCode,
    headers: corsHeaders,
    body: ""
  };
}

export function upstreamPath(event, functionName, strippedPrefix = "") {
  const rawUrl = event.rawUrl || `https://local${event.path || "/"}`;
  const url = new URL(rawUrl);
  let pathname = url.pathname;
  const functionPath = `/.netlify/functions/${functionName}`;

  if (pathname.startsWith(functionPath)) {
    pathname = pathname.slice(functionPath.length) || "/";
  }

  const v1Index = pathname.indexOf("/v1/");
  if (v1Index >= 0) {
    pathname = pathname.slice(v1Index);
  }

  if (strippedPrefix && pathname.startsWith(strippedPrefix)) {
    pathname = pathname.slice(strippedPrefix.length) || "/";
  }

  if (!pathname.startsWith("/")) pathname = `/${pathname}`;
  return `${pathname}${url.search}`;
}

export async function responseFromFetch(upstream) {
  return {
    statusCode: upstream.status,
    headers: {
      ...corsHeaders,
      "Content-Type": upstream.headers.get("content-type") || "application/json; charset=utf-8"
    },
    body: await upstream.text()
  };
}

