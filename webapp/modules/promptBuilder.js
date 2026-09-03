import {
  buildFooterPolicyPrompt,
  buildRegulationPromptRequirements
} from "./regulationKnowledge.js";

const NOT_CONFIRMED = "아직 확인하지 않음";

const DEFAULTS = {
  initialRequest: "사용자가 입력한 요청",
  output: "필요한 산출물",
  useScene: NOT_CONFIRMED,
  context: NOT_CONFIRMED,
  goal: "교사의 목적에 맞는 결과물을 만든다.",
  teacherJudgment: "교사가 직접 판단해야 하는 핵심 선택",
  sourceMaterial: "사용자가 제공하는 자료",
  safety: "개인정보 포함 여부 확인 필요",
  externalService: "저장 방식과 접속 방식 확인 필요",
  format: "사용자가 원하는 결과물 모습",
  quality: "현장에서 바로 활용할 수 있어야 한다."
};

function inferTechDirection(session = {}) {
  const answerMeta = session.answerMeta ?? {};
  const profile = session.intentProfile ?? {};
  const text = collectText(session);
  const optionTech = answerMeta.externalService?.tech;
  const needsLogin = profile.needsLogin === true || optionTech === "server-login" || /로그인|각자 자기|제출/.test(text);
  let storage = typeof profile.needsStorage === "string" ? profile.needsStorage : "";
  if (!storage) {
    if (optionTech === "none") storage = "none";
    else if (optionTech === "local") storage = "local";
    else if (optionTech === "server" || optionTech === "server-login") storage = "server";
    else if (/여러 사람|함께 저장|같이 보|인터넷으로 접속|학생이 직접|제출/.test(text)) storage = "server";
    else if (/저장하지 않|화면에서만|임시로/.test(text)) storage = "none";
    else if (/저장/.test(text)) storage = "local";
  }
  const isApp = /앱|웹앱|프로그램|사이트|도구/.test(`${session.initialRequest ?? ""} ${session.answers?.output ?? ""}`) || /app/.test(String(profile.outputKind ?? ""));
  return { storage, needsLogin, isApp };
}

function collectText(session = {}) {
  const turns = Array.isArray(session.conversationTurns) ? session.conversationTurns.map((turn) => (typeof turn?.text === "string" ? turn.text : "")) : [];
  return [session.initialRequest ?? "", ...Object.values(session.answers ?? {}), ...turns].join("\n");
}

export function buildTechDirectionSection(session = {}) {
  const { storage, needsLogin, isApp } = inferTechDirection(session);
  if (!isApp) return "";

  const lines = ["[기술 방향과 보안 기본]", "- 이 프롬프트는 AI에게 코딩을 시키는 상황을 전제로 한다. 아래 방향을 따르되, 더 단순한 방법이 있으면 이유와 함께 제안한다."];
  if (storage === "none") {
    lines.push("- 저장이 필요 없으므로 서버나 데이터베이스 없이 브라우저에서만 동작하는 단일 HTML 웹앱으로 만든다. 새로고침하면 내용이 사라진다는 점을 화면에 안내한다.");
  } else if (storage === "local") {
    lines.push("- 혼자 쓰고 내 컴퓨터에만 남으면 되므로 서버 없이 브라우저 저장(localStorage 또는 IndexedDB)을 사용한다. 내보내기/가져오기(JSON 파일) 기능을 넣어 백업할 수 있게 한다.");
    lines.push("- 학생 정보가 들어간다면 브라우저에 평문으로 오래 남지 않도록 삭제 기능과 안내 문구를 넣는다.");
  } else if (storage === "server") {
    lines.push("- 여러 사람이 접속해 같은 내용을 봐야 하므로 서버와 데이터베이스가 필요하다. 처음 만드는 사람도 다룰 수 있게 관리형 서비스(예: Supabase, Firebase 같은 무료 시작 가능 서비스) 중 하나를 골라 이유와 함께 제안한다.");
    lines.push("- 비밀키(API 키, 데이터베이스 비밀번호)는 코드에 직접 쓰지 않고 .env 같은 설정 파일이나 배포 환경 변수에 두며, 공개 저장소에 올리지 않도록 .gitignore에 포함한다.");
    lines.push("- 누가 무엇을 볼 수 있는지 권한 검사는 화면 숨김이 아니라 서버(또는 데이터베이스 규칙)에서 강제한다.");
    lines.push("- 사용자가 입력한 값은 서버에서 다시 검증하고, HTTPS로만 접속하게 한다.");
    lines.push("- 데이터 백업 방법, 삭제 방법, 접근 기록(누가 언제 봤는지)을 구현 계획에 포함한다.");
  } else {
    lines.push("- 저장 방식이 아직 확정되지 않았다. 저장 필요 없음 / 내 컴퓨터에만 저장 / 여러 사람이 함께 사용 중 어느 쪽인지 먼저 확인 질문을 하고, 확인 전에는 가장 단순한 방식(브라우저 저장)으로 초안을 만든다.");
  }
  if (needsLogin) {
    lines.push("- 로그인이 필요하므로 직접 비밀번호 저장 로직을 만들지 말고 검증된 로그인 서비스(관리형 서비스의 로그인 기능)를 쓴다. 학생은 자기 것만 보게 하고, 교사와 학생 역할을 나눈다.");
  } else if (storage === "server") {
    lines.push("- 로그인 없이 쓰는 경우에도 링크나 코드를 아는 사람만 들어올 수 있게 하고, 교사용 화면은 별도 비밀번호나 로그인으로 보호한다.");
  }
  lines.push("- 개인정보는 최소한만 받고, 이름 대신 번호나 가명을 쓸 수 있는 선택지를 둔다. 테스트는 가짜 데이터로 한다.");
  lines.push("- 외부 라이브러리는 꼭 필요한 것만 쓰고, 처음 만드는 사람이 읽을 수 있게 파일 구조와 실행 방법을 README에 적는다.");
  return lines.join("\n");
}

function valueOrDefault(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function formatLine(label, value) {
  return `- ${label}: ${value}`;
}

function findAiPromptHeading(prompt) {
  const heading = "[AI 실행용 프롬프트]";
  const index = prompt.indexOf(heading);
  if (index !== -1) return { index, length: heading.length };

  const flexibleMatch = prompt.match(/\n(?:#+\s*)?(?:\d+\)?\.?\s*)?AI\s*실행\s*(?:용\s*)?(?:프롬프트|지시)/);
  if (!flexibleMatch || typeof flexibleMatch.index !== "number") return null;

  return {
    index: flexibleMatch.index + 1,
    length: flexibleMatch[0].trimStart().length
  };
}

function insertAfterAiPromptHeading(prompt, section) {
  const heading = "[AI 실행용 프롬프트]";
  const match = findAiPromptHeading(prompt);
  if (!match) return `${prompt.trim()}\n\n${heading}\n\n${section}`.trim();

  const insertAt = match.index + match.length;
  return `${prompt.slice(0, insertAt).trimEnd()}\n\n${section}\n\n${prompt.slice(insertAt).trimStart()}`.trim();
}

function appendToAiPrompt(prompt, section) {
  const heading = "[AI 실행용 프롬프트]";
  const match = findAiPromptHeading(prompt);
  if (!match) return `${prompt.trim()}\n\n${heading}\n\n${section}`.trim();

  const missingInfoIndex = prompt.indexOf("[정보가 부족할 때]", match.index);
  if (missingInfoIndex === -1) return `${prompt.trim()}\n\n${section}`.trim();
  return `${prompt.slice(0, missingInfoIndex).trimEnd()}\n\n${section}\n\n${prompt.slice(missingInfoIndex).trimStart()}`.trim();
}

function hasTeacherSummary(text = "") {
  return text.includes("[교사용 요약]") || /교사\s*요약|요구사항\s*정리/.test(text.slice(0, 1200));
}

function hasDetailedExecutionGuide(text = "") {
  return /상세\s*작성\s*조건|요구사항\s*정의서\s*수준|테스트\s*기준,\s*완료\s*기준/.test(text);
}

function firstMeaningfulLines(text = "", limit = 3) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, "").trim())
    .filter((line) => line && !/^\[.+\]$/.test(line) && line.length > 8)
    .slice(0, limit);
}

function fallbackTeacherSummaryFromPrompt(text = "") {
  const lines = firstMeaningfulLines(text, 3);
  const confirmed = lines.length
    ? lines.map((line) => `  - ${line}`).join("\n")
    : "  - AI 실행용 프롬프트에 정리된 요구사항을 기준으로 확인합니다.";

  return `[교사용 요약]
- 만들 것: AI 실행용 프롬프트에 정리된 앱, 자료, 프로그램 또는 문서
- 확인한 핵심 내용:
${confirmed}
- 교사가 특히 확인할 점: 실제 수업 맥락에 맞는지, 학생 개인정보나 평가 기록이 포함되는지, 외부 서비스 사용과 학교 내부 검토가 필요한지 확인합니다.`;
}

function detailedExecutionGuideSection() {
  const regulationPromptRequirements = buildRegulationPromptRequirements();
  return `[상세 작성 조건]
- AI 실행용 프롬프트는 짧은 요약이 아니라, 개발자나 제작 AI가 바로 실행할 수 있는 요구사항 정의서 수준으로 작성한다.
- 반드시 다음 항목을 구체적으로 포함한다: 사용자 역할, 핵심 기능, 화면 흐름, 기능별 모듈, 데이터 모델, 권한 설계, 개인정보보호를 지키기 위한 구현 계획, 심의 대응에 필요한 구현 계획, 테스트 기준, 완료 기준.
- 화면 흐름은 교사, 학생, 관리자처럼 사용자가 다르면 역할별로 나누어 설명한다.
- 데이터 모델은 실제 학생 개인정보 대신 예시 필드명을 사용하고, 수집 목적, 보관 범위, 접근 권한, 삭제 또는 내보내기 기준을 함께 적는다.
- 개인정보보호와 학습지원 소프트웨어 심의 규정 자체의 설명은 참고 안내로 분리하고, 여기에는 그 기준을 지키기 위한 화면, 권한, 저장, 삭제, 로그, 내보내기 기능 계획만 적는다.
- 심의 대응 구현 계획에는 사용 목적이 교사 단독 행정·업무용인지, 정규 수업에서 학생과 함께 쓰는지, 학생 개인정보를 수집·처리하는지 확인하는 체크리스트나 설정 화면을 포함한다.
- 기능별 모듈은 서로 독립적으로 수정할 수 있게 역할, 주요 기능, 입력 데이터, 출력 데이터, 예외 상황, 수정 시 주의할 점을 적는다.
- 구현 지시는 막연한 표현보다 체크리스트, 표, 단계별 작업 목록처럼 바로 옮겨 쓸 수 있는 형태를 우선한다.
${regulationPromptRequirements}`;
}

export function buildMemoryContext(memoryItems = []) {
  const usableItems = memoryItems
    .map((item) => item?.text)
    .filter((text) => typeof text === "string" && text.trim())
    .map((text) => text.trim())
    .slice(0, 5);

  if (!usableItems.length) return "";

  return `[이전 작업 참고]
아래 내용은 이 브라우저에 저장된 이전 작업 요약이다. 확정 사실이 아니라 이전 작업에서 나온 참고 경향으로만 다뤄라. 현재 요청과 맞지 않으면 따르지 말고, 필요한 경우 사용자에게 확인 질문을 하라.
${usableItems.map((text) => `- ${text}`).join("\n")}`;
}

export function buildPrivacyCondition(answerMeta = {}) {
  const conditions = [];
  const safety = answerMeta.safety ?? {};
  const externalService = answerMeta.externalService ?? {};
  const hasSensitiveRisk = ["privacy", "sensitive"].includes(safety.risk) || safety.id === "D";
  const hasLearningSoftwareRisk = ["learningContent", "learningSoftware"].includes(externalService.risk) || externalService.id === "C";

  if (hasSensitiveRisk) {
    conditions.push("개인정보보호 구현 계획에는 내부 ID 또는 가명 사용, 최소 수집, 역할별 접근 권한, 마스킹, 삭제와 내보내기, 접근 기록 확인 기능을 포함하라.");
  }

  if (hasLearningSoftwareRisk) {
    conditions.push("심의 대응 구현 계획에는 사용 목적 분류(교사 단독 행정·업무용인지, 정규 수업에서 학생과 함께 쓰는지), 개인정보 수집·처리 여부, 수집 항목, 이용 목적, 보관 기간, 보안 조치, 접근 로그, 데이터 보관 위치를 교사가 확인하거나 문서로 내보낼 수 있는 기능을 포함하라.");
  }

  return conditions;
}

function summarizeForTeacher(session = {}) {
  const answers = session.answers ?? {};
  const initialRequest = valueOrDefault(session.initialRequest, DEFAULTS.initialRequest);
  const output = valueOrDefault(answers.output, initialRequest || DEFAULTS.output);
  const useScene = valueOrDefault(answers.useScene, NOT_CONFIRMED);
  const context = valueOrDefault(answers.context, NOT_CONFIRMED);
  const goal = valueOrDefault(answers.goal, NOT_CONFIRMED);
  const teacherJudgment = valueOrDefault(answers.teacherJudgment, NOT_CONFIRMED);
  const safety = valueOrDefault(answers.safety, NOT_CONFIRMED);
  const externalService = valueOrDefault(answers.externalService, NOT_CONFIRMED);
  const { storage, needsLogin, isApp } = inferTechDirection(session);
  const storageLabel = storage === "none"
    ? "저장 없이 화면에서만 사용"
    : storage === "local"
      ? "내 컴퓨터(브라우저)에만 저장"
      : storage === "server"
        ? `여러 사람이 접속해 함께 저장${needsLogin ? ", 로그인 필요" : ""}`
        : NOT_CONFIRMED;
  const lines = [
    "[교사용 요약]",
    `- 만들 것: ${output}`,
    `- 사용 장면: ${useScene}`,
    `- 대상과 맥락: ${context}`,
    `- 목표: ${goal}`,
    `- 선생님이 직접 정할 것: ${teacherJudgment}`,
    `- 개인정보: ${safety}`,
    `- 저장과 접속: ${externalService}`
  ];
  if (isApp) lines.push(`- 기술 방향: ${storageLabel}`);
  const capturedCount = Object.values(answers).filter((value) => typeof value === "string" && value.trim()).length;
  const turns = userTurnTexts(session).slice(1, 5);
  if (capturedCount < 3 && turns.length) {
    lines.push("- 대화에서 확인한 내용:");
    turns.forEach((text) => lines.push(`  - ${text}`));
  }
  lines.push("- 교사가 특히 확인할 점: 실제 학생 정보 사용 여부, 학생이 직접 로그인하는지, 외부 서비스가 학생 데이터를 다루는지, 학교 내부 검토가 필요한지");
  return lines.join("\n");
}

function userTurnTexts(session = {}) {
  return Array.isArray(session.conversationTurns)
    ? session.conversationTurns
        .filter((turn) => turn?.role === "user" && typeof turn.text === "string" && turn.text.trim())
        .map((turn) => turn.text.trim())
    : [];
}

function findTurnText(turns = [], pattern) {
  return turns.find((text) => pattern.test(text)) || "";
}

export function buildFinalPrompt(session = {}, options = {}) {
  const answers = session.answers ?? {};
  const answerMeta = session.answerMeta ?? {};
  const memoryContext = buildMemoryContext(options.memoryItems ?? []);
  const privacyConditions = buildPrivacyCondition(answerMeta);
  const turns = userTurnTexts(session);
  const detailTurns = turns.slice(1);

  const initialRequest = valueOrDefault(session.initialRequest, DEFAULTS.initialRequest);
  const output = valueOrDefault(answers.output, initialRequest || DEFAULTS.output);
  const useScene = valueOrDefault(answers.useScene, findTurnText(detailTurns, /교사|학생|로그인|평가|수업|피드백/) || DEFAULTS.useScene);
  const context = valueOrDefault(answers.context, findTurnText(detailTurns, /초등|중학|고등|학년|수행평가|보충|학습|수업/) || DEFAULTS.context);
  const goal = valueOrDefault(answers.goal, findTurnText(detailTurns, /목표|안내|관리|정리|제공|확인/) || DEFAULTS.goal);
  const teacherJudgment = valueOrDefault(answers.teacherJudgment, findTurnText(detailTurns, /교사.*정|직접|공개|보관|권한|범위/) || DEFAULTS.teacherJudgment);
  const sourceMaterial = valueOrDefault(answers.sourceMaterial, findTurnText(detailTurns, /자료|명단|기준|목록|예시|가명/) || DEFAULTS.sourceMaterial);
  const safety = valueOrDefault(answers.safety, findTurnText(detailTurns, /개인정보|학생 이름|학번|상담|가명|실제 학생/) || findTurnText(turns, /개인정보|학생 이름|학번|상담|가명|실제 학생/) || DEFAULTS.safety);
  const externalService = valueOrDefault(answers.externalService, findTurnText(detailTurns, /외부|업체|서버|AI|로그인|심의|학교 내부/) || DEFAULTS.externalService);
  const format = valueOrDefault(answers.format, findTurnText(detailTurns, /교사용 요약|AI 실행용|프롬프트|분리|화면|모듈/) || DEFAULTS.format);
  const quality = valueOrDefault(answers.quality, findTurnText(detailTurns, /완성 기준|초보|개발 AI|바로|구체적|수준/) || DEFAULTS.quality);

  const techDirection = buildTechDirectionSection(session);
  const sections = [
    memoryContext,
    summarizeForTeacher(session),
    `[AI 실행용 프롬프트]`,
    `[역할]
너는 교사의 수업 준비와 행정업무를 돕는 전문적인 AI 협력자이다. 교사가 판단해야 할 부분은 대신 결정하지 않고, 실행 가능한 초안과 점검 기준을 함께 제안한다.`,
    `[언어]
- 모든 결과는 한국어로 작성한다.
- 사용자가 일부 내용을 영어로 입력했더라도 교사가 바로 읽고 수정할 수 있는 자연스러운 한국어로 정리한다.`,
    `[상황]
${formatLine("초기 요청", initialRequest)}
${formatLine("필요한 산출물", output)}
${formatLine("사용 장면", useScene)}
${formatLine("교육 및 업무 맥락", context)}`,
    `[목표]
- ${goal}
- 결과물은 교사가 읽고 바로 수정하거나 사용할 수 있을 만큼 구체적으로 작성한다.`,
    `[교사 판단 지점]
- ${teacherJudgment}
- 위 판단 지점은 교사의 판단을 대신 확정하지 말고, 필요한 경우 선택지와 장단점을 제시한 뒤 교사가 고를 수 있게 남겨 둔다.`,
    `[사용 가능한 정보]
${formatLine("참고 자료", sourceMaterial)}
${formatLine("개인정보 및 민감정보 확인", safety)}
${formatLine("외부 서비스 사용 여부", externalService)}`,
    `[작업 지시]
- 교사의 요청과 제공된 정보를 바탕으로 ${output}을 만든다.
- 맥락이 불분명한 부분은 단정하지 말고 확인이 필요한 지점으로 표시한다.
- 교사가 현장에서 조정할 수 있도록 대안, 주의점, 적용 순서를 함께 정리한다.
- 앱, 웹앱, 프로그램을 만드는 경우 “요구사항 정의 → 화면 흐름 → 기능별 모듈 → 데이터 모델 → 권한/보안 → 개인정보보호 구현 계획 → 심의 대응 구현 계획 → 테스트 기준 → 완료 기준” 순서로 상세하게 작성한다.
- 앱, 웹앱, 프로그램, 복합 자료를 만드는 경우 기능별로 모듈화해 설계한다. 예: 화면/UI, 인증과 권한, 데이터 모델, 입력/업로드, 평가 기록, 피드백, 알림, 보안, 개인정보보호 구현, 심의 대응 자료 생성, 테스트를 분리한다.
- 각 모듈은 역할, 주요 기능, 입력 데이터, 출력 데이터, 수정할 때 주의할 점을 따로 정리해 이후 보완하기 쉽게 한다.`,
    `[반드시 지킬 조건]
- 교사의 판단을 대신 확정하지 말고, 판단이 필요한 부분은 선택지와 장단점으로 제시한다.
- 학생이나 보호자를 특정할 수 있는 내용은 최소 수집, 가명 처리, 권한 분리, 마스킹, 삭제 기능처럼 구현 계획으로 다룬다.
- 외부 도구나 서비스 사용이 필요해 보이면 교사가 확인할 수 있는 설정, 로그, 내보내기, 운영 점검 화면을 구현 계획으로 다룬다.
${privacyConditions.map((condition) => `- ${condition}`).join("\n")}`,
    `[결과물 모습]
- ${format}
- 사용자가 따로 요청하지 않았다면 전문 형식 이름을 쓰지 말고, 제목, 목적, 준비물이나 전제 조건, 실행 절차, 점검 기준이 읽기 쉽게 보이도록 작성한다.`,
    `[품질 기준]
- ${quality}
- 표현은 교사가 바로 검토하고 고칠 수 있게 명확해야 한다.
- 막연한 조언보다 실제 문장, 표, 체크리스트처럼 옮겨 쓸 수 있는 형태를 우선한다.`,
    techDirection,
    detailedExecutionGuideSection(),
    buildFooterPolicyPrompt(),
    `[정보가 부족할 때]
- 중요한 정보가 부족하면 추측하지 말고 확인 질문을 먼저 하라.
- 확인 질문은 한 번에 너무 많이 묻지 말고, 결과물 품질에 가장 큰 영향을 주는 질문부터 제시하라.`
  ].filter(Boolean);

  return sections.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function ensureFinalPromptRequirements(prompt = "", fallbackPrompt = "", session = null) {
  let nextPrompt = valueOrDefault(prompt, fallbackPrompt);
  const fallback = valueOrDefault(fallbackPrompt, "");

  if (!nextPrompt.includes("[교사용 요약]") && hasTeacherSummary(nextPrompt)) {
    nextPrompt = `[교사용 요약]\n${nextPrompt.trim()}`;
  } else if (fallback && !nextPrompt.includes("[교사용 요약]")) {
    const summary = fallback.split("[AI 실행용 프롬프트]")[0].trim();
    nextPrompt = `${summary}\n\n[AI 실행용 프롬프트]\n${nextPrompt.trim()}`;
  }

  if (!/한국어|한글/.test(nextPrompt)) {
    nextPrompt = insertAfterAiPromptHeading(nextPrompt, `[언어]
- 모든 결과는 한국어로 작성한다.
- 사용자가 일부 내용을 영어로 입력했더라도 교사가 바로 읽고 수정할 수 있는 자연스러운 한국어로 정리한다.`);
  }

  if (/앱|웹앱|프로그램/.test(nextPrompt) && !/기능별|모듈/.test(nextPrompt)) {
    nextPrompt = insertAfterAiPromptHeading(nextPrompt, `[구조화 조건]
- 앱, 웹앱, 프로그램은 기능별로 모듈화해 설계한다.
- 화면/UI, 인증과 권한, 데이터 모델, 입력/업로드, 평가 기록, 피드백, 알림, 보안, 개인정보보호 구현, 심의 대응 자료 생성, 테스트를 분리한다.
- 각 모듈은 역할, 주요 기능, 입력 데이터, 출력 데이터, 수정할 때 주의할 점을 포함한다.`);
  }

  if (session && !/기술\s*방향과\s*보안\s*기본/.test(nextPrompt)) {
    const techDirection = buildTechDirectionSection(session);
    if (techDirection) nextPrompt = appendToAiPrompt(nextPrompt, techDirection);
  }

  if (!hasDetailedExecutionGuide(nextPrompt)) {
    nextPrompt = appendToAiPrompt(nextPrompt, detailedExecutionGuideSection());
  }

  if (!/푸터\s*및\s*정책\s*문서/.test(nextPrompt)) {
    nextPrompt = appendToAiPrompt(nextPrompt, buildFooterPolicyPrompt());
  }

  return nextPrompt.replace(/\n{3,}/g, "\n\n").trim();
}

export function splitFinalPromptSections(prompt = "") {
  const text = typeof prompt === "string" ? prompt.trim() : "";
  if (!text) return { teacherSummary: "", aiPrompt: "" };

  const match = findAiPromptHeading(text);
  if (!match) {
    return {
      teacherSummary: fallbackTeacherSummaryFromPrompt(text),
      aiPrompt: text
    };
  }

  return {
    teacherSummary: text.slice(0, match.index).trim(),
    aiPrompt: text.slice(match.index + match.length).trim()
  };
}
