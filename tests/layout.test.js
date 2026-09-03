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

test("chat composer stays visible while the conversation scrolls", () => {
  assert.match(css, /\.chat-panel\s*{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.chat-log\s*{[^}]*flex:\s*1\s+1\s+auto/s);
  assert.match(css, /\.chat-log\s*{[^}]*overflow:\s*auto/s);
  assert.match(css, /\.composer\s*{[^}]*position:\s*sticky/s);
  assert.match(css, /\.composer\s*{[^}]*bottom:\s*0/s);
});

test("enabled composer focuses the textarea after render so teachers can type immediately", () => {
  assert.match(ui, /focusComposerIfReady\(elements, viewModel\)/);
  assert.match(ui, /elements\.messageInput\.focus\(/);
  assert.match(ui, /preventScroll: true/);
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
  assert.match(css, /body\.is-mobile-topbar-compact \.topbar-title,\s*body\.is-mobile-topbar-compact \.topbar \.ai-status-box\s*{[^}]*display:\s*none/s);
  assert.match(css, /body\.is-mobile-topbar-compact \.chat-panel\s*{[^}]*min-height:\s*calc\(100dvh - 68px\)/s);
  assert.match(main, /collapseMobileTopbarAfterInput\(\)/);
  assert.match(main, /currentScrollTop\(\) <= 4/);
});

test("left panel keeps the checklist preview without forcing ten-step completion copy", () => {
  const visibleCopy = `${html}\n${userFacingStrings(ui)}\n${userFacingStrings(main)}`;
  assert.match(visibleCopy, /10단계 질문을 마치면/);
  assert.match(visibleCopy, /예: 학급 규칙 안내문 만들고 싶어요/);
  assert.match(visibleCopy, /예: 우리 반 독서 기록 앱을 만들고 싶어요/);
  assert.match(visibleCopy, /예: 수행평가 루브릭을 만들 프롬프트가 필요해요/);
  assert.match(html, /현재 흐름/);
  assert.match(html, /id="progressBadge"[^>]*>0 \/ 10/);
  assert.match(html, /만들 것 확인/);
  assert.match(html, /결과물 모습 구체화/);
  assert.match(html, /품질 기준 및 수정 방향 확인/);
  assert.match(ui, /allSteps\.forEach/);
  assert.match(ui, /마무리 3개 · 추천안만 고르면 됩니다/);
  assert.match(ui, /is-current/);
  assert.match(ui, /aria-current/);
  assert.doesNotMatch(ui, /보조 질문/);
  assert.doesNotMatch(visibleCopy, /선택지는 보조/);
  assert.match(css, /\.history-item\.is-current/);
  assert.match(css, /\.history-panel\s*{[^}]*position:\s*sticky[^}]*max-height:\s*calc\(100vh - var\(--footer-height\)\)/s);
});

test("AI status controls are grouped in a clear box", () => {
  assert.match(html, /class="ai-status-box"/);
  assert.match(html, /<span class="ai-status-label">AI 상태<\/span>/);
  assert.match(html, /class="ai-status-box"[^>]*aria-label="AI 상태"[\s\S]*<span class="ai-status-label">AI 상태<\/span>[\s\S]*class="ai-status-value"[\s\S]*id="llmStatusBadge"[\s\S]*id="llmModelBadge"[\s\S]*기본 모델[\s\S]*id="localModelButton" class="mode-button"[\s\S]*>학교 AI<\/button>[\s\S]*id="openAiModelButton" class="mode-button is-active"[\s\S]*>OpenAI<\/button>/);
  assert.doesNotMatch(html, />e4b<|>5\.4 nano</);
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

test("plain answers with everyday verbs do not end the flow early", async () => {
  const source = main
    .slice(main.indexOf("function isExplicitFinalRequest"), main.indexOf("function isLocalFinalRequest"));
  const isExplicitFinalRequest = new Function(`${source}; return isExplicitFinalRequest;`)();
  assert.equal(isExplicitFinalRequest("익명으로 할게요. 학생들이 모둠별로 순서를 만들어서 정해요"), false);
  assert.equal(isExplicitFinalRequest("수업 자료를 정리해서 나눠줍니다"), false);
  assert.equal(isExplicitFinalRequest("학생이 글을 작성합니다"), false);
  assert.equal(isExplicitFinalRequest("여기까지만 하고 프롬프트 만들어줘"), true);
  assert.equal(isExplicitFinalRequest("질문 그만하고 최종 프롬프트 정리해 주세요"), true);
  assert.equal(isExplicitFinalRequest("추가 질문 없이 완성해주세요"), true);
});

test("typing a single letter picks the matching option instead of sending free text", () => {
  assert.match(main, /function findOptionByLetter/);
  assert.match(main, /\^\(\[a-dA-D\]\)\[\.\)\]\?\$/);
  assert.match(main, /const letterOption = findOptionByLetter\(text\);/);
  assert.match(ui, /A, B, C 중 하나를 고르거나 직접 요청사항을 입력하세요\./);
  assert.match(ui, /const accepted = handlers\.onSubmit\(text\);/);
  assert.match(ui, /if \(accepted === false\) return;/);
});

test("chat shows a typing indicator and scrolls to the newest message", () => {
  assert.match(ui, /is-typing/);
  assert.match(ui, /typing-dots/);
  assert.match(ui, /function awaitingLabel/);
  assert.match(ui, /최종 프롬프트를 만드는 중입니다/);
  assert.match(ui, /수정 내용을 반영하는 중입니다/);
  assert.match(ui, /function scrollChatToLatest/);
  assert.match(ui, /behavior: reduceMotion \? "auto" : "smooth"/);
  assert.match(css, /\.typing-dots i\s*{/);
  assert.match(css, /@media \(min-width: 821px\)\s*{[\s\S]*\.app-shell\s*{[^}]*height:\s*calc\(100vh - var\(--footer-height\)\)/s);
  assert.match(css, /\.content-grid\s*{[^}]*overflow:\s*hidden/s);
});

test("result panel stays compact until the prompt is ready", () => {
  assert.match(html, /id="progressSummary"/);
  assert.match(html, /지금까지 확인한 내용/);
  assert.match(ui, /function renderProgressSummary/);
  assert.match(ui, /classList\.toggle\("is-pending", !state\.completed\)/);
  assert.match(css, /\.result-panel\.is-pending \.prompt-section/);
  assert.match(html, /id="toggleAiPromptButton"/);
  assert.match(ui, /function applyAiPromptCollapse/);
  assert.match(css, /\.prompt-preview\.is-collapsed\s*{[^}]*max-height/s);
});

test("composer exposes a prominent restart button below the input", () => {
  const topbarEnd = html.indexOf("</header>");
  const restartIndex = html.indexOf('id="restartButton"');
  const composerIndex = html.indexOf('id="chatForm"');

  assert.match(html, /<form id="chatForm" class="composer">[\s\S]*id="restartButton"[\s\S]*>[\s\S]*처음부터 다시 시작하기[\s\S]*<\/button>[\s\S]*<\/form>/);
  assert.ok(restartIndex > topbarEnd);
  assert.ok(restartIndex > composerIndex);
  assert.match(ui, /restartButton: document\.getElementById\("restartButton"\)/);
  assert.match(ui, /elements\.restartButton\?\.addEventListener\("click", \(\) =>/);
  assert.match(ui, /window\.confirm\("현재 대화를 지우고 처음부터 다시 시작할까요\?"\)/);
  assert.match(ui, /handlers\.onClearDraft\(\)/);
  assert.match(main, /requestGeneration \+= 1/);
  assert.match(css, /\.restart-button\s*{[^}]*grid-column:\s*1 \/ -1/s);
  assert.match(css, /\.restart-button\s*{[^}]*justify-self:\s*stretch/s);
  assert.match(html, /id="restartButton"[^>]*hidden/);
  assert.match(ui, /elements\.restartButton\.hidden = !started/);
  assert.match(css, /\.finish-button\s*{/);
  assert.match(css, /\.restart-button:hover,\s*\.restart-button:focus-visible\s*{[^}]*transform:\s*translateY\(-2px\)/s);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
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
  assert.match(main, /chatCompletionWithRetry\(\{[\s\S]*endpoint:\s*settings\.llmEndpoint[\s\S]*model:\s*settings\.llmModelId[\s\S]*buildRevisionMessages/s);
  assert.match(main, /AI 수정 답변을 받지 못해 기본 방식/);
});

test("local model uses segmented final prompt generation without changing OpenAI flow", () => {
  assert.match(main, /shouldUseSegmentedFinalPrompt\(\)/);
  assert.match(main, /settings\.llmProvider === "local"/);
  assert.match(main, /finalPromptMode:\s*shouldUseSegmentedFinalPrompt\(\) \? "segmented" : "single"/);
  assert.match(main, /completeWithSegmentedFinalPrompt\(/);
  assert.match(main, /buildSegmentedFinalPromptMessages/);
  assert.match(main, /shouldCompleteLocalFlow\(text\)/);
  assert.match(main, /function isLocalFinalRequest\(text = ""\)/);
  assert.match(main, /isExplicitFinalRequest\(text/);
  assert.doesNotMatch(main, /return \/최종\|완성\|만들어\|정리\|생성\|작성\/\.test/);
  assert.match(main, /여기까지만\|여기까지\|이 정도로\|지금까지\|현재까지/);
  assert.match(main, /\(질문\|물어\)/);
  assert.match(main, /async function handleFinishEarly/);
  assert.match(main, /onFinishEarly: handleFinishEarly/);
  assert.match(html, /id="finishEarlyButton"/);
  assert.match(main, /fallbackQuestionForCurrentState/);
  assert.match(main, /MIN_REQUIRED_QUESTIONS\s*=\s*steps\.length/);
  assert.match(main, /MAX_TOTAL_QUESTIONS\s*=\s*15/);
  assert.match(main, /hasEnoughLocalStepsForFinal/);
  assert.match(main, /answeredAfterSeed >= MIN_REQUIRED_QUESTIONS/);
  assert.match(main, /MAX_FOLLOWUPS_AFTER_COVERAGE = 2/);
  assert.match(main, /const nextStepKey = chooseNextStepKey\(state\);/);
  assert.match(main, /function keepQuestionOnTrack/);
  assert.match(main, /appendQuestionToCurrentFlow\(setAwaitingAi\(state, false\), keepQuestionOnTrack\(value, nextStepKey\)\)/);
  assert.match(main, /function hasFullCoverage/);
  assert.match(main, /return hasFullCoverage\(currentState\) \|\| answeredQuestionCount\(currentState\) >= MIN_REQUIRED_QUESTIONS \+ wrapUpSteps\.length;/);
  assert.match(main, /function hasCoreCoverage/);
  assert.match(main, /hasFullCoverage\(currentState\) && followUpQuestionCount\(currentState\) >= MAX_FOLLOWUPS_AFTER_COVERAGE/);
  assert.match(main, /const followUpQuestions = hasFullCoverage\(nextState\) \? followUpQuestionCount\(nextState\) \+ 1 : 0;/);
  assert.match(main, /if \(hasReachedQuestionLimit\(\)\)/);
  assert.match(main, /handleOption[\s\S]*shouldCompleteLocalFlow\(option\.label\)/);
  assert.match(main, /async function completeWithSegmentedFinalPrompt/);
  assert.match(main, /if \(!allowIncomplete && !hasEnoughLocalStepsForFinal\(\)\)/);
  assert.match(main, /setTimeout\(\(\) => controller\.abort\(\), 36000\)/);
  assert.match(main, /settings\.llmProvider === "local" && task === "question"\) return 768/);
  assert.match(main, /state\.completed && state\.finalPrompt/);
  assert.match(main, /answeredQuestionCount\(\) >= MAX_TOTAL_QUESTIONS/);
  assert.match(main, /completeWithAvailableFinalPrompt\(\{ allowIncomplete: true \}\)/);
  assert.match(main, /if \(!allowIncomplete && !hasEnoughLocalStepsForFinal\(\)\)/);
});
