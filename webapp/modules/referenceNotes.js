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
- 학교 내부 검토 전에는 실제 학생 정보를 외부 서비스나 AI 도구에 입력하지 않는 전제로 진행합니다.`);

  notes.push(`학습지원 소프트웨어 심의 관련 고려할 점
- 학생이 로그인하거나, 평가 결과를 확인하거나, 오답 기록과 학습 활동 기록을 다루면 학습지원 소프트웨어 검토 대상이 될 수 있습니다.
- 교과 성취기준, 평가, 진단, 피드백, 추천 기능이 포함되는지 확인해야 합니다.
- 외부 업체나 클라우드를 사용한다면 개인정보 처리 위탁, 보안 조치, 접근 로그, 데이터 보관 위치를 확인해야 합니다.
- 학교 기기와 네트워크에서 안정적으로 쓸 수 있는지, 접근성과 사용성이 충분한지 점검해야 합니다.
- 필요하면 교원 의견수렴, 기준 충족 여부 확인, 학교운영위원회 심의, 최종 확정 절차를 준비합니다.`);

  return notes.join("\n\n");
}
