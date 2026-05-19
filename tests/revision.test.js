import test from "node:test";
import assert from "node:assert/strict";
import { buildRevisionMessages, revisePrompt, summarizeRevision } from "../webapp/modules/revision.js";

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

test("revisePrompt removes old feedback even when it contains a bracketed heading", () => {
  const firstFeedback = "표로 바꿔줘\n[출력 형식] 표로 바꿔줘";
  const first = revisePrompt(basePrompt, firstFeedback);
  const second = revisePrompt(first, "더 짧게 써줘");

  assert.equal((second.match(/\[수정 요청 반영\]/g) || []).length, 1);
  assert.match(second, /더 짧게 써줘/);
  assert.doesNotMatch(second, /\[출력 형식\] 표로 바꿔줘/);
  assert.doesNotMatch(second, /표로 바꿔줘\n\[출력 형식\] 표로 바꿔줘/);
});

test("summarizeRevision returns teacher-facing summaries", () => {
  assert.match(summarizeRevision("더 부드럽게"), /부드럽/);
  assert.match(summarizeRevision("더 구체적으로"), /구체/);
  assert.match(summarizeRevision("개인정보 안내를 조정"), /개인정보/);
  assert.match(summarizeRevision("짧게"), /분량/);
});

test("buildRevisionMessages asks the selected AI model to rewrite the saved prompt", () => {
  const messages = buildRevisionMessages({
    prompt: basePrompt,
    referenceNotes: "개인정보 보호 조건",
    revisionRequest: "앱 개발용으로 더 구체적으로"
  });
  const content = messages.map((message) => message.content).join("\n");

  assert.match(content, /최종 프롬프트 전체를 다시 작성/);
  assert.match(content, /모든 내용은 한국어로 작성/);
  assert.match(content, /수정된 최종 프롬프트만 반환/);
  assert.match(content, /개인정보 보호와 학습지원 소프트웨어/);
  assert.match(content, /앱 개발용으로 더 구체적으로/);
});
