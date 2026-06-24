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
import { buildNextQuestionMessages, buildSegmentedFinalPromptMessages, parsePlannerResponse, quickOptionsForIntent } from "./modules/conversationPlanner.js";

const WELCOME_MESSAGE = "짧게 시작해도 괜찮습니다. 만들고 싶은 자료, 앱, 프로그램, 문서를 한 문장으로 적어주세요.\n\n예: 학급 규칙 안내문 만들고 싶어요.\n예: 우리 반 독서 기록 앱을 만들고 싶어요.\n예: 수행평가 루브릭을 만들 프롬프트가 필요해요.";
const MIN_REQUIRED_QUESTIONS = steps.length;
const MAX_TOTAL_QUESTIONS = 15;

let settings = readSettings();
let memoryStore = readMemoryStore();
let sessions = readSessions();
let state = restoreDraft(readActiveDraft()) ?? createInitialState();
let requestGeneration = 0;
let demoTimer = 0;
let mobileTopbarExpanded = true;

const ui = createUi();

function init() {
  document.body.classList.toggle("capture-all", new URLSearchParams(window.location.search).get("captureAll") === "1");
  document.body.classList.toggle("capture-two", new URLSearchParams(window.location.search).get("captureTwo") === "1");
  document.body.classList.toggle("reference-focus", new URLSearchParams(window.location.search).get("referenceFocus") === "1");

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
  if (params.get("testScenario") === "e4bClassRules") return createE4bClassRulesDemoState();
  if (params.get("testScenario") === "nanoPrivacyDetailed") return createNanoPrivacyDetailedDemoState();
  if (params.get("testScenario") === "privacyLearningFull") return createPrivacyLearningFullDemoState();
  if (params.get("testScenario") === "adminNoPrivacyFull") return createAdminNoPrivacyFullDemoState();
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

function createPrivacyLearningFullDemoState() {
  settings = { ...settings, llmProvider: "openai", llmEndpoint: OPENAI_LLM_ENDPOINT, llmModelId: DEFAULT_OPENAI_MODEL_ID };
  const demoState = {
    ...createInitialState(),
    initialRequest: "시쓰기 수행평가를 관리하고 피드백을 남기는 수업용 웹앱을 만들고 싶습니다.",
    activeStepIndex: steps.length,
    llmStatus: "ready",
    availableModels: [DEFAULT_OPENAI_MODEL_ID],
    messages: [
      { role: "assistant", text: welcomeMessage() },
      { role: "user", text: "시쓰기 수행평가를 관리하고 피드백을 남기는 수업용 웹앱을 만들고 싶습니다." },
      { role: "assistant", text: "1단계입니다. 만들고 싶은 결과물을 더 구체적으로 확인하겠습니다. 어떤 웹앱이면 좋을까요?" },
      { role: "user", text: "교사가 학생별 시쓰기 제출 여부, 작품 초안, 수행평가 기준별 피드백, 다시 고쳐 쓸 점을 관리하고 학생은 로그인해서 자기 피드백만 확인하는 웹앱입니다." },
      { role: "assistant", text: "2단계입니다. 이 웹앱을 언제, 누가 사용하나요?" },
      { role: "user", text: "정규 국어 수업의 시쓰기 수행평가 시간과 피드백 시간에 교사와 학생이 함께 사용합니다. 교사는 평가와 피드백을 기록하고 학생은 자기 피드백을 확인합니다." },
      { role: "assistant", text: "3단계입니다. 교육 맥락과 대상 학년을 확인하겠습니다." },
      { role: "user", text: "초등학교 6학년 국어 시 단원 수행평가에 사용합니다. 학급 단위로 운영하고 담임교사가 담당합니다." },
      { role: "assistant", text: "4단계입니다. 이 웹앱으로 얻고 싶은 가장 중요한 목표는 무엇인가요?" },
      { role: "user", text: "학생이 시의 주제, 표현, 비유, 퇴고 과정을 돌아보고 교사가 기준별 피드백과 다음 수정 방향을 쉽게 남기는 것이 목표입니다." },
      { role: "assistant", text: "5단계입니다. 교사가 직접 판단해야 하는 부분은 무엇인가요?" },
      { role: "user", text: "피드백 공개 여부, 학생에게 보일 점수 범위, 교사용 평가 메모 공개 금지, 루브릭 기준별 코멘트는 교사가 직접 결정해야 합니다." },
      { role: "assistant", text: "6단계입니다. 개발에 필요한 자료나 입력 데이터는 무엇인가요?" },
      { role: "user", text: "학생 이름, 번호, 반, 제출한 시 제목, 제출 상태, 루브릭 기준별 성취 수준, 교사 피드백, 교사용 평가 메모가 필요합니다. 테스트 때는 가명 데이터만 사용합니다." },
      { role: "assistant", text: "7단계입니다. 개인정보와 민감정보 관련 확인이 필요합니다." },
      { role: "user", text: "학생 이름, 번호, 수행평가 성취 수준, 교사 피드백, 교사용 평가 메모가 들어갑니다. 보호자 연락처는 제외하고, 최소 수집과 권한 분리가 필요합니다." },
      { role: "assistant", text: "8단계입니다. 외부 서비스나 학교 심의와 관련된 부분을 확인하겠습니다." },
      { role: "user", text: "정규 수업에서 학생이 직접 사용하는 학습지원 웹앱입니다. 학교 내부 검토와 학습지원 소프트웨어 심의 준비가 필요하며, 수집 항목과 이용 목적을 문서로 정리해야 합니다." },
      { role: "assistant", text: "9단계입니다. 최종 결과물은 어떤 형식이면 좋을까요?" },
      { role: "user", text: "교사용 요약은 쉽게, AI 실행용 프롬프트는 개발자가 바로 구현할 수 있게 요구사항, 화면 흐름, 데이터 모델, 권한, 모듈, 테스트 기준까지 자세히 써주세요." },
      { role: "assistant", text: "10단계입니다. 품질 기준과 수정 방향을 확인하겠습니다." },
      { role: "user", text: "기능별로 모듈화하고, 개인정보보호와 심의 규정 설명은 참고 안내로 분리해주세요. AI 실행용 프롬프트에는 이를 준수하기 위한 구현 계획만 넣어주세요." }
    ],
    conversationTurns: [
      { role: "user", text: "시쓰기 수행평가를 관리하고 피드백을 남기는 수업용 웹앱을 만들고 싶습니다." },
      { role: "user", text: "교사가 학생별 시쓰기 제출 여부, 작품 초안, 루브릭 기준별 피드백, 다시 고쳐 쓸 점을 관리하고 학생은 로그인해서 자기 피드백만 확인하는 웹앱입니다." },
      { role: "user", text: "정규 국어 수업의 시쓰기 수행평가 시간과 피드백 시간에 교사와 학생이 함께 사용합니다." },
      { role: "user", text: "초등학교 6학년 국어 시 단원 수행평가에 사용합니다." },
      { role: "user", text: "학생이 시의 주제, 표현, 비유, 퇴고 과정을 돌아보고 교사가 기준별 피드백과 다음 수정 방향을 남기는 것이 목표입니다." },
      { role: "user", text: "피드백 공개 여부, 점수 공개 범위, 교사용 평가 메모 공개 금지, 루브릭 기준별 코멘트는 교사가 직접 결정합니다." },
      { role: "user", text: "학생 이름, 번호, 반, 제출한 시 제목, 제출 상태, 루브릭 기준별 성취 수준, 교사 피드백, 교사용 평가 메모가 필요합니다." },
      { role: "user", text: "학생 이름, 번호, 수행평가 성취 수준, 교사 피드백, 교사용 평가 메모가 들어가며 최소 수집과 권한 분리가 필요합니다." },
      { role: "user", text: "정규 수업에서 학생이 직접 사용하는 학습지원 웹앱이며 학교 내부 검토와 심의 준비가 필요합니다." },
      { role: "user", text: "교사용 요약은 쉽게, AI 실행용 프롬프트는 개발자가 바로 구현할 수 있게 자세히 써주세요." },
      { role: "user", text: "기능별 모듈화, 개인정보보호 구현 계획, 심의 대응 구현 계획, 테스트 기준을 포함해주세요." }
    ],
    answers: {
      output: "시쓰기 수행평가를 관리하고 피드백을 남기는 수업용 웹앱",
      useScene: "정규 국어 수업의 시쓰기 수행평가 시간과 피드백 시간에 교사와 학생이 함께 사용",
      context: "초등학교 6학년 국어 시 단원 수행평가",
      goal: "시의 주제, 표현, 비유, 퇴고 과정을 기준별로 확인하고 다음 수정 방향을 쉽게 안내",
      teacherJudgment: "피드백 공개 여부, 점수 공개 범위, 교사용 평가 메모 공개 금지, 루브릭 기준별 코멘트",
      sourceMaterial: "가명 학생 데이터, 제출한 시 제목, 제출 상태, 루브릭 기준별 성취 수준, 교사 피드백, 교사용 평가 메모",
      safety: "학생 이름, 번호, 수행평가 성취 수준, 교사 피드백, 교사용 평가 메모가 포함되므로 최소 수집, 권한 분리, 마스킹, 삭제 기능이 필요",
      externalService: "정규 수업에서 학생이 직접 사용하는 학습지원 웹앱이므로 학교 내부 검토와 심의 준비가 필요",
      format: "교사용 요약과 AI 실행용 프롬프트를 분리하고, 개발 가능한 요구사항 정의서 형태로 작성",
      quality: "기능별 모듈화, 개인정보보호 구현 계획, 심의 대응 구현 계획, 테스트 기준을 포함"
    },
    answerMeta: {
      safety: { id: "직접", label: "학생 이름, 번호, 수행평가 성취 수준, 교사 피드백, 교사용 평가 메모 포함", risk: "sensitive" },
      externalService: { id: "직접", label: "정규 수업에서 학생이 직접 사용하는 학습지원 웹앱", risk: "learningSoftware" }
    }
  };
  const fallbackPrompt = buildFinalPrompt(demoState, { memoryItems: [] });
  const finalPrompt = ensureFinalPromptRequirements(`[교사용 요약]
- 만들 것: 시쓰기 수행평가를 관리하고 피드백을 남기는 수업용 웹앱
- 사용 장면: 정규 국어 수업의 시쓰기 수행평가 시간과 피드백 시간에 교사와 학생이 함께 사용
- 주요 기능: 학생별 제출 상태, 시 제목, 루브릭 기준별 성취 수준, 교사 피드백, 다시 고쳐 쓸 점, 학생용 피드백 확인
- 포함 정보: 학생 이름, 번호, 반, 제출한 시 제목, 제출 상태, 루브릭 기준별 성취 수준, 교사 피드백, 교사용 평가 메모
- 교사가 확인할 점: 최소 수집, 권한 분리, 학생 공개 범위, 평가 메모 비공개, 보관 기간, 삭제 방법, 학교 내부 검토와 심의 준비

[AI 실행용 프롬프트]
너는 학교 현장에서 사용할 학습지원 웹앱을 설계하고 구현하는 개발 AI다. 아래 요구사항을 바탕으로 바로 개발에 들어갈 수 있는 한국어 요구사항 정의서, 모듈 설계, 데이터 모델, 화면 흐름, 권한 설계, 테스트 계획을 작성하라.

[개발 목표]
- 초등학교 6학년 국어 시쓰기 수행평가와 피드백을 관리하는 웹앱을 만든다.
- 교사는 학생별 제출 상태, 시 제목, 루브릭 기준별 성취 수준, 교사 피드백, 다시 고쳐 쓸 점, 교사용 평가 메모를 관리한다.
- 학생은 로그인 후 자기 수행평가 피드백과 다시 고쳐 쓸 점만 확인한다.
- 교사용 평가 메모와 전체 학급 비교 정보는 학생에게 공개하지 않는다.

[기능별 모듈]
1. 화면/UI 모듈
- 교사 대시보드: 학급 전체 제출 현황, 피드백 작성 필요 학생, 공개 대기 피드백, 최근 수정 기록을 표시한다.
- 학생 상세 화면: 기본 정보, 시 제목, 제출 상태, 루브릭 기준별 성취 수준, 교사 피드백, 교사용 평가 메모를 탭으로 분리한다.
- 학생 화면: 자기 수행평가 피드백, 다시 고쳐 쓸 점, 공개된 성취 수준만 보여준다.
- 심의 준비 화면: 수집 항목, 이용 목적, 보관 기간, 권한 구조, 삭제 방법, 데이터 보관 위치를 확인하고 문서로 내보낸다.

2. 인증과 권한 모듈
- 역할은 교사, 학생, 관리자 세 가지로 나눈다.
- 학생은 자기 데이터만 조회한다.
- 교사는 담당 학급 학생 데이터만 조회·수정한다.
- 교사용 평가 메모와 전체 학급 비교 정보는 교사 전용으로 두고, 관리자가 열람할 때도 감사 로그를 남긴다.
- 화면 숨김만으로 처리하지 말고 서버 API에서 권한을 강제한다.

3. 데이터 모델 모듈
- Student: 내부 ID, 가명 표시명, 학년, 반, 번호, 최소 식별 정보
- PoetrySubmission: 시 제목, 제출 상태, 제출일, 수정일, 공개 여부
- RubricScore: 표현, 주제, 비유, 퇴고 과정 등 기준별 성취 수준과 교사용 코멘트
- Feedback: 학생에게 공개할 피드백, 다시 고쳐 쓸 점, 공개 상태, 공개 일시
- TeacherNote: 교사용 평가 메모, 민감도, 열람 권한, 수정 이력
- RevisionHistory: 학생의 수정 이력, 제출 시각, 교사용 확인 상태
- AccessLog: 사용자, 접근 시각, 접근 대상, 수행 작업, IP 또는 기기 정보

4. 평가와 피드백 모듈
- 교사는 루브릭 기준별 성취 수준과 피드백을 입력하고 수정 이력을 확인한다.
- 피드백은 저장 상태와 공개 상태를 구분한다.
- 학생 공개 전 미리보기와 공개 취소 기능을 제공한다.
- 다시 고쳐 쓸 점은 교사가 직접 작성하거나 추천안을 수정해 확정한다.

5. 개인정보보호 구현 모듈
- 필수 항목과 선택 항목을 나누고 최소 수집 원칙을 적용한다.
- 실제 학생 정보 없이 가명 데이터로 테스트할 수 있는 샘플 데이터 모드를 제공한다.
- 학생 목록에서는 이름 대신 가명 표시를 선택할 수 있게 한다.
- 교사용 평가 메모와 전체 학급 비교 정보는 기본 마스킹하고 권한 있는 교사만 열람한다.
- 보관 기간 만료 알림, 삭제, 내보내기, 접근 로그 확인 기능을 제공한다.

6. 심의 대응 구현 모듈
- 사용 목적이 정규 수업에서 학생과 함께 쓰는 학습지원 웹앱인지 확인하는 체크리스트를 둔다.
- 학생 개인정보 수집·처리 여부, 수집 항목, 이용 목적, 보관 기간, 보안 조치, 접근 권한, 삭제 방법, 데이터 보관 위치를 교사가 입력하고 내보낼 수 있게 한다.
- 학교 내부 검토용 요약 페이지와 화면 캡처용 점검표를 만든다.

7. 테스트 모듈
- 학생이 다른 학생 정보에 접근할 수 없는지 테스트한다.
- 교사가 담당 학급 밖 학생 정보를 볼 수 없는지 테스트한다.
- 공개 전 피드백이 학생 화면에 보이지 않는지 테스트한다.
- 교사용 평가 메모, 전체 학급 비교 정보, 성취 수준 정보의 마스킹과 접근 로그를 테스트한다.
- 삭제, 내보내기, 보관 기간 만료, 모바일 화면을 테스트한다.

[완료 기준]
- 교사는 학생별 시쓰기 제출 상태, 루브릭 기준별 성취 수준, 피드백, 교사용 평가 메모를 분리해 관리할 수 있다.
- 학생은 자기에게 공개된 정보만 확인한다.
- 개인정보보호와 심의 준비에 필요한 항목을 교사가 확인하고 문서로 내보낼 수 있다.
- 모든 화면과 기능은 추후 수정하기 쉽도록 모듈별로 분리되어 있다.`, fallbackPrompt);

  return completeState(demoState, {
    finalPrompt,
    referenceNotes: buildReferenceNotes(demoState.answerMeta, demoState)
  });
}

function createAdminNoPrivacyFullDemoState() {
  settings = { ...settings, llmProvider: "openai", llmEndpoint: OPENAI_LLM_ENDPOINT, llmModelId: DEFAULT_OPENAI_MODEL_ID };
  const demoState = {
    ...createInitialState(),
    initialRequest: "학생 상담 기록을 정리하는 교사용 웹앱을 만들고 싶습니다.",
    activeStepIndex: steps.length,
    llmStatus: "ready",
    availableModels: [DEFAULT_OPENAI_MODEL_ID],
    messages: [
      { role: "assistant", text: welcomeMessage() },
      { role: "user", text: "학생 상담 기록을 정리하는 교사용 웹앱을 만들고 싶습니다." },
      { role: "assistant", text: "1단계입니다. 만들고 싶은 결과물을 구체적으로 확인하겠습니다. 어떤 업무용 웹앱인가요?" },
      { role: "user", text: "교사가 학생별 상담 날짜, 상담 주제, 후속 조치, 다음 확인일을 기록하고 검색할 수 있는 웹앱입니다." },
      { role: "assistant", text: "2단계입니다. 언제, 누가 사용하나요?" },
      { role: "user", text: "교사가 혼자 사용합니다. 학생과 상담한 뒤 기록을 남기고, 다음에 확인할 일을 놓치지 않기 위해 사용합니다." },
      { role: "assistant", text: "3단계입니다. 교육 및 업무 맥락을 확인하겠습니다." },
      { role: "user", text: "초등 담임교사의 생활지도와 학급 운영 맥락에서 사용합니다. 학생이 직접 로그인하거나 함께 사용하는 기능은 없습니다." },
      { role: "assistant", text: "4단계입니다. 가장 중요한 목표는 무엇인가요?" },
      { role: "user", text: "학생별 상담 내용을 안전하게 정리하고, 후속 조치와 다음 확인일을 놓치지 않는 것이 목표입니다." },
      { role: "assistant", text: "5단계입니다. 교사가 직접 판단해야 하는 부분은 무엇인가요?" },
      { role: "user", text: "상담 내용의 민감도, 기록 공개 금지 범위, 후속 조치 여부, 보관 기간은 교사가 직접 판단해야 합니다." },
      { role: "assistant", text: "6단계입니다. 필요한 자료나 입력 데이터는 무엇인가요?" },
      { role: "user", text: "학생 이름, 번호, 상담 날짜, 상담 주제, 상담 요약, 후속 조치, 다음 확인일, 교사용 메모가 필요합니다. 테스트 때는 가명 데이터만 사용합니다." },
      { role: "assistant", text: "7단계입니다. 개인정보나 민감정보가 들어가는지 확인하겠습니다." },
      { role: "user", text: "학생 이름, 번호, 상담 요약, 교사용 메모가 들어가므로 개인정보와 민감한 생활지도 기록으로 다뤄야 합니다. 보호자 연락처는 이번 버전에서는 제외합니다." },
      { role: "assistant", text: "8단계입니다. 외부 서비스나 심의 관련 부분을 확인하겠습니다." },
      { role: "user", text: "교사 단독 업무용이고 정규 수업에서 학생과 함께 쓰지 않습니다. 다만 개인정보가 있으니 권한, 잠금, 내보내기, 삭제 기능이 필요합니다." },
      { role: "assistant", text: "9단계입니다. 최종 결과물은 어떤 형식이면 좋을까요?" },
      { role: "user", text: "교사용 요약은 간단히, AI 실행용 프롬프트는 화면 구성, 데이터 구조, 권한, 보안, 모듈, 테스트 기준까지 개발 가능하게 작성해주세요." },
      { role: "assistant", text: "10단계입니다. 품질 기준과 수정 방향을 확인하겠습니다." },
      { role: "user", text: "초보 교사도 이해하기 쉬운 표현으로 작성하고, 기능별로 모듈화해서 나중에 수정하기 쉽게 만들어주세요." }
    ],
    conversationTurns: [
      { role: "user", text: "학생 상담 기록을 정리하는 교사용 웹앱을 만들고 싶습니다." },
      { role: "user", text: "교사가 학생별 상담 날짜, 상담 주제, 후속 조치, 다음 확인일을 기록하고 검색할 수 있는 웹앱입니다." },
      { role: "user", text: "교사가 혼자 사용하며 학생과 상담한 뒤 기록을 남기고 다음 확인할 일을 관리합니다." },
      { role: "user", text: "초등 담임교사의 생활지도와 학급 운영 맥락에서 사용하며 학생 로그인 기능은 없습니다." },
      { role: "user", text: "학생별 상담 내용을 안전하게 정리하고 후속 조치와 다음 확인일을 놓치지 않는 것이 목표입니다." },
      { role: "user", text: "상담 내용의 민감도, 기록 공개 금지 범위, 후속 조치 여부, 보관 기간은 교사가 직접 판단합니다." },
      { role: "user", text: "학생 이름, 번호, 상담 날짜, 상담 주제, 상담 요약, 후속 조치, 다음 확인일, 교사용 메모가 필요합니다." },
      { role: "user", text: "학생 이름, 번호, 상담 요약, 교사용 메모가 들어가므로 개인정보와 민감한 생활지도 기록으로 다뤄야 합니다." },
      { role: "user", text: "교사 단독 업무용이고 정규 수업에서 학생과 함께 쓰지 않지만 권한, 잠금, 내보내기, 삭제 기능이 필요합니다." },
      { role: "user", text: "화면 구성, 데이터 구조, 권한, 보안, 모듈, 테스트 기준까지 개발 가능하게 작성해주세요." },
      { role: "user", text: "초보 교사도 이해하기 쉬운 표현과 기능별 모듈화가 필요합니다." }
    ],
    answers: {
      output: "학생 상담 기록을 정리하는 교사용 웹앱",
      useScene: "교사가 혼자 상담 후 기록을 남기고 다음 확인할 일을 관리",
      context: "초등 담임교사의 생활지도와 학급 운영, 학생 로그인 기능 없음",
      goal: "학생별 상담 내용을 안전하게 정리하고 후속 조치와 다음 확인일을 놓치지 않기",
      teacherJudgment: "상담 내용의 민감도, 기록 공개 금지 범위, 후속 조치 여부, 보관 기간",
      sourceMaterial: "가명 학생 데이터, 상담 날짜, 상담 주제, 상담 요약, 후속 조치, 다음 확인일, 교사용 메모",
      safety: "학생 이름, 번호, 상담 요약, 교사용 메모가 포함되므로 개인정보와 민감한 생활지도 기록으로 관리 필요",
      externalService: "교사 단독 업무용이며 정규 수업에서 학생과 함께 쓰지 않음",
      format: "교사용 요약과 AI 실행용 프롬프트를 분리하고 개발 가능한 요구사항 정의서 형태로 작성",
      quality: "초보 교사도 이해하기 쉬운 표현, 기능별 모듈화, 테스트 기준 포함"
    },
    answerMeta: {
      safety: { id: "직접", label: "학생 이름, 번호, 상담 요약, 교사용 메모 포함", risk: "sensitive" },
      externalService: { id: "A", label: "교사 단독 행정·업무용, 학생 참여 없음", risk: "" }
    }
  };
  const fallbackPrompt = buildFinalPrompt(demoState, { memoryItems: [] });
  const finalPrompt = ensureFinalPromptRequirements(`[교사용 요약]
- 만들 것: 학생 상담 기록을 정리하는 교사용 웹앱
- 사용 장면: 교사가 혼자 상담 후 기록을 남기고 다음 확인할 일을 관리
- 주요 기능: 학생별 상담 기록, 상담 주제, 상담 요약, 후속 조치, 다음 확인일, 검색과 필터, 잠금과 백업
- 개인정보 확인: 학생 이름, 번호, 상담 요약, 교사용 메모가 포함되므로 개인정보와 민감한 생활지도 기록으로 관리
- 심의 관련 확인: 교사 단독 행정·업무용이며 정규 수업에서 학생과 함께 쓰는 학습지원 소프트웨어는 아님

[AI 실행용 프롬프트]
너는 교사의 업무 효율을 높이는 웹앱을 설계하고 구현하는 개발 AI다. 아래 요구사항을 바탕으로 바로 개발에 들어갈 수 있는 한국어 요구사항 정의서, 모듈 설계, 데이터 모델, 화면 흐름, 저장 방식, 테스트 계획을 작성하라.

[개발 목표]
- 초등 담임교사가 혼자 사용하는 학생 상담 기록용 웹앱을 만든다.
- 학생 이름, 번호, 상담 날짜, 상담 주제, 상담 요약, 후속 조치, 다음 확인일, 교사용 메모를 관리한다.
- 학생 로그인 기능은 만들지 않고, 교사만 기록을 작성하고 조회한다.
- 개인정보와 민감한 생활지도 기록을 다루므로 잠금, 권한, 마스킹, 삭제, 내보내기, 접근 기록 기능을 구현 계획에 포함한다.

[기능별 모듈]
1. 화면/UI 모듈
- 상담 대시보드: 최근 상담, 다음 확인일이 가까운 학생, 후속 조치가 필요한 기록을 보여준다.
- 학생별 상담 기록 화면: 상담 날짜, 상담 주제, 상담 요약, 후속 조치, 다음 확인일, 교사용 메모를 기록한다.
- 검색과 필터: 학생, 상담 주제, 기간, 후속 조치 여부, 다음 확인일로 찾을 수 있게 한다.
- 잠금 화면: 일정 시간 사용하지 않으면 상담 기록 화면을 잠그고 다시 확인하도록 한다.
- 백업 화면: 교사가 필요한 경우 암호화된 파일로 내보내고 가져올 수 있게 한다.

2. 데이터 모델 모듈
- Student: 내부 ID, 가명 표시명, 학년, 반, 번호, 최소 식별 정보
- CounselingRecord: 상담 ID, 학생 내부 ID, 상담 날짜, 상담 주제, 상담 요약, 민감도, 후속 조치, 다음 확인일, 작성자, 수정일
- FollowUpTask: 상담 ID, 해야 할 일, 기한, 완료 여부, 완료일
- AttachmentMemo: 파일 첨부가 필요하면 별도 모듈로 분리하되 첫 버전에서는 텍스트 메모만 사용
- AccessLog: 열람자, 열람 시각, 대상 학생, 수행 작업

3. 저장 모듈
- 첫 버전은 브라우저 IndexedDB 또는 교내 서버 저장을 선택할 수 있게 설계한다.
- 상담 기록은 브라우저에 평문으로 오래 남기지 않도록 잠금, 백업 암호화, 삭제 기능을 함께 설계한다.
- 저장 로직은 storage 모듈로 분리해 나중에 서버 API나 학교 계정 연동으로 바꾸기 쉽게 한다.
- 실제 학생 정보 대신 가명 데이터로 테스트할 수 있는 샘플 모드를 제공한다.

4. 상담 관리 모듈
- 상담 기록 추가, 수정, 삭제, 후속 조치 완료 처리를 지원한다.
- 다음 확인일이 지난 기록과 오늘 확인할 기록을 눈에 띄게 표시한다.
- 상담 요약과 교사용 세부 메모를 분리하고, 민감한 메모는 기본 접힘 상태로 둔다.

5. 개인정보보호 구현 모듈
- 필수 항목과 선택 항목을 나누고 최소 수집 원칙을 적용한다.
- 학생 목록에서는 이름 대신 가명 표시를 선택할 수 있게 한다.
- 상담 요약과 교사용 메모는 기본 마스킹하거나 접어둔다.
- 삭제, 내보내기, 보관 기간 만료 알림, 접근 로그 확인 기능을 제공한다.
- 화면 캡처나 외부 AI 입력 전에 실제 학생 정보가 포함될 수 있다는 경고 문구를 표시한다.

6. 참고 안내 구현 모듈
- 이 도구는 교사 단독 행정·업무용이며 학생과 함께 사용하는 정규 수업용 학습지원 소프트웨어가 아니라는 확인 문구를 제공한다.
- 개인정보가 포함된 상담 기록이므로 수집 목적, 보관 기간, 접근 권한, 삭제 방법을 교사가 확인할 수 있게 한다.
- 만약 나중에 학생 로그인, 학생별 피드백 공개, 정규 수업 중 학생 사용 기능을 추가하면 심의 대상 여부를 다시 확인해야 한다는 안내를 표시한다.

7. 테스트 모듈
- 상담 기록 추가, 수정, 삭제, 후속 조치 완료가 정상 동작하는지 테스트한다.
- 잠금, 마스킹, 삭제, 내보내기, 접근 로그가 정상 동작하는지 테스트한다.
- 다른 사용자가 상담 기록에 접근할 수 없도록 권한 흐름을 테스트한다.
- 모바일 화면에서 상담 기록이 잘리지 않고 민감한 내용이 기본 노출되지 않는지 테스트한다.

[완료 기준]
- 교사는 학생별 상담 기록과 후속 조치를 안전하게 관리할 수 있다.
- 상담 기록은 교사만 볼 수 있고, 민감한 메모는 기본 보호된다.
- 기능별 모듈이 분리되어 저장 방식, 권한, 화면 구성을 나중에 쉽게 바꿀 수 있다.
- 모든 문구는 초보 교사도 이해하기 쉬운 한국어로 작성한다.`, fallbackPrompt);

  return completeState(demoState, {
    finalPrompt,
    referenceNotes: [
      "개인정보보호 고려할 점",
      "- 이 예시는 학생 이름, 번호, 상담 요약, 교사용 메모를 다루므로 개인정보와 민감한 생활지도 기록으로 관리해야 합니다.",
      "- 상담 기록은 최소한으로 작성하고, 수집 목적, 보관 기간, 접근 권한, 삭제 방법을 교사가 확인할 수 있어야 합니다.",
      "- 실제 학생 정보로 테스트하지 말고 가명 데이터를 사용해야 합니다.",
      "",
      "학습지원 소프트웨어 심의 관련 고려할 점",
      "- 교사가 혼자 사용하는 상담 기록용 행정·업무 도구는 보통 학교운영위원회 심의 대상에서 제외됩니다.",
      "- 정규 수업에서 학생과 함께 사용하는 기능, 학생 로그인, 학생별 피드백 공개 기능이 추가되면 심의 대상 여부를 다시 확인해야 합니다.",
      "- 심의 제외 여부와 별개로 개인정보 보호 조치는 반드시 준비해야 합니다."
    ].join("\n")
  });
}

function createNanoPrivacyDetailedDemoState() {
  settings = { ...settings, llmProvider: "openai", llmEndpoint: OPENAI_LLM_ENDPOINT, llmModelId: DEFAULT_OPENAI_MODEL_ID };
  const demoState = {
    ...createInitialState(),
    initialRequest: "학생 개인정보와 상담 기록, 수행평가 피드백을 관리하는 교사용 웹앱을 만들고 싶습니다.",
    activeStepIndex: steps.length,
    llmStatus: "ready",
    availableModels: [DEFAULT_OPENAI_MODEL_ID],
    messages: [
      { role: "assistant", text: welcomeMessage() },
      { role: "user", text: "학생 개인정보와 상담 기록, 수행평가 피드백을 관리하는 교사용 웹앱을 만들고 싶습니다." },
      { role: "assistant", text: "학생에게 보이는 정보와 교사용으로만 남길 정보를 나눠 확인할게요." },
      { role: "user", text: "학생은 자기 피드백과 다음 학습 과제만 볼 수 있고, 상담 메모와 세부 평가 기록은 교사만 볼 수 있어야 합니다." },
      { role: "assistant", text: "개인정보보호와 심의 준비를 참고 안내로 분리하고, 구현 계획은 AI 실행용 프롬프트에 넣어 정리했습니다." }
    ],
    conversationTurns: [
      { role: "user", text: "학생 개인정보와 상담 기록, 수행평가 피드백을 관리하는 교사용 웹앱을 만들고 싶습니다." },
      { role: "user", text: "수집 항목은 학생 이름, 학번, 반, 보호자 연락처, 상담 메모, 수행평가 점수, 오답 유형, 교사 피드백입니다." },
      { role: "user", text: "학생은 자기 피드백과 다음 학습 과제만 볼 수 있고, 상담 메모와 세부 평가 기록은 교사만 볼 수 있어야 합니다." },
      { role: "user", text: "학교 내부 검토 전에는 실제 학생 정보를 넣지 않고, 예시 데이터와 가명으로 테스트해야 합니다." },
      { role: "user", text: "개인정보보호와 학습지원 소프트웨어 심의 준비는 참고 안내에 정리하고, 프롬프트에는 이를 지키는 구현 계획만 넣어주세요." }
    ],
    answerMeta: {
      safety: { id: "직접", label: "학생 이름, 학번, 보호자 연락처, 상담 메모, 평가 기록 포함", risk: "sensitive" },
      externalService: { id: "직접", label: "학생 로그인, 피드백 확인, 교수학습평가 지원에 사용", risk: "learningSoftware" }
    }
  };
  const fallbackPrompt = buildFinalPrompt(demoState, { memoryItems: [] });
  const finalPrompt = ensureFinalPromptRequirements(`[교사용 요약]
- 만들 것: 학생 개인정보, 상담 기록, 수행평가 피드백을 관리하는 교사용 웹앱
- 사용 목적: 교사가 학생별 학습 상황을 확인하고, 필요한 피드백과 다음 학습 과제를 안전하게 제공
- 학생에게 보이는 정보: 자기 피드백, 공개된 수행평가 요약, 다음 학습 과제
- 교사용으로만 남길 정보: 상담 메모, 세부 평가 기록, 보호자 연락처, 오답 유형 분석, 접근 로그
- 중요한 준비: 최소 수집, 가명 테스트, 권한 분리, 삭제/내보내기, 접근 로그, 학교 내부 검토와 심의 준비

[AI 실행용 프롬프트]
너는 학교 현장에서 사용할 교사용 학습지원 웹앱을 설계하는 기획자이자 개발 설계자다. 아래 조건을 바탕으로 교사가 이해하기 쉽고 개발 AI가 바로 구현 계획을 세울 수 있는 요구사항 정의서와 구현 지시서를 한국어로 작성하라.

[상황]
- 대상: 초등 또는 중등 담임교사와 학생
- 목적: 학생별 상담 기록, 수행평가 피드백, 다음 학습 과제를 한곳에서 관리한다.
- 수집 가능 항목: 학생 이름, 학번, 반, 보호자 연락처, 상담 메모, 수행평가 점수, 오답 유형, 교사 피드백
- 학생 공개 범위: 학생은 자기 피드백, 공개된 수행평가 요약, 다음 학습 과제만 볼 수 있다.
- 교사 전용 범위: 상담 메모, 세부 평가 기록, 보호자 연락처, 오답 유형 분석, 접근 로그는 교사용으로만 둔다.
- 개발 전제: 실제 학생 정보 대신 예시 데이터와 가명 데이터를 사용해 먼저 설계하고 테스트한다.

[기능별 모듈]
다음 모듈을 분리해서 설계하라. 각 모듈에는 역할, 주요 기능, 입력 데이터, 출력 데이터, 예외 상황, 수정할 때 주의할 점을 포함한다.

1. 화면/UI 모듈
- 교사 대시보드: 학급 전체 현황, 최근 상담, 피드백 작성 필요 학생, 공개 대기 피드백을 보여준다.
- 학생 상세 화면: 학생 기본 정보, 수행평가 요약, 오답 유형, 공개된 피드백, 교사용 상담 메모를 탭으로 분리한다.
- 학생 화면: 자기 피드백, 다음 학습 과제, 공개된 평가 요약만 보여준다.
- 심의 준비 화면: 수집 항목, 이용 목적, 보관 기간, 권한 구조, 데이터 보관 위치를 확인하고 문서로 내보낸다.

2. 인증과 권한 모듈
- 역할: 교사, 학생, 관리자.
- 학생은 자기 데이터만 조회한다.
- 교사는 담당 학급 학생 데이터만 조회하고 수정한다.
- 관리자도 민감 상담 메모를 기본으로 볼 수 없게 하고, 필요 시 감사 로그를 남긴다.
- 서버 API에서 권한을 강제하고, 화면 숨김만으로 보안을 처리하지 않는다.

3. 데이터 모델 모듈
- Student: 내부 ID, 가명 표시명, 학년/반/번호, 최소 식별 정보.
- GuardianContact: 보호자 연락처는 별도 테이블로 분리하고 접근 권한을 제한한다.
- AssessmentRecord: 평가명, 점수 또는 성취 수준, 공개 여부, 수정 이력.
- ErrorPattern: 오답 유형, 관련 단원, 교사용 분석 메모.
- CounselingNote: 상담 날짜, 교사용 메모, 민감도, 열람 권한, 수정 이력.
- Feedback: 학생에게 공개할 피드백, 다음 학습 과제, 공개 상태, 공개 일시.
- AccessLog: 누가, 언제, 어떤 학생 정보에 접근했는지 기록한다.

4. 평가/피드백 모듈
- 교사는 수행평가 결과와 오답 유형을 입력한다.
- 학생에게 보일 내용과 교사용 내부 메모를 분리한다.
- 피드백은 저장 상태와 공개 상태를 나눈다.
- 공개 전 미리보기와 공개 취소 기능을 둔다.

5. 개인정보보호 구현 모듈
- 최소 수집 원칙을 적용하고 필수/선택 항목을 분리한다.
- 실제 학생 정보 없이 가명 데이터로 테스트할 수 있게 한다.
- 학생 목록에서는 이름 대신 내부 ID 또는 가명 표시를 선택할 수 있게 한다.
- 보호자 연락처, 상담 메모는 기본 마스킹한다.
- 삭제, 보관 기간 만료, 데이터 내보내기 기능을 제공한다.
- 접근 로그와 수정 이력을 남긴다.

6. 심의 대응 구현 모듈
- 교사가 다음 항목을 확인하고 내보낼 수 있게 한다: 수집 항목, 이용 목적, 보관 기간, 접근 권한, 삭제 방법, 보안 조치, 데이터 보관 위치, 외부 서비스 사용 여부.
- 학습지원 소프트웨어 검토에 필요한 화면 캡처용 요약 페이지를 만든다.
- 학교 내부 검토 전 실제 학생 정보를 외부 AI나 외부 서비스에 넣지 않도록 안내 문구를 표시한다.

7. 테스트 모듈
- 학생이 다른 학생 정보에 접근할 수 없는지 테스트한다.
- 교사가 담당 학급 밖 학생 정보를 볼 수 없는지 테스트한다.
- 공개 전 피드백이 학생 화면에 보이지 않는지 테스트한다.
- 상담 메모와 보호자 연락처가 기본 마스킹되는지 테스트한다.
- 삭제/내보내기/접근 로그/수정 이력이 정상 동작하는지 테스트한다.
- 모바일 화면에서 학생/교사 주요 화면이 깨지지 않는지 테스트한다.

[완료 기준]
- 교사는 학생별 평가, 오답 유형, 상담 메모, 피드백을 분리해 관리할 수 있다.
- 학생은 자기에게 공개된 피드백과 다음 학습 과제만 볼 수 있다.
- 개인정보보호와 심의 준비에 필요한 항목을 교사가 확인하고 문서로 내보낼 수 있다.
- 모든 결과는 한국어로 작성하고, 교사가 바로 읽고 수정할 수 있는 쉬운 표현을 사용한다.`, fallbackPrompt);

  return completeState(demoState, {
    finalPrompt,
    referenceNotes: buildReferenceNotes(demoState.answerMeta, demoState)
  });
}

function createE4bClassRulesDemoState() {
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function chatCompletionWithRetry(request) {
  const firstResult = await chatCompletion(request);
  if (firstResult.ok || firstResult.reason === "empty_content") return firstResult;

  await wait(800);
  const secondResult = await chatCompletion(request);
  return secondResult.ok ? { ...secondResult, retried: true } : secondResult;
}

function maxTokensForTask(task) {
  const isLocalE4b = settings.llmProvider === "local" && /e4b/i.test(settings.llmModelId || "");
  if (settings.llmProvider === "local" && task === "question") return 768;
  if (isLocalE4b) return task === "revision" ? 4096 : 1536;
  return task === "revision" ? 8192 : 4096;
}

function maxTokensForFinalSegment(segment) {
  if (segment === "ai_prompt") return 1536;
  return 900;
}

function shouldUseSegmentedFinalPrompt() {
  return settings.llmProvider === "local";
}

function isExplicitFinalRequest(text = "") {
  const normalized = String(text).replace(/\s+/g, " ").trim();
  if (!normalized) return false;
  return /최종|완성|만들어|정리|생성|작성/.test(normalized)
    || /여기까지만|여기까지|이 정도로|지금까지|현재까지/.test(normalized)
    || /(질문|물어).*(그만|중단|끝|하지 마|안 해|안할|안 할)/.test(normalized)
    || /(그만|중단|끝).*(질문|물어)/.test(normalized)
    || /추가 질문.*(없|말|그만|중단|끝)/.test(normalized);
}

function isLocalFinalRequest(text = "") {
  return shouldUseSegmentedFinalPrompt() && isExplicitFinalRequest(text);
}

function answeredQuestionCount(currentState = state) {
  return Array.isArray(currentState.conversationTurns)
    ? currentState.conversationTurns.filter((turn) => turn?.role === "user" && turn?.source !== "seed" && turn?.text).length
    : 0;
}

function shouldCompleteLocalFlow(text = "") {
  if (!shouldUseSegmentedFinalPrompt()) return false;
  const userTurnCount = state.conversationTurns.filter((turn) => turn.role === "user").length;
  return answeredQuestionCount() >= MAX_TOTAL_QUESTIONS || userTurnCount >= MAX_TOTAL_QUESTIONS + 1 || (hasEnoughAnswersForFinal() && isLocalFinalRequest(text));
}

function hasEnoughLocalStepsForFinal(currentState = state) {
  if (!shouldUseSegmentedFinalPrompt()) return true;
  const answeredAfterSeed = answeredQuestionCount(currentState);
  return answeredAfterSeed >= MIN_REQUIRED_QUESTIONS;
}

function hasEnoughAnswersForFinal(currentState = state) {
  return answeredQuestionCount(currentState) >= MIN_REQUIRED_QUESTIONS;
}

function hasReachedQuestionLimit(currentState = state) {
  return answeredQuestionCount(currentState) >= MAX_TOTAL_QUESTIONS;
}

function inferNextStepIndex(currentState = state) {
  const answeredAfterSeed = answeredQuestionCount(currentState);
  return Math.min(steps.length - 1, Math.max(0, answeredAfterSeed));
}

function fallbackQuestionForCurrentState(currentState = state) {
  const step = steps[inferNextStepIndex(currentState)] ?? steps[steps.length - 1];
  return {
    question: step.question,
    suggestedOptions: step.options.map((option) => ({ ...option, optional: true })),
    capturedFacts: currentState.intentProfile ?? {}
  };
}

function appendQuestionToCurrentFlow(currentState, question) {
  return appendAiQuestion(
    {
      ...currentState,
      activeStepIndex: inferNextStepIndex(currentState)
    },
    question
  );
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
  } else if (state.completed && state.finalPrompt) {
    await handleRevision(text);
    collapseMobileTopbarAfterInput();
  } else {
    state = recordConversationAnswer(state, text, null);
    persistDraftIfNeeded();
    render();
    collapseMobileTopbarAfterInput();
    if (isExplicitFinalRequest(text)) {
      await completeWithAvailableFinalPrompt({ allowIncomplete: true });
      return;
    }
    if (shouldCompleteLocalFlow(text)) {
      await completeWithSegmentedFinalPrompt();
      return;
    }
    await requestNextQuestion();
  }
}

async function handleOption(option) {
  if (state.isAwaitingAi || state.llmStatus !== "ready") return;
  state = recordConversationAnswer(state, option.label, option);
  persistDraftIfNeeded();
  render();
  collapseMobileTopbarAfterInput();
  if (isExplicitFinalRequest(option.label)) {
    await completeWithAvailableFinalPrompt({ allowIncomplete: true });
    return;
  }
  if (shouldCompleteLocalFlow(option.label)) {
    await completeWithSegmentedFinalPrompt();
    return;
  }
  await requestNextQuestion();
}

async function requestNextQuestion() {
  if (hasReachedQuestionLimit()) {
    if (shouldUseSegmentedFinalPrompt()) {
      await completeWithSegmentedFinalPrompt();
    } else {
      await completeWithFinalPrompt(buildFinalPrompt(state, { memoryItems: selectMemoryItems(memoryStore.items, settings) }), "");
    }
    return;
  }

  const generation = ++requestGeneration;
  state = setAwaitingAi(state, true);
  render();

  const selectedMemory = selectMemoryItems(memoryStore.items, settings);
  const controller = shouldUseSegmentedFinalPrompt() && typeof AbortController === "function" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 36000) : null;
  const result = await chatCompletionWithRetry({
    endpoint: settings.llmEndpoint,
    model: settings.llmModelId,
    messages: buildNextQuestionMessages({
      seed: state.initialRequest,
      turns: state.conversationTurns,
      memoryItems: selectedMemory,
      guideMode: settings.guideMode,
      finalPromptMode: shouldUseSegmentedFinalPrompt() ? "segmented" : "single"
    }),
    maxTokens: maxTokensForTask("question"),
    signal: controller?.signal
  });
  if (timeoutId) clearTimeout(timeoutId);

  if (generation !== requestGeneration) return;

  if (!result.ok) {
    if (shouldUseSegmentedFinalPrompt()) {
      state = appendQuestionToCurrentFlow(setAwaitingAi(state, false), fallbackQuestionForCurrentState());
      persistDraftIfNeeded();
      render();
      return;
    }
    state = appendAssistantMessage(setAwaitingAi(state, false), result.message || "AI 답변을 받지 못했습니다. 잠시 후 한 번 더 입력해주세요.");
    persistDraftIfNeeded();
    render();
    return;
  }

  const parsed = parsePlannerResponse(result.content);
  if (!parsed.ok && result.truncated) {
    if (hasEnoughAnswersForFinal() && shouldUseSegmentedFinalPrompt()) {
      await completeWithSegmentedFinalPrompt(selectedMemory);
    } else if (!hasEnoughAnswersForFinal()) {
      state = appendQuestionToCurrentFlow(setAwaitingAi(state, false), fallbackQuestionForCurrentState());
      persistDraftIfNeeded();
      render();
    } else {
      await completeWithFinalPrompt(buildFinalPrompt(state, { memoryItems: selectedMemory }), "");
    }
    return;
  }

  const value = parsed.ok ? parsed.value : parsed.fallback;

  if (value.kind === "final_prompt_ready") {
    if (!hasEnoughAnswersForFinal()) {
      state = appendQuestionToCurrentFlow(setAwaitingAi(state, false), fallbackQuestionForCurrentState());
      persistDraftIfNeeded();
      render();
    } else if (shouldUseSegmentedFinalPrompt()) {
      await completeWithSegmentedFinalPrompt(selectedMemory);
    } else {
      await completeWithFinalPrompt(value.finalPrompt, value.referenceNotes);
    }
    return;
  }

  if (value.kind === "final_prompt_signal") {
    if (hasEnoughAnswersForFinal()) {
      await completeWithSegmentedFinalPrompt(selectedMemory);
    } else {
      state = appendQuestionToCurrentFlow(setAwaitingAi(state, false), fallbackQuestionForCurrentState());
      persistDraftIfNeeded();
      render();
    }
    return;
  }

  state = appendQuestionToCurrentFlow(setAwaitingAi(state, false), {
    question: value.question,
    suggestedOptions: value.suggestedOptions?.length ? value.suggestedOptions : quickOptionsForIntent(value.capturedFacts),
    capturedFacts: value.capturedFacts
  });
  persistDraftIfNeeded();
  render();
}

async function generateFinalSegment(segment, selectedMemory, fallbackText = "") {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 26000) : null;
  const result = await chatCompletionWithRetry({
    endpoint: settings.llmEndpoint,
    model: settings.llmModelId,
    messages: buildSegmentedFinalPromptMessages({
      segment,
      seed: state.initialRequest,
      turns: state.conversationTurns,
      memoryItems: selectedMemory
    }),
    maxTokens: maxTokensForFinalSegment(segment),
    signal: controller?.signal
  });
  if (timeoutId) clearTimeout(timeoutId);

  return result.ok && result.content ? result.content.trim() : fallbackText;
}

async function completeWithAvailableFinalPrompt({ allowIncomplete = false } = {}) {
  const selectedMemory = selectMemoryItems(memoryStore.items, settings);
  if (shouldUseSegmentedFinalPrompt()) {
    await completeWithSegmentedFinalPrompt(selectedMemory, { allowIncomplete });
    return;
  }
  await completeWithFinalPrompt(buildFinalPrompt(state, { memoryItems: selectedMemory }), "");
}

async function completeWithSegmentedFinalPrompt(selectedMemory = selectMemoryItems(memoryStore.items, settings), { allowIncomplete = false } = {}) {
  if (!allowIncomplete && !hasEnoughLocalStepsForFinal()) {
    state = appendQuestionToCurrentFlow(setAwaitingAi(state, false), fallbackQuestionForCurrentState());
    persistDraftIfNeeded();
    render();
    return;
  }

  const fallbackPrompt = buildFinalPrompt(state, { memoryItems: selectedMemory });
  const fallbackSections = splitFinalPromptSections(fallbackPrompt);
  const requiredReferenceNotes = buildReferenceNotes(state.answerMeta, state);

  const teacherSummary = await generateFinalSegment("teacher_summary", selectedMemory, fallbackSections.teacherSummary);
  const aiPrompt = await generateFinalSegment("ai_prompt", selectedMemory, fallbackSections.aiPrompt);
  const referenceNotesFromModel = await generateFinalSegment("reference_notes", selectedMemory, "");
  const finalPrompt = ensureFinalPromptRequirements(`[교사용 요약]\n${teacherSummary.replace(/^\[교사용 요약\]\s*/m, "").trim()}\n\n[AI 실행용 프롬프트]\n${aiPrompt.replace(/^\[AI 실행용 프롬프트\]\s*/m, "").trim()}`, fallbackPrompt);
  const referenceNotes = referenceNotesFromModel
    ? `${requiredReferenceNotes}\n\nAI가 정리한 추가 참고:\n${referenceNotesFromModel}`.trim()
    : requiredReferenceNotes;

  state = completeState(setAwaitingAi(state, false), { finalPrompt, referenceNotes });
  render();
  saveCompletedState();
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

  const result = await chatCompletionWithRetry({
    endpoint: settings.llmEndpoint,
    model: settings.llmModelId,
    messages: buildRevisionMessages({ prompt: state.finalPrompt, revisionRequest: text, referenceNotes: state.referenceNotes }),
    maxTokens: maxTokensForTask("revision")
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
  ui.showToast(provider === "openai" ? "기본 모델을 5.4 nano로 바꿨습니다." : "기본 모델을 e4b로 바꿨습니다.");
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
