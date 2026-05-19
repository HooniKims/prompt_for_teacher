import test from "node:test";
import assert from "node:assert/strict";
import {
  appendAiQuestion,
  createInitialState,
  markLlmStatus,
  recordConversationAnswer,
  startRequest
} from "../webapp/modules/state.js";

test("initial state includes adaptive LLM conversation fields", () => {
  const state = createInitialState();

  assert.equal(state.llmStatus, "unknown");
  assert.deepEqual(state.conversationTurns, []);
  assert.equal(state.isAwaitingAi, false);
});

test("markLlmStatus records blocked local LLM guidance without starting old wizard", () => {
  const state = markLlmStatus(createInitialState(), {
    status: "blocked",
    message: "LM Studio를 켜주세요."
  });

  assert.equal(state.llmStatus, "blocked");
  assert.match(state.llmError, /LM Studio/);
  assert.equal(state.activeStepIndex, -1);
});

test("startRequest stores a short seed without requiring fixed-step completion", () => {
  const state = startRequest(markLlmStatus(createInitialState(), { status: "ready" }), "앱 만들고 싶어");

  assert.equal(state.initialRequest, "앱 만들고 싶어");
  assert.equal(state.activeStepIndex, 0);
  assert.equal(state.completed, false);
});

test("appendAiQuestion and recordConversationAnswer keep direct answers first-class", () => {
  const asked = appendAiQuestion(startRequest(createInitialState(), "자료 만들기"), {
    question: "어떤 자료인가요?",
    suggestedOptions: [{ id: "A", label: "활동지", optional: true }]
  });
  const answered = recordConversationAnswer(asked, "우리 반 수준에 맞춘 활동지", null);

  assert.equal(asked.messages.at(-1).text, "어떤 자료인가요?");
  assert.equal(answered.conversationTurns.at(-1).text, "우리 반 수준에 맞춘 활동지");
  assert.equal(answered.conversationTurns.at(-1).source, "direct");
});
