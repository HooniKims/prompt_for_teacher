import test from "node:test";
import assert from "node:assert/strict";
import { upstreamPath } from "../netlify/functions/proxy-utils.js";
import { handler as openAiHandler } from "../netlify/functions/openai.js";
import { localLlmOrigin } from "../netlify/functions/local-llm.js";

test("Netlify proxy path keeps v1 routes after redirects", () => {
  assert.equal(
    upstreamPath({ rawUrl: "https://site.netlify.app/.netlify/functions/openai/v1/models" }, "openai", "/openai"),
    "/v1/models"
  );
  assert.equal(
    upstreamPath({ rawUrl: "https://site.netlify.app/openai/v1/chat/completions?x=1" }, "openai", "/openai"),
    "/v1/chat/completions?x=1"
  );
  assert.equal(
    upstreamPath({ rawUrl: "https://site.netlify.app/.netlify/functions/local-llm/v1/models" }, "local-llm"),
    "/v1/models"
  );
});

test("OpenAI Netlify function returns configured model list without exposing API key", async () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-5.4-nano";

  try {
    const response = await openAiHandler({
      httpMethod: "GET",
      rawUrl: "https://site.netlify.app/.netlify/functions/openai/v1/models",
      headers: {}
    });
    const body = JSON.parse(response.body);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(body.data, [{ id: "gpt-5.4-nano", object: "model" }]);
    assert.doesNotMatch(response.body, /test-key/);
  } finally {
    if (originalApiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalApiKey;

    if (originalModel === undefined) delete process.env.OPENAI_MODEL;
    else process.env.OPENAI_MODEL = originalModel;
  }
});

test("LM Studio Netlify function accepts common environment variable names", () => {
  const originalLmStudioUrl = process.env.LMSTUDIO_API_URL;
  const originalLocalOrigin = process.env.LOCAL_LLM_ORIGIN;

  process.env.LMSTUDIO_API_URL = "http://example.test:1234/v1/";
  process.env.LOCAL_LLM_ORIGIN = "http://fallback.test:1234";

  try {
    assert.equal(localLlmOrigin(), "http://example.test:1234");
  } finally {
    if (originalLmStudioUrl === undefined) delete process.env.LMSTUDIO_API_URL;
    else process.env.LMSTUDIO_API_URL = originalLmStudioUrl;

    if (originalLocalOrigin === undefined) delete process.env.LOCAL_LLM_ORIGIN;
    else process.env.LOCAL_LLM_ORIGIN = originalLocalOrigin;
  }
});
