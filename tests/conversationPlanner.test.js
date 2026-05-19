import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFinalPromptMessages,
  buildNextQuestionMessages,
  parsePlannerResponse,
  quickOptionsForIntent
} from "../webapp/modules/conversationPlanner.js";

test("buildNextQuestionMessages frames a short seed as teacher-focused creation support", () => {
  const messages = buildNextQuestionMessages({
    seed: "학급 앱 만들고 싶어",
    turns: []
  });
  const content = messages.map((message) => message.content).join("\n");

  assert.match(content, /교사용/);
  assert.match(content, /앱|프로그램|자료/);
  assert.match(content, /모두 한국어로 작성/);
  assert.match(content, /한 번에 하나의 질문/);
  assert.match(content, /존댓말 문장/);
  assert.match(content, /교사가 이해하기 쉬운 짧은 요약과 AI가 실행할 상세 프롬프트를 분리/);
  assert.match(content, /요구사항 정의서 수준으로 상세하게 작성/);
  assert.match(content, /개인정보보호를 지키기 위한 구현 계획/);
  assert.match(content, /심의 대응에 필요한 구현 계획/);
  assert.match(content, /규정 설명은 참고 안내로 분리/);
  assert.match(content, /기능별 모듈화/);
  assert.match(content, /인증과 권한|데이터 모델|테스트/);
  assert.match(content, /JSON/);
});

test("buildNextQuestionMessages can switch to thorough grill-style checks", () => {
  const messages = buildNextQuestionMessages({
    seed: "학생 개인정보를 받는 앱",
    turns: [],
    guideMode: "thorough"
  });
  const content = messages.map((message) => message.content).join("\n");

  assert.match(content, /꼼꼼 확인 모드/);
  assert.match(content, /grill-me 스타일/);
  assert.match(content, /모호한 답변을 그냥 넘기지 않는다/);
  assert.match(content, /개인정보|외부 서비스|학습 콘텐츠 심의/);
});

test("parsePlannerResponse accepts valid question JSON and limits quick options", () => {
  const parsed = parsePlannerResponse(JSON.stringify({
    kind: "question",
    question: "어떤 자료를 만들까요?",
    rationale: "산출물 확인",
    suggestedOptions: ["수업 자료", "앱", "문서", "평가", "초과"],
    capturedFacts: { domain: "teacher" }
  }));

  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.kind, "question");
  assert.deepEqual(parsed.value.suggestedOptions.map((option) => option.id), ["A", "B", "C", "D"]);
  assert.ok(parsed.value.suggestedOptions.every((option) => /(요|니다|습니다|입니다|까요|주세요)[.!?]?$/.test(option.label)));
});

test("parsePlannerResponse returns recoverable fallback for invalid model output", () => {
  const parsed = parsePlannerResponse("질문만 일반 텍스트");

  assert.equal(parsed.ok, false);
  assert.equal(parsed.fallback.kind, "question");
  assert.match(parsed.fallback.question, /질문만 일반 텍스트/);
});

test("quickOptionsForIntent keeps choices optional and teacher-focused", () => {
  const options = quickOptionsForIntent({ outputKind: "app" });

  assert.ok(options.some((option) => /웹앱|웹사이트/.test(option.label)));
  assert.ok(options.some((option) => /윈도우용 프로그램/.test(option.label)));
  assert.ok(options.some((option) => /모바일 앱/.test(option.label)));
  assert.ok(options.every((option) => option.optional === true));
  assert.ok(options.every((option) => /(요|니다|습니다|입니다|까요|주세요)[.!?]?$/.test(option.label)));
});

test("buildFinalPromptMessages keeps prompt and reference guidance separate", () => {
  const messages = buildFinalPromptMessages({
    seed: "학부모 안내문",
    turns: [{ role: "user", text: "부드럽게" }],
    memoryItems: [{ text: "중학교 맥락을 고려한 적 있음" }]
  });
  const content = messages.map((message) => message.content).join("\n");

  assert.match(content, /최종 프롬프트/);
  assert.match(content, /참고 안내/);
  assert.match(content, /AI 실행용 프롬프트는 실제 제작 AI가 바로 작업할 수 있도록 상세하게 작성/);
  assert.match(content, /테스트 기준, 완료 기준/);
  assert.match(content, /준수하기 위한 화면, 권한, 저장, 삭제, 로그, 내보내기 기능 계획/);
  assert.match(content, /기능별로 모듈화/);
  assert.match(content, /역할, 주요 기능, 입력 데이터, 출력 데이터/);
  assert.doesNotMatch(content, /실행 결과/);
});

test("parsePlannerResponse accepts fenced JSON returned by local models", () => {
  const parsed = parsePlannerResponse("```json\n{\"kind\":\"question\",\"question\":\"확인 질문\"}\n```");

  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.question, "확인 질문");
});

test("parsePlannerResponse recovers malformed final prompt JSON from models", () => {
  const parsed = parsePlannerResponse(`{
  "kind": "final_prompt_ready",
  "finalPrompt": "첫 줄
둘째 줄: 웹앱을 기능별 모듈로 만든다.",
  "referenceNotes": "개인정보보호 고려할 점\\n- 확인"
}`);

  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.kind, "final_prompt_ready");
  assert.match(parsed.value.finalPrompt, /첫 줄/);
  assert.match(parsed.value.finalPrompt, /기능별 모듈/);
  assert.match(parsed.value.referenceNotes, /개인정보보호 고려할 점/);
});
