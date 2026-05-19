import { LOCAL_MODEL_ID, modelProfile } from "./modules/modelProfile.js";
import { steps } from "./modules/steps.js";
import {
  appendAssistantMessage,
  appendAiQuestion,
  applyRevisionState,
  completeState,
  createInitialState,
  markLlmStatus,
  recordConversationAnswer,
  restoreDraft,
  setAwaitingAi,
  startRequest
} from "./modules/state.js";
import { buildFinalPrompt, ensureFinalPromptRequirements, splitFinalPromptSections } from "./modules/promptBuilder.js";
import { buildReferenceNotes } from "./modules/referenceNotes.js";
import { buildRevisionMessages, revisePrompt, summarizeRevision } from "./modules/revision.js";
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
} from "./modules/storage.js?v=shared-llm-endpoint";
import { createMemoryItemsFromSession, mergeMemoryItems, selectMemoryItems } from "./modules/memory.js";
import { createUi } from "./modules/ui.js?v=summary-fallback-2";
import {
  DEFAULT_LLM_ENDPOINT,
  DEFAULT_OPENAI_MODEL_ID,
  OPENAI_LLM_ENDPOINT,
  chatCompletion,
  createLocalLlmSettings,
  listModels
} from "./modules/localLlmClient.js?v=shared-llm-endpoint";
import { buildNextQuestionMessages, parsePlannerResponse, quickOptionsForIntent } from "./modules/conversationPlanner.js";

const WELCOME_MESSAGE = "짧게 시작해도 괜찮습니다. 만들고 싶은 자료, 앱, 프로그램, 문서를 한 문장으로 적어주세요.\n\n예: 학급 규칙 안내문 만들고 싶어요.\n예: 우리 반 독서 기록 앱을 만들고 싶어요.\n예: 수행평가 루브릭을 만들 프롬프트가 필요해요.";

let settings = readSettings();
let memoryStore = readMemoryStore();
let sessions = readSessions();
let state = restoreDraft(readActiveDraft()) ?? createInitialState();
let requestGeneration = 0;
let demoTimer = 0;
let mobileTopbarExpanded = true;

const ui = createUi();

function init() {
  const migration = migrateLegacySessions();
  if (!migration.ok) ui.showToast("이전 저장 데이터를 새 형식으로 옮기지 못했습니다.");

  sessions = readSessions();
  const demoStateFromUrl = createDemoStateFromUrl();
  state = demoStateFromUrl ?? state;
  if (!state.messages.length) {
    state = appendAssistantMessage(state, welcomeMessage());
  }

  ui.bindHandlers({
    onSubmit: handleSubmit,
    onCopyPrompt: () => copyText(state.finalPrompt, "아직 복사할 최종 프롬프트가 없습니다.", "promptPreview"),
    onCopyTeacherSummary: () => copyText(splitFinalPromptSections(state.finalPrompt).teacherSummary, "아직 복사할 교사용 요약이 없습니다.", "teacherSummaryPreview"),
    onCopyAiPrompt: () => copyText(splitFinalPromptSections(state.finalPrompt).aiPrompt, "아직 복사할 AI 실행용 프롬프트가 없습니다.", "aiPromptPreview"),
    onClearSessions: handleClearSessions,
    onToggleMemory: handleToggleMemory,
    onClearMemory: handleClearMemory,
    onClearDraft: handleClearDraft,
    onToggleTheme: handleToggleTheme,
    onSetGuideMode: handleSetGuideMode,
    onSetDefaultModel: handleSetDefaultModel
  });

  applyTheme();
  bindMobileTopbarBehavior();
  render();
  if (!demoStateFromUrl) checkLocalLlm();
  maybeRunPrivacyDemo();
}

function bindMobileTopbarBehavior() {
  window.addEventListener("scroll", updateMobileTopbarFromScroll, { passive: true });
  ui.elements.chatPanel?.addEventListener("scroll", updateMobileTopbarFromScroll, { passive: true });
}

function currentScrollTop() {
  return Math.max(window.scrollY || 0, ui.elements.chatPanel?.scrollTop || 0);
}

function updateMobileTopbarFromScroll() {
  if (!state.initialRequest) {
    mobileTopbarExpanded = true;
  } else {
    mobileTopbarExpanded = currentScrollTop() <= 4;
  }
  applyMobileTopbarState();
}

function collapseMobileTopbarAfterInput() {
  if (!state.initialRequest) return;
  mobileTopbarExpanded = false;
  applyMobileTopbarState();
}

function resetMobileTopbar() {
  mobileTopbarExpanded = true;
  applyMobileTopbarState();
}

function createDemoStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("testScenario") === "e2bClassRules") return createE2bClassRulesDemoState();
  if (params.get("testScenario") !== "privacy") return null;

  const demoState = {
    ...createInitialState(),
    initialRequest: "학생 이름, 학번, 수행평가 점수, 오답 기록, 학습 활동 기록을 수집하는 교사용 웹앱을 만들고 싶습니다.",
    activeStepIndex: steps.length,
    llmStatus: "ready",
    availableModels: [settings.llmModelId],
    messages: [
      { role: "assistant", text: welcomeMessage() },
      { role: "user", text: "학생 이름, 학번, 수행평가 점수, 오답 기록, 학습 활동 기록을 수집하는 교사용 웹앱을 만들고 싶습니다. 교사는 교수학습평가와 개별 피드백에 사용하고, 학생은 로그인해서 자신의 피드백을 확인합니다." },
      { role: "assistant", text: "최종 프롬프트를 정리했습니다. 오른쪽 완성본에서 확인해주세요." }
    ],
    conversationTurns: [
      { role: "user", text: "학생 이름, 학번, 수행평가 점수, 오답 기록, 학습 활동 기록을 수집하는 교사용 웹앱을 만들고 싶습니다. 교사는 교수학습평가와 개별 피드백에 사용하고, 학생은 로그인해서 자신의 피드백을 확인합니다." },
      { role: "user", text: "학생에게는 점수, 교사 피드백, 오답 유형 요약만 보여주고 상세 오답 기록과 전체 학습 활동 로그는 교사용으로만 둡니다." },
      { role: "user", text: "학교 내부 검토 전에는 실제 학생 정보를 넣지 않고 수집 항목, 이용 목적, 보관 기간, 접근 권한, 삭제 방법, 동의 필요 여부를 정리해야 합니다." },
      { role: "user", text: "개인정보보호와 학습지원 소프트웨어 심의는 참고 안내로 분리하고, 프롬프트에는 이를 지키기 위한 구현 계획을 기능별 모듈로 정리해주세요." }
    ],
    answerMeta: {
      safety: { id: "직접", label: "학생 이름, 학번, 점수, 오답 기록, 학습 활동 기록 포함", risk: "privacy" },
      externalService: { id: "직접", label: "학생 로그인 및 교수학습평가에 사용", risk: "learningSoftware" }
    }
  };
  const fallbackPrompt = buildFinalPrompt(demoState, { memoryItems: [] });
  const finalPrompt = ensureFinalPromptRequirements(`[교사용 요약]
- 만들 것: 학생 개인정보와 평가 기록을 다루는 교사용 웹앱
- 사용 목적: 교수학습평가, 오답 분석, 학생별 개별 피드백 제공
- 학생에게 보이는 정보: 점수, 교사 피드백, 오답 유형 요약
- 교사용으로만 남길 정보: 상세 오답 기록, 전체 학습 활동 로그, 관리용 감사 기록
- 교사가 준비할 일: 수집 항목, 이용 목적, 보관 기간, 접근 권한, 삭제 방법, 동의 또는 고지 필요 여부, 학교 내부 검토 절차 확인

[AI 실행용 프롬프트]
너는 학교 현장에서 사용할 교사용 웹앱을 설계하는 기획자이자 개발 설계자다. 아래 조건을 바탕으로 교사가 이해하기 쉽고 개발 AI도 바로 실행할 수 있는 요구사항 정의서와 구현 지시서를 한국어로 작성하라.

[언어]
- 모든 결과는 한국어로 작성한다.
- 교사가 바로 읽고 수정할 수 있는 쉬운 표현을 사용한다.

[기능별 모듈]
다음 모듈을 분리해서 설계하라.
- 화면/UI: 교사 대시보드, 학생 목록, 학생 상세, 점수 입력, 오답 기록, 피드백 작성, 학생용 피드백 화면
- 인증과 권한: 교사, 학생, 관리자 역할을 나누고 학생은 자기 정보만 볼 수 있게 한다.
- 데이터 모델: 학생, 학급, 평가, 오답 유형, 학습 활동 기록, 피드백, 접근 로그를 분리한다.
- 평가 기록: 수행평가 점수와 오답 유형을 입력하고 수정 이력을 남긴다.
- 피드백: 교사가 학생별 피드백을 작성하고 학생에게 공개할 범위를 선택한다.
- 개인정보보호 구현: 내부 ID, 가명, 마스킹, 역할별 접근 권한, 삭제, 내보내기, 접근 로그 기능을 설계한다.
- 심의 대응 구현: 수집 항목, 이용 목적, 보관 기간, 보안 조치, 접근 로그, 데이터 보관 위치를 교사가 확인하거나 문서로 내보낼 수 있게 한다.
- 테스트: 권한별 화면 접근, 데이터 삭제, 내보내기, 감사 로그, 모바일 화면을 확인한다.

[결과물]
1. 교사용 요구사항 요약
2. 기능별 모듈 설계
3. 데이터 모델 초안
4. 화면 흐름
5. 개인정보보호 구현 체크리스트
6. 심의 대응 자료 생성 계획
7. 개발 AI에게 넘길 구현 순서`, fallbackPrompt);
  return completeState(demoState, {
    finalPrompt,
    referenceNotes: buildReferenceNotes(demoState.answerMeta, demoState)
  });
}

function createE2bClassRulesDemoState() {
  settings = { ...settings, llmProvider: "local", llmEndpoint: DEFAULT_LLM_ENDPOINT, llmModelId: LOCAL_MODEL_ID };
  const demoState = {
    ...createInitialState(),
    initialRequest: "초등학생용 학급 규칙 안내문을 만들고 싶어요.",
    activeStepIndex: steps.length,
    llmStatus: "ready",
    availableModels: [LOCAL_MODEL_ID],
    messages: [
      { role: "assistant", text: welcomeMessage() },
      { role: "user", text: "초등학생용 학급 규칙 안내문을 만들고 싶어요." },
      { role: "assistant", text: "어느 장면에서 사용할 안내문인지 알려주세요." },
      { role: "user", text: "새 학기 첫날 5학년 학생들에게 나눠줄 A4 한 장 안내문입니다." },
      { role: "assistant", text: "규칙에 꼭 넣고 싶은 내용을 알려주세요." },
      { role: "user", text: "서로 존중하기, 수업 시간 지키기, 친구 말 끊지 않기, 준비물 챙기기, 교실 깨끗하게 쓰기 규칙을 넣고 싶습니다." },
      { role: "assistant", text: "최종 프롬프트를 정리했습니다. 오른쪽 완성본에서 확인해주세요." }
    ],
    conversationTurns: [
      { role: "user", text: "초등학생용 학급 규칙 안내문을 만들고 싶어요." },
      { role: "user", text: "새 학기 첫날 5학년 학생들에게 나눠줄 A4 한 장 안내문입니다." },
      { role: "user", text: "서로 존중하기, 수업 시간 지키기, 친구 말 끊지 않기, 준비물 챙기기, 교실 깨끗하게 쓰기 규칙을 넣고 싶습니다." },
      { role: "user", text: "말투는 따뜻하고 쉬운 표현이면 좋겠습니다. 개인정보는 들어가지 않습니다." }
    ],
    answerMeta: {
      safety: { id: "A", label: "개인정보는 들어가지 않음", risk: "" },
      externalService: { id: "A", label: "외부 서비스 사용 없음", risk: "" }
    }
  };
  const fallbackPrompt = buildFinalPrompt(demoState, { memoryItems: [] });
  const finalPrompt = ensureFinalPromptRequirements(`[교사용 요약]
- 만들 것: 초등학생용 학급 규칙 안내문
- 사용 장면: 새 학기 첫날 5학년 학생들에게 나눠줄 A4 한 장 안내문
- 핵심 규칙: 서로 존중하기, 수업 시간 지키기, 친구 말 끊지 않기, 준비물 챙기기, 교실 깨끗하게 쓰기
- 말투: 따뜻하고 쉬운 표현
- 개인정보 확인: 개인정보는 들어가지 않음

[AI 실행용 프롬프트]
너는 초등학생 눈높이에 맞춰 긍정적인 학급 규칙 안내문을 작성하는 교육 콘텐츠 작가다.

[목표]
새 학기 첫날 5학년 학생들이 읽고 바로 이해할 수 있는 A4 한 장 분량의 학급 규칙 안내문을 작성한다.

[포함할 내용]
1. 학생이 친근하게 느낄 수 있는 제목
2. 왜 학급 규칙이 필요한지 설명하는 짧은 안내 문장
3. 다음 규칙 5개
   - 서로 존중하기
   - 수업 시간 지키기
   - 친구 말 끊지 않기
   - 준비물 챙기기
   - 교실 깨끗하게 쓰기
4. 각 규칙마다 학생이 실제로 어떻게 행동하면 되는지 쉬운 예시 1개
5. 마지막 다짐 문장

[작성 조건]
- 모든 내용은 한국어로 작성한다.
- 초등학생이 이해할 수 있는 짧고 따뜻한 문장을 사용한다.
- 혼내는 말투보다 함께 약속하는 말투를 사용한다.
- 개인정보, 학생 이름, 학번, 실제 반 정보는 넣지 않는다.
- 교사가 바로 복사해 수정할 수 있도록 제목, 설명, 규칙, 다짐 순서로 정리한다.

[결과물]
- A4 한 장에 들어갈 수 있는 학급 규칙 안내문 초안
- 교사가 바꿔 넣을 수 있는 자리표시자: [학년], [반], [선생님 이름]`, fallbackPrompt);

  return completeState(demoState, {
    finalPrompt,
    referenceNotes: "개인정보보호 고려할 점\n- 이 샘플 안내문에는 실제 학생 이름, 학번, 연락처, 평가 기록을 넣지 않습니다.\n- 배포 전 학년, 반, 교사 이름처럼 필요한 정보만 교사가 직접 확인해 넣습니다.\n\n학습지원 소프트웨어 심의 관련 고려할 점\n- 단순 안내문 생성 샘플이므로 학생 로그인, 평가 기록, 학습 활동 기록을 다루지 않습니다.\n- 이후 앱 기능으로 확장할 경우 개인정보 수집 여부와 학교 내부 검토 필요성을 다시 확인합니다."
  });
}

function maybeRunPrivacyDemo() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("runDemo") !== "privacy") return;

  window.clearTimeout(demoTimer);
  requestGeneration += 1;
  state = appendAssistantMessage(createInitialState(), welcomeMessage());
  settings = { ...settings, guideMode: "thorough" };
  writeSettings(settings);
  render();

  const demoSteps = [
    {
      delay: 700,
      run: () => {
        state = startRequest(state, "학생 이름, 학번, 수행평가 점수, 오답 기록, 학습 활동 기록을 수집하는 교사용 웹앱을 만들고 싶습니다. 교사는 교수학습평가와 개별 피드백에 사용하고, 학생은 로그인해서 자신의 피드백을 확인합니다.");
      }
    },
    {
      delay: 1400,
      run: () => {
        state = appendAiQuestion(state, {
          question: "학생에게 어떤 정보까지 보여줄지 먼저 확인할게요. 점수, 교사 피드백, 오답 유형 요약은 보여주고, 상세 오답 기록과 전체 학습 활동 로그는 교사용으로만 둘까요?",
          suggestedOptions: [
            { id: "A", label: "네, 학생에게는 요약만 보여줍니다.", optional: true },
            { id: "B", label: "점수는 숨기고 피드백만 보여줍니다.", optional: true }
          ]
        });
      }
    },
    {
      delay: 2200,
      run: () => {
        state = recordConversationAnswer(state, "네. 학생에게는 점수, 교사 피드백, 오답 유형 요약만 보여주고 상세 오답 기록과 전체 학습 활동 로그는 교사용으로만 둡니다.", null);
      }
    },
    {
      delay: 3000,
      run: () => {
        state = appendAiQuestion(state, {
          question: "개인정보보호를 위해 수집 항목, 이용 목적, 보관 기간, 접근 권한, 삭제 방법, 동의 또는 고지 필요 여부를 함께 정리할까요?",
          suggestedOptions: [
            { id: "A", label: "네, 학교 내부 검토 전제로 정리합니다.", optional: true },
            { id: "B", label: "간단한 안내만 넣습니다.", optional: true }
          ]
        });
      }
    },
    {
      delay: 3800,
      run: () => {
        state = recordConversationAnswer(state, "학교 내부 검토 전에는 실제 학생 정보를 넣지 않고, 수집 항목, 이용 목적, 보관 기간, 접근 권한, 삭제 방법, 동의 또는 고지 필요 여부를 정리해야 합니다.", null);
      }
    },
    {
      delay: 4600,
      run: () => {
        state = appendAiQuestion(state, {
          question: "학습지원 소프트웨어 심의 관련 내용은 참고 안내로 분리하고, 앱에는 보안 조치, 접근 로그, 데이터 보관 위치를 확인하거나 내보내는 기능을 넣으면 될까요?",
          suggestedOptions: [
            { id: "A", label: "네, 구현 계획으로 포함합니다.", optional: true },
            { id: "B", label: "개인정보 안내만 포함합니다.", optional: true }
          ]
        });
      }
    },
    {
      delay: 5400,
      run: () => {
        state = recordConversationAnswer(state, "네. 심의 관련 설명은 참고 안내로 분리하고, 앱에는 보안 조치, 접근 로그, 데이터 보관 위치를 확인하거나 내보내는 기능을 포함합니다.", null);
      }
    },
    {
      delay: 6400,
      run: () => {
        const demoState = createDemoStateFromUrlForPrivacy();
        state = demoState;
      }
    }
  ];

  demoSteps.forEach(({ delay, run }) => {
    demoTimer = window.setTimeout(() => {
      run();
      render();
    }, delay);
  });
}

function createDemoStateFromUrlForPrivacy() {
  const demoState = {
    ...createInitialState(),
    initialRequest: "학생 이름, 학번, 수행평가 점수, 오답 기록, 학습 활동 기록을 수집하는 교사용 웹앱을 만들고 싶습니다.",
    activeStepIndex: steps.length,
    llmStatus: "ready",
    availableModels: [settings.llmModelId],
    messages: [
      { role: "assistant", text: welcomeMessage() },
      { role: "user", text: "학생 이름, 학번, 수행평가 점수, 오답 기록, 학습 활동 기록을 수집하는 교사용 웹앱을 만들고 싶습니다. 교사는 교수학습평가와 개별 피드백에 사용하고, 학생은 로그인해서 자신의 피드백을 확인합니다." },
      { role: "assistant", text: "학생에게 어떤 정보까지 보여줄지 먼저 확인할게요. 점수, 교사 피드백, 오답 유형 요약은 보여주고, 상세 오답 기록과 전체 학습 활동 로그는 교사용으로만 둘까요?" },
      { role: "user", text: "학생에게는 점수, 교사 피드백, 오답 유형 요약만 보여주고 상세 오답 기록과 전체 학습 활동 로그는 교사용으로만 둡니다." },
      { role: "assistant", text: "개인정보보호와 학습지원 소프트웨어 심의 관련 내용은 참고 안내로 분리하고, AI 실행용 프롬프트에는 이를 지키기 위한 구현 계획만 담아 정리했습니다. 오른쪽 완성본에서 확인해주세요." }
    ],
    conversationTurns: [
      { role: "user", text: "학생 이름, 학번, 수행평가 점수, 오답 기록, 학습 활동 기록을 수집하는 교사용 웹앱을 만들고 싶습니다. 교사는 교수학습평가와 개별 피드백에 사용하고, 학생은 로그인해서 자신의 피드백을 확인합니다." },
      { role: "user", text: "학생에게는 점수, 교사 피드백, 오답 유형 요약만 보여주고 상세 오답 기록과 전체 학습 활동 로그는 교사용으로만 둡니다." },
      { role: "user", text: "학교 내부 검토 전에는 실제 학생 정보를 넣지 않고 수집 항목, 이용 목적, 보관 기간, 접근 권한, 삭제 방법, 동의 필요 여부를 정리해야 합니다." },
      { role: "user", text: "개인정보보호와 학습지원 소프트웨어 심의는 참고 안내로 분리하고, 프롬프트에는 이를 지키기 위한 구현 계획을 기능별 모듈로 정리해주세요." }
    ],
    answerMeta: {
      safety: { id: "직접", label: "학생 이름, 학번, 점수, 오답 기록, 학습 활동 기록 포함", risk: "privacy" },
      externalService: { id: "직접", label: "학생 로그인 및 교수학습평가에 사용", risk: "learningSoftware" }
    }
  };
  const fallbackPrompt = buildFinalPrompt(demoState, { memoryItems: [] });
  const finalPrompt = ensureFinalPromptRequirements(`[교사용 요약]
- 만들 것: 학생 개인정보와 평가 기록을 다루는 교사용 웹앱
- 사용 목적: 교수학습평가, 오답 분석, 학생별 개별 피드백 제공
- 학생에게 보이는 정보: 점수, 교사 피드백, 오답 유형 요약
- 교사용으로만 남길 정보: 상세 오답 기록, 전체 학습 활동 로그, 관리용 감사 기록
- 교사가 준비할 일: 수집 항목, 이용 목적, 보관 기간, 접근 권한, 삭제 방법, 동의 또는 고지 필요 여부, 학교 내부 검토 절차 확인

[AI 실행용 프롬프트]
너는 학교 현장에서 사용할 교사용 웹앱을 설계하는 기획자이자 개발 설계자다. 아래 조건을 바탕으로 교사가 이해하기 쉽고 개발 AI도 바로 실행할 수 있는 요구사항 정의서와 구현 지시서를 한국어로 작성하라.

[언어]
- 모든 결과는 한국어로 작성한다.
- 교사가 바로 읽고 수정할 수 있는 쉬운 표현을 사용한다.

[기능별 모듈]
다음 모듈을 분리해서 설계하라.
- 화면/UI: 교사 대시보드, 학생 목록, 학생 상세, 점수 입력, 오답 기록, 피드백 작성, 학생용 피드백 화면
- 인증과 권한: 교사, 학생, 관리자 역할을 나누고 학생은 자기 정보만 볼 수 있게 한다.
- 데이터 모델: 학생, 학급, 평가, 오답 유형, 학습 활동 기록, 피드백, 접근 로그를 분리한다.
- 평가 기록: 수행평가 점수와 오답 유형을 입력하고 수정 이력을 남긴다.
- 피드백: 교사가 학생별 피드백을 작성하고 학생에게 공개할 범위를 선택한다.
- 개인정보보호 구현: 내부 ID, 가명, 마스킹, 역할별 접근 권한, 삭제, 내보내기, 접근 로그 기능을 설계한다.
- 심의 대응 구현: 수집 항목, 이용 목적, 보관 기간, 보안 조치, 접근 로그, 데이터 보관 위치를 교사가 확인하거나 문서로 내보낼 수 있게 한다.
- 테스트: 권한별 화면 접근, 데이터 삭제, 내보내기, 감사 로그, 모바일 화면을 확인한다.

[결과물]
1. 교사용 요구사항 요약
2. 기능별 모듈 설계
3. 데이터 모델 초안
4. 화면 흐름
5. 개인정보보호 구현 체크리스트
6. 심의 대응 자료 생성 계획
7. 개발 AI에게 넘길 구현 순서`, fallbackPrompt);
  return completeState(demoState, {
    finalPrompt,
    referenceNotes: buildReferenceNotes(demoState.answerMeta, demoState)
  });
}

function welcomeMessage() {
  return settings.memoryEnabled ? `${WELCOME_MESSAGE}\n\n이전에 만든 프롬프트를 참고하여 작업할 수 있습니다.` : WELCOME_MESSAGE;
}

async function checkLocalLlm() {
  state = markLlmStatus(state, { status: "checking", message: "AI 연결을 확인하고 있습니다." });
  render();

  const result = await listModels({ endpoint: settings.llmEndpoint });
  if (!result.ok) {
    state = markLlmStatus(state, { status: "blocked", message: result.message, models: [] });
    render();
    return;
  }

  const fallbackModelId = settings.llmProvider === "openai" ? DEFAULT_OPENAI_MODEL_ID : LOCAL_MODEL_ID;
  const nextLlm = createLocalLlmSettings({ endpoint: settings.llmEndpoint, models: result.models, fallbackModelId });
  settings = { ...settings, llmEndpoint: nextLlm.endpoint, llmModelId: nextLlm.modelId };
  writeSettings(settings);
  state = markLlmStatus(state, { status: "ready", message: "", models: result.models });
  render();
}

async function handleSubmit(text) {
  if (state.isAwaitingAi) {
    ui.showToast("AI가 답변하는 중입니다. 잠시만 기다려주세요.");
    return;
  }

  if (state.llmStatus !== "ready") {
    ui.showToast("AI 준비 상태를 먼저 확인해주세요.");
    return;
  }

  if (!state.initialRequest) {
    state = startRequest(state, text);
    persistDraftIfNeeded();
    render();
    collapseMobileTopbarAfterInput();
    await requestNextQuestion();
  } else if (state.completed) {
    await handleRevision(text);
    collapseMobileTopbarAfterInput();
  } else {
    state = recordConversationAnswer(state, text, null);
    persistDraftIfNeeded();
    render();
    collapseMobileTopbarAfterInput();
    await requestNextQuestion();
  }
}

async function handleOption(option) {
  if (state.isAwaitingAi || state.llmStatus !== "ready") return;
  state = recordConversationAnswer(state, option.label, option);
  persistDraftIfNeeded();
  render();
  collapseMobileTopbarAfterInput();
  await requestNextQuestion();
}

async function requestNextQuestion() {
  const generation = ++requestGeneration;
  state = setAwaitingAi(state, true);
  render();

  const selectedMemory = selectMemoryItems(memoryStore.items, settings);
  const result = await chatCompletion({
    endpoint: settings.llmEndpoint,
    model: settings.llmModelId,
    messages: buildNextQuestionMessages({ seed: state.initialRequest, turns: state.conversationTurns, memoryItems: selectedMemory, guideMode: settings.guideMode }),
    maxTokens: 4096
  });

  if (generation !== requestGeneration) return;

  if (!result.ok) {
    state = appendAssistantMessage(setAwaitingAi(state, false), result.message || "AI 답변을 받지 못했습니다. 잠시 후 한 번 더 입력해주세요.");
    persistDraftIfNeeded();
    render();
    return;
  }

  const parsed = parsePlannerResponse(result.content);
  const value = parsed.ok ? parsed.value : parsed.fallback;

  if (value.kind === "final_prompt_ready") {
    await completeWithFinalPrompt(value.finalPrompt, value.referenceNotes);
    return;
  }

  state = appendAiQuestion(setAwaitingAi(state, false), {
    question: value.question,
    suggestedOptions: value.suggestedOptions?.length ? value.suggestedOptions : quickOptionsForIntent(value.capturedFacts),
    capturedFacts: value.capturedFacts
  });
  persistDraftIfNeeded();
  render();
}

async function completeWithFinalPrompt(finalPromptFromModel, referenceNotesFromModel = "") {
  const fallbackPrompt = buildFinalPrompt(state, { memoryItems: selectMemoryItems(memoryStore.items, settings) });
  const finalPrompt = ensureFinalPromptRequirements(finalPromptFromModel, fallbackPrompt);
  const requiredReferenceNotes = buildReferenceNotes(state.answerMeta, state);
  const referenceNotes = referenceNotesFromModel
    ? `${requiredReferenceNotes}\n\nAI가 정리한 추가 참고:\n${referenceNotesFromModel}`.trim()
    : requiredReferenceNotes;
  state = completeState(setAwaitingAi(state, false), { finalPrompt, referenceNotes });
  render();
  saveCompletedState();
}

async function handleRevision(text) {
  const generation = ++requestGeneration;
  const stateWithUserMessage = {
    ...state,
    messages: [...state.messages, { role: "user", text }]
  };

  state = setAwaitingAi(stateWithUserMessage, true);
  render();

  const result = await chatCompletion({
    endpoint: settings.llmEndpoint,
    model: settings.llmModelId,
    messages: buildRevisionMessages({ prompt: state.finalPrompt, revisionRequest: text, referenceNotes: state.referenceNotes }),
    maxTokens: 8192
  });

  if (generation !== requestGeneration) return;

  if (!result.ok) {
    const fallbackPrompt = revisePrompt(state.finalPrompt, text);
    state = appendAssistantMessage(setAwaitingAi(state, false), result.message || "AI 수정 답변을 받지 못했습니다. 기본 방식으로 수정 내용을 반영했습니다.");
    state = applyRevisionState(state, {
      revisedPrompt: fallbackPrompt,
      summary: "AI 수정 답변을 받지 못해 기본 방식으로 수정 요청을 반영했습니다."
    });
    render();
    saveCompletedState();
    return;
  }

  const revisedPrompt = result.content || revisePrompt(state.finalPrompt, text);
  const summary = summarizeRevision(text);
  state = applyRevisionState(
    setAwaitingAi(state, false),
    { revisedPrompt, summary }
  );

  render();
  saveCompletedState();
}

function saveCompletedState() {
  const now = new Date().toISOString();
  const session = {
    ...state,
    id: typeof state.id === "string" && state.id ? state.id : `session-${Date.now()}`,
    title: state.initialRequest.slice(0, 42) || "새 작업",
    createdAt: state.createdAt || now,
    updatedAt: now
  };
  state = { ...state, id: session.id, createdAt: session.createdAt, updatedAt: session.updatedAt };

  const saveResult = saveSession(session);
  if (!saveResult.ok) ui.showToast("완료한 작업을 저장하지 못했습니다.");

  const newMemory = createMemoryItemsFromSession(session);
  memoryStore = {
    items: mergeMemoryItems(memoryStore.items, newMemory),
    updatedAt: now
  };
  const memoryResult = writeMemoryStore(memoryStore);
  if (!memoryResult.ok) ui.showToast("이전 작업 참고 내용을 저장하지 못했습니다.");

  const clearResult = clearActiveDraft();
  if (!clearResult.ok) ui.showToast("완료한 작업 표시를 정리하지 못했습니다.");

  sessions = readSessions();
}

function persistDraftIfNeeded() {
  if (state.completed) return;
  const result = writeActiveDraft(state);
  if (!result.ok) ui.showToast("진행 중인 작업을 저장하지 못했습니다.");
}

function handleLoadSession(session) {
  const clearResult = clearActiveDraft();
  resetMobileTopbar();
  state = {
    ...createInitialState(),
    ...session,
    completed: true,
    activeStepIndex: steps.length,
    finalPrompt: session.finalPrompt,
    referenceNotes: session.referenceNotes
  };
  render();
  ui.showToast(clearResult.ok ? "저장한 작업을 불러왔습니다." : "저장한 작업은 불러왔지만 진행 중인 작업을 지우지 못했습니다.");
}

function handleClearSessions() {
  const result = clearSessions();
  sessions = readSessions();
  render();
  ui.showToast(result.ok ? "저장한 작업을 지웠습니다." : "저장한 작업을 지우지 못했습니다.");
}

function handleToggleMemory() {
  settings = { ...settings, memoryEnabled: !settings.memoryEnabled };
  const result = writeSettings(settings);
  if (!result.ok) ui.showToast("이전 작업 참고 설정을 저장하지 못했습니다.");
  render();
}

function handleToggleTheme() {
  settings = { ...settings, theme: settings.theme === "dark" ? "light" : "dark" };
  const result = writeSettings(settings);
  if (!result.ok) ui.showToast("테마 설정을 저장하지 못했습니다.");
  applyTheme();
  render();
}

function handleSetGuideMode(mode) {
  if (mode !== "friendly" && mode !== "thorough") return;
  if (settings.guideMode === mode) return;
  settings = { ...settings, guideMode: mode };
  const result = writeSettings(settings);
  if (!result.ok) ui.showToast("질문 방식 설정을 저장하지 못했습니다.");
  render();
  ui.showToast(mode === "thorough" ? "꼼꼼 확인으로 바꿨습니다." : "친절 모드로 바꿨습니다.");
}

function handleSetDefaultModel(provider) {
  if (provider !== "local" && provider !== "openai") return;
  if (settings.llmProvider === provider) return;

  settings = provider === "openai"
    ? { ...settings, llmProvider: "openai", llmEndpoint: OPENAI_LLM_ENDPOINT, llmModelId: DEFAULT_OPENAI_MODEL_ID }
    : { ...settings, llmProvider: "local", llmEndpoint: DEFAULT_LLM_ENDPOINT, llmModelId: LOCAL_MODEL_ID };

  const result = writeSettings(settings);
  if (!result.ok) ui.showToast("기본 모델 설정을 저장하지 못했습니다.");
  render();
  ui.showToast(provider === "openai" ? "기본 모델을 5.4 nano로 바꿨습니다." : "기본 모델을 e2b로 바꿨습니다.");
  checkLocalLlm();
}

function applyTheme() {
  document.documentElement.dataset.theme = settings.theme || "light";
}

function applyMobileTopbarState() {
  document.body.classList.toggle("is-mobile-topbar-compact", Boolean(state.initialRequest && !mobileTopbarExpanded));
}

function handleClearMemory() {
  const result = clearMemoryStore();
  memoryStore = readMemoryStore();
  render();
  ui.showToast(result.ok ? "이전 작업 참고 내용을 지웠습니다." : "이전 작업 참고 내용을 지우지 못했습니다.");
}

function handleClearDraft() {
  requestGeneration += 1;
  const result = clearActiveDraft();
  resetMobileTopbar();
  state = appendAssistantMessage(createInitialState(), welcomeMessage());
  render();
  checkLocalLlm();
  ui.showToast(result.ok ? "새로 시작합니다." : "진행 중인 작업을 지우지 못했습니다.");
}

function copyText(text, emptyMessage, fallbackElementId) {
  if (!text) {
    ui.showToast(emptyMessage);
    return;
  }

  if (copyWithSelection(text)) {
    ui.showToast("복사했습니다.");
    return;
  }

  copyWithClipboardApi(text)
    .then(() => ui.showToast("복사했습니다."))
    .catch(() => {
      if (selectCopyFallback(fallbackElementId)) {
        ui.showToast("텍스트를 선택해두었습니다. ⌘C를 눌러 복사해주세요.");
      } else {
        ui.showToast("복사하지 못했습니다. 텍스트를 직접 선택해주세요.");
      }
    });
}

async function copyWithClipboardApi(text) {
  if (!navigator.clipboard?.writeText || !window.isSecureContext) {
    throw new Error("clipboard api unavailable");
  }

  await navigator.clipboard.writeText(text);
}

function copyWithSelection(text) {
  if (!document.execCommand) return false;

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function selectCopyFallback(elementId) {
  const element = document.getElementById(elementId);
  if (!element) return false;

  const selection = window.getSelection?.();
  const range = document.createRange?.();
  if (!selection || !range) return false;

  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
  element.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

function render() {
  applyMobileTopbarState();
  ui.render({
    state,
    steps,
    sessions,
    settings,
    memory: memoryStore,
    modelProfile,
    localModelId: settings.llmModelId || LOCAL_MODEL_ID,
    handlers: {
      onOption: handleOption,
      onLoadSession: handleLoadSession
    }
  });
}

init();
