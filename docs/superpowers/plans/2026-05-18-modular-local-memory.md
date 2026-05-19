# Modular Local Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the static 질문형 프롬프트 가이드 webapp into focused ES modules, add local draft/session/memory persistence, and preserve a teacher-led final prompt quality contract.

**Architecture:** Keep the app as static HTML/CSS/vanilla JavaScript. Move current `webapp/main.js` responsibilities into pure modules for steps, state, prompt building, reference notes, revision, storage, memory, and UI rendering. Use versioned `localStorage` keys and Node's built-in `node --test` for browser-independent module tests.

**Tech Stack:** Static HTML, CSS, browser ES modules, vanilla JavaScript, `localStorage`, Node.js built-in test runner.

---

## Source Documents

- Spec: `docs/superpowers/specs/2026-05-18-modular-local-memory-design.md`
- Issue slices:
  - `issues/0002-prompt-quality-contract.md`
  - `issues/0003-es-module-flow-refactor.md`
  - `issues/0004-active-draft-persistence.md`
  - `issues/0005-completed-session-migration.md`
  - `issues/0006-summary-memory-extraction.md`
  - `issues/0007-memory-toggle-prompt-context.md`
  - `issues/0008-local-storage-failure-handling.md`

## Local Constraints

- This directory is not currently a git repository. Do not invent git history. Each task includes a verification checkpoint instead of `git commit`.
- There is no package manager setup yet. Add a tiny root `package.json` only to enable ES module tests and convenience scripts.
- Do not add a build tool. The browser should load `webapp/main.js` as an ES module directly.
- Keep `/design` as the styling source. `webapp/styles.css` should continue importing `../design/variables.css`.
- Use locally downloaded Paperlogy webfont files from `webapp/assets/fonts`. App typography should use `letter-spacing: -0.02em` and approximately `line-height: 1.3`.
- LM Studio integration is out of scope.

## File Structure

Create:

- `package.json` - marks `.js` files as ES modules and adds test/check scripts.
- `tests/helpers.js` - in-memory `localStorage` replacement for tests.
- `tests/promptBuilder.test.js` - final prompt quality contract tests.
- `tests/revision.test.js` - clean revision tests.
- `tests/state.test.js` - session state and draft restore tests.
- `tests/storage.test.js` - versioned storage, legacy migration, malformed data tests.
- `tests/memory.test.js` - lightweight memory extraction and selection tests.
- `webapp/modules/steps.js` - ten-step question data.
- `webapp/modules/promptBuilder.js` - final prompt generation.
- `webapp/modules/referenceNotes.js` - separated reference notes.
- `webapp/modules/revision.js` - prompt revision and summary.
- `webapp/modules/state.js` - pure session state transitions.
- `webapp/modules/storage.js` - versioned `localStorage` access.
- `webapp/modules/memory.js` - deterministic summary memory.
- `webapp/modules/modelProfile.js` - local model display metadata.
- `webapp/modules/ui.js` - DOM rendering and event binding.
- `webapp/assets/fonts/Paperlogy-*.woff2` - local Paperlogy webfonts.

Modify:

- `webapp/main.js` - replace with thin app orchestration.
- `webapp/index.html` - change script to `type="module"` and add memory/draft controls.
- `webapp/styles.css` - add compact memory/draft control styles using existing tokens.

---

### Task 1: Prompt Quality Contract

**Issues:** `issues/0002-prompt-quality-contract.md`

**Files:**
- Create: `package.json`
- Create: `tests/promptBuilder.test.js`
- Create: `tests/revision.test.js`
- Create: `webapp/modules/promptBuilder.js`
- Create: `webapp/modules/revision.js`

- [ ] **Step 1: Create the minimal Node test setup**

Create `package.json`:

```json
{
  "type": "module",
  "scripts": {
    "test": "node --test",
    "check": "node --check webapp/main.js"
  }
}
```

- [ ] **Step 2: Write failing tests for the prompt quality contract**

Create `tests/promptBuilder.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildFinalPrompt, buildMemoryContext } from "../webapp/modules/promptBuilder.js";

const completedSession = {
  initialRequest: "중학교 과학 단원 마무리 활동지를 만들고 싶어요.",
  answers: {
    output: "활동지, 평가 문항, 루브릭",
    useScene: "수업 준비",
    context: "중학교 수업 또는 생활지도",
    goal: "학생의 개념 이해를 돕기",
    teacherJudgment: "학생 수준과 활동 난이도",
    sourceMaterial: "교육과정 성취기준",
    safety: "가명이나 예시 정보로 바꿀 수 있음",
    externalService: "교사만 준비용으로 사용",
    format: "표 형식",
    quality: "내일 바로 실행 가능해야 함"
  },
  answerMeta: {
    safety: { id: "B", label: "가명이나 예시 정보로 바꿀 수 있음" },
    externalService: { id: "A", label: "교사만 준비용으로 사용" }
  }
};

test("buildFinalPrompt includes every required human-readable section", () => {
  const prompt = buildFinalPrompt(completedSession);
  [
    "[역할]",
    "[상황]",
    "[목표]",
    "[교사 판단 지점]",
    "[사용 가능한 정보]",
    "[작업 지시]",
    "[반드시 지킬 조건]",
    "[출력 형식]",
    "[품질 기준]",
    "[정보가 부족할 때]"
  ].forEach((section) => assert.match(prompt, new RegExp(section.replace("[", "\\[").replace("]", "\\]"))));
});

test("buildFinalPrompt keeps teacher judgment with the teacher", () => {
  const prompt = buildFinalPrompt(completedSession);
  assert.match(prompt, /교사의 판단을 대신 확정하지 말고/);
  assert.match(prompt, /선택지와 장단점/);
});

test("buildFinalPrompt includes privacy and external-service constraints when risk signals exist", () => {
  const prompt = buildFinalPrompt({
    ...completedSession,
    answerMeta: {
      safety: { id: "D", label: "상담, 건강, 가정환경 등 민감한 내용이 있음", risk: "sensitive" },
      externalService: { id: "C", label: "학생이 답안이나 활동 결과를 제출", risk: "learningSoftware" }
    }
  });

  assert.match(prompt, /식별 가능한 정보는 사용하지 말고/);
  assert.match(prompt, /외부 서비스에 직접 로그인하거나 답안을 제출/);
});

test("buildMemoryContext formats prior memory as a soft preference, not a fact", () => {
  const memoryContext = buildMemoryContext([
    { text: "중학교 과학 수업 맥락을 자주 사용함" },
    { text: "결과물은 표 형식을 선호하는 경우가 많음" }
  ]);

  assert.match(memoryContext, /\[이전 작업 참고\]/);
  assert.match(memoryContext, /현재 요청과 맞지 않으면 따르지 말고/);
  assert.match(memoryContext, /중학교 과학 수업 맥락/);
});

test("buildFinalPrompt includes memory only when memory items are provided", () => {
  const promptWithoutMemory = buildFinalPrompt(completedSession);
  const promptWithMemory = buildFinalPrompt(completedSession, {
    memoryItems: [{ text: "중학교 과학 수업 맥락을 자주 사용함" }]
  });

  assert.doesNotMatch(promptWithoutMemory, /\[이전 작업 참고\]/);
  assert.match(promptWithMemory, /\[이전 작업 참고\]/);
});
```

- [ ] **Step 3: Write failing tests for clean revision behavior**

Create `tests/revision.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { revisePrompt, summarizeRevision } from "../webapp/modules/revision.js";

const basePrompt = `[역할]
너는 교사의 수업 준비와 행정업무를 돕는 전문적인 AI 협력자이다.

[상황]
- 초기 요청: 중학교 과학 활동지

[정보가 부족할 때]
- 중요한 정보가 부족하면 추측하지 말고 확인 질문을 먼저 하라.`;

test("revisePrompt inserts feedback as a structured section before missing-information guidance", () => {
  const revised = revisePrompt(basePrompt, "더 부드럽게 써줘");
  assert.match(revised, /\[수정 요청 반영\]/);
  assert.match(revised, /더 부드럽게 써줘/);
  assert.ok(revised.indexOf("[수정 요청 반영]") < revised.indexOf("[정보가 부족할 때]"));
});

test("revisePrompt replaces an older revision section instead of duplicating it", () => {
  const first = revisePrompt(basePrompt, "더 부드럽게 써줘");
  const second = revisePrompt(first, "더 짧게 써줘");
  assert.equal((second.match(/\[수정 요청 반영\]/g) || []).length, 1);
  assert.doesNotMatch(second, /더 부드럽게 써줘/);
  assert.match(second, /더 짧게 써줘/);
});

test("summarizeRevision returns teacher-facing summaries", () => {
  assert.match(summarizeRevision("더 부드럽게"), /부드럽/);
  assert.match(summarizeRevision("더 구체적으로"), /구체/);
  assert.match(summarizeRevision("개인정보 안내를 조정"), /개인정보/);
  assert.match(summarizeRevision("짧게"), /분량/);
});
```

- [ ] **Step 4: Run tests and verify they fail**

Run:

```bash
node --test tests/promptBuilder.test.js tests/revision.test.js
```

Expected: FAIL with module-not-found errors for `webapp/modules/promptBuilder.js` and `webapp/modules/revision.js`.

- [ ] **Step 5: Implement the prompt builder module**

Create `webapp/modules/promptBuilder.js`:

```js
const DEFAULTS = {
  initialRequest: "사용자가 입력한 요청",
  output: "필요한 산출물",
  useScene: "사용 장면",
  context: "교육 및 업무 맥락",
  goal: "교사의 목적에 맞는 결과물을 만든다.",
  teacherJudgment: "교사가 직접 판단해야 하는 핵심 선택",
  sourceMaterial: "사용자가 제공하는 자료",
  safety: "개인정보 포함 여부 확인 필요",
  externalService: "외부 서비스 사용 여부 확인 필요",
  format: "사용자가 요청한 형식",
  quality: "현장에서 바로 활용할 수 있어야 한다."
};

export function buildMemoryContext(memoryItems = []) {
  const usableItems = memoryItems
    .map((item) => item?.text)
    .filter(Boolean)
    .slice(0, 5);

  if (!usableItems.length) return "";

  return `[이전 작업 참고]
아래 내용은 이 브라우저에 저장된 이전 작업 요약이다. 현재 요청과 맞지 않으면 따르지 말고, 필요한 경우 사용자에게 확인 질문을 하라.
${usableItems.map((text) => `- ${text}`).join("\n")}`;
}

export function buildPrivacyCondition(answerMeta = {}) {
  const safety = answerMeta.safety;
  const external = answerMeta.externalService;
  const conditions = [];

  if (safety?.risk === "privacy" || safety?.risk === "sensitive") {
    conditions.push("- 실제 학생 이름, 얼굴, 학번, 연락처, 성적, 상담 내용 등 식별 가능한 정보는 사용하지 말고 가명 또는 예시 정보로 바꾸라.");
  } else {
    conditions.push("- 실제 학생 개인정보가 필요해 보이면 먼저 익명화 가능 여부를 확인하라.");
  }

  if (external?.risk === "learningSoftware" || external?.risk === "learningContent") {
    conditions.push("- 학생이 외부 서비스에 직접 로그인하거나 답안을 제출하는 방식이 포함되면, 도구 선정과 개인정보 보호 기준 확인이 필요함을 안내하라.");
  }

  conditions.push("- 교사의 판단을 대신 확정하지 말고, 필요한 경우 선택지와 장단점을 함께 제시하라.");
  conditions.push("- 표현은 동료 교사가 함께 설계하는 말투로 하라.");

  return conditions.join("\n");
}

export function buildFinalPrompt(session, options = {}) {
  const answers = session?.answers || {};
  const answerMeta = session?.answerMeta || {};
  const memoryContext = buildMemoryContext(options.memoryItems || []);

  const initialRequest = session?.initialRequest || DEFAULTS.initialRequest;
  const output = answers.output || DEFAULTS.output;
  const useScene = answers.useScene || DEFAULTS.useScene;
  const context = answers.context || DEFAULTS.context;
  const goal = answers.goal || DEFAULTS.goal;
  const teacherJudgment = answers.teacherJudgment || DEFAULTS.teacherJudgment;
  const sourceMaterial = answers.sourceMaterial || DEFAULTS.sourceMaterial;
  const safety = answers.safety || DEFAULTS.safety;
  const externalService = answers.externalService || DEFAULTS.externalService;
  const format = answers.format || DEFAULTS.format;
  const quality = answers.quality || DEFAULTS.quality;

  const memoryBlock = memoryContext ? `\n\n${memoryContext}` : "";

  return `[역할]
너는 교사의 수업 준비와 행정업무를 돕는 전문적인 AI 협력자이다. 교사의 판단을 대신하지 않고, 교사가 생각을 정리해 현장에서 쓸 수 있는 결과물을 만들도록 돕는다.

[상황]
교사는 다음 작업을 준비하고 있다.
- 초기 요청: ${initialRequest}
- 산출물: ${output}
- 사용 장면: ${useScene}
- 교육 및 업무 맥락: ${context}

[목표]
${goal}

[교사 판단 지점]
다음 부분은 AI가 단정하지 말고 선택지와 근거를 제시한 뒤 교사가 판단할 수 있게 도와라.
- ${teacherJudgment}

[사용 가능한 정보]
- 참고 자료: ${sourceMaterial}
- 안전 확인: ${safety}
- 외부 도구 및 서비스: ${externalService}${memoryBlock}

[작업 지시]
1. 교사의 요청을 바탕으로 ${output}을 작성하라.
2. ${useScene}에서 바로 활용할 수 있도록 구체적으로 구성하라.
3. 교육과정, 학생 수준, 학교 업무 맥락을 추측하지 말고 제공된 정보 안에서 반영하라.
4. 교사가 수정하기 쉬운 구조로 작성하라.
5. 필요한 경우 교사가 선택할 수 있는 대안과 장단점을 함께 제시하라.

[반드시 지킬 조건]
${buildPrivacyCondition(answerMeta)}

[출력 형식]
${format}으로 작성하라.

[품질 기준]
- ${quality}
- 사람도 구조를 이해할 수 있고, 다른 AI 도구도 바로 실행할 수 있게 구체적으로 작성하라.
- 불필요하게 과장된 표현을 줄이고, 교사가 바로 검토하고 수정할 수 있게 하라.

[정보가 부족할 때]
- 중요한 정보가 부족하면 임의로 확정하지 말고 확인 질문을 먼저 제시하라.
- 단, 일반적인 예시로 진행할 수 있는 부분은 "예시"임을 밝히고 작성하라.`;
}
```

- [ ] **Step 6: Implement the revision module**

Create `webapp/modules/revision.js`:

```js
const REVISION_SECTION = "[수정 요청 반영]";
const MISSING_INFO_SECTION = "[정보가 부족할 때]";

export function revisePrompt(currentPrompt, feedback) {
  const cleanedPrompt = String(currentPrompt || "").replace(
    /\n\n\[수정 요청 반영\][\s\S]*?(?=\n\n\[정보가 부족할 때\]|$)/u,
    ""
  );

  const revisionBlock = `${REVISION_SECTION}
사용자의 추가 요청: ${feedback}
위 요청을 반영해 톤, 구체성, 출력 형식, 안전 안내의 강도를 조정하라. 수정 후에도 전체 결과는 바로 복사해 쓸 수 있는 한 벌의 프롬프트로 유지하라.`;

  const missingInfoIndex = cleanedPrompt.indexOf(`\n\n${MISSING_INFO_SECTION}`);

  if (missingInfoIndex === -1) {
    return `${cleanedPrompt}\n\n${revisionBlock}`;
  }

  return `${cleanedPrompt.slice(0, missingInfoIndex)}\n\n${revisionBlock}${cleanedPrompt.slice(missingInfoIndex)}`;
}

export function summarizeRevision(feedback) {
  if (feedback.includes("부드럽")) return "전체 톤을 더 부드럽고 동료 교사형으로 조정하도록 지시했습니다.";
  if (feedback.includes("구체")) return "출력 기준과 절차를 더 구체화하도록 지시했습니다.";
  if (feedback.includes("개인정보") || feedback.includes("안전")) return "개인정보 안내의 강도와 표현을 조정하도록 지시했습니다.";
  if (feedback.includes("짧") || feedback.includes("간결")) return "분량을 줄이고 핵심만 남기도록 지시했습니다.";
  return "입력한 피드백을 최종 프롬프트의 수정 조건으로 반영했습니다.";
}
```

- [ ] **Step 7: Run tests and verify they pass**

Run:

```bash
node --test tests/promptBuilder.test.js tests/revision.test.js
```

Expected: PASS for all tests in both files.

- [ ] **Step 8: Check task completion snapshot**

Run:

```bash
git rev-parse --is-inside-work-tree 2>/dev/null || true
```

Expected in current workspace: no output. Do not run `git commit` because the current directory is not a git repository.

---

### Task 2: Modular Flow Core

**Issues:** `issues/0003-es-module-flow-refactor.md`

**Files:**
- Create: `tests/state.test.js`
- Create: `webapp/modules/steps.js`
- Create: `webapp/modules/referenceNotes.js`
- Create: `webapp/modules/state.js`
- Create: `webapp/modules/modelProfile.js`
- Modify: `webapp/index.html`

- [ ] **Step 1: Write failing state and reference tests**

Create `tests/state.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { steps } from "../webapp/modules/steps.js";
import {
  createInitialState,
  appendAssistantMessage,
  startRequest,
  recordStepAnswer,
  advanceStep,
  completeState,
  restoreDraft
} from "../webapp/modules/state.js";
import { buildReferenceNotes } from "../webapp/modules/referenceNotes.js";

test("state helpers preserve the one-question-at-a-time flow", () => {
  let state = createInitialState();
  state = appendAssistantMessage(state, "시작 안내");
  state = startRequest(state, "중학교 과학 활동지");
  state = recordStepAnswer(state, steps[0], "활동지, 평가 문항, 루브릭", steps[0].options[1]);
  state = advanceStep(state, steps.length);

  assert.equal(state.initialRequest, "중학교 과학 활동지");
  assert.equal(state.activeStepIndex, 1);
  assert.equal(state.answers.output, "활동지, 평가 문항, 루브릭");
  assert.equal(state.messages.at(-1).role, "user");
});

test("completeState marks the flow completed and stores outputs", () => {
  const state = completeState(createInitialState(), {
    finalPrompt: "최종 프롬프트",
    referenceNotes: "참고 안내"
  });

  assert.equal(state.completed, true);
  assert.equal(state.activeStepIndex, steps.length);
  assert.equal(state.finalPrompt, "최종 프롬프트");
  assert.equal(state.referenceNotes, "참고 안내");
});

test("restoreDraft restores only valid draft-like state", () => {
  const draft = restoreDraft({
    initialRequest: "초안 요청",
    activeStepIndex: 3,
    answers: { output: "표" },
    answerMeta: {},
    messages: [{ role: "user", text: "초안 요청" }],
    finalPrompt: "",
    referenceNotes: "",
    completed: false
  });

  assert.equal(draft.initialRequest, "초안 요청");
  assert.equal(draft.activeStepIndex, 3);
  assert.equal(draft.answers.output, "표");
});

test("buildReferenceNotes keeps safety guidance separated from final prompt", () => {
  const notes = buildReferenceNotes({
    safety: { id: "C", label: "실제 학생 정보가 일부 들어갈 수 있음", risk: "privacy" },
    externalService: { id: "B", label: "학생이 외부 서비스에 로그인", risk: "learningSoftware" }
  });

  assert.match(notes, /관련 기준: 개인정보 보호 원칙/);
  assert.match(notes, /관련 기준: 교육부/);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
node --test tests/state.test.js
```

Expected: FAIL with module-not-found errors for `steps.js`, `state.js`, or `referenceNotes.js`.

- [ ] **Step 3: Create the steps module**

Create `webapp/modules/steps.js` by moving the existing `steps` array out of `webapp/main.js` and exporting it:

```js
export const steps = [
  {
    key: "output",
    title: "산출물 확인",
    question: "먼저 만들 산출물을 정리해볼게요. 지금 가장 가까운 결과물은 무엇인가요?",
    options: [
      { id: "A", label: "수업안 또는 수업 흐름" },
      { id: "B", label: "활동지, 평가 문항, 루브릭" },
      { id: "C", label: "안내문, 가정통신문, 메시지" },
      { id: "D", label: "회의록, 계획서, 행정 문서" }
    ]
  },
  {
    key: "useScene",
    title: "사용 장면 확인",
    question: "이 프롬프트는 어느 장면에서 쓰일 예정인가요?",
    options: [
      { id: "A", label: "수업 준비" },
      { id: "B", label: "수업 중 활용" },
      { id: "C", label: "피드백 또는 평가" },
      { id: "D", label: "행정 처리 또는 협의" }
    ]
  },
  {
    key: "context",
    title: "교육 및 업무 맥락 확인",
    question: "교육 및 업무 맥락은 어디에 가장 가깝나요?",
    options: [
      { id: "A", label: "초등 수업 또는 학급 운영" },
      { id: "B", label: "중학교 수업 또는 생활지도" },
      { id: "C", label: "고등학교 수업 또는 진로·평가" },
      { id: "D", label: "학교 공통 업무 또는 부서 업무" }
    ]
  },
  {
    key: "goal",
    title: "목표 확인",
    question: "이 작업을 통해 가장 좋아져야 하는 부분은 무엇인가요?",
    options: [
      { id: "A", label: "학생의 개념 이해를 돕기" },
      { id: "B", label: "학생의 질문과 참여를 늘리기" },
      { id: "C", label: "업무 내용을 빠르게 정리하기" },
      { id: "D", label: "문장의 톤과 완성도 높이기" }
    ]
  },
  {
    key: "teacherJudgment",
    title: "교사 판단 지점 확인",
    question: "AI가 대신 정하면 안 되고 선생님이 판단해야 하는 핵심 선택은 무엇인가요?",
    options: [
      { id: "A", label: "성취기준 또는 평가 기준" },
      { id: "B", label: "학생 수준과 활동 난이도" },
      { id: "C", label: "생활지도 또는 소통 표현" },
      { id: "D", label: "민감한 행정 판단" }
    ]
  },
  {
    key: "sourceMaterial",
    title: "필요한 자료 확인",
    question: "프롬프트에 반영할 참고 자료가 있나요?",
    options: [
      { id: "A", label: "교육과정 성취기준" },
      { id: "B", label: "기존 문서 또는 학교 양식" },
      { id: "C", label: "회의 내용, 협의 내용, 학생 반응" },
      { id: "D", label: "아직 없음, 나중에 추가" }
    ]
  },
  {
    key: "safety",
    title: "안전 확인",
    question: "안전 확인 하나만 할게요. 실제 학생 이름, 얼굴, 학번, 연락처, 성적, 상담 내용처럼 특정 학생을 알아볼 수 있는 정보가 들어가나요?",
    options: [
      { id: "A", label: "개인정보는 들어가지 않음" },
      { id: "B", label: "가명이나 예시 정보로 바꿀 수 있음" },
      { id: "C", label: "실제 학생 정보가 일부 들어갈 수 있음", risk: "privacy" },
      { id: "D", label: "상담, 건강, 가정환경 등 민감한 내용이 있음", risk: "sensitive" }
    ]
  },
  {
    key: "externalService",
    title: "외부 도구 및 서비스 확인",
    question: "학생이 직접 외부 서비스에 로그인하거나 답안을 입력하는 방식이 포함되나요?",
    options: [
      { id: "A", label: "교사만 준비용으로 사용" },
      { id: "B", label: "학생이 외부 서비스에 로그인", risk: "learningSoftware" },
      { id: "C", label: "학생이 답안이나 활동 결과를 제출", risk: "learningSoftware" },
      { id: "D", label: "업체가 만든 학습 콘텐츠나 진단 기능 사용", risk: "learningContent" }
    ]
  },
  {
    key: "format",
    title: "출력 형식 확인",
    question: "최종 결과물은 어떤 형식이면 바로 쓰기 좋을까요?",
    options: [
      { id: "A", label: "표 형식" },
      { id: "B", label: "단계별 계획" },
      { id: "C", label: "문장 초안" },
      { id: "D", label: "체크리스트 또는 루브릭" }
    ]
  },
  {
    key: "quality",
    title: "품질 기준 및 수정 방향 확인",
    question: "결과물을 평가할 때 가장 중요한 기준은 무엇인가요?",
    options: [
      { id: "A", label: "내일 바로 실행 가능해야 함" },
      { id: "B", label: "말투가 부드럽고 부담 없어야 함" },
      { id: "C", label: "기준과 절차가 구체적이어야 함" },
      { id: "D", label: "짧고 명확해야 함" }
    ]
  }
];

export function getStepByIndex(index) {
  return steps[index] || null;
}
```

- [ ] **Step 4: Create reference notes, model profile, and state modules**

Create `webapp/modules/referenceNotes.js`:

```js
export function buildReferenceNotes(answerMeta = {}) {
  const notes = [];
  const safety = answerMeta.safety;
  const external = answerMeta.externalService;

  if (safety?.risk === "privacy" || safety?.risk === "sensitive") {
    notes.push(`관련 기준: 개인정보 보호 원칙
해당 부분: 실제 학생을 알아볼 수 있는 정보 또는 민감한 학생 정보의 입력 여부
쉬운 설명: 학생 이름, 학번, 연락처, 성적, 상담 내용, 건강 정보, 가정환경처럼 특정 학생을 알아볼 수 있거나 민감한 정보는 AI 도구에 그대로 넣지 않는 것이 안전합니다.
이번 요청과 연결되는 이유: 안전 확인 단계에서 "${safety.label}"을 선택했기 때문입니다.`);
  }

  if (external?.risk === "learningSoftware" || external?.risk === "learningContent") {
    notes.push(`관련 기준: 교육부 「학습지원 소프트웨어 선정기준 및 가이드라인」
해당 부분: 학생 개인정보 처리 여부, 학생이 직접 사용하는 외부 서비스 여부, 교과 성취기준 관련 학습 콘텐츠 포함 여부
쉬운 설명: 학생이 외부 서비스에 로그인하거나 답안을 제출하거나, 업체가 만든 학습 콘텐츠와 진단 기능을 사용하는 경우 학교 차원의 확인이 필요할 수 있습니다.
이번 요청과 연결되는 이유: 외부 도구 및 서비스 확인 단계에서 "${external.label}"을 선택했기 때문입니다.`);
  }

  if (!notes.length) {
    notes.push(`관련 기준: 안전 확인 기본 원칙
해당 부분: 학생 개인정보와 외부 서비스 사용 여부
쉬운 설명: 이번 흐름에서는 실제 학생 개인정보나 학생 직접 사용 외부 서비스가 명확히 포함되지 않았습니다. 다만 최종 프롬프트에는 개인정보가 필요해 보이면 먼저 확인하도록 조건을 넣었습니다.`);
  }

  return notes.join("\n\n");
}
```

Create `webapp/modules/modelProfile.js`:

```js
export const LOCAL_MODEL_ID = "google/gemma-4-e4b";

export const modelProfile = {
  title: "Gemma 4 e4b",
  description: "단일 모델. 단계별 질문, 최종 프롬프트 생성, 수정 요청을 모두 처리합니다. 저사양 환경을 고려해 API 연결 시 요청은 반드시 하나씩 순차 실행합니다.",
  stepTokens: "1024-1536 tokens",
  finalTokens: "2500-4000 tokens"
};
```

Create `webapp/modules/state.js`:

```js
import { steps } from "./steps.js";

export function createInitialState() {
  return {
    id: `draft-${Date.now()}`,
    initialRequest: "",
    activeStepIndex: -1,
    answers: {},
    answerMeta: {},
    messages: [],
    finalPrompt: "",
    referenceNotes: "",
    completed: false
  };
}

export function appendAssistantMessage(state, text, options = []) {
  return {
    ...state,
    messages: [
      ...state.messages,
      { role: "assistant", text, options, stepIndex: state.activeStepIndex }
    ]
  };
}

export function appendUserMessage(state, text) {
  return {
    ...state,
    messages: [...state.messages, { role: "user", text }]
  };
}

export function startRequest(state, text) {
  return {
    ...appendUserMessage(state, text),
    initialRequest: text,
    activeStepIndex: 0
  };
}

export function recordStepAnswer(state, step, answerText, option = null) {
  const displayText = option ? `${option.id}. ${option.label}` : answerText;
  return {
    ...appendUserMessage(state, displayText),
    answers: {
      ...state.answers,
      [step.key]: option ? option.label : answerText
    },
    answerMeta: {
      ...state.answerMeta,
      [step.key]: option || { id: "직접", label: answerText }
    }
  };
}

export function advanceStep(state, totalSteps = steps.length) {
  const nextIndex = state.activeStepIndex + 1;
  return {
    ...state,
    activeStepIndex: Math.min(nextIndex, totalSteps)
  };
}

export function completeState(state, { finalPrompt, referenceNotes }) {
  return {
    ...state,
    completed: true,
    activeStepIndex: steps.length,
    finalPrompt,
    referenceNotes
  };
}

export function applyRevisionState(state, { revisedPrompt, summary }) {
  return appendAssistantMessage(
    {
      ...state,
      finalPrompt: revisedPrompt
    },
    `수정 요청을 반영했습니다.\n변경점: ${summary}\n\n오른쪽 최종 프롬프트를 다시 확인해주세요.`
  );
}

export function restoreDraft(draft) {
  if (!draft || typeof draft !== "object") return createInitialState();
  return {
    ...createInitialState(),
    ...draft,
    answers: draft.answers && typeof draft.answers === "object" ? draft.answers : {},
    answerMeta: draft.answerMeta && typeof draft.answerMeta === "object" ? draft.answerMeta : {},
    messages: Array.isArray(draft.messages) ? draft.messages : [],
    completed: Boolean(draft.completed)
  };
}
```

- [ ] **Step 5: Change the script tag to ES module**

Modify `webapp/index.html`:

```html
<script type="module" src="./main.js"></script>
```

This replaces the existing:

```html
<script src="./main.js"></script>
```

- [ ] **Step 6: Run tests and verify they pass**

Run:

```bash
node --test tests/state.test.js
```

Expected: PASS.

- [ ] **Step 7: Check task completion snapshot**

Run:

```bash
git rev-parse --is-inside-work-tree 2>/dev/null || true
```

Expected in current workspace: no output. Do not run `git commit`.

---

### Task 3: Versioned Storage and Legacy Sessions

**Issues:** `issues/0005-completed-session-migration.md`

**Files:**
- Create: `tests/helpers.js`
- Create: `tests/storage.test.js`
- Create: `webapp/modules/storage.js`

- [ ] **Step 1: Write the storage test helper**

Create `tests/helpers.js`:

```js
export function createLocalStorageMock(initialValues = {}) {
  const store = new Map(Object.entries(initialValues));

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    key(index) {
      return Array.from(store.keys())[index] || null;
    },
    get length() {
      return store.size;
    },
    dump() {
      return Object.fromEntries(store.entries());
    }
  };
}

export function createFailingStorage() {
  return {
    getItem() {
      throw new Error("storage unavailable");
    },
    setItem() {
      throw new Error("quota exceeded");
    },
    removeItem() {
      throw new Error("storage unavailable");
    }
  };
}
```

- [ ] **Step 2: Write failing storage tests**

Create `tests/storage.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { createFailingStorage, createLocalStorageMock } from "./helpers.js";
import {
  STORAGE_KEYS,
  clearSessions,
  migrateLegacySessions,
  readSessions,
  saveSession
} from "../webapp/modules/storage.js";

test("saveSession stores newest sessions first and keeps only 20", () => {
  const storage = createLocalStorageMock();

  for (let index = 0; index < 22; index += 1) {
    saveSession({ id: `session-${index}`, title: `세션 ${index}`, finalPrompt: "p", referenceNotes: "r" }, storage);
  }

  const sessions = readSessions(storage);
  assert.equal(sessions.length, 20);
  assert.equal(sessions[0].id, "session-21");
  assert.equal(sessions.at(-1).id, "session-2");
});

test("migrateLegacySessions moves old compact sessions into the versioned key", () => {
  const storage = createLocalStorageMock({
    teacherPromptGuideSessions: JSON.stringify([
      {
        id: 1710000000000,
        title: "이전 초안",
        createdAt: "2026. 5. 18.",
        prompt: "이전 프롬프트",
        reference: "이전 참고"
      }
    ])
  });

  const result = migrateLegacySessions(storage);
  const sessions = readSessions(storage);

  assert.equal(result.ok, true);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].title, "이전 초안");
  assert.equal(sessions[0].finalPrompt, "이전 프롬프트");
  assert.equal(storage.getItem("teacherPromptGuideSessions"), null);
});

test("migrateLegacySessions does not delete legacy data when migration fails", () => {
  const storage = createLocalStorageMock({
    teacherPromptGuideSessions: "{broken"
  });

  const result = migrateLegacySessions(storage);

  assert.equal(result.ok, false);
  assert.equal(storage.getItem("teacherPromptGuideSessions"), "{broken");
});

test("readSessions returns an empty list for malformed data", () => {
  const storage = createLocalStorageMock({
    [STORAGE_KEYS.sessions]: "{broken"
  });

  assert.deepEqual(readSessions(storage), []);
});

test("clearSessions removes only this app's session key", () => {
  const storage = createLocalStorageMock({
    [STORAGE_KEYS.sessions]: "[]",
    unrelated: "keep"
  });

  clearSessions(storage);

  assert.equal(storage.getItem(STORAGE_KEYS.sessions), null);
  assert.equal(storage.getItem("unrelated"), "keep");
});

test("write failures return ok false instead of throwing", () => {
  const result = saveSession({ id: "session-1", title: "x" }, createFailingStorage());
  assert.equal(result.ok, false);
});
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
node --test tests/storage.test.js
```

Expected: FAIL with module-not-found errors for `webapp/modules/storage.js`.

- [ ] **Step 4: Implement versioned storage**

Create `webapp/modules/storage.js`:

```js
export const STORAGE_KEYS = {
  sessions: "teacherPromptGuide.sessions.v1",
  activeDraft: "teacherPromptGuide.activeDraft.v1",
  memory: "teacherPromptGuide.memory.v1",
  settings: "teacherPromptGuide.settings.v1",
  legacySessions: "teacherPromptGuideSessions"
};

const DEFAULT_SETTINGS = { memoryEnabled: true };
const DEFAULT_MEMORY = { items: [], updatedAt: "" };

function getBrowserStorage() {
  return globalThis.localStorage;
}

function safeRead(key, fallback, storage = getBrowserStorage()) {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function safeWrite(key, value, storage = getBrowserStorage()) {
  try {
    storage?.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

function safeRemove(key, storage = getBrowserStorage()) {
  try {
    storage?.removeItem(key);
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error.message };
  }
}

function normalizeSession(session) {
  return {
    id: String(session.id || `session-${Date.now()}`),
    title: session.title || session.initialRequest?.slice(0, 42) || "새 프롬프트 초안",
    createdAt: session.createdAt || new Date().toISOString(),
    updatedAt: session.updatedAt || new Date().toISOString(),
    initialRequest: session.initialRequest || "",
    answers: session.answers || {},
    answerMeta: session.answerMeta || {},
    messages: Array.isArray(session.messages) ? session.messages : [],
    finalPrompt: session.finalPrompt || session.prompt || "",
    referenceNotes: session.referenceNotes || session.reference || "",
    memorySummary: session.memorySummary || null
  };
}

export function readSessions(storage = getBrowserStorage()) {
  const sessions = safeRead(STORAGE_KEYS.sessions, [], storage);
  return Array.isArray(sessions) ? sessions.map(normalizeSession) : [];
}

export function saveSession(session, storage = getBrowserStorage()) {
  const sessions = readSessions(storage);
  const normalized = normalizeSession(session);
  const next = [
    normalized,
    ...sessions.filter((item) => item.id !== normalized.id && item.title !== normalized.title)
  ].slice(0, 20);
  return safeWrite(STORAGE_KEYS.sessions, next, storage);
}

export function clearSessions(storage = getBrowserStorage()) {
  return safeRemove(STORAGE_KEYS.sessions, storage);
}

export function migrateLegacySessions(storage = getBrowserStorage()) {
  let legacy;
  try {
    const raw = storage?.getItem(STORAGE_KEYS.legacySessions);
    if (!raw) return { ok: true, migrated: 0 };
    legacy = JSON.parse(raw);
  } catch (error) {
    return { ok: false, migrated: 0, message: error.message };
  }

  if (!Array.isArray(legacy)) return { ok: false, migrated: 0, message: "legacy sessions are not an array" };

  const existing = readSessions(storage);
  const migrated = legacy.map(normalizeSession);
  const next = [...migrated, ...existing].slice(0, 20);
  const writeResult = safeWrite(STORAGE_KEYS.sessions, next, storage);
  if (!writeResult.ok) return { ...writeResult, migrated: 0 };

  safeRemove(STORAGE_KEYS.legacySessions, storage);
  return { ok: true, migrated: migrated.length };
}

export function readActiveDraft(storage = getBrowserStorage()) {
  return safeRead(STORAGE_KEYS.activeDraft, null, storage);
}

export function writeActiveDraft(draft, storage = getBrowserStorage()) {
  return safeWrite(STORAGE_KEYS.activeDraft, { ...draft, updatedAt: new Date().toISOString() }, storage);
}

export function clearActiveDraft(storage = getBrowserStorage()) {
  return safeRemove(STORAGE_KEYS.activeDraft, storage);
}

export function readMemoryStore(storage = getBrowserStorage()) {
  const memory = safeRead(STORAGE_KEYS.memory, DEFAULT_MEMORY, storage);
  return {
    items: Array.isArray(memory.items) ? memory.items : [],
    updatedAt: memory.updatedAt || ""
  };
}

export function writeMemoryStore(memory, storage = getBrowserStorage()) {
  const items = Array.isArray(memory.items) ? memory.items.slice(0, 30) : [];
  return safeWrite(STORAGE_KEYS.memory, { items, updatedAt: new Date().toISOString() }, storage);
}

export function clearMemoryStore(storage = getBrowserStorage()) {
  return safeRemove(STORAGE_KEYS.memory, storage);
}

export function readSettings(storage = getBrowserStorage()) {
  return { ...DEFAULT_SETTINGS, ...safeRead(STORAGE_KEYS.settings, DEFAULT_SETTINGS, storage) };
}

export function writeSettings(settings, storage = getBrowserStorage()) {
  return safeWrite(STORAGE_KEYS.settings, { ...DEFAULT_SETTINGS, ...settings }, storage);
}
```

- [ ] **Step 5: Run tests and verify they pass**

Run:

```bash
node --test tests/storage.test.js
```

Expected: PASS.

- [ ] **Step 6: Check task completion snapshot**

Run:

```bash
git rev-parse --is-inside-work-tree 2>/dev/null || true
```

Expected in current workspace: no output. Do not run `git commit`.

---

### Task 4: Lightweight Summary Memory

**Issues:** `issues/0006-summary-memory-extraction.md`

**Files:**
- Create: `tests/memory.test.js`
- Create: `webapp/modules/memory.js`

- [ ] **Step 1: Write failing memory tests**

Create `tests/memory.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  createMemoryItemsFromSession,
  mergeMemoryItems,
  selectMemoryItems
} from "../webapp/modules/memory.js";

const completedSession = {
  id: "session-1",
  completed: true,
  answers: {
    output: "활동지, 평가 문항, 루브릭",
    useScene: "수업 준비",
    context: "중학교 수업 또는 생활지도",
    quality: "내일 바로 실행 가능해야 함"
  },
  answerMeta: {
    safety: { id: "D", label: "상담, 건강, 가정환경 등 민감한 내용이 있음", risk: "sensitive" },
    externalService: { id: "A", label: "교사만 준비용으로 사용" }
  }
};

test("createMemoryItemsFromSession extracts deterministic memory only from completed sessions", () => {
  const items = createMemoryItemsFromSession(completedSession);
  assert.ok(items.some((item) => item.kind === "workContext" && item.text.includes("중학교")));
  assert.ok(items.some((item) => item.kind === "preferredOutput" && item.text.includes("활동지")));
  assert.ok(items.some((item) => item.kind === "safetyPreference" && item.text.includes("민감")));

  assert.deepEqual(createMemoryItemsFromSession({ ...completedSession, completed: false }), []);
});

test("mergeMemoryItems keeps newest items first and limits the list to 30", () => {
  const existing = Array.from({ length: 29 }, (_, index) => ({
    id: `old-${index}`,
    kind: "workContext",
    text: `기존 ${index}`,
    createdAt: "2026-05-18T00:00:00.000Z"
  }));
  const next = mergeMemoryItems(existing, [
    { id: "new-1", kind: "qualityPreference", text: "새 메모리", createdAt: "2026-05-18T01:00:00.000Z" },
    { id: "new-2", kind: "qualityPreference", text: "새 메모리", createdAt: "2026-05-18T01:00:00.000Z" }
  ]);

  assert.equal(next.length, 30);
  assert.equal(next[0].id, "new-1");
  assert.equal(next.filter((item) => item.text === "새 메모리").length, 1);
});

test("selectMemoryItems returns no memory when disabled", () => {
  const selected = selectMemoryItems([{ text: "중학교 수업" }], { memoryEnabled: false });
  assert.deepEqual(selected, []);
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
node --test tests/memory.test.js
```

Expected: FAIL with module-not-found error for `webapp/modules/memory.js`.

- [ ] **Step 3: Implement the memory module**

Create `webapp/modules/memory.js`:

```js
function nowIso() {
  return new Date().toISOString();
}

function createItem(sourceSessionId, kind, text) {
  return {
    id: `memory-${Date.now()}-${kind}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    sourceSessionId,
    kind,
    text
  };
}

export function createMemoryItemsFromSession(session) {
  if (!session?.completed) return [];

  const answers = session.answers || {};
  const answerMeta = session.answerMeta || {};
  const sourceSessionId = session.id || `session-${Date.now()}`;
  const items = [];

  if (answers.context) items.push(createItem(sourceSessionId, "workContext", `${answers.context} 맥락을 자주 사용함`));
  if (answers.output) items.push(createItem(sourceSessionId, "preferredOutput", `결과물은 ${answers.output}을 선호하는 경우가 많음`));
  if (answers.useScene) items.push(createItem(sourceSessionId, "useScene", `${answers.useScene} 장면에서 사용할 프롬프트를 자주 만듦`));
  if (answers.quality) items.push(createItem(sourceSessionId, "qualityPreference", `품질 기준은 "${answers.quality}"를 중요하게 봄`));

  if (answerMeta.safety?.risk) {
    items.push(createItem(sourceSessionId, "safetyPreference", `안전 확인에서 "${answerMeta.safety.label}" 같은 민감 조건을 고려한 적이 있음`));
  }

  if (answerMeta.externalService?.risk) {
    items.push(createItem(sourceSessionId, "safetyPreference", `외부 도구 확인에서 "${answerMeta.externalService.label}" 조건을 고려한 적이 있음`));
  }

  return items;
}

export function mergeMemoryItems(existingItems = [], newItems = []) {
  const seen = new Set();
  const merged = [];

  [...newItems, ...existingItems].forEach((item) => {
    if (!item?.text || seen.has(item.text)) return;
    seen.add(item.text);
    merged.push(item);
  });

  return merged.slice(0, 30);
}

export function selectMemoryItems(items = [], settings = { memoryEnabled: true }) {
  if (!settings.memoryEnabled) return [];
  return items.filter((item) => item?.text).slice(0, 5);
}
```

- [ ] **Step 4: Run tests and verify they pass**

Run:

```bash
node --test tests/memory.test.js
```

Expected: PASS.

- [ ] **Step 5: Check task completion snapshot**

Run:

```bash
git rev-parse --is-inside-work-tree 2>/dev/null || true
```

Expected in current workspace: no output. Do not run `git commit`.

---

### Task 5: UI Module and Main Orchestration

**Issues:** `issues/0003-es-module-flow-refactor.md`, `issues/0004-active-draft-persistence.md`, `issues/0007-memory-toggle-prompt-context.md`

**Files:**
- Create: `webapp/modules/ui.js`
- Modify: `webapp/main.js`
- Modify: `webapp/index.html`
- Modify: `webapp/styles.css`

- [ ] **Step 1: Add memory and draft controls to the HTML**

Modify the left panel in `webapp/index.html` so the saved section is followed by this block:

```html
        <section class="history-section memory-section">
          <div class="section-title-row">
            <h2>로컬 메모리</h2>
            <button id="toggleMemoryButton" class="text-button" type="button">MEMORY ON</button>
          </div>
          <p id="memoryStatus" class="memory-status">이 브라우저의 이전 작업 요약을 참고합니다.</p>
          <div class="memory-actions">
            <button id="clearMemoryButton" class="text-button" type="button">CLEAR MEMORY</button>
            <button id="clearDraftButton" class="text-button" type="button">NEW DRAFT</button>
          </div>
        </section>
```

Keep the script tag as:

```html
    <script type="module" src="./main.js"></script>
```

- [ ] **Step 2: Add compact memory styles**

Append to `webapp/styles.css` before the first media query. Keep these controls on the local Paperlogy typography baseline (`letter-spacing: -0.02em`, `line-height: 1.3`):

```css
.memory-section {
  padding-top: var(--spacing-16);
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}

.memory-status {
  margin: var(--spacing-12) 0 0;
  color: var(--color-steel-gray);
  font-family: "Paperlogy", var(--font-pragmatica), ui-sans-serif, system-ui, sans-serif;
  font-size: var(--text-caption);
  line-height: 1.3;
  letter-spacing: -0.02em;
}

.memory-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-12);
  margin-top: var(--spacing-12);
}

.text-button.is-active {
  color: #f0b196;
}
```

- [ ] **Step 3: Create the UI module**

Create `webapp/modules/ui.js`:

```js
export function createUi() {
  const elements = {
    chatLog: document.getElementById("chatLog"),
    chatForm: document.getElementById("chatForm"),
    messageInput: document.getElementById("messageInput"),
    stepHistory: document.getElementById("stepHistory"),
    progressBadge: document.getElementById("progressBadge"),
    promptPreview: document.getElementById("promptPreview"),
    referencePreview: document.getElementById("referencePreview"),
    copyPromptButton: document.getElementById("copyPromptButton"),
    copyReferenceButton: document.getElementById("copyReferenceButton"),
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
    memoryStatus: document.getElementById("memoryStatus")
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

      elements.copyPromptButton.addEventListener("click", handlers.onCopyPrompt);
      elements.copyReferenceButton.addEventListener("click", handlers.onCopyReference);
      elements.clearSavedButton.addEventListener("click", handlers.onClearSessions);
      elements.toggleMemoryButton.addEventListener("click", handlers.onToggleMemory);
      elements.clearMemoryButton.addEventListener("click", handlers.onClearMemory);
      elements.clearDraftButton.addEventListener("click", handlers.onClearDraft);
    },
    render(viewModel) {
      renderMessages(elements, viewModel);
      renderHistory(elements, viewModel);
      renderResult(elements, viewModel);
      renderSavedSessions(elements, viewModel);
      renderModelPlan(elements, viewModel);
      renderMemory(elements, viewModel);
    },
    showToast(text) {
      elements.toast.textContent = text;
      elements.toast.classList.add("visible");
      window.setTimeout(() => elements.toast.classList.remove("visible"), 1800);
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
    meta.textContent = message.role === "assistant" ? "GUIDE" : "TEACHER";

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    bubble.textContent = message.text;

    article.append(meta, bubble);

    if (message.options?.length && index === viewModel.state.messages.length - 1 && !viewModel.state.completed) {
      const options = document.createElement("div");
      options.className = "options-grid";

      message.options.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "option-button";
        button.innerHTML = `<span class="option-letter">${option.id}</span><span class="option-text">${option.label}</span>`;
        button.addEventListener("click", () => viewModel.handlers.onOption(option));
        options.append(button);
      });

      article.append(options);
    }

    elements.chatLog.append(article);
  });

  elements.chatLog.scrollTop = elements.chatLog.scrollHeight;
}

function renderHistory(elements, viewModel) {
  const { state, steps } = viewModel;
  elements.stepHistory.innerHTML = "";
  elements.progressBadge.textContent = `${Math.min(state.activeStepIndex, steps.length)} / ${steps.length}`;

  steps.forEach((step, index) => {
    const item = document.createElement("li");
    item.className = "history-item";

    const indexNode = document.createElement("div");
    indexNode.className = "history-index";
    indexNode.textContent = String(index + 1).padStart(2, "0");

    const body = document.createElement("div");
    const question = document.createElement("p");
    question.className = "history-question";
    question.textContent = step.title;

    const answer = document.createElement("p");
    answer.className = "history-answer";
    answer.textContent = state.answers[step.key] || "대기 중";

    body.append(question, answer);
    item.append(indexNode, body);
    elements.stepHistory.append(item);
  });
}

function renderResult(elements, viewModel) {
  elements.promptPreview.textContent = viewModel.state.finalPrompt || "10단계 질문이 끝나면 복사 가능한 프롬프트가 여기에 표시됩니다.";
  elements.referencePreview.textContent = viewModel.state.referenceNotes || "개인정보 또는 학습지원 소프트웨어 관련 신호가 있을 때 관련 기준과 쉬운 설명이 분리되어 표시됩니다.";
}

function renderSavedSessions(elements, viewModel) {
  elements.savedSessions.innerHTML = "";

  if (!viewModel.sessions.length) {
    const empty = document.createElement("p");
    empty.className = "saved-empty";
    empty.textContent = "아직 저장된 초안이 없습니다.";
    elements.savedSessions.append(empty);
    return;
  }

  viewModel.sessions.forEach((session) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "saved-item";
    button.textContent = `${session.title}\n${new Date(session.updatedAt || session.createdAt).toLocaleString("ko-KR")}`;
    button.addEventListener("click", () => viewModel.handlers.onLoadSession(session));
    elements.savedSessions.append(button);
  });
}

function renderModelPlan(elements, viewModel) {
  elements.modelPlanTitle.textContent = viewModel.modelProfile.title;
  elements.modelPlanDescription.textContent = `${viewModel.modelProfile.description} 모델 ID: ${viewModel.localModelId}`;
  elements.stepTokenBudget.textContent = viewModel.modelProfile.stepTokens;
  elements.finalTokenBudget.textContent = viewModel.modelProfile.finalTokens;
}

function renderMemory(elements, viewModel) {
  const enabled = viewModel.settings.memoryEnabled;
  const count = viewModel.memory.items.length;
  elements.toggleMemoryButton.textContent = enabled ? "MEMORY ON" : "MEMORY OFF";
  elements.toggleMemoryButton.classList.toggle("is-active", enabled);
  elements.memoryStatus.textContent = enabled
    ? `이 브라우저의 이전 작업 요약 ${count}개를 참고합니다.`
    : "이전 작업 요약을 참고하지 않습니다.";
}
```

- [ ] **Step 4: Replace main.js with orchestration**

Replace `webapp/main.js` with orchestration that imports the modules created above. It should:

- call `migrateLegacySessions()` once at startup
- read settings, memory, sessions, and active draft
- restore the draft when present
- add the initial assistant message only when no draft exists
- persist active draft after every non-completed interaction
- save completed sessions and clear active draft on completion
- merge summary memory after completion
- pass selected memory into `buildFinalPrompt`
- call `ui.render(...)` after every state change

Use this control-flow skeleton and keep function names exactly as shown:

```js
import { LOCAL_MODEL_ID, modelProfile } from "./modules/modelProfile.js";
import { steps, getStepByIndex } from "./modules/steps.js";
import {
  appendAssistantMessage,
  applyRevisionState,
  completeState,
  createInitialState,
  recordStepAnswer,
  restoreDraft,
  startRequest,
  advanceStep
} from "./modules/state.js";
import { buildFinalPrompt } from "./modules/promptBuilder.js";
import { buildReferenceNotes } from "./modules/referenceNotes.js";
import { revisePrompt, summarizeRevision } from "./modules/revision.js";
import {
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
} from "./modules/storage.js";
import { createMemoryItemsFromSession, mergeMemoryItems, selectMemoryItems } from "./modules/memory.js";
import { createUi } from "./modules/ui.js";

const WELCOME_MESSAGE = "하고 싶은 작업을 한두 문장으로 적어주세요.\n\n예: 중학교 과학 단원 마무리 활동지를 만들고 싶어요.\n예: 학부모 안내문 초안을 만들고 싶은데 개인정보 표현이 걱정돼요.\n예: 학생들이 쓸 AI 학습 도구 선정 기준을 검토하고 싶어요.";

let settings = readSettings();
let memoryStore = readMemoryStore();
let sessions = readSessions();
let state = restoreDraft(readActiveDraft());

const ui = createUi();

function init() {
  const migration = migrateLegacySessions();
  if (!migration.ok) ui.showToast("이전 저장 데이터를 새 형식으로 옮기지 못했습니다.");
  sessions = readSessions();

  if (!state.messages.length) {
    state = appendAssistantMessage(state, settings.memoryEnabled ? `${WELCOME_MESSAGE}\n\n로컬 메모리가 켜져 있습니다.` : WELCOME_MESSAGE);
  }

  ui.bindHandlers({
    onSubmit: handleSubmit,
    onOption: handleOption,
    onCopyPrompt: () => copyText(state.finalPrompt, "아직 복사할 최종 프롬프트가 없습니다."),
    onCopyReference: () => copyText(state.referenceNotes, "아직 복사할 참고 안내가 없습니다."),
    onClearSessions: handleClearSessions,
    onToggleMemory: handleToggleMemory,
    onClearMemory: handleClearMemory,
    onClearDraft: handleClearDraft,
    onLoadSession: handleLoadSession
  });

  render();
}

function handleSubmit(text) {
  if (!state.initialRequest) {
    state = startRequest(state, text);
    askCurrentStep();
  } else if (state.completed) {
    handleRevision(text);
  } else {
    handleStepAnswer(text, null);
  }

  persistDraftIfNeeded();
  render();
}

function handleOption(option) {
  handleStepAnswer(option.label, option);
  persistDraftIfNeeded();
  render();
}

function askCurrentStep() {
  const step = getStepByIndex(state.activeStepIndex);
  if (!step) {
    finishFlow();
    return;
  }
  state = appendAssistantMessage(state, `${step.title}\n${step.question}`, step.options);
}

function handleStepAnswer(answerText, option) {
  const step = getStepByIndex(state.activeStepIndex);
  if (!step) return;

  state = recordStepAnswer(state, step, answerText, option);

  if (option?.risk === "privacy" || option?.risk === "sensitive") {
    state = appendAssistantMessage(state, "좋습니다. 실제 정보가 꼭 필요하지 않다면 가명이나 예시 정보로 바꾸는 방향을 최종 프롬프트에 반영하겠습니다.");
  }

  if (option?.risk === "learningSoftware" || option?.risk === "learningContent") {
    state = appendAssistantMessage(state, "학생이 직접 쓰는 외부 서비스가 포함될 수 있네요. 학습지원 소프트웨어 기준과 연결되는 참고 안내를 분리해서 붙이겠습니다.");
  }

  state = advanceStep(state, steps.length);

  if (state.activeStepIndex >= steps.length) {
    finishFlow();
  } else {
    askCurrentStep();
  }
}

function finishFlow() {
  const selectedMemory = selectMemoryItems(memoryStore.items, settings);
  const finalPrompt = buildFinalPrompt(state, { memoryItems: selectedMemory });
  const referenceNotes = buildReferenceNotes(state.answerMeta);
  state = completeState(state, { finalPrompt, referenceNotes });
  state = appendAssistantMessage(state, "10단계 확인이 끝났습니다. 오른쪽에 최종 프롬프트와 참고 안내를 분리해두었습니다.\n\n마음에 들지 않는 부분이 있으면 아래 입력창에 그대로 지적해주세요. 예: 더 부드럽게, 행정 문서 느낌 줄이기, 개인정보 안내를 덜 부담스럽게.");

  saveCompletedState();
}

function handleRevision(text) {
  const revisedPrompt = revisePrompt(state.finalPrompt, text);
  const summary = summarizeRevision(text);
  state = applyRevisionState({ ...state, messages: [...state.messages, { role: "user", text }] }, { revisedPrompt, summary });
  saveCompletedState();
}

function saveCompletedState() {
  const session = {
    ...state,
    id: state.id?.startsWith("session-") ? state.id : `session-${Date.now()}`,
    title: state.initialRequest.slice(0, 42) || "새 프롬프트 초안",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const saveResult = saveSession(session);
  if (!saveResult.ok) ui.showToast("완료된 세션을 저장하지 못했습니다.");

  const newMemory = createMemoryItemsFromSession(session);
  memoryStore = { ...memoryStore, items: mergeMemoryItems(memoryStore.items, newMemory) };
  const memoryResult = writeMemoryStore(memoryStore);
  if (!memoryResult.ok) ui.showToast("로컬 메모리를 저장하지 못했습니다.");

  clearActiveDraft();
  sessions = readSessions();
}

function persistDraftIfNeeded() {
  if (state.completed) return;
  const result = writeActiveDraft(state);
  if (!result.ok) ui.showToast("진행 중 초안을 저장하지 못했습니다.");
}

function handleLoadSession(session) {
  state = {
    ...restoreDraft(session),
    completed: true,
    activeStepIndex: steps.length,
    finalPrompt: session.finalPrompt,
    referenceNotes: session.referenceNotes
  };
  render();
  ui.showToast("저장된 초안을 불러왔습니다.");
}

function handleClearSessions() {
  clearSessions();
  sessions = readSessions();
  render();
  ui.showToast("저장된 초안을 지웠습니다.");
}

function handleToggleMemory() {
  settings = { ...settings, memoryEnabled: !settings.memoryEnabled };
  const result = writeSettings(settings);
  if (!result.ok) ui.showToast("메모리 설정을 저장하지 못했습니다.");
  render();
}

function handleClearMemory() {
  const result = clearMemoryStore();
  memoryStore = readMemoryStore();
  render();
  ui.showToast(result.ok ? "로컬 메모리를 지웠습니다." : "로컬 메모리를 지우지 못했습니다.");
}

function handleClearDraft() {
  clearActiveDraft();
  state = appendAssistantMessage(createInitialState(), settings.memoryEnabled ? `${WELCOME_MESSAGE}\n\n로컬 메모리가 켜져 있습니다.` : WELCOME_MESSAGE);
  render();
  ui.showToast("새 초안을 시작합니다.");
}

function copyText(text, emptyMessage) {
  if (!text) {
    ui.showToast(emptyMessage);
    return;
  }

  navigator.clipboard.writeText(text)
    .then(() => ui.showToast("복사했습니다."))
    .catch(() => ui.showToast("브라우저 권한 때문에 복사하지 못했습니다. 텍스트를 직접 선택해주세요."));
}

function render() {
  ui.render({
    state,
    steps,
    sessions,
    settings,
    memory: memoryStore,
    modelProfile,
    localModelId: LOCAL_MODEL_ID,
    handlers: {
      onOption: handleOption,
      onLoadSession: handleLoadSession
    }
  });
}

init();
```

- [ ] **Step 5: Run syntax and module tests**

Run:

```bash
node --check webapp/main.js
node --test
```

Expected: `node --check` exits 0 and all tests pass.

- [ ] **Step 6: Run the local static server**

Run from the project root, not from `webapp`, so `webapp/styles.css` can keep importing the shared `../design/variables.css` source:

```bash
python3 -m http.server 8087 --bind 127.0.0.1
```

Expected: server starts and the app is available at `http://127.0.0.1:8087/webapp/`.

- [ ] **Step 7: Browser smoke check**

Open `http://127.0.0.1:8087/webapp/` and manually verify:

- initial guide message appears
- A/B/C/D option buttons render after the first request
- final prompt and reference notes render after 10 answers
- memory section appears in the left panel
- `MEMORY ON/OFF`, `CLEAR MEMORY`, and `NEW DRAFT` are visible and compact

- [ ] **Step 8: Stop the server**

Press `Ctrl-C` in the terminal running `python3 -m http.server`.

- [ ] **Step 9: Check task completion snapshot**

Run:

```bash
git rev-parse --is-inside-work-tree 2>/dev/null || true
```

Expected in current workspace: no output. Do not run `git commit`.

---

### Task 6: Active Draft Persistence

**Issues:** `issues/0004-active-draft-persistence.md`

**Files:**
- Modify: `tests/storage.test.js`
- Modify: `tests/state.test.js`
- Modify: `webapp/modules/storage.js`
- Modify: `webapp/main.js`

- [ ] **Step 1: Add active draft tests**

Modify the existing import from `../webapp/modules/storage.js` at the top of `tests/storage.test.js` so it includes these names:

```js
import {
  STORAGE_KEYS,
  clearActiveDraft,
  clearSessions,
  migrateLegacySessions,
  readActiveDraft,
  readSessions,
  saveSession,
  writeActiveDraft
} from "../webapp/modules/storage.js";
```

Then append this test to `tests/storage.test.js`:

```js

test("active draft can be written, read, and cleared", () => {
  const storage = createLocalStorageMock();
  const draft = {
    id: "draft-1",
    initialRequest: "초안",
    activeStepIndex: 2,
    messages: [{ role: "user", text: "초안" }],
    completed: false
  };

  assert.equal(writeActiveDraft(draft, storage).ok, true);
  assert.equal(readActiveDraft(storage).initialRequest, "초안");
  assert.equal(readActiveDraft(storage).activeStepIndex, 2);

  clearActiveDraft(storage);
  assert.equal(readActiveDraft(storage), null);
});
```

- [ ] **Step 2: Run active draft tests**

Run:

```bash
node --test tests/storage.test.js tests/state.test.js
```

Expected: PASS. The storage module must already export `readActiveDraft`, `writeActiveDraft`, and `clearActiveDraft` from Task 3.

- [ ] **Step 3: Manual active draft browser check**

Run:

```bash
python3 -m http.server 8087 --bind 127.0.0.1
```

In the browser:

1. Open `http://127.0.0.1:8087/webapp/`.
2. Enter an initial request.
3. Answer two step questions.
4. Reload the page.
5. Confirm the same chat messages, step history, and current question are still shown.
6. Click `NEW DRAFT`.
7. Confirm the app returns to the initial guide message.

Expected: reload restores the active draft; `NEW DRAFT` clears it.

- [ ] **Step 4: Stop the server**

Press `Ctrl-C` in the terminal running the server.

- [ ] **Step 5: Check task completion snapshot**

Run:

```bash
git rev-parse --is-inside-work-tree 2>/dev/null || true
```

Expected in current workspace: no output. Do not run `git commit`.

---

### Task 7: Memory Toggle and Prompt Context HITL Check

**Issues:** `issues/0007-memory-toggle-prompt-context.md`

**Files:**
- Modify: `tests/promptBuilder.test.js`
- Modify: `tests/storage.test.js`
- Modify: `webapp/main.js`
- Modify: `webapp/modules/ui.js`
- Modify: `webapp/styles.css`

- [ ] **Step 1: Add settings persistence tests**

Modify the existing import from `../webapp/modules/storage.js` at the top of `tests/storage.test.js` so it includes these names:

```js
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
```

Then append these tests to `tests/storage.test.js`:

```js

test("settings default to memory enabled and can be updated", () => {
  const storage = createLocalStorageMock();
  assert.equal(readSettings(storage).memoryEnabled, true);

  assert.equal(writeSettings({ memoryEnabled: false }, storage).ok, true);
  assert.equal(readSettings(storage).memoryEnabled, false);
});

test("memory store can be written and cleared", () => {
  const storage = createLocalStorageMock();
  writeMemoryStore({ items: [{ id: "m1", text: "중학교 맥락" }] }, storage);
  assert.equal(readMemoryStore(storage).items.length, 1);

  clearMemoryStore(storage);
  assert.equal(readMemoryStore(storage).items.length, 0);
});
```

- [ ] **Step 2: Run tests**

Run:

```bash
node --test tests/storage.test.js tests/promptBuilder.test.js tests/memory.test.js
```

Expected: PASS.

- [ ] **Step 3: Manual HITL browser check for memory UI**

Run:

```bash
python3 -m http.server 8087 --bind 127.0.0.1
```

In the browser:

1. Complete one 10-step flow.
2. Confirm local memory count increases in the left panel.
3. Start a new draft with memory on.
4. Complete a second flow.
5. Confirm the final prompt includes `[이전 작업 참고]`.
6. Click `MEMORY ON` so it changes to `MEMORY OFF`.
7. Start another draft and complete the flow.
8. Confirm the final prompt does not include `[이전 작업 참고]`.
9. Click `CLEAR MEMORY`.
10. Confirm the memory count returns to 0 and the UI still fits in the left panel.

Expected: memory UI is compact, understandable, and not visually louder than saved drafts.

- [ ] **Step 4: Stop and request HITL approval**

Stop the static server with `Ctrl-C`.

Ask the user:

```text
메모리 UI 위치와 문구가 교사-facing 도구에 과하지 않은지 확인해주세요. 이 상태로 유지할까요, 아니면 문구나 위치를 조정할까요?
```

Expected: user explicitly approves or requests UI wording/layout changes.

- [ ] **Step 5: Apply any requested HITL adjustment**

If the user requests wording or placement changes, edit only `webapp/index.html` and `webapp/styles.css` unless behavior also needs to change. Re-run:

```bash
node --check webapp/main.js
node --test
```

Expected: syntax check exits 0 and all tests pass.

- [ ] **Step 6: Check task completion snapshot**

Run:

```bash
git rev-parse --is-inside-work-tree 2>/dev/null || true
```

Expected in current workspace: no output. Do not run `git commit`.

---

### Task 8: Storage Failure Handling

**Issues:** `issues/0008-local-storage-failure-handling.md`

**Files:**
- Modify: `tests/storage.test.js`
- Modify: `webapp/modules/storage.js`
- Modify: `webapp/main.js`

- [ ] **Step 1: Add failure behavior tests**

Confirm the existing import from `../webapp/modules/storage.js` at the top of `tests/storage.test.js` includes these names:

```js
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
```

Then append these tests to `tests/storage.test.js`:

```js
test("read helpers tolerate unavailable storage", () => {
  const storage = createFailingStorage();

  assert.deepEqual(readSessions(storage), []);
  assert.equal(readActiveDraft(storage), null);
  assert.deepEqual(readMemoryStore(storage), { items: [], updatedAt: "" });
  assert.equal(readSettings(storage).memoryEnabled, true);
});

test("storage helpers do not touch unrelated keys", () => {
  const storage = createLocalStorageMock({
    unrelated: "keep",
    [STORAGE_KEYS.sessions]: JSON.stringify([{ id: "session-1", title: "x" }])
  });

  clearSessions(storage);
  clearActiveDraft(storage);
  clearMemoryStore(storage);

  assert.equal(storage.getItem("unrelated"), "keep");
});
```

- [ ] **Step 2: Run failure tests**

Run:

```bash
node --test tests/storage.test.js
```

Expected: PASS.

- [ ] **Step 3: Verify UI reports write failures via toast**

Review `webapp/main.js` and confirm every write result is checked:

- `saveSession(session)` result checked
- `writeMemoryStore(memoryStore)` result checked
- `writeActiveDraft(state)` result checked
- `writeSettings(settings)` result checked

If any write result is ignored, update `webapp/main.js` to show `ui.showToast(...)` on `ok: false`.

- [ ] **Step 4: Full verification**

Run:

```bash
node --check webapp/main.js
node --test
python3 -m http.server 8087 --bind 127.0.0.1
```

Expected: syntax check exits 0, all tests pass, and server starts.

- [ ] **Step 5: Final browser smoke check**

Open `http://127.0.0.1:8087/webapp/` and verify:

- 10-step flow completes.
- final prompt includes all required quality sections.
- reference notes remain separate.
- reload restores active draft before completion.
- completed sessions persist after reload.
- memory on/off affects final prompt.
- `CLEAR MEMORY` clears memory.
- UI remains consistent with the dark monochrome design.

- [ ] **Step 6: Stop the server**

Press `Ctrl-C` in the terminal running the server.

- [ ] **Step 7: Check task completion snapshot**

Run:

```bash
git rev-parse --is-inside-work-tree 2>/dev/null || true
```

Expected in current workspace: no output. Do not run `git commit`.

---

## Self-Review

Spec coverage:

- Prompt quality contract: Task 1.
- ES module split: Task 2 and Task 5.
- Local storage schema and legacy migration: Task 3.
- Active draft persistence: Task 6.
- Lightweight memory extraction: Task 4.
- Memory toggle and prompt context: Task 7.
- Storage failure handling: Task 8.
- Design constraints: Task 5 and Task 7 manual checks.

Execution order:

1. Task 1 creates the prompt/revision contract.
2. Task 2 creates core modules.
3. Task 3 creates storage and migration.
4. Task 4 creates memory extraction.
5. Task 5 wires UI and main orchestration.
6. Task 6 verifies active draft persistence.
7. Task 7 performs HITL memory UI review.
8. Task 8 hardens storage failures and performs final verification.

The plan intentionally avoids LM Studio integration, account systems, remote sync, full chat search, encryption, and cross-device sharing because those are outside the approved spec.
