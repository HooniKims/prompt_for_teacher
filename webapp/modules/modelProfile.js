export const LOCAL_MODEL_ID = "google/gemma-4-e2b";

export const modelProfile = {
  title: "Gemma 4 e2b",
  description: "단일 모델. 단계별 질문, 최종 프롬프트 생성, 수정 요청을 모두 처리합니다. 저사양 환경을 고려해 API 연결 시 요청은 반드시 하나씩 순차 실행합니다.",
  stepTokens: "1024-1536 tokens",
  finalTokens: "2500-4000 tokens"
};
