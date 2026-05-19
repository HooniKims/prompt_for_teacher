import test from "node:test";
import assert from "node:assert/strict";
import { createFailingStorageMock, createLocalStorageMock } from "./helpers.js";
import {
  STORAGE_KEYS,
  clearActiveDraft,
  clearMemoryStore,
  clearSessions,
  migrateLegacySessions,
  readActiveDraft,
  readMemoryStore,
  readSessions,
  readSettings,
  saveSession,
  writeActiveDraft,
  writeMemoryStore,
  writeSettings
} from "../webapp/modules/storage.js";

function makeSession(index) {
  return {
    id: `session-${index}`,
    title: `Session ${index}`,
    initialRequest: `Request ${index}`,
    answers: { output: "수업안" },
    answerMeta: {},
    finalPrompt: `Prompt ${index}`,
    referenceNotes: `Reference ${index}`,
    messages: [{ role: "user", text: `Request ${index}` }],
    createdAt: `2026-05-18T00:00:${String(index).padStart(2, "0")}.000Z`
  };
}

test("saveSession stores newest first and keeps only 20", () => {
  const storage = createLocalStorageMock();

  for (let index = 1; index <= 21; index += 1) {
    const result = saveSession(makeSession(index), storage);
    assert.equal(result.ok, true);
  }

  const sessions = readSessions(storage);
  assert.equal(sessions.length, 20);
  assert.equal(sessions[0].id, "session-21");
  assert.equal(sessions.at(-1).id, "session-2");
});

test("saveSession keeps separate sessions that happen to share the same title", () => {
  const storage = createLocalStorageMock();

  assert.equal(saveSession({ ...makeSession(1), id: "first", title: "같은 요청" }, storage).ok, true);
  assert.equal(saveSession({ ...makeSession(2), id: "second", title: "같은 요청" }, storage).ok, true);

  const sessions = readSessions(storage);
  assert.equal(sessions.length, 2);
  assert.deepEqual(sessions.map((session) => session.id), ["second", "first"]);
});

test("migrateLegacySessions moves compact old sessions into the versioned key", () => {
  const storage = createLocalStorageMock({
    [STORAGE_KEYS.legacySessions]: JSON.stringify([
      {
        title: "이전 초안",
        prompt: "이전 프롬프트",
        reference: "이전 참고",
        answers: { output: "활동지" }
      }
    ])
  });

  const result = migrateLegacySessions(storage);
  const sessions = readSessions(storage);

  assert.equal(result.ok, true);
  assert.equal(result.migrated, 1);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].title, "이전 초안");
  assert.equal(sessions[0].finalPrompt, "이전 프롬프트");
  assert.equal(sessions[0].referenceNotes, "이전 참고");
});

test("successful migration removes old key", () => {
  const storage = createLocalStorageMock({
    [STORAGE_KEYS.legacySessions]: JSON.stringify([{ title: "이전 초안", prompt: "이전 프롬프트" }])
  });

  const result = migrateLegacySessions(storage);

  assert.equal(result.ok, true);
  assert.equal(storage.getItem(STORAGE_KEYS.legacySessions), null);
});

test("migration deduplicates repeated legacy sessions before writing the versioned key", () => {
  const storage = createLocalStorageMock({
    [STORAGE_KEYS.legacySessions]: JSON.stringify([
      { id: "legacy-1", title: "중복 초안", prompt: "새 프롬프트" },
      { id: "legacy-2", title: "중복 초안", prompt: "오래된 프롬프트" }
    ])
  });

  const result = migrateLegacySessions(storage);
  const sessions = readSessions(storage);

  assert.equal(result.ok, true);
  assert.equal(result.migrated, 1);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].finalPrompt, "새 프롬프트");
});

test("failed migration with broken legacy JSON does not delete old key", () => {
  const storage = createLocalStorageMock({
    [STORAGE_KEYS.legacySessions]: "{broken"
  });

  const result = migrateLegacySessions(storage);

  assert.equal(result.ok, false);
  assert.equal(storage.getItem(STORAGE_KEYS.legacySessions), "{broken");
});

test("readSessions returns [] for malformed versioned data", () => {
  const storage = createLocalStorageMock({
    [STORAGE_KEYS.sessions]: "{broken"
  });

  assert.deepEqual(readSessions(storage), []);
});

test("clearSessions removes only this app's session key, not unrelated keys", () => {
  const storage = createLocalStorageMock({
    [STORAGE_KEYS.sessions]: "[]",
    unrelated: "keep"
  });

  const result = clearSessions(storage);

  assert.equal(result.ok, true);
  assert.equal(storage.getItem(STORAGE_KEYS.sessions), null);
  assert.equal(storage.getItem("unrelated"), "keep");
});

test("storage helpers do not touch unrelated keys", () => {
  const storage = createLocalStorageMock({
    unrelated: "keep",
    [STORAGE_KEYS.sessions]: JSON.stringify([{ id: "session-1", title: "x" }]),
    [STORAGE_KEYS.activeDraft]: JSON.stringify({ initialRequest: "초안" }),
    [STORAGE_KEYS.memory]: JSON.stringify({ items: [{ text: "메모리" }], updatedAt: "2026-05-18T00:00:00.000Z" })
  });

  assert.equal(clearSessions(storage).ok, true);
  assert.equal(clearActiveDraft(storage).ok, true);
  assert.equal(clearMemoryStore(storage).ok, true);

  assert.equal(storage.getItem("unrelated"), "keep");
});

test("saveSession write failure returns { ok: false } and does not throw", () => {
  const result = saveSession(makeSession(1), createFailingStorageMock("quota exceeded"));

  assert.equal(result.ok, false);
  assert.match(result.message, /quota exceeded/);
});

test("saveSession generates unique ids when Date.now is the same millisecond", () => {
  const storage = createLocalStorageMock();
  const originalNow = Date.now;
  Date.now = () => 42;

  try {
    assert.equal(saveSession({ title: "A", finalPrompt: "Prompt A" }, storage).ok, true);
    assert.equal(saveSession({ title: "B", finalPrompt: "Prompt B" }, storage).ok, true);
  } finally {
    Date.now = originalNow;
  }

  const sessions = readSessions(storage);
  assert.equal(sessions.length, 2);
  assert.notEqual(sessions[0].id, sessions[1].id);
});

test("active draft can be written, read, timestamped, and cleared", () => {
  const storage = createLocalStorageMock();
  const draft = {
    id: "draft-1",
    initialRequest: "초안",
    activeStepIndex: 2,
    answers: { output: "표" }
  };

  assert.equal(writeActiveDraft(draft, storage).ok, true);
  const stored = readActiveDraft(storage);
  assert.equal(stored.initialRequest, "초안");
  assert.equal(stored.activeStepIndex, 2);
  assert.match(stored.updatedAt, /^\d{4}-\d{2}-\d{2}T/);

  assert.equal(clearActiveDraft(storage).ok, true);
  assert.equal(readActiveDraft(storage), null);
});

test("memory and settings helpers can write, read, and clear app-owned values", () => {
  const storage = createLocalStorageMock();

  assert.equal(readSettings(storage).memoryEnabled, true);
  assert.equal(writeSettings({ memoryEnabled: false }, storage).ok, true);
  assert.equal(readSettings(storage).memoryEnabled, false);

  assert.equal(writeMemoryStore({ items: [{ id: "m1", text: "중학교 맥락" }] }, storage).ok, true);
  assert.equal(readMemoryStore(storage).items.length, 1);

  assert.equal(clearMemoryStore(storage).ok, true);
  assert.deepEqual(readMemoryStore(storage), { items: [], updatedAt: "" });
});

test("memory store filters malformed items and limits stored items to 30", () => {
  const storage = createLocalStorageMock();
  const items = [
    null,
    { id: "broken" },
    ...Array.from({ length: 35 }, (_, index) => ({ id: `m-${index}`, text: `메모리 ${index}` }))
  ];

  assert.equal(writeMemoryStore({ items }, storage).ok, true);
  const memory = readMemoryStore(storage);

  assert.equal(memory.items.length, 30);
  assert.equal(memory.items[0].text, "메모리 0");
  assert.equal(memory.items.at(-1).text, "메모리 29");
});

test("read helpers tolerate unavailable storage method failures", () => {
  const storage = createFailingStorageMock("blocked");

  assert.deepEqual(readSessions(storage), []);
  assert.equal(readActiveDraft(storage), null);
  assert.deepEqual(readMemoryStore(storage), { items: [], updatedAt: "" });
  assert.equal(readSettings(storage).memoryEnabled, true);
});

test("storage helpers tolerate blocked global localStorage access", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("localStorage blocked");
    }
  });

  try {
    assert.deepEqual(readSessions(), []);
    assert.equal(readActiveDraft(), null);
    assert.deepEqual(readMemoryStore(), { items: [], updatedAt: "" });
    assert.equal(readSettings().memoryEnabled, true);
    assert.equal(saveSession(makeSession(1)).ok, false);
    assert.equal(writeActiveDraft({ initialRequest: "초안" }).ok, false);
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "localStorage", originalDescriptor);
    } else {
      delete globalThis.localStorage;
    }
  }
});

test("readSettings adds light theme and OpenAI nano defaults to legacy settings", () => {
  const storage = createLocalStorageMock({
    [STORAGE_KEYS.settings]: JSON.stringify({ memoryEnabled: false })
  });

  const settings = readSettings(storage);

  assert.equal(settings.memoryEnabled, false);
  assert.equal(settings.guideMode, "thorough");
  assert.equal(settings.theme, "light");
  assert.equal(settings.llmProvider, "openai");
  assert.equal(settings.llmEndpoint, "/openai/v1");
  assert.equal(settings.llmModelId, "gpt-5.4-nano");
});

test("readSettings normalizes invalid theme and endpoint values", () => {
  const storage = createLocalStorageMock({
    [STORAGE_KEYS.settings]: JSON.stringify({ guideMode: "strict", theme: "solarized", llmEndpoint: "", llmModelId: "" })
  });

  const settings = readSettings(storage);

  assert.equal(settings.guideMode, "thorough");
  assert.equal(settings.theme, "light");
  assert.equal(settings.llmProvider, "openai");
  assert.equal(settings.llmEndpoint, "/openai/v1");
  assert.equal(settings.llmModelId, "gpt-5.4-nano");
});

test("readSettings keeps local e2b when local provider is selected", () => {
  const storage = createLocalStorageMock({
    [STORAGE_KEYS.settings]: JSON.stringify({ llmProvider: "local", llmEndpoint: "", llmModelId: "" })
  });

  const settings = readSettings(storage);

  assert.equal(settings.llmProvider, "local");
  assert.equal(settings.llmEndpoint, "/v1");
  assert.equal(settings.llmModelId, "google/gemma-4-e2b");
});

test("readSettings can select OpenAI 5.4 nano as the default model", () => {
  const storage = createLocalStorageMock({
    [STORAGE_KEYS.settings]: JSON.stringify({ llmProvider: "openai", llmModelId: "" })
  });

  const settings = readSettings(storage);

  assert.equal(settings.llmProvider, "openai");
  assert.equal(settings.llmEndpoint, "/openai/v1");
  assert.equal(settings.llmModelId, "gpt-5.4-nano");
});

test("readSettings migrates old localhost LLM endpoint to shared endpoint", () => {
  const storage = createLocalStorageMock({
    [STORAGE_KEYS.settings]: JSON.stringify({ llmEndpoint: "http://127.0.0.1:1234/v1" })
  });

  const settings = readSettings(storage);

  assert.equal(settings.llmEndpoint, "/v1");
});

test("readSettings migrates remote LLM endpoint to same-origin proxy", () => {
  const storage = createLocalStorageMock({
    [STORAGE_KEYS.settings]: JSON.stringify({ llmEndpoint: "http://lm.alluser.site:1234/v1" })
  });

  const settings = readSettings(storage);

  assert.equal(settings.llmEndpoint, "/v1");
});
