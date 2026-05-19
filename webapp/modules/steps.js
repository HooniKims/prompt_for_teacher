export const steps = [
  {
    key: "output",
    title: "만들 것 확인",
    question: "먼저 무엇을 만들고 싶은지 정해볼게요. 지금 가장 가까운 것은 무엇인가요?",
    options: [
      { id: "A", label: "웹앱 또는 웹사이트를 만들고 싶습니다." },
      { id: "B", label: "윈도우용 프로그램을 만들고 싶습니다." },
      { id: "C", label: "모바일 앱을 만들고 싶습니다." },
      { id: "D", label: "수업 자료, 문서, 활동지를 만들고 싶습니다." }
    ]
  },
  {
    key: "useScene",
    title: "사용 장면 확인",
    question: "이 프롬프트는 어느 장면에서 쓰일 예정인가요?",
    options: [
      { id: "A", label: "수업 준비에 사용합니다." },
      { id: "B", label: "수업 중에 활용합니다." },
      { id: "C", label: "피드백 또는 평가에 사용합니다." },
      { id: "D", label: "행정 처리 또는 협의에 사용합니다." }
    ]
  },
  {
    key: "context",
    title: "교육 및 업무 맥락 확인",
    question: "교육 및 업무 맥락은 어디에 가장 가깝나요?",
    options: [
      { id: "A", label: "초등 수업 또는 학급 운영에 가깝습니다." },
      { id: "B", label: "중학교 수업 또는 생활지도에 가깝습니다." },
      { id: "C", label: "고등학교 수업 또는 진로·평가에 가깝습니다." },
      { id: "D", label: "학교 공통 업무 또는 부서 업무에 가깝습니다." }
    ]
  },
  {
    key: "goal",
    title: "목표 확인",
    question: "이 작업을 통해 가장 좋아져야 하는 부분은 무엇인가요?",
    options: [
      { id: "A", label: "학생의 개념 이해를 돕고 싶습니다." },
      { id: "B", label: "학생의 질문과 참여를 늘리고 싶습니다." },
      { id: "C", label: "업무 내용을 빠르게 정리하고 싶습니다." },
      { id: "D", label: "문장의 톤과 완성도를 높이고 싶습니다." }
    ]
  },
  {
    key: "teacherJudgment",
    title: "교사 판단 지점 확인",
    question: "AI가 대신 정하면 안 되고 선생님이 판단해야 하는 핵심 선택은 무엇인가요?",
    options: [
      { id: "A", label: "성취기준 또는 평가 기준입니다." },
      { id: "B", label: "학생 수준과 활동 난이도입니다." },
      { id: "C", label: "생활지도 또는 소통 표현입니다." },
      { id: "D", label: "민감한 행정 판단입니다." }
    ]
  },
  {
    key: "sourceMaterial",
    title: "필요한 자료 확인",
    question: "프롬프트에 반영할 참고 자료가 있나요?",
    options: [
      { id: "A", label: "교육과정 성취기준이 있습니다." },
      { id: "B", label: "기존 문서 또는 학교 양식이 있습니다." },
      { id: "C", label: "회의 내용, 협의 내용, 학생 반응이 있습니다." },
      { id: "D", label: "아직 없습니다. 나중에 추가하겠습니다." }
    ]
  },
  {
    key: "safety",
    title: "안전 확인",
    question: "안전 확인 하나만 할게요. 실제 학생 이름, 얼굴, 학번, 연락처, 성적, 상담 내용처럼 특정 학생을 알아볼 수 있는 정보가 들어가나요?",
    options: [
      { id: "A", label: "개인정보는 들어가지 않습니다." },
      { id: "B", label: "가명이나 예시 정보로 바꿀 수 있습니다." },
      { id: "C", label: "실제 학생 정보가 일부 들어갈 수 있습니다.", risk: "privacy" },
      { id: "D", label: "상담, 건강, 가정환경 등 민감한 내용이 있습니다.", risk: "sensitive" }
    ]
  },
  {
    key: "externalService",
    title: "외부 도구 및 서비스 확인",
    question: "학생이 직접 외부 서비스에 로그인하거나 답안을 입력하는 방식이 포함되나요?",
    options: [
      { id: "A", label: "교사만 준비용으로 사용합니다." },
      { id: "B", label: "학생이 외부 서비스에 로그인합니다.", risk: "learningSoftware" },
      { id: "C", label: "학생이 답안이나 활동 결과를 제출합니다.", risk: "learningSoftware" },
      { id: "D", label: "업체가 만든 학습 콘텐츠나 진단 기능을 사용합니다.", risk: "learningContent" }
    ]
  },
  {
    key: "format",
    title: "결과물 모습 구체화",
    question: "최종 결과물은 어떤 모습이면 바로 쓰기 좋을까요?",
    options: [
      { id: "A", label: "화면과 버튼이 있는 앱이면 좋겠습니다." },
      { id: "B", label: "설치해서 쓰는 프로그램이면 좋겠습니다." },
      { id: "C", label: "문서나 표로 정리된 자료이면 좋겠습니다." },
      { id: "D", label: "체크리스트 또는 루브릭이면 좋겠습니다." }
    ]
  },
  {
    key: "quality",
    title: "품질 기준 및 수정 방향 확인",
    question: "결과물을 평가할 때 가장 중요한 기준은 무엇인가요?",
    options: [
      { id: "A", label: "내일 바로 실행 가능해야 합니다." },
      { id: "B", label: "말투가 부드럽고 부담 없어야 합니다." },
      { id: "C", label: "기준과 절차가 구체적이어야 합니다." },
      { id: "D", label: "짧고 명확해야 합니다." }
    ]
  }
];

export function getStepByIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < steps.length ? steps[index] : null;
}
