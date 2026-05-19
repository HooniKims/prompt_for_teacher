const MAX_MEMORY_ITEMS = 30;
const MAX_SELECTED_ITEMS = 5;

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeMemoryText(value) {
  return normalizeText(value)
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .replace(/[\[\]{}<>`]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 160)
    .trim();
}

function nowIso() {
  return new Date().toISOString();
}

function hashText(text) {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 33) ^ text.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function safeIdPart(value) {
  return normalizeText(value).replace(/[^a-zA-Z0-9_-]/g, "-") || "unknown";
}

function createItem(sourceSessionId, kind, text) {
  const normalizedText = sanitizeMemoryText(text);
  return {
    id: `memory-${safeIdPart(sourceSessionId)}-${kind}-${hashText(normalizedText)}`,
    createdAt: nowIso(),
    sourceSessionId,
    kind,
    text: normalizedText
  };
}

export function createMemoryItemsFromSession(session) {
  if (!session?.completed) return [];

  const answers = normalizeObject(session.answers);
  const answerMeta = normalizeObject(session.answerMeta);
  const sourceSessionId = normalizeText(session.id) || `session-${hashText(JSON.stringify(answers))}`;
  const items = [];

  const context = sanitizeMemoryText(answers.context);
  const output = sanitizeMemoryText(answers.output);
  const useScene = sanitizeMemoryText(answers.useScene);
  const quality = sanitizeMemoryText(answers.quality);
  const safety = normalizeObject(answerMeta.safety);
  const externalService = normalizeObject(answerMeta.externalService);

  if (context) items.push(createItem(sourceSessionId, "workContext", `이전 세션에서 ${context} 맥락을 요청한 적이 있음`));
  if (output) items.push(createItem(sourceSessionId, "preferredOutput", `이전 세션에서 결과물로 ${output}을 요청한 적이 있음`));
  if (useScene) items.push(createItem(sourceSessionId, "useScene", `이전 세션에서 ${useScene} 장면을 요청한 적이 있음`));
  if (quality) items.push(createItem(sourceSessionId, "qualityPreference", `이전 세션에서 품질 기준으로 "${quality}"를 요청한 적이 있음`));

  if (safety.risk || safety.id === "D" || /민감|개인정보|상담|건강|가정환경/.test(normalizeText(safety.label))) {
    const label = sanitizeMemoryText(safety.label) || "민감 조건";
    items.push(createItem(sourceSessionId, "safetyPreference", `안전 확인에서 "${label}" 같은 민감 조건을 고려한 적이 있음`));
  }

  if (externalService.risk || externalService.id === "C" || /학생.*제출|답안|활동 결과/.test(normalizeText(externalService.label))) {
    const label = sanitizeMemoryText(externalService.label) || "외부 도구 조건";
    items.push(createItem(sourceSessionId, "safetyPreference", `외부 도구 확인에서 "${label}" 조건을 고려한 적이 있음`));
  }

  return items;
}

export function mergeMemoryItems(existingItems = [], newItems = []) {
  const seen = new Set();
  const merged = [];

  [...newItems, ...existingItems].forEach((item) => {
    const text = sanitizeMemoryText(item?.text);
    if (!text || seen.has(text)) return;
    seen.add(text);
    merged.push({
      ...item,
      text,
      createdAt: normalizeText(item?.createdAt) || nowIso()
    });
  });

  return merged
    .map((item, index) => ({ item, index, time: Date.parse(item.createdAt) }))
    .sort((left, right) => {
      const leftTime = Number.isNaN(left.time) ? 0 : left.time;
      const rightTime = Number.isNaN(right.time) ? 0 : right.time;
      return rightTime - leftTime || left.index - right.index;
    })
    .map(({ item }) => item)
    .slice(0, MAX_MEMORY_ITEMS);
}

export function selectMemoryItems(items = [], settings = { memoryEnabled: true }) {
  if (settings?.memoryEnabled === false) return [];

  return items
    .map((item) => ({ ...item, text: sanitizeMemoryText(item?.text) }))
    .filter((item) => item.text)
    .slice(0, MAX_SELECTED_ITEMS);
}
