# 질문형 프롬프트 가이드

교사가 만들고 싶은 웹앱, 프로그램, 수업 자료, 평가 자료, 학교 업무 자료를 더 좋은 AI 실행용 프롬프트로 정리해 주는 브라우저 기반 도구입니다.

핵심 문장은 **“AI 이전 사람 있고, AI 이후 사람 있다”**입니다.  
AI가 바로 결과를 대신 만드는 것보다, 교사의 생각과 판단 지점을 먼저 정리한 뒤 AI가 실제로 실행하기 좋은 프롬프트를 만드는 데 초점을 둡니다.

## 무엇을 해주나요?

- 교사가 짧게 적은 아이디어를 질문으로 구체화합니다.
- 10단계 확인 흐름으로 빠뜨리기 쉬운 조건을 점검합니다.
- 최종 결과를 `교사용 요약`, `AI 실행용 프롬프트`, `참고 안내`로 나누어 보여줍니다.
- 개인정보보호와 학습지원 소프트웨어 심의 관련 확인 사항을 따로 정리합니다.
- 초보 교사도 이해하기 쉬운 말로 안내합니다.
- 모바일에서도 채팅 중심으로 사용할 수 있습니다.

## 최종 결과 구조

### 1. 교사용 요약

교사가 빠르게 확인할 수 있는 쉬운 요약입니다.

- 만들 것
- 사용 장면
- 교육 맥락
- 목표
- 교사가 직접 판단할 부분

### 2. AI 실행용 프롬프트

개발 AI가 바로 작업할 수 있도록 상세하게 작성됩니다.

포함되는 내용:

- 요구사항 정의
- 화면 흐름
- 기능별 모듈
- 데이터 모델
- 권한 설계
- 개인정보보호 구현 계획
- 학습지원 소프트웨어 심의 대응 구현 계획
- 테스트 기준
- 완료 기준

### 3. 참고 안내

교사가 실제 서비스로 쓰기 전에 확인할 내용을 따로 보여줍니다.

특히 다음 기준을 반영합니다.

- 교사 단독 행정·업무·수업 준비용 도구는 보통 심의 제외
- 정규 수업에서 학생과 함께 쓰며 개인정보를 수집·처리하면 심의 필요
- 개인정보를 전혀 수집하지 않는 단순 수업용 웹앱이나 체험 콘텐츠는 심의 제외 가능
- 교사 자체 개발 수업용 도구가 개인정보를 수집하면 교사가 개인정보 보호 5개 필수 기준 체크리스트나 서술형 증빙을 준비

## 주요 기능

- `친절` 모드와 `꼼꼼` 모드 선택
- 기본값은 `꼼꼼` 모드
- 현재 진행 단계 표시
- 저장한 작업 다시 불러오기
- 이전에 만든 프롬프트 참고
- 엔터로 보내기, Shift+Enter로 줄바꿈
- 처음부터 다시 시작
- 교사용 요약과 AI 실행용 프롬프트 각각 복사
- 라이트/다크 모드
- OpenAI `gpt-5.4-nano` 지원
- LM Studio/OpenAI-compatible 로컬 모델 지원

## 실행 방법

```bash
npm run dev
```

브라우저에서 아래 주소로 접속합니다.

```text
http://127.0.0.1:5173/
```

## 환경 변수

프로젝트 루트에 `.env` 파일을 만들고 필요한 값을 넣습니다.  
`.env`는 GitHub에 올리지 않습니다.

### OpenAI 사용

```env
OPENAI_API_KEY=여기에_API_키
OPENAI_MODEL=gpt-5.4-nano
```

### LM Studio 사용

```env
LMSTUDIO_API_URL=https://lm.alluser.site
LMSTUDIO_API_KEY=필요한_경우에만_입력
LMSTUDIO_GEMMA_E4B_MODEL=google/gemma-4-e4b
```

로컬 개발 서버는 `/openai/v1`과 `/v1` 프록시를 제공합니다.

## Netlify 배포 환경 변수

Netlify에 배포할 때는 사이트 설정의 Environment variables에 아래 값을 추가합니다.

```text
OPENAI_API_KEY
OPENAI_MODEL
LMSTUDIO_API_URL
LMSTUDIO_API_KEY
LMSTUDIO_GEMMA_E4B_MODEL
```

기본 OpenAI 모델은 `gpt-5.4-nano`입니다.

## 검증

```bash
npm test
npm run build
```

현재 기준:

- 테스트 100개 통과
- 빌드 체크 통과
- 로컬 e4b API 짧은 응답 10회 연속 점검 통과

## 주요 파일

```text
webapp/index.html
webapp/styles.css
webapp/main.js
webapp/modules/conversationPlanner.js
webapp/modules/promptBuilder.js
webapp/modules/referenceNotes.js
webapp/modules/localLlmClient.js
dev-server.mjs
netlify/
tests/
```

## 라이선스와 권리

© HooniKim. All rights reserved.
