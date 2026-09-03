export const steps = [
  {
    key: "output",
    title: "만들 것 확인",
    shortTitle: "만들 것",
    question: "먼저 무엇을 만들고 싶은지 정해볼게요. 지금 가장 가까운 것은 무엇인가요?",
    options: [
      { id: "A", label: "웹앱 또는 웹사이트를 만들고 싶습니다." },
      { id: "B", label: "컴퓨터에 설치해서 쓰는 프로그램을 만들고 싶습니다." },
      { id: "C", label: "휴대폰 앱을 만들고 싶습니다." },
      { id: "D", label: "수업 자료, 문서, 활동지를 만들고 싶습니다." }
    ]
  },
  {
    key: "useScene",
    title: "사용 장면 확인",
    shortTitle: "사용 장면",
    question: "이 결과물은 언제, 누가 쓰나요?",
    options: [
      { id: "A", label: "선생님이 수업 준비할 때 혼자 씁니다." },
      { id: "B", label: "수업 시간에 학생들과 함께 씁니다." },
      { id: "C", label: "피드백이나 평가할 때 씁니다." },
      { id: "D", label: "행정 처리나 교사 협의에 씁니다." }
    ]
  },
  {
    key: "context",
    title: "교육 및 업무 맥락 확인",
    shortTitle: "대상과 맥락",
    question: "어떤 학교급, 어떤 상황에 가장 가깝나요?",
    options: [
      { id: "A", label: "초등 수업 또는 학급 운영입니다." },
      { id: "B", label: "중학교 수업 또는 생활지도입니다." },
      { id: "C", label: "고등학교 수업 또는 진로·평가입니다." },
      { id: "D", label: "학교 공통 업무 또는 부서 업무입니다." }
    ]
  },
  {
    key: "goal",
    title: "목표 확인",
    shortTitle: "목표",
    question: "이 결과물로 가장 좋아졌으면 하는 것은 무엇인가요?",
    options: [
      { id: "A", label: "학생이 개념을 더 잘 이해하면 좋겠습니다." },
      { id: "B", label: "학생의 질문과 참여가 늘면 좋겠습니다." },
      { id: "C", label: "업무 시간이 줄면 좋겠습니다." },
      { id: "D", label: "문장의 말투와 완성도가 좋아지면 좋겠습니다." }
    ]
  },
  {
    key: "teacherJudgment",
    title: "교사 판단 지점 확인",
    shortTitle: "선생님이 정할 것",
    question: "AI가 마음대로 정하면 안 되고 선생님이 직접 정해야 하는 것은 무엇인가요?",
    options: [
      { id: "A", label: "성취기준이나 평가 기준입니다." },
      { id: "B", label: "학생 수준과 활동 난이도입니다." },
      { id: "C", label: "생활지도나 학부모 소통 표현입니다." },
      { id: "D", label: "민감한 행정 판단입니다." }
    ]
  },
  {
    key: "sourceMaterial",
    title: "필요한 자료 확인",
    shortTitle: "참고 자료",
    question: "AI에게 같이 줄 자료가 있나요?",
    options: [
      { id: "A", label: "교육과정 성취기준이 있습니다." },
      { id: "B", label: "기존 문서나 학교 양식이 있습니다." },
      { id: "C", label: "회의 내용, 협의 내용, 학생 반응이 있습니다." },
      { id: "D", label: "아직 없습니다. 나중에 추가하겠습니다." }
    ]
  },
  {
    key: "safety",
    title: "개인정보 확인",
    shortTitle: "개인정보",
    question: "실제 학생 이름, 얼굴, 학번, 연락처, 성적, 상담 내용처럼 특정 학생을 알아볼 수 있는 정보가 들어가나요?",
    options: [
      { id: "A", label: "개인정보는 들어가지 않습니다." },
      { id: "B", label: "가명이나 예시 정보로 바꿀 수 있습니다." },
      { id: "C", label: "실제 학생 정보가 일부 들어갈 수 있습니다.", risk: "privacy" },
      { id: "D", label: "상담, 건강, 가정환경 등 민감한 내용이 있습니다.", risk: "sensitive" }
    ]
  },
  {
    key: "externalService",
    title: "저장·접속 방식 확인",
    shortTitle: "저장과 접속",
    question: "입력한 내용이 다음에 다시 열어도 남아 있어야 하나요? 그리고 여러 사람이 인터넷으로 같이 쓰나요?",
    options: [
      { id: "A", label: "저장할 필요 없이 화면에서만 쓰면 됩니다.", tech: "none" },
      { id: "B", label: "내 컴퓨터(브라우저)에만 남아 있으면 됩니다.", tech: "local" },
      { id: "C", label: "여러 사람이 인터넷으로 접속하고 내용이 함께 저장돼야 합니다.", tech: "server", risk: "learningSoftware" },
      { id: "D", label: "학생이 로그인해서 직접 입력하거나 제출합니다.", tech: "server-login", risk: "learningSoftware" }
    ]
  },
  {
    key: "format",
    title: "결과물 모습 구체화",
    shortTitle: "결과물 모습",
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
    shortTitle: "품질 기준",
    question: "결과물을 볼 때 가장 중요한 기준은 무엇인가요?",
    options: [
      { id: "A", label: "내일 바로 쓸 수 있어야 합니다." },
      { id: "B", label: "말투가 부드럽고 부담 없어야 합니다." },
      { id: "C", label: "기준과 절차가 구체적이어야 합니다." },
      { id: "D", label: "짧고 명확해야 합니다." }
    ]
  }
];

// 기본 10개 확인이 끝난 뒤, AI가 추천안을 먼저 제시하고 선생님은 고르기만 하면 되는 마무리 항목.
export const wrapUpSteps = [
  {
    key: "scope",
    title: "이번에 만들 범위",
    shortTitle: "범위",
    phase: "wrapup",
    question: "이번에는 여기까지만 만드는 게 좋겠어요. 어떤가요?",
    recommendHint: "지금까지 대화에서 나온 기능 중 꼭 필요한 것만 남기고, 이번에는 만들지 않을 기능을 분명히 적는다. 예: \"순서 뽑기, 결과 화면, 다시 뽑기까지만. 출석 관리와 점수 기록은 이번엔 만들지 않음\"",
    options: [
      { id: "A", label: "추천안대로 할게요: 핵심 기능만 먼저 만들고 나머지는 다음에 합니다." },
      { id: "B", label: "조금 더 넣고 싶어요. 아래에 적을게요." },
      { id: "C", label: "아직 정하지 않았습니다." }
    ]
  },
  {
    key: "priority",
    title: "꼭 있어야 하는 것 순서",
    shortTitle: "우선순위",
    phase: "wrapup",
    question: "꼭 있어야 하는 기능을 순서대로 세 가지만 정하면 이렇게 될 것 같아요. 어떤가요?",
    recommendHint: "대화에서 나온 기능을 '반드시 → 있으면 좋음' 순서로 3개 안팎 나열한다. 첫 번째가 없으면 앱이 의미 없는 것이어야 한다.",
    options: [
      { id: "A", label: "추천안대로 할게요: 가장 핵심 기능부터 순서대로 만듭니다." },
      { id: "B", label: "순서를 바꾸고 싶어요. 아래에 적을게요." },
      { id: "C", label: "아직 정하지 않았습니다." }
    ]
  },
  {
    key: "success",
    title: "성공했다고 볼 기준",
    shortTitle: "성공 기준",
    phase: "wrapup",
    question: "성공했다고 볼 기준은 이걸로 할까요?",
    recommendHint: "수업 장면에서 눈으로 확인할 수 있는 한 문장으로 쓴다. 숫자가 있으면 좋다. 예: \"수업 시작 1분 안에 순서가 정해지고, 학생들이 공정하다고 느끼면 성공\"",
    options: [
      { id: "A", label: "추천안대로 할게요: 수업에서 바로 써 보고 학생 반응으로 확인합니다." },
      { id: "B", label: "다른 기준으로 하고 싶어요. 아래에 적을게요." },
      { id: "C", label: "아직 정하지 않았습니다." }
    ]
  }
];

export const allSteps = [...steps, ...wrapUpSteps];
export const stepKeys = steps.map((step) => step.key);
export const wrapUpKeys = wrapUpSteps.map((step) => step.key);
export const allStepKeys = allSteps.map((step) => step.key);
export const RECOMMENDATION_PREFIX = /^추천안대로 할게요\s*[:：]?\s*/;

export function getStepByIndex(index) {
  return Number.isInteger(index) && index >= 0 && index < steps.length ? steps[index] : null;
}

export function getStepByKey(key) {
  return allSteps.find((step) => step.key === key) ?? null;
}

export function isWrapUpKey(key) {
  return wrapUpKeys.includes(key);
}
