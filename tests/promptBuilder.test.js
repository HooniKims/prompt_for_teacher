import test from "node:test";
import assert from "node:assert/strict";
import { buildFinalPrompt, buildMemoryContext, buildPrivacyCondition, ensureFinalPromptRequirements, splitFinalPromptSections } from "../webapp/modules/promptBuilder.js";

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
    "[교사용 요약]",
    "[AI 실행용 프롬프트]",
    "[상세 작성 조건]",
    "[역할]",
    "[언어]",
    "[상황]",
    "[목표]",
    "[교사 판단 지점]",
    "[사용 가능한 정보]",
    "[작업 지시]",
    "[반드시 지킬 조건]",
    "[결과물 모습]",
    "[품질 기준]",
    "[정보가 부족할 때]"
  ].forEach((section) => assert.match(prompt, new RegExp(section.replace("[", "\\[").replace("]", "\\]"))));
});

test("buildFinalPrompt requires Korean output even when inputs are mixed language", () => {
  const prompt = buildFinalPrompt({
    ...completedSession,
    initialRequest: "I want a student feedback web app.",
    answers: {
      ...completedSession.answers,
      output: "web app with student login"
    }
  });

  assert.match(prompt, /모든 결과는 한국어로 작성/);
  assert.match(prompt, /영어로 입력했더라도/);
});

test("buildFinalPrompt separates teacher summary from AI execution prompt", () => {
  const prompt = buildFinalPrompt(completedSession);

  assert.ok(prompt.indexOf("[교사용 요약]") < prompt.indexOf("[AI 실행용 프롬프트]"));
  assert.match(prompt, /교사가 특히 확인할 점/);
  assert.match(prompt, /실제 학생 정보 사용 여부/);
});

test("buildFinalPrompt summarizes adaptive conversation turns for teachers", () => {
  const prompt = buildFinalPrompt({
    initialRequest: "학생 개인정보를 수집하는 피드백 웹앱",
    conversationTurns: [
      { role: "user", text: "학생 이름, 학번, 수행평가 점수, 오답 기록을 수집합니다." },
      { role: "assistant", text: "어떤 용도인가요?" },
      { role: "user", text: "교수학습평가와 개별 피드백에 사용합니다." }
    ]
  });

  assert.match(prompt, /대화에서 확인한 내용/);
  assert.match(prompt, /학생 이름, 학번, 수행평가 점수, 오답 기록/);
  assert.match(prompt, /교수학습평가와 개별 피드백/);
});

test("buildFinalPrompt asks app-like outputs to be modularized by feature", () => {
  const prompt = buildFinalPrompt(completedSession);

  assert.match(prompt, /기능별로 모듈화/);
  assert.match(prompt, /화면\/UI, 인증과 권한, 데이터 모델/);
  assert.match(prompt, /각 모듈은 역할, 주요 기능, 입력 데이터, 출력 데이터/);
  assert.match(prompt, /요구사항 정의서 수준/);
  assert.match(prompt, /개인정보보호를 지키기 위한 구현 계획/);
  assert.match(prompt, /심의 대응에 필요한 구현 계획/);
});

test("ensureFinalPromptRequirements adds Korean and module requirements to model output", () => {
  const fallbackPrompt = buildFinalPrompt(completedSession);
  const modelPrompt = `[교사용 요약]
- 학생 피드백 웹앱

[AI 실행용 프롬프트]
학생 피드백 웹앱을 만들어라.`;
  const prompt = ensureFinalPromptRequirements(modelPrompt, fallbackPrompt);

  assert.match(prompt, /모든 결과는 한국어로 작성/);
  assert.match(prompt, /기능별로 모듈화/);
  assert.match(prompt, /화면\/UI, 인증과 권한, 데이터 모델/);
  assert.match(prompt, /상세 작성 조건/);
  assert.match(prompt, /테스트 기준, 완료 기준/);
  assert.match(prompt, /규정 자체의 설명은 참고 안내로 분리/);
});

test("ensureFinalPromptRequirements preserves Korean teacher summary from model output", () => {
  const fallbackPrompt = buildFinalPrompt({
    initialRequest: "Teacher web app with student score data",
    conversationTurns: [{ role: "user", text: "Teacher web app with student score data" }]
  });
  const modelPrompt = `[1) 교사 요약(요구사항 정리)]
- 앱 종류: 웹앱
- 목적: 수행평가 점수와 오답 유형 요약을 교사가 확인한다.

[2) 개발 지시]
기능별 모듈로 나누어 설계한다.`;
  const prompt = ensureFinalPromptRequirements(modelPrompt, fallbackPrompt);

  assert.match(prompt, /^\[교사용 요약\]/);
  assert.doesNotMatch(prompt.slice(0, 500), /Teacher web app/);
  assert.match(prompt, /\[AI 실행용 프롬프트\]/);
});

test("splitFinalPromptSections separates teacher summary and AI prompt", () => {
  const prompt = `[교사용 요약]
- 교사가 볼 내용

[AI 실행용 프롬프트]
AI가 실행할 내용`;
  const sections = splitFinalPromptSections(prompt);

  assert.match(sections.teacherSummary, /교사가 볼 내용/);
  assert.match(sections.aiPrompt, /AI가 실행할 내용/);
  assert.doesNotMatch(sections.aiPrompt, /교사용 요약/);
});

test("splitFinalPromptSections recognizes model-written AI execution headings", () => {
  const prompt = `[교사용 요약]
- 교사용 설명

## 2) AI 실행 지시
기능별 모듈로 설계한다.`;
  const sections = splitFinalPromptSections(prompt);

  assert.match(sections.teacherSummary, /교사용 설명/);
  assert.doesNotMatch(sections.teacherSummary, /기능별 모듈/);
  assert.match(sections.aiPrompt, /기능별 모듈/);
});

test("splitFinalPromptSections creates a teacher summary when model omits the summary heading", () => {
  const prompt = `[역할]
- 당신은 교사용 독서 기록 웹앱을 설계하는 개발자입니다.

[목표]
- 학생은 읽은 책 제목과 한 줄 소감을 남깁니다.
- 교사는 학생별 피드백을 공개 버튼으로 제공합니다.`;
  const sections = splitFinalPromptSections(prompt);

  assert.match(sections.teacherSummary, /^\[교사용 요약\]/);
  assert.match(sections.teacherSummary, /교사가 특히 확인할 점/);
  assert.match(sections.aiPrompt, /\[역할\]/);
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

  assert.match(prompt, /개인정보보호 구현 계획에는 내부 ID 또는 가명 사용/);
  assert.match(prompt, /심의 대응 구현 계획에는 수집 항목, 이용 목적, 보관 기간/);
});

test("buildPrivacyCondition includes privacy constraints for privacy risk", () => {
  const conditions = buildPrivacyCondition({
    safety: { id: "B", label: "학생 개인정보가 포함될 수 있음", risk: "privacy" }
  }).join("\n");

  assert.match(conditions, /개인정보보호 구현 계획에는 내부 ID 또는 가명 사용/);
});

test("buildPrivacyCondition includes external-service constraints for learningContent risk", () => {
  const conditions = buildPrivacyCondition({
    externalService: { id: "B", label: "학습 콘텐츠를 외부 도구에서 사용", risk: "learningContent" }
  }).join("\n");

  assert.match(conditions, /심의 대응 구현 계획에는 수집 항목, 이용 목적, 보관 기간/);
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
