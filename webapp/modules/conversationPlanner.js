import { steps } from "./steps.js";
import {
  buildFooterPolicyPrompt,
  buildNaturalRegulationQuestionGuidance,
  buildRegulationPromptRequirements
} from "./regulationKnowledge.js";

const OPTION_IDS = ["A", "B", "C", "D"];

function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function summarizeTurns(turns = []) {
  return Array.isArray(turns)
    ? turns
        .map((turn) => `${turn.role === "assistant" ? "가이드" : "교사"}: ${safeText(turn.text)}`)
        .filter(Boolean)
        .join("\n")
    : "";
}

export function quickOptionsForIntent(intentProfile = {}) {
  const outputKind = safeText(intentProfile.outputKind).toLowerCase();
  let labels;

  if (/app|앱|program|프로그램|tool|도구/.test(outputKind)) {
    labels = ["웹앱 또는 웹사이트를 만들고 싶습니다.", "윈도우용 프로그램을 만들고 싶습니다.", "모바일 앱을 만들고 싶습니다.", "아직 구상 중입니다."];
  } else if (/document|문서|admin|행정/.test(outputKind)) {
    labels = ["안내문이 필요합니다.", "계획서가 필요합니다.", "회의록 정리가 필요합니다.", "공문 초안이 필요합니다."];
  } else if (/assessment|평가|rubric|루브릭/.test(outputKind)) {
    labels = ["평가 문항이 필요합니다.", "루브릭이 필요합니다.", "피드백 문장이 필요합니다.", "성취기준 정리가 필요합니다."];
  } else {
    labels = [steps[0].options[0].label, steps[0].options[1].label, steps[0].options[2].label, steps[0].options[3].label];
  }

  return labels.slice(0, 4).map((label, index) => ({ id: OPTION_IDS[index], label, optional: true }));
}

export function buildNextQuestionMessages({ seed = "", turns = [], memoryItems = [], guideMode = "friendly", finalPromptMode = "single", answers = {} } = {}) {
  const confirmed = steps.filter((step) => safeText(answers?.[step.key]));
  const missing = steps.filter((step) => !safeText(answers?.[step.key]));
  const coverageStatus = missing.length
    ? `확인된 항목 (${confirmed.length}/${steps.length}):\n${confirmed.map((step) => `- ${step.key}: ${safeText(answers[step.key])}`).join("\n") || "- 없음"}\n\n아직 비어 있는 항목 (${missing.length}개):\n${missing.map((step) => `- ${step.key}: ${step.shortTitle || step.title}`).join("\n")}\n\n다음 질문은 반드시 비어 있는 항목 중 하나를 채우는 질문이어야 한다. 이미 확인된 항목을 더 자세히 묻지 않는다.`
    : `10개 항목이 모두 확인되었다. 결과물이 크게 달라질 핵심 사항이 남아 있지 않다면 지금 ${finalPromptMode === "segmented" ? "final_prompt_signal" : "final_prompt_ready"}를 반환한다.`;
  const memory = memoryItems.map((item) => `- ${safeText(item?.text)}`).filter((line) => line !== "- ").join("\n");
  const transcript = summarizeTurns(turns) || "아직 후속 대화 없음";
  const isThorough = guideMode === "thorough";
  const useSegmentedFinalPrompt = finalPromptMode === "segmented";
  const regulationQuestionGuidance = buildNaturalRegulationQuestionGuidance();
  const regulationPromptRequirements = buildRegulationPromptRequirements();
  const checklist = steps.map((step, index) => `${index + 1}. ${step.key}: ${step.shortTitle || step.title}`).join("\n");
  const modeRules = isThorough
    ? `질문 방식: 꼼꼼 확인 모드.\n- 모호한 답변은 그냥 넘기지 않고 한 번 더 쉬운 말로 되묻는다.\n- 단, 말투는 코딩을 처음 접하는 선생님에게 부담 없게 부드럽게 유지한다.\n- 아래 10개 항목 중 아직 비어 있는 항목을 우선순위대로 하나씩 확인한다.\n- 10개 항목이 모두 채워지기 전에는 final_prompt를 반환하지 않는다.\n- 10개 항목이 모두 채워지면 바로 final_prompt를 반환한다. 추가 질문은 결과물이 크게 달라질 때만, 최대 2번까지만 한다.`
    : `질문 방식: 친절 모드.\n- 코딩을 처음 접하는 선생님이 부담 없이 답할 수 있게 부드럽게 묻는다.\n- 아래 10개 항목 중 꼭 필요한 것부터 확인하고, 모호한 부분은 쉬운 선택지로 돕는다.\n- 10개 항목이 모두 채워지기 전에는 final_prompt를 반환하지 않는다.\n- 10개 항목이 모두 채워지면 바로 final_prompt를 반환한다. 추가 질문은 결과물이 크게 달라질 때만, 최대 2번까지만 한다.`;
  const plainLanguageRules = `쉬운 말 규칙 (반드시 지킨다):
- 한 번에 한 가지만 묻는다. 질문은 두 문장을 넘기지 않고, 괄호 안에 여러 보기를 나열하지 않는다.
- 서버, DB, 데이터베이스, 백엔드, 프론트엔드, API, 인증, 식별 정보, 세션, 배포 같은 개발 용어를 질문에 쓰지 않는다. 대신 생활 언어로 바꿔 묻는다.
  - 데이터베이스가 필요한지 → "입력한 내용이 다음에 다시 열어도 남아 있어야 하나요?"
  - 서버(백엔드)가 필요한지 → "여러 사람이 각자 휴대폰이나 컴퓨터에서 접속해서 같은 내용을 봐야 하나요?"
  - 로그인이 필요한지 → "누가 썼는지 구분해야 하나요? 학생이 각자 자기 것만 보게 해야 하나요?"
  - 개인정보 → "학생 이름이나 번호처럼 누구인지 알 수 있는 정보를 적나요?"
- 선택지에는 예시를 넣어 고르기 쉽게 한다. 예: "네, 이름을 적습니다.", "아니요, 번호만 씁니다.", "아직 정하지 않았습니다."
- 앱이나 프로그램을 만드는 요청이면 저장 여부, 여러 사람 접속 여부, 로그인 여부, 개인정보 여부는 반드시 쉬운 말로 확인한다. 이 답이 최종 프롬프트의 기술 방향(저장 방식, 서버 필요 여부, 보안 조치)을 정한다.`;
  const factRules = `capturedFacts 작성 규칙:
- capturedFacts는 지금까지의 대화에서 확인된 항목만 담는다. 키는 아래 10개 항목의 영문 키를 그대로 쓴다.
${checklist}
- 값은 선생님 답변을 한 줄(60자 이내)의 쉬운 한국어로 요약한다. 확인되지 않은 항목은 넣지 않는다.
- 추가로 outputKind(app|material|document|assessment|unknown), needsStorage(none|local|server), needsLogin(true|false), hasPersonalData(true|false)도 확인되면 담는다.
- nextStepKey에는 이번 질문이 채우려는 항목의 영문 키를 넣는다.`;

  return [
    {
      role: "system",
      content: `너는 교사용 질문형 프롬프트 가이드다. 초보 선생님이 짧은 자연어 씨앗에서 시작해 만들고 싶은 앱, 프로그램, 수업 자료, 평가 자료, 학교 업무 자료를 생성할 수 있는 최종 프롬프트를 함께 완성하도록 돕는다.\n\n${modeRules}\n\n${plainLanguageRules}\n\n${factRules}\n\n${regulationQuestionGuidance}\n\n공통 규칙:\n- 교사용 맥락을 기본으로 하되, 교사가 일반 사용자처럼 앱/프로그램/자료를 만들고 싶어 할 수 있음을 허용한다.\n- 질문, 최종 프롬프트, 참고 안내는 모두 한국어로 작성한다. 사용자가 영어로 입력해도 한국어로 정리한다.\n- 한 번에 하나의 질문만 한다.\n- 선생님은 A/B/C/D 중 하나를 고르거나 직접 문장으로 답할 수 있다. 직접 답한 내용이 선택지보다 우선이다.\n- suggestedOptions는 모두 교사에게 말하는 존댓말 문장으로 쓴다. 예: "웹앱을 만들고 싶습니다.", "학생 정보는 포함하지 않습니다.", "아직 정하지 않았습니다."\n- suggestedOptions에 반말, 명사형 종결, "~함", "~없음", "~있음" 같은 표현을 쓰지 않는다.\n- 교사 판단 지점, 개인정보/민감정보, 학생의 외부 서비스 사용 여부를 필요할 때 쉬운 말로 확인한다.\n- 심의 관련 확인이 필요하면 교사 단독 행정·업무용인지, 정규 수업에서 학생과 함께 쓰는지, 학생 개인정보를 수집·처리하는지 구분해 묻는다.\n- 최종 프롬프트에는 교사가 이해하기 쉬운 짧은 요약과 AI가 실행할 상세 프롬프트를 분리한다.\n- 최종 프롬프트는 요즘처럼 AI에게 코딩을 시키는 상황을 전제로 쓴다. 저장 여부, 여러 사람 접속 여부, 로그인 여부에 맞춰 가장 단순한 기술 방향(예: 저장 없음 → 브라우저만으로 동작, 혼자 저장 → 브라우저 저장, 여러 사람 공유 → 서버와 데이터베이스)을 정해 주고, 비밀키를 코드에 넣지 않기, 권한 검사는 서버에서 하기, 입력값 검증, 백업, 최소 수집 같은 보안 기본을 구현 계획에 포함한다.\n- AI 실행용 프롬프트는 짧게 요약하지 말고, 개발자나 제작 AI가 바로 실행할 수 있는 요구사항 정의서 수준으로 상세하게 작성한다.\n- AI 실행용 프롬프트에는 사용자 역할, 핵심 기능, 화면 흐름, 기능별 모듈, 데이터 모델, 권한 설계, 개인정보보호를 지키기 위한 구현 계획, 심의 대응에 필요한 구현 계획, 테스트 기준, 완료 기준을 포함한다.\n- 개인정보보호와 학습지원 소프트웨어 심의 규정 설명은 참고 안내로 분리하고, AI 실행용 프롬프트에는 이를 준수하기 위한 화면, 권한, 저장, 삭제, 로그, 내보내기 기능 계획만 담는다.\n- 앱, 웹앱, 프로그램, 복합 자료를 만드는 최종 프롬프트에는 기능별 모듈화를 반드시 요구한다. 예: 화면/UI, 인증과 권한, 데이터 모델, 입력/업로드, 평가 기록, 피드백, 알림, 보안, 개인정보보호 구현, 심의 대응 자료 생성, 테스트.\n- 각 모듈에는 역할, 주요 기능, 입력 데이터, 출력 데이터, 수정할 때 주의할 점을 포함하게 한다.\n${regulationPromptRequirements}\n${useSegmentedFinalPrompt ? "- 충분히 모였으면 final_prompt_signal을 반환한다. 이때 최종 프롬프트 본문을 작성하지 않는다." : "- 충분히 모였으면 final_prompt_ready를 반환한다."}\n- 반드시 JSON만 반환한다.`
    },
    {
      role: "user",
      content: `초기 씨앗: ${safeText(seed) || "없음"}\n\n누적 대화:\n${transcript}\n\n${coverageStatus}\n\n이전 작업 참고(있으면 참고만):\n${memory || "없음"}\n\n반환 JSON 형식 중 하나:\n{"kind":"question","question":"다음 한 가지 질문","rationale":"왜 이 질문이 필요한지","nextStepKey":"확인하려는 항목 키","suggestedOptions":["선택지1","선택지2","아직 정하지 않았습니다."],"capturedFacts":{"output":"확인된 값","useScene":"확인된 값","outputKind":"app|material|document|assessment|unknown","needsStorage":"none|local|server","needsLogin":false,"hasPersonalData":false}}\n또는\n${useSegmentedFinalPrompt ? `{"kind":"final_prompt_signal","rationale":"충분한 이유"}` : `{"kind":"final_prompt_ready","finalPrompt":"복사 가능한 최종 프롬프트","referenceNotes":"분리된 참고 안내","rationale":"충분한 이유"}`}`
    }
  ];
}

export function buildSegmentedFinalPromptMessages({ segment = "ai_prompt", seed = "", turns = [], memoryItems = [] } = {}) {
  const transcript = summarizeTurns(turns) || "후속 대화 없음";
  const memory = memoryItems.map((item) => `- ${safeText(item?.text)}`).filter((line) => line !== "- ").join("\n");
  const regulationPromptRequirements = buildRegulationPromptRequirements();
  const footerPolicyPrompt = buildFooterPolicyPrompt();
  const segmentRules = {
    teacher_summary: "교사용 요약 부분만 작성한다. 초보 교사가 빠르게 이해할 수 있게 만들 것, 사용 장면, 핵심 확인 사항, 교사가 직접 판단할 점을 짧고 쉬운 한국어로 정리한다.",
    ai_prompt: `AI 실행용 프롬프트 부분만 작성한다. 첫 줄은 [역할]로 시작하고, 개발자나 제작 AI가 바로 실행할 수 있도록 요구사항 정의서 수준으로 상세하게 작성한다. 앱이나 프로그램이면 대화에서 확인한 저장 여부, 여러 사람 접속 여부, 로그인 여부에 맞춰 [기술 방향과 보안 기본] 섹션을 넣는다. 저장이 필요 없으면 브라우저만으로 동작하게, 혼자만 쓰면 브라우저 저장으로, 여러 사람이 함께 쓰면 서버와 데이터베이스를 쓰되 비밀키는 코드에 넣지 않고 설정 파일로 분리하고 권한 검사는 서버에서 하며 입력값 검증, 백업, 최소 수집을 지시한다. 사용자 역할, 핵심 기능, 화면 흐름, 기능별 모듈, 데이터 모델, 권한 설계, 개인정보보호를 지키기 위한 구현 계획, 심의 대응에 필요한 구현 계획, 테스트 기준, 완료 기준을 포함한다. 심의 대응 구현 계획에는 사용 목적이 교사 단독 행정·업무용인지, 정규 수업에서 학생과 함께 쓰는지, 학생 개인정보를 수집·처리하는지 확인하는 화면이나 체크리스트를 포함한다. 기능별 모듈은 역할, 주요 기능, 입력 데이터, 출력 데이터, 예외 상황, 수정할 때 주의할 점을 나누어 쓴다.\n${regulationPromptRequirements}\n${footerPolicyPrompt}`,
    reference_notes: "참고 안내 부분만 작성한다. 만들려는 앱이나 서비스에서 개인정보보호를 위해 교사가 확인할 점과 학습지원 소프트웨어 심의 준비를 위해 고려할 점만 간결한 체크리스트로 정리한다. 특히 교사 단독 행정·업무·수업 준비용 도구는 심의 제외, 정규 수업에서 학생과 함께 쓰며 개인정보를 수집·처리하는 도구는 심의 필요, 정규 수업용이라도 개인정보 수집이 전혀 없는 단순 도구는 심의 제외 가능이라는 판단 흐름을 포함한다. 규정 전체를 길게 설명하지 않는다."
  };
  const selectedRule = segmentRules[segment] || segmentRules.ai_prompt;

  return [
    {
      role: "system",
      content: `너는 교사용 생성 프롬프트 설계자다. 모든 내용은 한국어로 작성한다. 요청받은 한 부분만 작성하고, 다른 부분의 제목이나 설명은 섞지 않는다. ${selectedRule}`
    },
    {
      role: "user",
      content: `초기 요청: ${safeText(seed)}\n\n누적 대화:\n${transcript}\n\n이전 작업 참고:\n${memory || "없음"}\n\n위 내용을 바탕으로 ${selectedRule}`
    }
  ];
}

export function buildFinalPromptMessages({ seed = "", turns = [], memoryItems = [] } = {}) {
  const transcript = summarizeTurns(turns) || "후속 대화 없음";
  const memory = memoryItems.map((item) => `- ${safeText(item?.text)}`).filter((line) => line !== "- ").join("\n");
  const regulationPromptRequirements = buildRegulationPromptRequirements();
  const footerPolicyPrompt = buildFooterPolicyPrompt();

  return [
    {
      role: "system",
      content: "너는 교사용 생성 프롬프트 설계자다. 최종 프롬프트와 참고 안내를 분리한다. 교사용 요약은 짧고 쉬워야 하지만, AI 실행용 프롬프트는 개발자나 제작 AI가 바로 실행할 수 있는 요구사항 정의서 수준으로 상세해야 한다. 교사 판단 지점과 안전 확인을 보존한다. 모든 내용은 한국어로 작성한다. 앱, 웹앱, 프로그램, 복합 자료는 기능별 모듈로 나누어 수정과 보완이 쉽도록 설계하게 한다."
    },
    {
      role: "user",
      content: `초기 요청: ${safeText(seed)}\n\n누적 대화:\n${transcript}\n\n이전 작업 참고:\n${memory || "없음"}\n\n복사 가능한 최종 프롬프트를 만들어라. 반드시 [교사용 요약]과 [AI 실행용 프롬프트]를 분리하라. 교사용 요약은 교사가 빠르게 이해할 수 있게 짧게 정리하고, AI 실행용 프롬프트는 실제 제작 AI가 바로 작업할 수 있도록 상세하게 작성하라. 사용자가 직접 요청하지 않았다면 전문 형식 이름을 넣지 말고, 결과물이 어떤 모습이면 좋은지 쉬운 말로 정리하라. 참고 안내가 필요하면 별도 섹션으로 분리하라. 참고 안내에는 교사 단독 행정·업무·수업 준비용 도구는 심의 제외, 정규 수업에서 학생과 함께 쓰며 개인정보를 수집·처리하는 도구는 심의 필요, 개인정보 수집이 전혀 없는 단순 도구는 심의 제외 가능이라는 판단 흐름을 짧게 포함하라.\n\nAI 실행용 프롬프트에는 다음을 구체적으로 포함하라: 사용자 역할, 핵심 기능, 화면 흐름, 기능별 모듈, 데이터 모델, 권한 설계, 개인정보보호를 지키기 위한 구현 계획, 심의 대응에 필요한 구현 계획, 테스트 기준, 완료 기준. 개인정보보호와 학습지원 소프트웨어 심의 규정 자체의 설명은 참고 안내로 분리하고, AI 실행용 프롬프트에는 이를 준수하기 위한 화면, 권한, 저장, 삭제, 로그, 내보내기 기능 계획만 담아라. 심의 대응 구현 계획에는 사용 목적이 교사 단독 행정·업무용인지, 정규 수업에서 학생과 함께 쓰는지, 학생 개인정보를 수집·처리하는지 확인하는 체크리스트 또는 설정 화면을 포함하게 하라.\n\n앱, 웹앱, 프로그램, 복합 자료라면 기능별로 모듈화하라고 명시하라. 모듈 예시는 화면/UI, 인증과 권한, 데이터 모델, 입력/업로드, 평가 기록, 피드백, 알림, 보안, 개인정보보호 구현, 심의 대응 자료 생성, 테스트이다. 각 모듈에는 역할, 주요 기능, 입력 데이터, 출력 데이터, 예외 상황, 수정할 때 주의할 점을 포함하게 하라.\n\n${regulationPromptRequirements}\n\n${footerPolicyPrompt}`
    }
  ];
}

function optionObjects(values = []) {
  return values
    .map((value) => safeText(value))
    .filter(Boolean)
    .slice(0, 4)
    .map((label, index) => ({ id: OPTION_IDS[index], label: ensurePoliteOptionLabel(label), optional: true }));
}

function ensurePoliteOptionLabel(label = "") {
  const text = safeText(label);
  if (!text) return "";
  if (/[.!?。！？]$/.test(text) && /(요|니다|습니다|입니다|까요|주세요)[.!?。！？]?$/.test(text)) return text;
  if (/(요|니다|습니다|입니다|까요|주세요)$/.test(text)) return `${text}.`;

  const replacements = [
    [/할 수 있음$/, "할 수 있습니다."],
    [/갈 수 있음$/, "갈 수 있습니다."],
    [/수 있음$/, "수 있습니다."],
    [/하지 않음$/, "하지 않습니다."],
    [/들어가지 않음$/, "들어가지 않습니다."],
    [/없음$/, "없습니다."],
    [/있음$/, "있습니다."],
    [/해야 함$/, "해야 합니다."],
    [/되어야 함$/, "되어야 합니다."],
    [/없어야 함$/, "없어야 합니다."],
    [/이어야 함$/, "이어야 합니다."],
    [/사용$/, "사용합니다."],
    [/활용$/, "활용합니다."],
    [/로그인$/, "로그인합니다."],
    [/제출$/, "제출합니다."],
    [/정리$/, "정리합니다."],
    [/확인$/, "확인합니다."]
  ];

  for (const [pattern, replacement] of replacements) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }

  return `${text}입니다.`;
}

function extractJsonText(text) {
  const trimmed = safeText(text);
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

function cleanJsonishString(value = "") {
  return safeText(value)
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\")
    .trim();
}

function recoverMalformedFinalPrompt(text = "") {
  if (!/"kind"\s*:\s*"final_prompt_ready"/.test(text)) return null;

  const finalMatch =
    text.match(/"finalPrompt"\s*:\s*"([\s\S]*?)"\s*,\s*"referenceNotes"\s*:/) ||
    text.match(/"finalPrompt"\s*:\s*"([\s\S]*?)"\s*,\s*"rationale"\s*:/) ||
    text.match(/"finalPrompt"\s*:\s*"([\s\S]*?)"\s*}/);
  const referenceMatch =
    text.match(/"referenceNotes"\s*:\s*"([\s\S]*?)"\s*,\s*"rationale"\s*:/) ||
    text.match(/"referenceNotes"\s*:\s*"([\s\S]*?)"\s*}/);
  const finalPrompt = cleanJsonishString(finalMatch?.[1]);

  if (!finalPrompt) return null;

  return {
    kind: "final_prompt_ready",
    finalPrompt,
    referenceNotes: cleanJsonishString(referenceMatch?.[1]),
    rationale: "모델이 엄격한 JSON 대신 복구 가능한 최종 프롬프트 형식으로 응답했습니다."
  };
}

export function parsePlannerResponse(content = "") {
  const text = safeText(content);
  const jsonText = extractJsonText(text);
  if (!text) {
    return {
      ok: false,
      reason: "empty",
      fallback: { kind: "question", question: "응답이 비어 있습니다. 다시 한 번 어떤 자료나 앱을 만들고 싶은지 적어주세요.", suggestedOptions: [] }
    };
  }

  try {
    const parsed = JSON.parse(jsonText);
    if (parsed?.kind === "question" && safeText(parsed.question)) {
      const outputKind = safeText(parsed?.capturedFacts?.outputKind) || "unknown";
      const suggestedOptions = optionObjects(parsed.suggestedOptions);
      const nextStepKey = safeText(parsed.nextStepKey);
      return {
        ok: true,
        value: {
          kind: "question",
          question: safeText(parsed.question),
          rationale: safeText(parsed.rationale),
          stepKey: steps.some((step) => step.key === nextStepKey) ? nextStepKey : "",
          suggestedOptions: suggestedOptions.length ? suggestedOptions : quickOptionsForIntent({ outputKind }),
          capturedFacts: parsed.capturedFacts && typeof parsed.capturedFacts === "object" ? parsed.capturedFacts : { outputKind }
        }
      };
    }

    if (parsed?.kind === "final_prompt_ready" && safeText(parsed.finalPrompt)) {
      return {
        ok: true,
        value: {
          kind: "final_prompt_ready",
          finalPrompt: safeText(parsed.finalPrompt),
          referenceNotes: safeText(parsed.referenceNotes),
          rationale: safeText(parsed.rationale)
        }
      };
    }

    if (parsed?.kind === "final_prompt_signal") {
      return {
        ok: true,
        value: {
          kind: "final_prompt_signal",
          rationale: safeText(parsed.rationale)
        }
      };
    }

    throw new Error("missing required fields");
  } catch {
    const recoveredFinalPrompt = recoverMalformedFinalPrompt(jsonText);
    if (recoveredFinalPrompt) {
      return {
        ok: true,
        value: recoveredFinalPrompt
      };
    }

    return {
      ok: false,
      reason: "invalid_json",
      fallback: {
        kind: "question",
        question: text.length > 240 ? `${text.slice(0, 240)}…` : text,
        rationale: "모델이 JSON 대신 일반 텍스트를 반환했습니다.",
        suggestedOptions: []
      }
    };
  }
}
