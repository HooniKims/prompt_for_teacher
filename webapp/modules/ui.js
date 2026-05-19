import { splitFinalPromptSections } from "./promptBuilder.js?v=summary-fallback-2";

export function createUi() {
  let toastTimeout = 0;
  const elements = {
    chatPanel: document.querySelector(".chat-panel"),
    chatLog: document.getElementById("chatLog"),
    chatForm: document.getElementById("chatForm"),
    messageInput: document.getElementById("messageInput"),
    stepHistory: document.getElementById("stepHistory"),
    progressBadge: document.getElementById("progressBadge"),
    promptPreview: document.getElementById("promptPreview"),
    teacherSummaryPreview: document.getElementById("teacherSummaryPreview"),
    aiPromptPreview: document.getElementById("aiPromptPreview"),
    referencePreview: document.getElementById("referencePreview"),
    copyPromptButton: document.getElementById("copyPromptButton"),
    copyTeacherSummaryButton: document.getElementById("copyTeacherSummaryButton"),
    copyAiPromptButton: document.getElementById("copyAiPromptButton"),
    savedSessions: document.getElementById("savedSessions"),
    clearSavedButton: document.getElementById("clearSavedButton"),
    toast: document.getElementById("toast"),
    modelPlanTitle: document.getElementById("modelPlanTitle"),
    modelPlanDescription: document.getElementById("modelPlanDescription"),
    stepTokenBudget: document.getElementById("stepTokenBudget"),
    finalTokenBudget: document.getElementById("finalTokenBudget"),
    toggleMemoryButton: document.getElementById("toggleMemoryButton"),
    clearMemoryButton: document.getElementById("clearMemoryButton"),
    clearDraftButton: document.getElementById("clearDraftButton"),
    memoryStatus: document.getElementById("memoryStatus"),
    sendButton: document.getElementById("sendButton"),
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
        elements.messageInput.value = "";
        elements.messageInput.style.height = "auto";
        handlers.onSubmit(text);
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
      elements.clearSavedButton.addEventListener("click", handlers.onClearSessions);
      elements.toggleMemoryButton.addEventListener("click", handlers.onToggleMemory);
      elements.clearMemoryButton.addEventListener("click", handlers.onClearMemory);
      elements.clearDraftButton.addEventListener("click", handlers.onClearDraft);
      elements.themeToggleButton?.addEventListener("click", handlers.onToggleTheme);
      elements.restartButton?.addEventListener("click", handlers.onClearDraft);
      elements.friendlyModeButton?.addEventListener("click", () => handlers.onSetGuideMode("friendly"));
      elements.thoroughModeButton?.addEventListener("click", () => handlers.onSetGuideMode("thorough"));
      elements.localModelButton?.addEventListener("click", () => handlers.onSetDefaultModel?.("local"));
      elements.openAiModelButton?.addEventListener("click", () => handlers.onSetDefaultModel?.("openai"));
    },
    render(viewModel) {
      renderMessages(elements, viewModel);
      renderHistory(elements, viewModel);
      renderResult(elements, viewModel);
      renderSavedSessions(elements, viewModel);
      renderModelPlan(elements, viewModel);
      renderMemory(elements, viewModel);
      renderConnection(elements, viewModel);
      renderTheme(elements, viewModel);
      renderGuideMode(elements, viewModel);
      renderDefaultModel(elements, viewModel);
      renderInput(elements, viewModel);
      focusComposerIfReady(elements, viewModel);
    },
    showToast(text) {
      elements.toast.textContent = text;
      elements.toast.classList.add("visible");
      window.clearTimeout(toastTimeout);
      toastTimeout = window.setTimeout(() => elements.toast.classList.remove("visible"), 1800);
    }
  };
}

function renderMessages(elements, viewModel) {
  elements.chatLog.innerHTML = "";

  viewModel.state.messages.forEach((message, index) => {
    const article = document.createElement("article");
    article.className = `message ${message.role}`;

    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.textContent = message.role === "assistant" ? "가이드" : "나";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = sanitizeVisibleMessage(message.text);

    article.append(meta, bubble);

    if (message.options?.length && index === viewModel.state.messages.length - 1 && !viewModel.state.completed) {
      const options = document.createElement("div");
      options.className = "options-grid";

      message.options.forEach((option) => {
        let clicked = false;
        const button = document.createElement("button");
        button.type = "button";
        button.className = option.optional ? "option-button optional" : "option-button";

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

      article.append(options);
    }

    elements.chatLog.append(article);
  });

  elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
}

function sanitizeVisibleMessage(text = "") {
  if (/"kind"\s*:\s*"final_prompt_ready"/.test(text) || /final_prompt_ready/.test(text)) {
    return "최종 프롬프트를 정리했습니다. 오른쪽 완성본에서 확인해주세요.";
  }

  return text;
}

function renderHistory(elements, viewModel) {
  const { state, steps } = viewModel;
  elements.stepHistory.innerHTML = "";
  const answeredKeys = new Set(Object.keys(state.answers ?? {}).filter((key) => state.answers?.[key]));
  const inferredCount = Math.min(
    steps.length,
    Array.isArray(state.conversationTurns)
      ? state.conversationTurns.filter((turn) => turn?.role === "user" && turn?.source !== "seed" && turn?.text).length
      : 0
  );
  const completedCount = state.completed ? steps.length : Math.max(answeredKeys.size, inferredCount);
  const currentIndex = state.completed
    ? steps.length - 1
    : Math.min(steps.length - 1, Math.max(0, completedCount));
  elements.progressBadge.textContent = `${completedCount} / ${steps.length}`;

  steps.forEach((step, index) => {
    const item = document.createElement("li");
    item.className = "history-item";
    item.classList.toggle("is-done", index < completedCount || state.completed);
    item.classList.toggle("is-current", index === currentIndex);
    item.setAttribute("aria-current", index === currentIndex ? "step" : "false");

    const indexNode = document.createElement("div");
    indexNode.className = "history-index";
    indexNode.textContent = String(index + 1).padStart(2, "0");

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

function renderResult(elements, viewModel) {
  const finalPrompt = viewModel.state.finalPrompt || "";
  const { teacherSummary, aiPrompt } = splitFinalPromptSections(finalPrompt);
  const emptyMessage = "질문에 답하면 바로 복사해 쓸 수 있는 프롬프트가 여기에 표시됩니다.";
  elements.promptPreview.textContent = finalPrompt || emptyMessage;
  if (elements.teacherSummaryPreview) {
    elements.teacherSummaryPreview.textContent = teacherSummary || (finalPrompt ? "교사용 요약이 따로 감지되지 않았습니다." : "완성되면 교사가 먼저 볼 요약이 여기에 표시됩니다.");
  }
  if (elements.aiPromptPreview) {
    elements.aiPromptPreview.textContent = aiPrompt || (finalPrompt ? finalPrompt : "완성되면 AI에 붙여 넣을 프롬프트가 여기에 표시됩니다.");
  }
  elements.referencePreview.textContent = viewModel.state.referenceNotes || "개인정보 또는 학습지원 소프트웨어 관련 신호가 있을 때 관련 기준과 쉬운 설명이 분리되어 표시됩니다.";
}

function renderSavedSessions(elements, viewModel) {
  elements.savedSessions.innerHTML = "";

  if (!viewModel.sessions.length) {
    const empty = document.createElement("p");
    empty.className = "saved-empty";
    empty.textContent = "아직 저장한 작업이 없습니다.";
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
  if (elements.stepTokenBudget) elements.stepTokenBudget.textContent = "";
  if (elements.finalTokenBudget) elements.finalTokenBudget.textContent = "";
}

function renderMemory(elements, viewModel) {
  const enabled = viewModel.settings.memoryEnabled;
  const count = viewModel.memory.items.filter((item) => typeof item?.text === "string" && item.text.trim()).length;
  elements.toggleMemoryButton.textContent = enabled ? "켜짐" : "꺼짐";
  elements.toggleMemoryButton.classList.toggle("is-active", enabled);
  elements.memoryStatus.textContent = enabled
    ? `이 브라우저에 남아 있는 이전 작업 ${count}개를 참고합니다.`
    : "이전 작업을 참고하지 않습니다.";
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
    elements.llmModelBadge.textContent = shouldShowModel ? `모델: ${modelId}` : "";
    elements.llmModelBadge.title = shouldShowModel ? modelId : "";
  }
}

function renderTheme(elements, viewModel) {
  if (!elements.themeToggleButton) return;
  const theme = viewModel.settings.theme === "dark" ? "dark" : "light";
  elements.themeToggleButton.textContent = theme === "dark" ? "DARK" : "LIGHT";
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
  const blocked = viewModel.state.llmStatus !== "ready";
  const awaiting = viewModel.state.isAwaitingAi;
  elements.messageInput.disabled = blocked || awaiting;
  if (elements.sendButton) elements.sendButton.disabled = blocked || awaiting;

  if (awaiting) {
    elements.messageInput.placeholder = "AI가 다음 질문을 준비하고 있습니다.";
  } else if (blocked) {
    elements.messageInput.placeholder = "AI 준비가 끝나면 시작할 수 있습니다.";
  } else if (!viewModel.state.initialRequest) {
    elements.messageInput.placeholder = "만들고 싶은 자료, 앱, 프로그램을 짧게 적어주세요.";
  } else if (viewModel.state.completed) {
    elements.messageInput.placeholder = "수정하고 싶은 부분을 적어주세요.";
  } else {
    elements.messageInput.placeholder = "직접 답변을 입력하세요. 선택지는 보조입니다.";
  }
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value || "" : date.toLocaleString("ko-KR");
}


function focusComposerIfReady(elements, viewModel) {
  if (!elements.messageInput || elements.messageInput.disabled || viewModel.state.isAwaitingAi) return;
  if (document.activeElement && document.activeElement !== document.body && document.activeElement !== elements.messageInput) return;

  window.requestAnimationFrame(() => {
    elements.messageInput.focus();
    elements.chatForm?.scrollIntoView({ block: "nearest" });
  });
}
