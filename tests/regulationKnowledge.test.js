import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFooterPolicyPrompt,
  buildNaturalRegulationQuestionGuidance,
  buildRegulationPromptRequirements,
  regulationKnowledge
} from "../webapp/modules/regulationKnowledge.js";

test("regulation knowledge keeps extracted PDF and law sources usable by prompts", () => {
  assert.equal(regulationKnowledge.documents.length, 3);
  assert.ok(regulationKnowledge.documents.some((document) => document.sourceType === "pdf" && document.pages.length >= 10));
  assert.ok(regulationKnowledge.documents.some((document) => /개인정보 처리방침 작성지침/.test(document.title) && document.pages.length >= 150));
  assert.ok(regulationKnowledge.documents.some((document) => document.sourceUrl === "https://www.law.go.kr/LSW/admRulLsInfoP.do?admRulSeq=2100000216090"));
  assert.ok(regulationKnowledge.extractedQuestions.length > 0);
  assert.ok(regulationKnowledge.usageRules.some((rule) => /학생이 직접/.test(rule.teacherQuestion)));
});

test("regulation guidance asks naturally while preserving review and privacy duties", () => {
  const guidance = buildNaturalRegulationQuestionGuidance();

  assert.match(guidance, /단도직입적으로 심의 대상인지 묻지 말고/);
  assert.match(guidance, /학생이 직접 사용하는 장면/);
  assert.match(guidance, /로그인|답안|활동 기록/);
  assert.match(guidance, /처리 목적|보유 기간|파기/);
});

test("regulation prompt requirements include footer privacy policy and terms", () => {
  const requirements = buildRegulationPromptRequirements();
  const footer = buildFooterPolicyPrompt();

  assert.match(requirements, /표준 개인정보 처리방침/);
  assert.match(requirements, /서비스 이용약관/);
  assert.match(requirements, /푸터/);
  assert.match(footer, /개인정보 처리방침/);
  assert.match(footer, /이용약관/);
  assert.match(footer, /디지털콘텐츠 중개 표준약관/);
});
