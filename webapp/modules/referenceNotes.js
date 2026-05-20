const PRIVACY_RISKS = new Set(["privacy", "sensitive"]);
const LEARNING_SERVICE_RISKS = new Set(["learningSoftware", "learningContent"]);

function textOrFallback(value, fallback) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function summarizeIdea(session = {}) {
  const answers = session.answers ?? {};
  const parts = [
    textOrFallback(session.initialRequest, ""),
    textOrFallback(answers.output, ""),
    textOrFallback(answers.useScene, ""),
    textOrFallback(answers.context, "")
  ].filter(Boolean);

  return parts.length ? parts.join(" / ") : "현재 대화에서 정리한 아이디어";
}

function collectSessionText(session = {}) {
  const answers = session.answers ?? {};
  const turns = Array.isArray(session.conversationTurns)
    ? session.conversationTurns.map((turn) => textOrFallback(turn?.text, ""))
    : [];
  return [
    textOrFallback(session.initialRequest, ""),
    ...Object.values(answers).map((value) => textOrFallback(value, "")),
    ...turns
  ].filter(Boolean).join("\n");
}

export function buildReferenceNotes(answerMeta = {}, session = {}) {
  const notes = [];
  const safety = answerMeta.safety;
  const external = answerMeta.externalService;
  const idea = summarizeIdea(session);
  const sessionText = collectSessionText(session);
  const privacyRisk = PRIVACY_RISKS.has(safety?.risk) || /학생\s*(이름|실명|학번|번호|얼굴|사진|연락처)|성적|점수|오답|상담|건강|가정환경|학습\s*(기록|활동)|피드백|교사\s*메모/.test(sessionText);
  const learningServiceRisk = LEARNING_SERVICE_RISKS.has(external?.risk) || /웹앱|앱|프로그램|로그인|학생이\s*직접|답안|제출|교수학습평가|학습지원|성취기준|진단|추천|대시보드/.test(sessionText);

  notes.push(`개인정보보호 고려할 점
- 이 아이디어에는 학생 이름, 학번, 점수, 오답 기록, 학습 활동 기록처럼 학생을 알아볼 수 있거나 민감할 수 있는 정보가 포함될 수 있습니다.
- 실제 학생 정보 대신 내부 ID, 가명, 예시 데이터, 마스킹된 정보로 설계할 수 있는지 먼저 확인합니다.
- 수집 항목, 이용 목적, 보관 기간, 접근 권한, 삭제 방법, 동의 필요 여부를 정리해야 합니다.
- 학생 정보는 교사, 학생, 관리자 권한별로 볼 수 있는 범위를 분리해야 합니다.
- 교사 자체 개발 도구라도 학생 개인정보를 수집·처리한다면 최소 수집과 개인정보 보호 필수 기준 증빙을 준비합니다.`);

  notes.push(`학습지원 소프트웨어 심의 관련 고려할 점
- 교사 단독 행정·업무·수업 준비용 도구는 보통 심의 제외입니다.
- 정규 교과 수업에서 학생과 함께 쓰고 로그인, 기록 저장, 점수, 활동 로그 등 개인정보를 수집·처리하면 심의가 필요합니다.
- 교사 자체 개발 수업용 도구라면 교사가 공급자 역할로 개인정보 보호 5개 필수 기준 체크리스트나 서술형 증빙을 준비합니다.
- 정규 수업용이라도 개인정보 수집이 전혀 없는 단순 웹앱, 체험 콘텐츠, 교사 제작 자료는 심의 제외로 볼 수 있습니다.
- 교사 단독용에서 학생 참여형 과제나 수업용으로 용도가 바뀌고 개인정보를 수집하는 순간 다시 심의 여부를 확인합니다.`);

  return notes.join("\n\n");
}
