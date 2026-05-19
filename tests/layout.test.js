import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../webapp/styles.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../webapp/index.html", import.meta.url), "utf8");
const ui = readFileSync(new URL("../webapp/modules/ui.js", import.meta.url), "utf8");
const main = readFileSync(new URL("../webapp/main.js", import.meta.url), "utf8");
const localLlmClient = readFileSync(new URL("../webapp/modules/localLlmClient.js", import.meta.url), "utf8");

function userFacingStrings(source) {
  return source.match(/"[^"]*"|'[^']*'|`[^`]*`/g)?.join("\n") ?? "";
}

test("chat composer participates in normal conversation flow instead of being pushed to bottom", () => {
  assert.match(css, /\.chat-panel\s*{[^}]*overflow:\s*auto/s);
  assert.match(css, /\.chat-log\s*{[^}]*flex:\s*0\s+0\s+auto/s);
  assert.match(css, /\.chat-log\s*{[^}]*overflow:\s*visible/s);
  assert.match(css, /\.composer\s*{[^}]*position:\s*relative/s);
});

test("enabled composer focuses the textarea after render so teachers can type immediately", () => {
  assert.match(ui, /focusComposerIfReady\(elements, viewModel\)/);
  assert.match(ui, /elements\.messageInput\.focus\(\)/);
});

test("composer submits with Enter and keeps Shift Enter for multiline input", () => {
  assert.match(ui, /elements\.messageInput\.addEventListener\("keydown"/);
  assert.match(ui, /event\.key !== "Enter"/);
  assert.match(ui, /event\.shiftKey/);
  assert.match(ui, /requestSubmit\(\)/);
});

test("interface avoids technical copy for non-technical teachers", () => {
  const visibleCopy = `${html}\n${userFacingStrings(ui)}\n${userFacingStrings(main)}\n${userFacingStrings(localLlmClient)}`;
  assert.doesNotMatch(visibleCopy, /tokens/i);
  assert.doesNotMatch(visibleCopy, /NEW DRAFT|MEMORY ON|MEMORY OFF|CLEAR MEMORY|RETRY|SEND|COPY/);
  assert.doesNotMatch(visibleCopy, /엔드포인트|모델을 사용합니다|OpenAI-compatible|LM Studio|LLM|토큰/);
  assert.doesNotMatch(visibleCopy, /로컬 메모리/);
  assert.match(visibleCopy, /이전에 만든 프롬프트를 참고하여 작업할 수 있습니다/);
  assert.match(visibleCopy, /저장한 작업/);
  assert.match(visibleCopy, /새로 시작/);
  assert.doesNotMatch(visibleCopy, /다시 확인을 눌러/);
});

test("mobile layout keeps chat primary and opens side panels on demand", () => {
  assert.match(html, /id="historyPanelToggle"/);
  assert.match(html, /id="resultPanelToggle"/);
  assert.match(html, /for="historyPanelToggle"[^>]*>작업 목록/);
  assert.match(html, /for="resultPanelToggle"[^>]*>완성본/);
  assert.match(css, /@media \(max-width: 820px\)/);
  assert.match(css, /#historyPanelToggle:checked\s*~\s*\.app-shell\s*\.history-panel/s);
  assert.match(css, /#resultPanelToggle:checked\s*~\s*\.app-shell\s*\.result-panel/s);
  assert.match(css, /\.chat-panel\s*{[^}]*min-height:\s*calc\(100dvh - 92px\)/s);
});

test("left panel restores the original ten-step flow preview", () => {
  const visibleCopy = `${html}\n${userFacingStrings(ui)}\n${userFacingStrings(main)}`;
  assert.match(visibleCopy, /10단계/);
  assert.match(visibleCopy, /예: 학급 규칙 안내문 만들고 싶어요/);
  assert.match(visibleCopy, /예: 우리 반 독서 기록 앱을 만들고 싶어요/);
  assert.match(visibleCopy, /예: 수행평가 루브릭을 만들 프롬프트가 필요해요/);
  assert.match(html, /현재 흐름/);
  assert.match(html, /id="progressBadge"[^>]*>0 \/ 10/);
  assert.match(html, /만들 것 확인/);
  assert.match(html, /결과물 모습 구체화/);
  assert.match(html, /품질 기준 및 수정 방향 확인/);
  assert.match(ui, /steps\.forEach/);
  assert.match(ui, /is-current/);
  assert.match(ui, /aria-current/);
  assert.doesNotMatch(ui, /보조 질문/);
  assert.doesNotMatch(ui, /아직 확인 전|대화에서 확인됨/);
  assert.match(css, /\.history-item\.is-current/);
});

test("AI status controls are grouped in a clear box", () => {
  assert.match(html, /class="ai-status-box"/);
  assert.match(html, /<span class="ai-status-label">AI 상태<\/span>/);
  assert.match(html, /class="ai-status-box"[^>]*aria-label="AI 상태"[\s\S]*<span class="ai-status-label">AI 상태<\/span>[\s\S]*class="ai-status-value"[\s\S]*id="llmStatusBadge"[\s\S]*id="llmModelBadge"[\s\S]*기본 모델[\s\S]*id="localModelButton"[\s\S]*>e2b<\/button>[\s\S]*id="openAiModelButton"[\s\S]*>5\.4 nano<\/button>/);
  assert.doesNotMatch(html, /id="modelStatusBadge"|id="retryLlmButton"|AI 확인|답변 가능|답변 준비 중/);
  assert.match(css, /\.title-row,\s*\.guide-mode-box,\s*\.ai-status-box,\s*\.guide-mode-options,\s*\.ai-status-value\s*{[^}]*display:\s*flex/s);
  assert.match(css, /\.status-cluster\s*{[^}]*align-items:\s*center/s);
  assert.match(css, /\.ai-status-box,\s*\.guide-mode-box\s*{[^}]*border:\s*1px solid var\(--theme-border\)/s);
  assert.match(css, /\.ai-status-label,\s*\.guide-mode-label\s*{[^}]*align-items:\s*center[^}]*background:\s*color-mix/s);
  assert.match(css, /\.model-pill\s*{[^}]*text-overflow:\s*ellipsis/s);
});

test("guide mode controls let teachers choose friendly or thorough questioning", () => {
  assert.match(html, /class="title-row"[\s\S]*질문형 프롬프트 가이드[\s\S]*class="guide-mode-box"/);
  assert.match(html, /class="guide-mode-box"[^>]*aria-label="질문 방식 선택"/);
  assert.match(html, /질문 방식/);
  assert.match(html, /class="guide-mode-box"[^>]*aria-label="질문 방식 선택"[\s\S]*<span class="guide-mode-label">질문 방식<\/span>[\s\S]*class="guide-mode-options"[\s\S]*id="friendlyModeButton"[\s\S]*>친절<\/button>[\s\S]*id="thoroughModeButton"[\s\S]*>꼼꼼<\/button>/);
  assert.match(css, /\.title-row\s*{[^}]*align-items:\s*center/s);
  assert.match(css, /\.guide-mode-options,\s*\.ai-status-value\s*{[^}]*gap:\s*var\(--spacing-4\)/s);
  assert.match(ui, /renderGuideMode\(elements, viewModel\)/);
  assert.match(ui, /renderDefaultModel\(elements, viewModel\)/);
  assert.match(ui, /onSetGuideMode\("friendly"\)/);
  assert.match(ui, /onSetGuideMode\("thorough"\)/);
  assert.match(ui, /onSetDefaultModel\?\.\("local"\)/);
  assert.match(ui, /onSetDefaultModel\?\.\("openai"\)/);
  assert.match(css, /\.ai-status-box,\s*\.guide-mode-box\s*{/);
  assert.match(css, /\.mode-button\.is-active\s*{/);
});

test("composer exposes a mobile-friendly restart button below the input", () => {
  const topbarEnd = html.indexOf("</header>");
  const restartIndex = html.indexOf('id="restartButton"');
  const composerIndex = html.indexOf('id="chatForm"');

  assert.match(html, /<form id="chatForm" class="composer">[\s\S]*id="restartButton"[\s\S]*>처음부터 다시 시작<\/button>[\s\S]*<\/form>/);
  assert.ok(restartIndex > topbarEnd);
  assert.ok(restartIndex > composerIndex);
  assert.match(ui, /restartButton: document\.getElementById\("restartButton"\)/);
  assert.match(ui, /elements\.restartButton\?\.addEventListener\("click", handlers\.onClearDraft\)/);
  assert.match(main, /requestGeneration \+= 1/);
  assert.match(css, /\.restart-button\s*{[^}]*grid-column:\s*1 \/ -1/s);
});

test("final prompt view does not execute prompts or copy reference notes", () => {
  const visibleCopy = `${html}\n${ui}\n${main}`;
  assert.doesNotMatch(html, /copyReferenceButton|executionPreview|execution-section|AI가 만든 결과|실행 결과/);
  assert.doesNotMatch(ui, /copyReferenceButton|executionPreview|executionResult|executionMeta/);
  assert.doesNotMatch(main, /executeFinalPrompt|buildPromptExecutionMessages|recordExecutionResult|onCopyReference/);
  assert.match(visibleCopy, /참고 안내/);
  assert.match(visibleCopy, /함께 확인할 내용/);
  assert.match(visibleCopy, /copyPromptButton/);
  assert.match(html, /teacherSummaryPreview/);
  assert.match(html, /aiPromptPreview/);
  assert.match(html, /copyTeacherSummaryButton/);
  assert.match(html, /copyAiPromptButton/);
  assert.match(ui, /sanitizeVisibleMessage/);
});

test("saved prompt revisions use the selected AI model", () => {
  assert.match(main, /async function handleRevision/);
  assert.match(main, /chatCompletion\(\{[\s\S]*endpoint:\s*settings\.llmEndpoint[\s\S]*model:\s*settings\.llmModelId[\s\S]*buildRevisionMessages/s);
  assert.match(main, /AI 수정 답변을 받지 못해 기본 방식/);
});
