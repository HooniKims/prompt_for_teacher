export const STORAGE_KEYS = {
  sessions: "teacherPromptGuide.sessions.v1",
  activeDraft: "teacherPromptGuide.activeDraft.v1",
  memory: "teacherPromptGuide.memory.v1",
  settings: "teacherPromptGuide.settings.v2",
  legacySessions: "teacherPromptGuideSessions"
};

const MAX_SESSIONS = 20;
const MAX_MEMORY_ITEMS = 30;
const DEFAULT_MEMORY_STORE = { items: [], updatedAt: "" };
const LEGACY_LLM_ENDPOINTS = new Set(["http://127.0.0.1:1234/v1", "http://lm.alluser.site:1234/v1"]);
const DEFAULT_LLM_ENDPOINT = "/v1";
const OPENAI_LLM_ENDPOINT = "/openai/v1";
const DEFAULT_OPENAI_MODEL_ID = "gpt-5.4-nano";
const DEFAULT_SETTINGS = {
  memoryEnabled: true,
  guideMode: "thorough",
  theme: "light",
  llmProvider: "openai",
  llmEndpoint: OPENAI_LLM_ENDPOINT,
  llmModelId: DEFAULT_OPENAI_MODEL_ID
};
let generatedSessionIdCounter = 0;

function browserStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function safeRead(key, fallback, storage = browserStorage()) {
  if (!storage) return fallback;

  try {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeWrite(key, value, storage = browserStorage()) {
  if (!storage) return { ok: false, message: "localStorage is unavailable" };

  try {
    storage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

function safeRemove(key, storage = browserStorage()) {
  if (!storage) return { ok: false, message: "localStorage is unavailable" };

  try {
    storage.removeItem(key);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

function normalizeMessages(messages) {
  return Array.isArray(messages)
    ? messages
        .filter((message) => message && typeof message === "object")
        .map((message) => ({
          role: typeof message.role === "string" ? message.role : "assistant",
          text: typeof message.text === "string" ? message.text : ""
        }))
    : [];
}

function normalizeMemoryItems(items) {
  return Array.isArray(items)
    ? items
        .filter((item) => item && typeof item === "object" && typeof item.text === "string" && item.text.trim())
        .map((item) => ({
          ...item,
          text: item.text.trim()
        }))
        .slice(0, MAX_MEMORY_ITEMS)
    : [];
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function createSessionId(index) {
  generatedSessionIdCounter = (generatedSessionIdCounter + 1) % Number.MAX_SAFE_INTEGER;
  return `session-${Date.now()}-${index}-${generatedSessionIdCounter}`;
}

function normalizeSession(session, index = 0) {
  const source = normalizeObject(session);
  const createdAt = typeof source.createdAt === "string" && source.createdAt ? source.createdAt : new Date().toISOString();
  const title =
    typeof source.title === "string" && source.title
      ? source.title
      : typeof source.initialRequest === "string" && source.initialRequest
        ? source.initialRequest
        : `Session ${index + 1}`;

  return {
    id: typeof source.id === "string" && source.id ? source.id : createSessionId(index),
    title,
    initialRequest: typeof source.initialRequest === "string" ? source.initialRequest : title,
    activeStepIndex: Number.isInteger(source.activeStepIndex) ? source.activeStepIndex : -1,
    answers: normalizeObject(source.answers),
    answerMeta: normalizeObject(source.answerMeta),
    finalPrompt: typeof source.finalPrompt === "string" ? source.finalPrompt : typeof source.prompt === "string" ? source.prompt : "",
    referenceNotes:
      typeof source.referenceNotes === "string" ? source.referenceNotes : typeof source.reference === "string" ? source.reference : "",
    messages: normalizeMessages(source.messages),
    completed: source.completed === true,
    createdAt,
    updatedAt: typeof source.updatedAt === "string" && source.updatedAt ? source.updatedAt : createdAt,
    memorySummary: source.memorySummary ?? null
  };
}

function parseJsonFromStorage(key, storage = browserStorage()) {
  if (!storage) return { ok: false, message: "localStorage is unavailable" };

  try {
    const raw = storage.getItem(key);
    if (raw === null) return { ok: true, value: null };
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, message: errorMessage(error) };
  }
}

export function readSessions(storage = browserStorage()) {
  const stored = safeRead(STORAGE_KEYS.sessions, [], storage);
  if (!Array.isArray(stored)) return [];
  return stored.map((session, index) => normalizeSession(session, index));
}

export function saveSession(session, storage = browserStorage()) {
  const normalized = normalizeSession(session);
  const existing = readSessions(storage);
  const next = [
    normalized,
    ...existing.filter((item) => item.id !== normalized.id)
  ].slice(0, MAX_SESSIONS);

  return safeWrite(STORAGE_KEYS.sessions, next, storage);
}

export function clearSessions(storage = browserStorage()) {
  return safeRemove(STORAGE_KEYS.sessions, storage);
}

export function migrateLegacySessions(storage = browserStorage()) {
  const legacyResult = parseJsonFromStorage(STORAGE_KEYS.legacySessions, storage);
  if (!legacyResult.ok) {
    return { ok: false, migrated: 0, message: legacyResult.message };
  }

  if (legacyResult.value === null) {
    return { ok: true, migrated: 0 };
  }

  if (!Array.isArray(legacyResult.value)) {
    return { ok: false, migrated: 0, message: "legacy sessions are not an array" };
  }

  const legacySessions = legacyResult.value.map((session, index) => normalizeSession(session, index));
  const existing = readSessions(storage);
  const existingIds = new Set(existing.map((session) => session.id));
  const existingTitles = new Set(existing.map((session) => session.title));
  const migrated = legacySessions.filter((session) => {
    if (existingIds.has(session.id) || existingTitles.has(session.title)) return false;
    existingIds.add(session.id);
    existingTitles.add(session.title);
    return true;
  });
  const next = [...migrated, ...existing].slice(0, MAX_SESSIONS);
  const writeResult = safeWrite(STORAGE_KEYS.sessions, next, storage);
  if (!writeResult.ok) {
    return { ...writeResult, migrated: 0 };
  }

  const removeResult = safeRemove(STORAGE_KEYS.legacySessions, storage);
  if (!removeResult.ok) {
    return { ...removeResult, migrated: migrated.length };
  }

  return { ok: true, migrated: migrated.length };
}

export function readActiveDraft(storage = browserStorage()) {
  return safeRead(STORAGE_KEYS.activeDraft, null, storage);
}

export function writeActiveDraft(draft, storage = browserStorage()) {
  return safeWrite(
    STORAGE_KEYS.activeDraft,
    {
      ...normalizeObject(draft),
      updatedAt: new Date().toISOString()
    },
    storage
  );
}

export function clearActiveDraft(storage = browserStorage()) {
  return safeRemove(STORAGE_KEYS.activeDraft, storage);
}

export function readMemoryStore(storage = browserStorage()) {
  const stored = safeRead(STORAGE_KEYS.memory, DEFAULT_MEMORY_STORE, storage);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return { ...DEFAULT_MEMORY_STORE };

  return {
    items: normalizeMemoryItems(stored.items),
    updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : ""
  };
}

export function writeMemoryStore(memory, storage = browserStorage()) {
  const source = normalizeObject(memory);
  return safeWrite(
    STORAGE_KEYS.memory,
    {
      items: normalizeMemoryItems(source.items),
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString()
    },
    storage
  );
}

export function clearMemoryStore(storage = browserStorage()) {
  return safeRemove(STORAGE_KEYS.memory, storage);
}

function normalizeTheme(value) {
  return value === "dark" || value === "light" ? value : DEFAULT_SETTINGS.theme;
}

function normalizeGuideMode(value) {
  return value === "thorough" || value === "friendly" ? value : DEFAULT_SETTINGS.guideMode;
}

function inferLlmProvider(source = {}) {
  if (source.llmProvider === "openai" || source.llmProvider === "local") return source.llmProvider;
  const endpoint = typeof source.llmEndpoint === "string" ? source.llmEndpoint.trim().replace(/\/+$/g, "") : "";
  if (endpoint === DEFAULT_LLM_ENDPOINT || LEGACY_LLM_ENDPOINTS.has(endpoint)) return "local";
  if (endpoint === OPENAI_LLM_ENDPOINT) return "openai";
  return DEFAULT_SETTINGS.llmProvider;
}

function normalizeEndpointSetting(value, fallback = DEFAULT_SETTINGS.llmEndpoint) {
  const endpoint = typeof value === "string" && value.trim() ? value.trim().replace(/\/+$/g, "") : fallback;
  return LEGACY_LLM_ENDPOINTS.has(endpoint) ? DEFAULT_LLM_ENDPOINT : endpoint;
}

function normalizeModelSetting(value) {
  return typeof value === "string" && value.trim() ? value.trim() : DEFAULT_SETTINGS.llmModelId;
}

function normalizeSettings(value) {
  const source = normalizeObject(value);
  const llmProvider = inferLlmProvider(source);
  return {
    ...DEFAULT_SETTINGS,
    ...source,
    memoryEnabled: typeof source.memoryEnabled === "boolean" ? source.memoryEnabled : DEFAULT_SETTINGS.memoryEnabled,
    guideMode: normalizeGuideMode(source.guideMode),
    theme: normalizeTheme(source.theme),
    llmProvider,
    llmEndpoint: llmProvider === "openai" ? OPENAI_LLM_ENDPOINT : normalizeEndpointSetting(source.llmEndpoint, DEFAULT_LLM_ENDPOINT),
    llmModelId: typeof source.llmModelId === "string" && source.llmModelId.trim()
      ? source.llmModelId.trim()
      : llmProvider === "openai" ? DEFAULT_OPENAI_MODEL_ID : "google/gemma-4-e4b"
  };
}

export function readSettings(storage = browserStorage()) {
  return normalizeSettings(safeRead(STORAGE_KEYS.settings, DEFAULT_SETTINGS, storage));
}

export function writeSettings(settings, storage = browserStorage()) {
  return safeWrite(STORAGE_KEYS.settings, normalizeSettings(settings), storage);
}
