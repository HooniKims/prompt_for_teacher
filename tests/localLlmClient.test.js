import test from "node:test";
import assert from "node:assert/strict";
import {
  chatCompletion,
  createLocalLlmSettings,
  listModels,
  normalizeEndpoint
} from "../webapp/modules/localLlmClient.js";

function jsonResponse(body, init = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    async json() {
      return body;
    }
  };
}

test("normalizeEndpoint removes trailing slashes and fills default local endpoint", () => {
  assert.equal(normalizeEndpoint("http://127.0.0.1:1234/v1///"), "http://127.0.0.1:1234/v1");
  assert.equal(normalizeEndpoint(""), "/v1");
});

test("listModels returns normalized model ids from OpenAI-compatible endpoint", async () => {
  const calls = [];
  const result = await listModels({
    endpoint: "http://localhost:1234/v1/",
    fetchImpl: async (url) => {
      calls.push(url);
      return jsonResponse({ data: [{ id: "google/gemma-4-e2b" }, { id: "other" }] });
    }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.models, ["google/gemma-4-e2b", "other"]);
  assert.equal(calls[0], "http://localhost:1234/v1/models");
});

test("listModels normalizes network failures into unavailable state", async () => {
  const result = await listModels({
    fetchImpl: async () => {
      throw new Error("connect ECONNREFUSED");
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "network_error");
  assert.match(result.message, /LM Studio|로컬/);
});

test("chatCompletion extracts content and marks length truncation", async () => {
  const result = await chatCompletion({
    model: "google/gemma-4-e2b",
    messages: [{ role: "user", content: "안녕" }],
    fetchImpl: async (url, init) => {
      assert.equal(url, "/v1/chat/completions");
      const payload = JSON.parse(init.body);
      assert.equal(payload.model, "google/gemma-4-e2b");
      return jsonResponse({ choices: [{ message: { content: "답변" }, finish_reason: "length" }] });
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.content, "답변");
  assert.equal(result.truncated, true);
});

test("chatCompletion treats reasoning-only or empty responses as recoverable failure", async () => {
  const result = await chatCompletion({
    model: "google/gemma-4-e2b",
    messages: [{ role: "user", content: "질문" }],
    fetchImpl: async () => jsonResponse({ choices: [{ message: { reasoning_content: "생각만 있음" } }] })
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "empty_content");
  assert.match(result.message, /답변을 비워/);
});

test("createLocalLlmSettings prefers the e2b fallback when it is available", () => {
  assert.deepEqual(createLocalLlmSettings({ models: ["model-a", "google/gemma-4-e2b"], fallbackModelId: "google/gemma-4-e2b" }), {
    endpoint: "/v1",
    modelId: "google/gemma-4-e2b"
  });
});

test("createLocalLlmSettings falls back to a discovered model when e2b is not loaded", () => {
  assert.deepEqual(createLocalLlmSettings({ models: ["model-a"], fallbackModelId: "google/gemma-4-e2b" }), {
    endpoint: "/v1",
    modelId: "model-a"
  });
});
