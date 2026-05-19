export const DEFAULT_LLM_ENDPOINT = "/v1";
export const DEFAULT_LLM_MODEL_ID = "google/gemma-4-e4b";
export const OPENAI_LLM_ENDPOINT = "/openai/v1";
export const DEFAULT_OPENAI_MODEL_ID = "gpt-5.4-nano";

export function normalizeEndpoint(endpoint = DEFAULT_LLM_ENDPOINT) {
  const value = typeof endpoint === "string" && endpoint.trim() ? endpoint.trim() : DEFAULT_LLM_ENDPOINT;
  return value.replace(/\/+$/g, "") || DEFAULT_LLM_ENDPOINT;
}

function readableError(error) {
  return error instanceof Error ? error.message : String(error || "알 수 없는 오류");
}

function localSetupMessage(detail = "") {
  return "로컬 AI와 연결하지 못했습니다. AI 프로그램이 켜져 있는지 확인해주세요.";
}

function openAiSetupMessage(detail = "") {
  return "OpenAI 모델을 확인하지 못했습니다. 배포 환경의 API 키 설정을 확인해주세요.";
}

function setupMessageForEndpoint(endpoint, detail = "") {
  return normalizeEndpoint(endpoint) === OPENAI_LLM_ENDPOINT ? openAiSetupMessage(detail) : localSetupMessage(detail);
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function listModels({ endpoint = DEFAULT_LLM_ENDPOINT, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "fetch_unavailable", models: [], message: setupMessageForEndpoint(endpoint, "fetch 사용 불가") };
  }

  const base = normalizeEndpoint(endpoint);
  try {
    const response = await fetchImpl(`${base}/models`, { method: "GET" });
    const body = await readJson(response);

    if (!response.ok) {
      return {
        ok: false,
        reason: "http_error",
        status: response.status,
        models: [],
        message: setupMessageForEndpoint(base, `${response.status} ${response.statusText || ""}`.trim())
      };
    }

    const models = Array.isArray(body?.data)
      ? body.data.map((model) => model?.id).filter((id) => typeof id === "string" && id.trim())
      : [];

    if (!models.length) {
      return { ok: false, reason: "no_models", models: [], message: setupMessageForEndpoint(base, "로드된 모델 없음") };
    }

    return { ok: true, models, endpoint: base };
  } catch (error) {
    return { ok: false, reason: "network_error", models: [], message: setupMessageForEndpoint(base, readableError(error)) };
  }
}

export async function chatCompletion({
  endpoint = DEFAULT_LLM_ENDPOINT,
  model = DEFAULT_LLM_MODEL_ID,
  messages = [],
  maxTokens = 1536,
  temperature = 0.4,
  fetchImpl = globalThis.fetch
} = {}) {
  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "fetch_unavailable", content: "", message: setupMessageForEndpoint(endpoint, "fetch 사용 불가") };
  }

  const base = normalizeEndpoint(endpoint);
  try {
    const response = await fetchImpl(`${base}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature })
    });
    const body = await readJson(response);

    if (!response.ok) {
      return {
        ok: false,
        reason: "http_error",
        status: response.status,
        content: "",
        message: setupMessageForEndpoint(base, `${response.status} ${response.statusText || ""}`.trim())
      };
    }

    const choice = Array.isArray(body?.choices) ? body.choices[0] : null;
    const content = typeof choice?.message?.content === "string" ? choice.message.content.trim() : "";
    const reasoningOnly = !content && typeof choice?.message?.reasoning_content === "string" && choice.message.reasoning_content.trim();

    if (!content) {
      return {
        ok: false,
        reason: "empty_content",
        content: "",
        reasoningContent: reasoningOnly || "",
        message: "AI가 답변을 비워 보냈습니다. 잠시 후 한 번 더 입력해주세요."
      };
    }

    return {
      ok: true,
      content,
      truncated: choice?.finish_reason === "length",
      finishReason: choice?.finish_reason || "stop",
      raw: body
    };
  } catch (error) {
    return { ok: false, reason: "network_error", content: "", message: setupMessageForEndpoint(base, readableError(error)) };
  }
}

export function createLocalLlmSettings({ endpoint = DEFAULT_LLM_ENDPOINT, models = [], fallbackModelId = DEFAULT_LLM_MODEL_ID } = {}) {
  const usableModels = Array.isArray(models) ? models.filter((model) => typeof model === "string" && model.trim()) : [];
  const fallback = typeof fallbackModelId === "string" && fallbackModelId.trim() ? fallbackModelId.trim() : DEFAULT_LLM_MODEL_ID;
  const preferredModel = usableModels.find((model) => model === fallback) || usableModels[0] || fallback;
  const modelId = preferredModel;
  return { endpoint: normalizeEndpoint(endpoint), modelId };
}
