import { steps, stepKeys } from "./steps.js";

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
    awaitingTask: "",
    followUpQuestions: 0,
    mode: "ai"
  };
}

const MAX_FACT_LENGTH = 160;

function trimFact(value) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return text.length > MAX_FACT_LENGTH ? `${text.slice(0, MAX_FACT_LENGTH - 1)}…` : text;
}

export function mergeCapturedAnswers(answers = {}, capturedFacts = {}) {
  if (!capturedFacts || typeof capturedFacts !== "object") return { ...(answers ?? {}) };
  const next = { ...(answers ?? {}) };
  stepKeys.forEach((key) => {
    if (typeof next[key] === "string" && next[key].trim()) return;
    const fact = trimFact(capturedFacts[key]);
    if (!fact) return;
    if (/^(unknown|없음|미정|모름|null|undefined|n\/a)$/i.test(fact)) return;
    if (/미확인|아직|정하지 않|확인 전|확인되지 않|모르겠|미정|해당 없음|tbd/i.test(fact)) return;
    next[key] = fact;
  });
  return next;
}

export function answeredStepCount(state) {
  const answers = state?.answers ?? {};
  return stepKeys.filter((key) => typeof answers[key] === "string" && answers[key].trim()).length;
}

export function unansweredSteps(state) {
  const answers = state?.answers ?? {};
  return steps.filter((step) => !(typeof answers[step.key] === "string" && answers[step.key].trim()));
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

export function completionMessage(state) {
  const answered = answeredStepCount(state);
  const total = steps.length;
  const missing = unansweredSteps(state).map((step) => step.shortTitle || step.title);
  const headline = answered >= total
    ? `${total}단계 확인이 끝났습니다.`
    : `${total}개 항목 중 ${answered}개를 확인한 내용으로 프롬프트를 만들었습니다.`;
  const missingLine = missing.length && answered < total
    ? `\n아직 확인하지 않은 항목: ${missing.join(", ")}. 필요하면 아래 입력창에 적어주시면 반영합니다.`
    : "";
  return `${headline} 오른쪽에 최종 프롬프트와 참고 안내를 나눠 두었습니다.${missingLine}\n\n마음에 들지 않는 부분이 있으면 아래 입력창에 그대로 적어주세요. 예: 더 부드럽게, 행정 문서 느낌 줄이기, 개인정보 안내를 덜 부담스럽게.`;
}

export function completeState(state, { finalPrompt, referenceNotes }) {
  const nextState = {
    ...state,
    completed: true,
    activeStepIndex: steps.length,
    finalPrompt: normalizeText(finalPrompt),
    referenceNotes: normalizeText(referenceNotes),
    awaitingTask: ""
  };
  return appendAssistantMessage(nextState, completionMessage(nextState));
}

export function applyRevisionState(state, { revisedPrompt, summary }) {
  return appendAssistantMessage(
    {
      ...state,
      finalPrompt: normalizeText(revisedPrompt),
      awaitingTask: ""
    },
    `${normalizeText(summary)}\n\n오른쪽 최종 프롬프트를 다시 확인해주세요.`
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
    awaitingTask: normalizeText(draft.awaitingTask),
    followUpQuestions: Number.isInteger(draft.followUpQuestions) ? draft.followUpQuestions : 0,
    pendingStepKey: normalizeText(draft.pendingStepKey),
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

export function setAwaitingAi(state, isAwaitingAi = true, task = "") {
  return { ...state, isAwaitingAi: isAwaitingAi === true, awaitingTask: isAwaitingAi === true ? normalizeText(task) : "" };
}

export function appendAiQuestion(state, { question, suggestedOptions = [], capturedFacts = {}, stepKey = "" } = {}) {
  const text = normalizeText(question);
  const options = Array.isArray(suggestedOptions) ? suggestedOptions.map((option) => ({ ...option, optional: option.optional !== false })) : [];
  const facts = capturedFacts && typeof capturedFacts === "object" ? capturedFacts : {};
  return appendAssistantMessage(
    {
      ...state,
      suggestedOptions: options,
      pendingStepKey: normalizeText(stepKey),
      answers: mergeCapturedAnswers(state.answers, facts),
      intentProfile: { ...(state.intentProfile ?? {}), ...facts },
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
  const pendingStepKey = normalizeText(state.pendingStepKey);
  const answers = pendingStepKey && !(state.answers ?? {})[pendingStepKey]
    ? { ...(state.answers ?? {}), [pendingStepKey]: trimFact(text) }
    : state.answers;
  const answerMeta = pendingStepKey && option
    ? { ...(state.answerMeta ?? {}), [pendingStepKey]: { ...option } }
    : state.answerMeta;
  return appendUserMessage(
    {
      ...state,
      answers,
      answerMeta,
      pendingStepKey: "",
      conversationTurns: [
        ...(Array.isArray(state.conversationTurns) ? state.conversationTurns : []),
        { role: "user", text, source: option ? "quick-option" : "direct", option: option ? { ...option } : null }
      ]
    },
    option?.id ? `${option.id}. ${text}` : text
  );
}
