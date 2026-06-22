import regulationKnowledgeData from "../data/regulationKnowledge.json" with { type: "json" };

export const regulationKnowledge = regulationKnowledgeData;

function bulletList(items = []) {
  return items.filter(Boolean).map((item) => `- ${item}`).join("\n");
}

export function buildNaturalRegulationQuestionGuidance() {
  const questions = regulationKnowledge.usageRules.map((rule) => rule.teacherQuestion);
  const explanations = regulationKnowledge.usageRules.map((rule) => rule.plainExplanation);

  return `규정 참고 질문 방식:
- 단도직입적으로 심의 대상인지 묻지 말고, 선생님이 개발하고자 하는 서비스의 실제 사용 장면을 자연스럽게 확인한다.
- 학생이 직접 사용하는 장면, 정규 수업에서 쓰는지, 교사만 준비용으로 쓰는지부터 묻는다.
- 로그인, 답안 제출, 점수, 활동 기록, 상담 내용, 보호자 정보처럼 저장되는 정보가 있는지 부드럽게 이어서 확인한다.
- 개인정보 처리방침에 필요한 처리 목적, 처리 항목, 보유 기간, 파기, 제3자 제공, 위탁, 안전성 확보조치를 서비스 설계 질문 안에 녹여 묻는다.
- 푸터에 개인정보 처리방침, 이용약관, 문의/담당자, 시행일/변경일을 둘 수 있도록 화면 구성 질문에 자연스럽게 포함한다.
${bulletList(questions)}

쉬운 설명 기준:
${bulletList(explanations)}`;
}

export function buildRegulationPromptRequirements() {
  const requirements = regulationKnowledge.usageRules.map((rule) => rule.promptRequirement);

  return `규정 기반 최종 프롬프트 요구사항:
${bulletList(requirements)}
- 최종 프롬프트에는 표준 개인정보 처리방침 작성지침을 참고해 개인정보 처리방침 초안을 만들도록 지시한다.
- 최종 프롬프트에는 서비스 이용약관 초안을 만들도록 지시하고, 온라인 서비스 또는 디지털콘텐츠 성격이면 디지털콘텐츠 중개 표준약관의 권리·의무·환불·청약철회·분쟁 대응 취지를 참고하게 한다.
- 화면 설계에는 푸터 또는 하단 메뉴에 개인정보 처리방침 및 이용약관 링크가 포함되도록 요구한다.`;
}

export function buildFooterPolicyPrompt() {
  return `[푸터 및 정책 문서]
- 서비스 모든 주요 화면의 푸터 또는 하단 메뉴에 개인정보 처리방침, 이용약관, 문의/담당자, 기관명, 시행일, 변경일 링크를 둔다.
- 개인정보 처리방침은 개인정보보호위원회 「개인정보 처리방침 작성지침」 기준에 맞춰 처리 목적, 처리 항목, 보유 기간, 파기 절차와 방법, 제3자 제공, 처리업무 위탁, 안전성 확보조치, 정보주체와 법정대리인의 권리 행사 방법, 개인정보 보호책임자 또는 담당부서, 권익침해 구제방법, 처리방침 변경 고지를 포함해 초안을 만든다.
- 이용약관은 서비스 목적, 회원 또는 이용자 조건, 계정과 접근 권한, 콘텐츠 또는 산출물 이용 조건, 금지행위, 서비스 변경과 중단, 책임 제한, 환불이나 청약철회가 필요한 경우의 기준, 분쟁 처리 절차를 포함해 초안을 만든다.
- 온라인 서비스 또는 디지털콘텐츠를 제공·중개하는 성격이면 국가법령정보센터 「디지털콘텐츠 중개 표준약관」의 취지를 참고해 이용자 권리와 사업자 의무가 균형 있게 보이도록 한다.
- 실제 법률 문구를 확정하는 것이 아니라, 학교나 기관 담당자가 검토할 수 있는 초안과 확인 항목으로 작성한다.`;
}
