import { splitFinalPromptSections } from "./promptBuilder.js?v=summary-fallback-2";

const COLLAPSED_PROMPT_LINES = 14;

export function createUi() {
  let toastTimeout = 0;
  let aiPromptExpanded = false;
  let lastRenderedMessageCount = 0;
  const elements = {
    chatPanel: document.querySelector(".chat-panel"),
    chatLog: document.getElementById("chatLog"),
    chatForm: document.getElementById("chatForm"),
    composerHint: document.getElementById("composerHint"),
    messageInput: document.getElementById("messageInput"),
    stepHistory: document.getElementById("stepHistory"),
    progressBadge: document.getElementById("progressBadge"),
    progressSummary: document.getElementById("progressSummary"),
    progressSummaryList: document.getElementById("progressSummaryList"),
    promptPreview: document.getElementById("promptPreview"),
    teacherSummaryPreview: document.getElementById("teacherSummaryPreview"),
    aiPromptPreview: document.getElementById("aiPromptPreview"),
    toggleAiPromptButton: document.getElementById("toggleAiPromptButton"),
    referencePreview: document.getElementById("referencePreview"),
    resultPanel: document.querySelector(".result-panel"),
    copyPromptButton: document.getElementById("copyPromptButton"),
    copyTeacherSummaryButton: document.getElementById("copyTeacherSummaryButton"),
    copyAiPromptButton: document.getElementById("copyAiPromptButton"),
    savedSessions: document.getElementById("savedSessions"),
    clearSavedButton: document.getElementById("clearSavedButton"),
    toast: document.getElementById("toast"),
    modelPlanTitle: document.getElementById("modelPlanTitle"),
    modelPlanDescription: document.getElementById("modelPlanDescription"),
    toggleMemoryButton: document.getElementById("toggleMemoryButton"),
    clearMemoryButton: document.getElementById("clearMemoryButton"),
    clearDraftButton: document.getElementById("clearDraftButton"),
    memoryStatus: document.getElementById("memoryStatus"),
    sendButton: document.getElementById("sendButton"),
    finishEarlyButton: document.getElementById("finishEarlyButton"),
    themeToggleButton: document.getElementById("themeToggleButton"),
    restartButton: document.getElementById("restartButton"),
    friendlyModeButton: document.getElementById("friendlyModeButton"),
    thoroughModeButton: document.getElementById("thoroughModeButton"),
    localModelButton: document.getElementById("localModelButton"),
    openAiModelButton: document.getElementById("openAiModelButton"),
    llmStatusBadge: document.getElementById("llmStatusBadge"),
    llmModelBadge: document.getElementById("llmModelBadge")
  };

  return {
    elements,
    bindHandlers(handlers) {
      elements.chatForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = elements.messageInput.value.trim();
        if (!text) return;
        const accepted = handlers.onSubmit(text);
        if (accepted === false) return;
        elements.messageInput.value = "";
        elements.messageInput.style.height = "auto";
      });

      elements.messageInput.addEventListener("input", () => {
        elements.messageInput.style.height = "auto";
        elements.messageInput.style.height = `${elements.messageInput.scrollHeight}px`;
      });

      elements.messageInput.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
        event.preventDefault();
        elements.chatForm.requestSubmit();
      });

      elements.copyPromptButton.addEventListener("click", handlers.onCopyPrompt);
      elements.copyTeacherSummaryButton?.addEventListener("click", handlers.onCopyTeacherSummary);
      elements.copyAiPromptButton?.addEventListener("click", handlers.onCopyAiPrompt);
      elements.toggleAiPromptButton?.addEventListener("click", () => {
        aiPromptExpanded = !aiPromptExpanded;
        applyAiPromptCollapse(elements, aiPromptExpanded);
      });
      elements.clearSavedButton.addEventListener("click", () => {
        if (!window.confirm("저장한 작업 목록을 모두 지울까요? 지운 뒤에는 되돌릴 수 없습니다.")) return;
        handlers.onClearSessions();
      });
      elements.toggleMemoryButton.addEventListener("click", handlers.onToggleMemory);
      elements.clearMemoryButton.addEventListener("click", () => {
        if (!window.confirm("이전 작업 참고 기록을 지울까요? 저장한 작업 목록은 남습니다.")) return;
        handlers.onClearMemory();
      });
      elements.clearDraftButton?.addEventListener("click", handlers.onClearDraft);
      elements.themeToggleButton?.addEventListener("click", handlers.onToggleTheme);
      elements.restartButton?.addEventListener("click", () => {
        if (!window.confirm("현재 대화를 지우고 처음부터 다시 시작할까요?")) return;
        handlers.onClearDraft();
      });
      elements.finishEarlyButton?.addEventListener("click", () => handlers.onFinishEarly?.());
      elements.friendlyModeButton?.addEventListener("click", () => handlers.onSetGuideMode("friendly"));
      elements.thoroughModeButton?.addEventListener("click", () => handlers.onSetGuideMode("thorough"));
      elements.localModelButton?.addEventListener("click", () => handlers.onSetDefaultModel?.("local"));
      elements.openAiModelButton?.addEventListener("click", () => handlers.onSetDefaultModel?.("openai"));
    },
    render(viewModel) {
      const messageCountChanged = renderMessages(elements, viewModel, lastRenderedMessageCount);
      lastRenderedMessageCount = viewModel.state.messages.length;
      renderHistory(elements, viewModel);
      renderProgressSummary(elements, viewModel);
      renderResult(elements, viewModel, aiPromptExpanded);
      renderSavedSessions(elements, viewModel);
      renderModelPlan(elements, viewModel);
      renderMemory(elements, viewModel);
      renderConnection(elements, viewModel);
      renderTheme(elements, viewModel);
      renderGuideMode(elements, viewModel);
      renderDefaultModel(elements, viewModel);
      renderInput(elements, viewModel);
      scrollChatToLatest(elements, messageCountChanged || viewModel.state.isAwaitingAi);
      focusComposerIfReady(elements, viewModel);
    },
    showToast(text) {
      elements.toast.textContent = text;
      elements.toast.classList.add("visible");
      window.clearTimeout(toastTimeout);
      toastTimeout = window.setTimeout(() => elements.toast.classList.remove("visible"), 2200);
    }
  };
}

function awaitingLabel(state, totalSteps = 10) {
  if (state.awaitingTask === "final") return "최종 프롬프트를 만드는 중입니다. 조금만 기다려주세요.";
  if (!state.completed && answeredKeysOf(state).size >= totalSteps) return "확인이 끝났습니다. 최종 프롬프트를 만드는 중입니다.";
  if (state.awaitingTask === "revision") return "수정 내용을 반영하는 중입니다.";
  if (state.completed) return "수정 내용을 반영하는 중입니다.";
  return "다음 질문을 정리하는 중입니다.";
}

function renderMessages(elements, viewModel, previousCount) {
  const { state } = viewModel;
  elements.chatLog.innerHTML = "";

  state.messages.forEach((message, index) => {
    const article = document.createElement("article");
    article.className = `message ${message.role}`;
    if (index >= previousCount) article.classList.add("is-new");

    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = message.role === "assistant" ? "가이드" : "나";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = sanitizeVisibleMessage(message.text);

    article.append(meta, bubble);

    const isLatest = index === state.messages.length - 1;
    if (message.options?.length && isLatest && !state.completed && !state.isAwaitingAi) {
      const options = document.createElement("div");
      options.className = "options-grid";

      message.options.forEach((option) => {
        let clicked = false;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "option-button";
        button.setAttribute("aria-label", `${option.id}. ${option.label}`);

        const letter = document.createElement("span");
        letter.className = "option-letter";
        letter.textContent = option.id;

        const label = document.createElement("span");
        label.className = "option-text";
        label.textContent = option.label;

        button.append(letter, label);
        button.addEventListener("click", () => {
          if (clicked) return;
          clicked = true;
          options.querySelectorAll("button").forEach((optionButton) => {
            optionButton.disabled = true;
          });
          viewModel.handlers.onOption(option);
        });
        options.append(button);
      });

      const hint = document.createElement("p");
      hint.className = "options-hint";
      const isWrapUp = (viewModel.wrapUpSteps ?? []).some((step) => step.key === (state.pendingStepKey || ""));
      hint.textContent = isWrapUp
        ? "A는 AI 추천안입니다. 그대로 써도 되고, 고치고 싶은 내용을 아래에 직접 적어도 됩니다."
        : "위에서 하나를 고르거나, 아래 입력창에 직접 적어도 됩니다. 글자 A, B, C만 보내도 됩니다.";

      article.append(options, hint);
    }

    elements.chatLog.append(article);
  });

  if (state.isAwaitingAi) {
    const typing = document.createElement("article");
    typing.className = "message assistant is-typing";
    typing.setAttribute("aria-label", awaitingLabel(state, viewModel.steps.length));

    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = "가이드";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble typing-bubble";
    const dots = document.createElement("span");
    dots.className = "typing-dots";
    dots.innerHTML = "<i></i><i></i><i></i>";
    const label = document.createElement("span");
    label.className = "typing-label";
    label.textContent = awaitingLabel(state, viewModel.steps.length);
    bubble.append(dots, label);

    typing.append(meta, bubble);
    elements.chatLog.append(typing);
  }

  return state.messages.length !== previousCount;
}

function scrollChatToLatest(elements, shouldScroll) {
  if (!shouldScroll || !elements.chatLog) return;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  window.requestAnimationFrame(() => {
    const target = elements.chatLog.scrollHeight;
    if (typeof elements.chatLog.scrollTo === "function") {
      elements.chatLog.scrollTo({ top: target, behavior: reduceMotion ? "auto" : "smooth" });
    } else {
      elements.chatLog.scrollTop = target;
    }
  });
}

function sanitizeVisibleMessage(text = "") {
  if (/"kind"\s*:\s*"final_prompt_ready"/.test(text) || /final_prompt_ready/.test(text)) {
    return "최종 프롬프트를 정리했습니다. 오른쪽 완성본에서 확인해주세요.";
  }

  return text;
}

function answeredKeysOf(state) {
  return new Set(Object.keys(state.answers ?? {}).filter((key) => typeof state.answers?.[key] === "string" && state.answers[key].trim()));
}

function renderHistory(elements, viewModel) {
  const { state, steps } = viewModel;
  const wrapUpSteps = viewModel.wrapUpSteps ?? [];
  elements.stepHistory.innerHTML = "";
  const answeredKeys = answeredKeysOf(state);
  const completedCount = steps.filter((step) => answeredKeys.has(step.key)).length;
  const allSteps = [...steps, ...wrapUpSteps];
  const pendingKey = state.pendingStepKey || "";
  const firstUnansweredIndex = allSteps.findIndex((step) => !answeredKeys.has(step.key));
  const currentIndex = state.completed || !state.initialRequest
    ? -1
    : pendingKey && allSteps.some((step) => step.key === pendingKey)
      ? allSteps.findIndex((step) => step.key === pendingKey)
      : firstUnansweredIndex;
  elements.progressBadge.textContent = `${completedCount} / ${steps.length}`;

  allSteps.forEach((step, index) => {
    if (index === steps.length) {
      const divider = document.createElement("li");
      divider.className = "history-divider";
      divider.setAttribute("aria-hidden", "true");
      divider.textContent = "마무리 3개 · 추천안만 고르면 됩니다";
      elements.stepHistory.append(divider);
    }
    const item = document.createElement("li");
    item.className = step.phase === "wrapup" ? "history-item is-wrapup" : "history-item";
    const done = answeredKeys.has(step.key);
    item.classList.toggle("is-done", done);
    item.classList.toggle("is-current", index === currentIndex);
    item.setAttribute("aria-current", index === currentIndex ? "step" : "false");

    const indexNode = document.createElement("div");
    indexNode.className = "history-index";
    indexNode.textContent = done ? "✓" : String(index + 1).padStart(2, "0");

    const body = document.createElement("div");
    const question = document.createElement("p");
    question.className = "history-question";
    question.textContent = step.title;

    const answerText = state.answers?.[step.key];
    if (answerText) {
      const answer = document.createElement("p");
      answer.className = "history-answer";
      answer.textContent = answerText;
      body.append(question, answer);
    } else {
      body.append(question);
    }
    item.append(indexNode, body);
    elements.stepHistory.append(item);
  });
}

function renderProgressSummary(elements, viewModel) {
  const { state, steps } = viewModel;
  if (!elements.progressSummary || !elements.progressSummaryList) return;
  const showSummary = Boolean(state.initialRequest) && !state.completed;
  elements.progressSummary.hidden = !showSummary;
  elements.resultPanel?.classList.toggle("is-pending", !state.completed);
  elements.resultPanel?.classList.toggle("is-idle", !state.initialRequest);
  if (!showSummary) return;

  elements.progressSummaryList.innerHTML = "";
  const answeredKeys = answeredKeysOf(state);
  const emptyNote = elements.progressSummary.querySelector(".progress-summary-empty");
  if (emptyNote) emptyNote.hidden = answeredKeys.size > 0;

  const request = document.createElement("div");
  request.className = "progress-row is-done";
  const requestTerm = document.createElement("dt");
  requestTerm.textContent = "처음 요청";
  const requestValue = document.createElement("dd");
  requestValue.textContent = state.initialRequest;
  request.append(requestTerm, requestValue);
  elements.progressSummaryList.append(request);

  [...steps, ...(viewModel.wrapUpSteps ?? [])].forEach((step) => {
    const row = document.createElement("div");
    const done = answeredKeys.has(step.key);
    row.className = done ? "progress-row is-done" : "progress-row";
    const term = document.createElement("dt");
    term.textContent = step.shortTitle || step.title;
    const value = document.createElement("dd");
    value.textContent = done ? state.answers[step.key] : "아직 확인 전";
    row.append(term, value);
    elements.progressSummaryList.append(row);
  });
}

function applyAiPromptCollapse(elements, expanded) {
  if (!elements.aiPromptPreview) return;
  const text = elements.aiPromptPreview.textContent || "";
  const lineCount = text.split("\n").length;
  const collapsible = lineCount > COLLAPSED_PROMPT_LINES;
  elements.aiPromptPreview.classList.toggle("is-collapsed", collapsible && !expanded);
  if (elements.toggleAiPromptButton) {
    elements.toggleAiPromptButton.hidden = !collapsible;
    elements.toggleAiPromptButton.textContent = expanded ? "접기" : `전체 펼치기 (${lineCount}줄)`;
    elements.toggleAiPromptButton.setAttribute("aria-expanded", String(expanded));
  }
}

function renderResult(elements, viewModel, aiPromptExpanded) {
  const finalPrompt = viewModel.state.finalPrompt || "";
  const { teacherSummary, aiPrompt } = splitFinalPromptSections(finalPrompt);
  const emptyMessage = "질문에 답하면 바로 복사해 쓸 수 있는 프롬프트가 여기에 표시됩니다.";
  elements.promptPreview.textContent = finalPrompt || emptyMessage;
  if (elements.teacherSummaryPreview) {
    elements.teacherSummaryPreview.textContent = teacherSummary || (finalPrompt ? "교사용 요약이 따로 감지되지 않았습니다." : "완성되면 교사가 먼저 볼 요약이 여기에 표시됩니다.");
  }
  if (elements.aiPromptPreview) {
    elements.aiPromptPreview.textContent = aiPrompt || (finalPrompt ? finalPrompt : "완성되면 AI에 붙여 넣을 프롬프트가 여기에 표시됩니다.");
    applyAiPromptCollapse(elements, aiPromptExpanded);
  }
  elements.referencePreview.textContent = viewModel.state.referenceNotes || "개인정보나 학생 사용과 관련된 내용이 나오면, 확인해야 할 기준을 쉬운 말로 여기에 정리합니다.";
}

function renderSavedSessions(elements, viewModel) {
  elements.savedSessions.innerHTML = "";

  if (!viewModel.sessions.length) {
    const empty = document.createElement("p");
    empty.className = "saved-empty";
    empty.textContent = "아직 저장한 작업이 없습니다. 프롬프트가 완성되면 자동으로 저장됩니다.";
    elements.savedSessions.append(empty);
    return;
  }

  viewModel.sessions.forEach((session) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "saved-item";
    button.textContent = `${session.title}\n${formatDate(session.updatedAt || session.createdAt)}`;
    button.addEventListener("click", () => viewModel.handlers.onLoadSession(session));
    elements.savedSessions.append(button);
  });
}

function renderModelPlan(elements, viewModel) {
  const status = viewModel.state.llmStatus;
  elements.modelPlanTitle.textContent = status === "ready" ? "AI가 준비되었습니다" : "AI 확인이 필요합니다";
  elements.modelPlanDescription.textContent = status === "ready"
    ? "이제 질문에 답하면 가이드가 이어서 도와드립니다."
    : viewModel.state.llmError || "AI 프로그램이 켜져 있는지 확인해주세요.";
}

function renderMemory(elements, viewModel) {
  const enabled = viewModel.settings.memoryEnabled;
  const count = viewModel.memory.items.filter((item) => typeof item?.text === "string" && item.text.trim()).length;
  elements.toggleMemoryButton.textContent = enabled ? "켜짐" : "꺼짐";
  elements.toggleMemoryButton.classList.toggle("is-active", enabled);
  elements.memoryStatus.textContent = enabled
    ? `이 브라우저에서 만든 이전 프롬프트 ${count}개를 참고해 질문합니다.`
    : "이전 프롬프트를 참고하지 않습니다.";
}

function renderConnection(elements, viewModel) {
  const status = viewModel.state.llmStatus;
  const labels = {
    unknown: "AI 확인 대기",
    checking: "AI 확인 중",
    ready: "AI 준비됨",
    blocked: "AI 확인 필요",
    error: "AI 오류"
  };
  if (elements.llmStatusBadge) {
    elements.llmStatusBadge.textContent = labels[status] || labels.unknown;
    elements.llmStatusBadge.dataset.status = status || "unknown";
  }
  if (elements.llmModelBadge) {
    const modelId = viewModel.localModelId || viewModel.settings.llmModelId || "";
    const shouldShowModel = status === "ready" && modelId;
    elements.llmModelBadge.hidden = !shouldShowModel;
    elements.llmModelBadge.textContent = shouldShowModel ? formatModelBadgeLabel(modelId) : "";
    elements.llmModelBadge.title = shouldShowModel ? modelId : "";
  }
}

function formatModelBadgeLabel(modelId = "") {
  const normalized = String(modelId).toLowerCase();
  if (normalized.includes("gpt-")) return "OpenAI 사용 중";
  if (normalized.includes("gemma") || normalized.includes("e4b") || normalized.includes("e2b")) return "학교 AI 사용 중";
  return modelId;
}

function renderTheme(elements, viewModel) {
  if (!elements.themeToggleButton) return;
  const theme = viewModel.settings.theme === "dark" ? "dark" : "light";
  elements.themeToggleButton.textContent = theme === "dark" ? "어둡게" : "밝게";
  elements.themeToggleButton.setAttribute("aria-pressed", String(theme === "dark"));
}

function renderGuideMode(elements, viewModel) {
  const guideMode = viewModel.settings.guideMode === "thorough" ? "thorough" : "friendly";
  const modeButtons = [
    { node: elements.friendlyModeButton, mode: "friendly" },
    { node: elements.thoroughModeButton, mode: "thorough" }
  ];

  modeButtons.forEach(({ node, mode }) => {
    if (!node) return;
    const active = guideMode === mode;
    node.classList.toggle("is-active", active);
    node.setAttribute("aria-pressed", String(active));
  });
}

function renderDefaultModel(elements, viewModel) {
  const provider = viewModel.settings.llmProvider === "openai" ? "openai" : "local";
  const modelButtons = [
    { node: elements.localModelButton, provider: "local" },
    { node: elements.openAiModelButton, provider: "openai" }
  ];

  modelButtons.forEach(({ node, provider: optionProvider }) => {
    if (!node) return;
    const active = provider === optionProvider;
    node.classList.toggle("is-active", active);
    node.setAttribute("aria-pressed", String(active));
  });
}

function renderInput(elements, viewModel) {
  const { state } = viewModel;
  const blocked = state.llmStatus !== "ready";
  const awaiting = state.isAwaitingAi;
  const started = Boolean(state.initialRequest);
  const hasOptions = Boolean(state.messages.at(-1)?.options?.length) && !state.completed;
  const wrapUpKeys = new Set((viewModel.wrapUpSteps ?? []).map((step) => step.key));
  const askingWrapUp = wrapUpKeys.has(state.pendingStepKey || "");
  elements.chatPanel?.classList.toggle("has-started", started);
  elements.messageInput.disabled = blocked || awaiting;
  if (elements.sendButton) elements.sendButton.disabled = blocked || awaiting;

  if (elements.restartButton) elements.restartButton.hidden = !started;
  if (elements.finishEarlyButton) {
    const answered = answeredKeysOf(state).size;
    elements.finishEarlyButton.hidden = !started || state.completed || awaiting || answered < 1;
    elements.finishEarlyButton.disabled = blocked || awaiting;
  }

  let placeholder;
  let hint;
  if (awaiting) {
    placeholder = awaitingLabel(state, viewModel.steps.length);
    hint = "";
  } else if (blocked) {
    placeholder = "AI 준비가 끝나면 시작할 수 있습니다.";
    hint = "";
  } else if (!started) {
    placeholder = "예: 우리 반 독서 기록 앱을 만들고 싶어요";
    hint = "만들고 싶은 자료, 앱, 문서를 한 문장으로 적어주세요. 짧아도 괜찮습니다.";
  } else if (state.completed) {
    placeholder = "예: 더 짧게, 말투를 부드럽게, 학생 이름은 빼주세요";
    hint = "고치고 싶은 부분을 적으면 오른쪽 프롬프트를 다시 만듭니다.";
  } else if (hasOptions && askingWrapUp) {
    placeholder = "A를 고르면 추천안대로 갑니다. 고치고 싶으면 직접 적어주세요.";
    hint = "AI가 대화 내용으로 추천안을 만들었습니다. 그대로 써도 되고, 원하는 대로 고쳐 적어도 됩니다.";
  } else if (hasOptions) {
    placeholder = "A, B, C 중 하나를 고르거나 직접 요청사항을 입력하세요.";
    hint = "";
  } else {
    placeholder = "답을 문장으로 적어주세요. 잘 모르면 '잘 모르겠어요'라고 적어도 됩니다.";
    hint = "";
  }
  elements.messageInput.placeholder = placeholder;
  if (elements.composerHint) {
    elements.composerHint.textContent = hint;
    elements.composerHint.hidden = !hint;
  }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || "" : date.toLocaleString("ko-KR");
}

function focusComposerIfReady(elements, viewModel) {
  if (!elements.messageInput || elements.messageInput.disabled || viewModel.state.isAwaitingAi) return;
  const active = document.activeElement;
  const canFocus = !active || active === document.body || active === elements.messageInput || active === elements.sendButton;
  if (!canFocus) return;

  window.requestAnimationFrame(() => {
    elements.messageInput.focus({ preventScroll: true });
  });
}
