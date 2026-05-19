import { steps } from "./steps.js";

function cloneRecord(record) {
  return record && typeof record === "object" && !Array.isArray(record) ? { ...record } : {};
}

function cloneMessages(messages) {
  return Array.isArray(messages)
    ? messages
        .filter((message) => message && typeof message.role === "string" && typeof message.text === "string")
        .map((message) => ({
          ...message,
          options: Array.isArray(message.options) ? message.options.map((option) => ({ ...option })) : message.options
        }))
    : [];
}

function normalizeText(text) {
  return typeof text === "string" ? text : "";
}

export function createInitialState() {
  return {
    initialRequest: "",
    activeStepIndex: -1,
    answers: {},
    answerMeta: {},
    messages: [],
    finalPrompt: "",
    referenceNotes: "",
    completed: false,
    llmStatus: "unknown",
    llmError: "",
    availableModels: [],
    intentProfile: {},
    conversationTurns: [],
    suggestedOptions: [],
    isAwaitingAi: false,
    mode: "ai"
  };
}

export function appendAssistantMessage(state, text, options = []) {
  return {
    ...state,
    messages: [
      ...(state.messages ?? []),
      {
        role: "assistant",
        text: normalizeText(text),
        options: Array.isArray(options) ? options.map((option) => ({ ...option })) : [],
        stepIndex: state.activeStepIndex
      }
    ]
  };
}

export function appendUserMessage(state, text) {
  return {
    ...state,
    messages: [
      ...(state.messages ?? []),
      {
        role: "user",
        text: normalizeText(text)
      }
    ]
  };
}

export function startRequest(state, text) {
  const normalized = normalizeText(text);
  return appendUserMessage(
    {
      ...state,
      initialRequest: normalized,
      activeStepIndex: 0,
      completed: false,
      conversationTurns: [
        ...(Array.isArray(state.conversationTurns) ? state.conversationTurns : []),
        { role: "user", text: normalized, source: "seed" }
      ]
    },
    text
  );
}

export function recordStepAnswer(state, step, answerText, option = null) {
  if (!step?.key) return state;

  const displayText = option ? `${option.id}. ${option.label}` : normalizeText(answerText);
  const answer = option ? option.label : normalizeText(answerText);
  const answerMeta = option ? { ...option } : { id: "직접", label: answer };

  return appendUserMessage(
    {
      ...state,
      answers: {
        ...(state.answers ?? {}),
        [step.key]: answer
      },
      answerMeta: {
        ...(state.answerMeta ?? {}),
        [step.key]: answerMeta
      }
    },
    displayText
  );
}

export function advanceStep(state, totalSteps = steps.length) {
  const nextIndex = Math.min((state.activeStepIndex ?? -1) + 1, totalSteps);

  return {
    ...state,
    activeStepIndex: nextIndex
  };
}

export function completeState(state, { finalPrompt, referenceNotes }) {
  return appendAssistantMessage(
    {
      ...state,
      completed: true,
      activeStepIndex: steps.length,
      finalPrompt: normalizeText(finalPrompt),
      referenceNotes: normalizeText(referenceNotes)
    },
    "10단계 확인이 끝났습니다. 오른쪽에 최종 프롬프트와 참고 안내를 분리해두었습니다.\n\n마음에 들지 않는 부분이 있으면 아래 입력창에 그대로 지적해주세요. 예: 더 부드럽게, 행정 문서 느낌 줄이기, 개인정보 안내를 덜 부담스럽게."
  );
}

export function applyRevisionState(state, { revisedPrompt, summary }) {
  return appendAssistantMessage(
    {
      ...state,
      finalPrompt: normalizeText(revisedPrompt)
    },
    `수정 요청을 반영했습니다.\n변경점: ${normalizeText(summary)}\n\n오른쪽 최종 프롬프트를 다시 확인해주세요.`
  );
}

export function restoreDraft(draft) {
  if (!draft || typeof draft !== "object") return null;
  if (!Number.isInteger(draft.activeStepIndex) || draft.activeStepIndex < -1 || draft.activeStepIndex > steps.length) return null;

  return {
    ...createInitialState(),
    initialRequest: normalizeText(draft.initialRequest),
    activeStepIndex: draft.activeStepIndex,
    answers: cloneRecord(draft.answers),
    answerMeta: cloneRecord(draft.answerMeta),
    messages: cloneMessages(draft.messages),
    finalPrompt: normalizeText(draft.finalPrompt),
    referenceNotes: normalizeText(draft.referenceNotes),
    completed: draft.completed === true,
    llmStatus: normalizeText(draft.llmStatus) || "unknown",
    llmError: normalizeText(draft.llmError),
    availableModels: Array.isArray(draft.availableModels) ? draft.availableModels.filter((model) => typeof model === "string") : [],
    intentProfile: cloneRecord(draft.intentProfile),
    conversationTurns: Array.isArray(draft.conversationTurns) ? draft.conversationTurns.map((turn) => ({ ...turn })) : [],
    suggestedOptions: Array.isArray(draft.suggestedOptions) ? draft.suggestedOptions.map((option) => ({ ...option })) : [],
    isAwaitingAi: draft.isAwaitingAi === true,
    mode: normalizeText(draft.mode) || "ai"
  };
}


export function markLlmStatus(state, { status = "unknown", message = "", models = [] } = {}) {
  return {
    ...state,
    llmStatus: normalizeText(status) || "unknown",
    llmError: normalizeText(message),
    availableModels: Array.isArray(models) ? models.filter((model) => typeof model === "string" && model.trim()) : state.availableModels ?? [],
    isAwaitingAi: false
  };
}

export function setAwaitingAi(state, isAwaitingAi = true) {
  return { ...state, isAwaitingAi: isAwaitingAi === true };
}

export function appendAiQuestion(state, { question, suggestedOptions = [], capturedFacts = {} } = {}) {
  const text = normalizeText(question);
  const options = Array.isArray(suggestedOptions) ? suggestedOptions.map((option) => ({ ...option, optional: option.optional !== false })) : [];
  return appendAssistantMessage(
    {
      ...state,
      suggestedOptions: options,
      intentProfile: { ...(state.intentProfile ?? {}), ...(capturedFacts && typeof capturedFacts === "object" ? capturedFacts : {}) },
      conversationTurns: [
        ...(Array.isArray(state.conversationTurns) ? state.conversationTurns : []),
        { role: "assistant", text, source: "ai-question" }
      ],
      isAwaitingAi: false
    },
    text,
    options
  );
}

export function recordConversationAnswer(state, answerText, option = null) {
  const text = option?.label ? option.label : normalizeText(answerText);
  return appendUserMessage(
    {
      ...state,
      conversationTurns: [
        ...(Array.isArray(state.conversationTurns) ? state.conversationTurns : []),
        { role: "user", text, source: option ? "quick-option" : "direct", option: option ? { ...option } : null }
      ]
    },
    option?.id ? `${option.id}. ${text}` : text
  );
}
