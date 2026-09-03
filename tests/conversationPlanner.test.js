import test from "node:test";
import assert from "node:assert/strict";
import {
  chooseNextStepKey,
  buildFinalPromptMessages,
  buildNextQuestionMessages,
  buildSegmentedFinalPromptMessages,
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
  assert.match(content, /교사 단독 행정·업무용인지/);
  assert.match(content, /규정 설명은 참고 안내로 분리/);
  assert.match(content, /기능별 모듈화/);
  assert.match(content, /인증과 권한|데이터 모델|테스트/);
  assert.match(content, /JSON/);
});

test("buildNextQuestionMessages includes natural regulation-informed service questions", () => {
  const messages = buildNextQuestionMessages({
    seed: "학생들이 쓰는 수학 진단 웹앱을 만들고 싶어",
    turns: [],
    guideMode: "thorough"
  });
  const content = messages.map((message) => message.content).join("\n");

  assert.match(content, /단도직입적으로 심의 대상인지 묻지 말고/);
  assert.match(content, /학생이 직접 사용하는 장면/);
  assert.match(content, /로그인, 답안 제출, 점수, 활동 기록/);
  assert.match(content, /개인정보 처리방침/);
  assert.match(content, /이용약관/);
  assert.match(content, /별도의 질문으로 만들지 않는다/);
  assert.match(content, /선생님에게 묻지 않는다/);
  assert.match(content, /마무리 3개\(범위, 우선순위, 성공 기준\)를 추천안과 함께 확인하고, 그 뒤 바로 final_prompt를 반환한다/);
  assert.match(content, /최대 2번까지만/);
});

test("buildNextQuestionMessages tells the model which checklist items are still empty", () => {
  const partial = buildNextQuestionMessages({ seed: "발표 순서 앱", turns: [], answers: { output: "발표 순서 앱", useScene: "수업 중 학생 사용" } })
    .map((message) => message.content).join("\n");
  assert.match(partial, /확인된 항목 \(2\/10\)/);
  assert.match(partial, /아직 비어 있는 항목 \(8개\)/);
  assert.match(partial, /- context: 대상과 맥락/);
  assert.match(partial, /반드시 비어 있는 항목 중 하나를 채우는 질문/);

  const full = buildNextQuestionMessages({ seed: "발표 순서 앱", turns: [], answers: Object.fromEntries(["output","useScene","context","goal","teacherJudgment","sourceMaterial","safety","externalService","format","quality"].map((key) => [key, "확인"])) })
    .map((message) => message.content).join("\n");
  assert.match(full, /기본 10개 항목이 모두 확인되었다/);
  assert.match(full, /남은 마무리 항목: scope: 범위, priority: 우선순위, success: 성공 기준/);

  const everything = buildNextQuestionMessages({ seed: "발표 순서 앱", turns: [], answers: Object.fromEntries([...["output","useScene","context","goal","teacherJudgment","sourceMaterial","safety","externalService","format","quality"], "scope", "priority", "success"].map((key) => [key, "확인"])) })
    .map((message) => message.content).join("\n");
  assert.match(everything, /지금 final_prompt_ready를 반환한다/);

  const wrapUp = buildNextQuestionMessages({ seed: "발표 순서 앱", turns: [{ role: "user", text: "네" }], answers: Object.fromEntries(["output","useScene","context","goal","teacherJudgment","sourceMaterial","safety","externalService","format","quality"].map((key) => [key, "확인"])), nextStepKey: "scope" })
    .map((message) => message.content).join("\n");
  assert.match(wrapUp, /이번에 물을 항목 \(지정됨\): scope: 범위/);
  assert.match(wrapUp, /추천안 제시형/);
  assert.match(wrapUp, /suggestedOptions 첫 번째는 반드시 "추천안대로 할게요: "/);
});

test("buildNextQuestionMessages can switch to thorough grill-style checks", () => {
  const messages = buildNextQuestionMessages({
    seed: "학생 개인정보를 받는 앱",
    turns: [],
    guideMode: "thorough"
  });
  const content = messages.map((message) => message.content).join("\n");

  assert.match(content, /꼼꼼 확인 모드/);
  assert.match(content, /꼼꼼 확인 모드/);
  assert.match(content, /모호한 답변은 그냥 넘기지 않고/);
  assert.match(content, /개인정보|외부 서비스|학습 콘텐츠 심의/);
});

test("buildNextQuestionMessages can ask local models for a short final signal", () => {
  const messages = buildNextQuestionMessages({
    seed: "학생 개인정보를 다루는 웹앱",
    turns: [{ role: "user", text: "수행평가 기록을 관리합니다." }],
    finalPromptMode: "segmented"
  });
  const content = messages.map((message) => message.content).join("\n");

  assert.match(content, /final_prompt_signal/);
  assert.match(content, /최종 프롬프트 본문을 작성하지 않는다/);
  assert.doesNotMatch(content, /"finalPrompt":"복사 가능한 최종 프롬프트"/);
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

test("parsePlannerResponse accepts a short final prompt signal", () => {
  const parsed = parsePlannerResponse(JSON.stringify({
    kind: "final_prompt_signal",
    rationale: "필수 내용을 충분히 확인했습니다."
  }));

  assert.equal(parsed.ok, true);
  assert.equal(parsed.value.kind, "final_prompt_signal");
  assert.match(parsed.value.rationale, /충분히 확인/);
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
  assert.match(content, /교사 단독 행정·업무·수업 준비용 도구는 심의 제외/);
  assert.match(content, /정규 수업에서 학생과 함께 쓰며 개인정보를 수집·처리하는 도구는 심의 필요/);
  assert.match(content, /AI 실행용 프롬프트는 실제 제작 AI가 바로 작업할 수 있도록 상세하게 작성/);
  assert.match(content, /테스트 기준, 완료 기준/);
  assert.match(content, /준수하기 위한 화면, 권한, 저장, 삭제, 로그, 내보내기 기능 계획/);
  assert.match(content, /기능별로 모듈화/);
  assert.match(content, /역할, 주요 기능, 입력 데이터, 출력 데이터/);
  assert.match(content, /푸터/);
  assert.match(content, /개인정보 처리방침/);
  assert.match(content, /이용약관/);
  assert.doesNotMatch(content, /실행 결과/);
});

test("buildSegmentedFinalPromptMessages creates focused Korean section prompts", () => {
  const messages = buildSegmentedFinalPromptMessages({
    segment: "ai_prompt",
    seed: "학생 개인정보를 다루는 수행평가 웹앱",
    turns: [{ role: "user", text: "점수와 오답 기록을 저장합니다." }],
    memoryItems: [{ text: "교사용 요약은 짧게 유지한 적 있음" }]
  });
  const content = messages.map((message) => message.content).join("\n");

  assert.match(content, /AI 실행용 프롬프트 부분만 작성/);
  assert.match(content, /기능별 모듈/);
  assert.match(content, /개인정보보호를 지키기 위한 구현 계획/);
  assert.match(content, /사용 목적이 교사 단독 행정·업무용인지/);
  assert.match(content, /한국어/);
  assert.doesNotMatch(content, /교사용 요약 부분/);
});

test("buildSegmentedFinalPromptMessages asks AI prompt segment for footer policy links", () => {
  const messages = buildSegmentedFinalPromptMessages({
    segment: "ai_prompt",
    seed: "학생 로그인 웹앱",
    turns: [{ role: "user", text: "풀이 기록과 점수를 저장합니다." }]
  });
  const content = messages.map((message) => message.content).join("\n");

  assert.match(content, /푸터/);
  assert.match(content, /개인정보 처리방침/);
  assert.match(content, /이용약관/);
  assert.match(content, /표준 개인정보 처리방침/);
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

test("chooseNextStepKey follows the checklist order and pulls privacy/storage forward for apps", () => {
  assert.equal(chooseNextStepKey({ initialRequest: "학급 규칙 안내문", answers: {}, conversationTurns: [] }), "output");
  assert.equal(chooseNextStepKey({ initialRequest: "학급 규칙 안내문", answers: { output: "안내문", useScene: "수업" }, conversationTurns: [] }), "context");

  const appAfterTwoQuestions = {
    initialRequest: "발표 순서 앱",
    answers: { output: "발표 순서 웹앱", useScene: "수업 중 학생 사용" },
    conversationTurns: [{ role: "user", text: "발표 순서 앱" }, { role: "assistant", text: "q1" }, { role: "user", text: "a1" }, { role: "assistant", text: "q2" }, { role: "user", text: "a2" }]
  };
  assert.equal(chooseNextStepKey(appAfterTwoQuestions), "safety");
  assert.equal(chooseNextStepKey({ ...appAfterTwoQuestions, answers: { ...appAfterTwoQuestions.answers, safety: "없음" } }), "externalService");
  assert.equal(chooseNextStepKey({ ...appAfterTwoQuestions, answers: { ...appAfterTwoQuestions.answers, safety: "없음", externalService: "저장 없음" } }), "context");
  const coreDone = Object.fromEntries(["output","useScene","context","goal","teacherJudgment","sourceMaterial","safety","externalService","format","quality"].map((key) => [key, "v"]));
  assert.equal(chooseNextStepKey({ initialRequest: "앱", answers: coreDone, conversationTurns: [] }), "scope");
  assert.equal(chooseNextStepKey({ initialRequest: "앱", answers: { ...coreDone, scope: "핵심만" }, conversationTurns: [] }), "priority");
  assert.equal(chooseNextStepKey({ initialRequest: "앱", answers: { ...coreDone, scope: "핵심만", priority: "뽑기", success: "1분" }, conversationTurns: [] }), "");
});

test("buildNextQuestionMessages pins the next item and asks the model to bridge from the last answer", () => {
  const content = buildNextQuestionMessages({
    seed: "발표 순서 앱",
    turns: [{ role: "user", text: "발표 순서 앱" }, { role: "assistant", text: "학생이 직접 쓰나요?" }, { role: "user", text: "네, 수업 중에 학생들이 직접 씁니다." }],
    answers: { output: "발표 순서 앱", useScene: "수업 중 학생 사용" },
    nextStepKey: "goal"
  }).map((message) => message.content).join("\n");
  assert.match(content, /이번에 물을 항목 \(지정됨\): goal: 목표/);
  assert.match(content, /이 항목만 묻는다/);
  assert.match(content, /직전 답변: 네, 수업 중에 학생들이 직접 씁니다\./);
  assert.match(content, /직전 답변의 핵심을 짧게 받아서/);
  assert.match(content, /대화 흐름 규칙/);
  assert.match(content, /같은 항목을 두 번 연속 묻지 않는다/);
});
