const REVISION_SECTION_TITLE = "[수정 요청 반영]";
const MISSING_INFO_SECTION_TITLE = "[정보가 부족할 때]";

function cleanRevisionRequest(revisionRequest) {
  return typeof revisionRequest === "string" && revisionRequest.trim()
    ? revisionRequest.trim()
    : "교사가 요청한 수정 방향을 반영한다.";
}

function removeExistingRevisionSection(prompt) {
  const revisionIndex = prompt.indexOf(REVISION_SECTION_TITLE);

  if (revisionIndex === -1) return prompt;

  const missingInfoIndex = prompt.indexOf(MISSING_INFO_SECTION_TITLE, revisionIndex + REVISION_SECTION_TITLE.length);

  if (missingInfoIndex === -1) {
    return prompt.slice(0, revisionIndex).trimEnd();
  }

  return `${prompt.slice(0, revisionIndex).trimEnd()}\n\n${prompt.slice(missingInfoIndex).trimStart()}`;
}

export function summarizeRevision(revisionRequest = "") {
  const request = cleanRevisionRequest(revisionRequest);

  if (/개인정보|민감|안전|보안/.test(request)) {
    return "개인정보와 안전 조건이 더 분명하게 보이도록 수정했습니다.";
  }

  if (/짧|간결|요약|줄여/.test(request)) {
    return "분량을 줄이고 핵심 지시가 더 간결하게 보이도록 수정했습니다.";
  }

  if (/구체|자세|상세|예시/.test(request)) {
    return "교사가 바로 판단하고 실행할 수 있도록 더 구체적인 방향을 반영했습니다.";
  }

  if (/부드럽|친절|완곡|따뜻/.test(request)) {
    return "표현이 더 부드럽고 교사가 검토하기 쉬운 방향으로 수정했습니다.";
  }

  return "교사의 수정 요청을 최종 프롬프트에 반영했습니다.";
}

export function revisePrompt(prompt = "", revisionRequest = "") {
  const request = cleanRevisionRequest(revisionRequest);
  const basePrompt = removeExistingRevisionSection(String(prompt)).trim();
  const revisionSection = `${REVISION_SECTION_TITLE}
- 교사의 추가 수정 요청: ${request}
- 이 수정 방향을 전체 프롬프트에 반영하되, 기존 역할, 맥락, 조건, 결과물 모습과 충돌하지 않게 한 벌의 실행 지시문으로 유지한다.`;

  const missingInfoIndex = basePrompt.indexOf(MISSING_INFO_SECTION_TITLE);

  if (missingInfoIndex === -1) {
    return `${basePrompt}\n\n${revisionSection}`.trim();
  }

  const beforeMissingInfo = basePrompt.slice(0, missingInfoIndex).trimEnd();
  const fromMissingInfo = basePrompt.slice(missingInfoIndex).trimStart();

  return `${beforeMissingInfo}\n\n${revisionSection}\n\n${fromMissingInfo}`.trim();
}

export function buildRevisionMessages({ prompt = "", revisionRequest = "", referenceNotes = "" } = {}) {
  const request = cleanRevisionRequest(revisionRequest);

  return [
    {
      role: "system",
      content: `너는 교사용 생성 프롬프트를 다듬는 편집자다. 사용자의 수정 요청을 반영해 최종 프롬프트 전체를 다시 작성한다.

규칙:
- 설명이나 머리말 없이 수정된 최종 프롬프트만 반환한다.
- 모든 내용은 한국어로 작성한다. 기존 프롬프트에 영어가 섞여 있으면 교사가 이해하기 쉬운 한국어로 정리한다.
- 기존 역할, 상황, 목표, 조건, 결과물 모습, 품질 기준은 가능한 보존한다.
- 개인정보 보호와 학습지원 소프트웨어 관련 안전 조건은 약화하지 않는다.
- 사용자가 요청하지 않은 새 기능이나 새 요구사항을 임의로 추가하지 않는다.`
    },
    {
      role: "user",
      content: `현재 최종 프롬프트:
${String(prompt).trim() || "없음"}

참고 안내:
${String(referenceNotes).trim() || "없음"}

수정 요청:
${request}`
    }
  ];
}
