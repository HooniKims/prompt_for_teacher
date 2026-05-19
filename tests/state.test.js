import test from "node:test";
import assert from "node:assert/strict";
import { steps, getStepByIndex } from "../webapp/modules/steps.js";
import { buildReferenceNotes } from "../webapp/modules/referenceNotes.js";
import {
  advanceStep,
  appendAssistantMessage,
  appendUserMessage,
  applyRevisionState,
  completeState,
  createInitialState,
  recordStepAnswer,
  restoreDraft,
  startRequest
} from "../webapp/modules/state.js";

test("steps exports the existing ten-step one-question flow", () => {
  assert.equal(steps.length, 10);
  assert.equal(steps[0].key, "output");
  assert.equal(steps[9].key, "quality");
  assert.equal(getStepByIndex(0), steps[0]);
  assert.equal(getStepByIndex(steps.length), null);
  assert.equal(steps.every((step) => step.options.length === 4), true);
});

test("state helpers preserve a one-question-at-a-time flow", () => {
  const initial = createInitialState();
  const greeted = appendAssistantMessage(initial, "시작 안내");
  const started = startRequest(greeted, "중학교 과학 활동지를 만들고 싶어요.");
  const asked = appendAssistantMessage(started, `${steps[0].title}\n${steps[0].question}`, steps[0].options);
  const answered = recordStepAnswer(asked, steps[0], steps[0].options[1].label, steps[0].options[1]);
  const advanced = advanceStep(answered);

  assert.equal(initial.activeStepIndex, -1);
  assert.equal(started.activeStepIndex, 0);
  assert.equal(answered.activeStepIndex, 0);
  assert.equal(advanced.activeStepIndex, 1);
  assert.equal(advanced.completed, false);
  assert.equal(advanced.answers.output, "윈도우용 프로그램을 만들고 싶습니다.");
  assert.equal(advanced.answerMeta.output.id, "B");
  assert.equal(advanced.messages.at(-1).role, "user");
  assert.equal(advanced.messages.at(-1).text, "B. 윈도우용 프로그램을 만들고 싶습니다.");
  assert.equal(greeted.messages.length, 1);
  assert.equal(initial.messages.length, 0);
});

test("state helpers record direct answers without option metadata and advance to completion boundary", () => {
  const started = startRequest(createInitialState(), "회의록 정리");
  const answered = recordStepAnswer(started, steps[0], "직접 쓴 산출물");
  const advanced = advanceStep({ ...answered, activeStepIndex: steps.length - 1 });

  assert.equal(answered.answers.output, "직접 쓴 산출물");
  assert.equal(answered.answerMeta.output.id, "직접");
  assert.equal(answered.answerMeta.output.label, "직접 쓴 산출물");
  assert.equal(advanced.activeStepIndex, steps.length);
});

test("completeState marks the flow complete and stores generated outputs", () => {
  const completed = completeState(startRequest(createInitialState(), "학부모 안내문"), {
    finalPrompt: "최종 프롬프트",
    referenceNotes: "참고 안내"
  });

  assert.equal(completed.completed, true);
  assert.equal(completed.activeStepIndex, steps.length);
  assert.equal(completed.finalPrompt, "최종 프롬프트");
  assert.equal(completed.referenceNotes, "참고 안내");
  assert.equal(completed.messages.at(-1).role, "assistant");
  assert.match(completed.messages.at(-1).text, /10단계 확인이 끝났습니다/);
});

test("applyRevisionState replaces the final prompt and appends a teacher-facing summary", () => {
  const revised = applyRevisionState(
    completeState(createInitialState(), {
      finalPrompt: "초안",
      referenceNotes: "참고"
    }),
    {
      revisedPrompt: "수정된 프롬프트",
      summary: "더 부드럽게 조정했습니다."
    }
  );

  assert.equal(revised.finalPrompt, "수정된 프롬프트");
  assert.equal(revised.referenceNotes, "참고");
  assert.match(revised.messages.at(-1).text, /더 부드럽게 조정했습니다/);
});

test("restoreDraft restores valid draft-like objects into normalized state", () => {
  const restored = restoreDraft({
    initialRequest: "초등 수업안",
    activeStepIndex: 3,
    answers: { output: "수업안 또는 수업 흐름" },
    answerMeta: { output: { id: "A", label: "수업안 또는 수업 흐름" } },
    messages: [{ role: "user", text: "초등 수업안" }],
    finalPrompt: "",
    referenceNotes: "",
    completed: false
  });

  assert.equal(restored.initialRequest, "초등 수업안");
  assert.equal(restored.activeStepIndex, 3);
  assert.equal(restored.answers.output, "수업안 또는 수업 흐름");
  assert.equal(restored.answerMeta.output.id, "A");
  assert.equal(restored.messages.length, 1);
  assert.equal(restoreDraft(null), null);
  assert.equal(restoreDraft({ activeStepIndex: 99 }), null);
});

test("buildReferenceNotes returns privacy and Ministry guidance for risk metadata", () => {
  const notes = buildReferenceNotes({
    safety: { id: "C", label: "실제 학생 정보가 일부 들어갈 수 있음", risk: "privacy" },
    externalService: { id: "B", label: "학생이 외부 서비스에 로그인", risk: "learningSoftware" }
  }, {
    initialRequest: "학생 기록을 수집하는 웹앱",
    answers: {
      output: "웹앱 또는 웹사이트",
      useScene: "수업 중 활용",
      context: "중학교 수업 또는 생활지도"
    }
  });

  assert.match(notes, /개인정보보호 고려할 점/);
  assert.match(notes, /학생 이름, 학번, 점수, 오답 기록, 학습 활동 기록/);
  assert.match(notes, /수집 항목, 이용 목적, 보관 기간/);
  assert.match(notes, /학습지원 소프트웨어 심의 관련 고려할 점/);
  assert.match(notes, /교원 의견수렴, 기준 충족 여부 확인, 학교운영위원회 심의, 최종 확정/);
  assert.match(notes, /학생이 로그인/);
  assert.ok(notes.split("\n").length <= 14);
});

test("buildReferenceNotes always includes strict privacy and learning software preparation", () => {
  const notes = buildReferenceNotes({}, {
    initialRequest: "학생 이름과 학번, 수행평가 점수를 수집하는 교수학습평가 웹앱",
    answers: { output: "모바일 앱" }
  });

  assert.match(notes, /개인정보보호 고려할 점/);
  assert.match(notes, /내부 ID, 가명, 예시 데이터, 마스킹된 정보/);
  assert.match(notes, /학습지원 소프트웨어 심의 관련 고려할 점/);
  assert.match(notes, /평가, 진단, 피드백, 추천 기능/);
});
