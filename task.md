# 작업 정리: 교사용 질문형 프롬프트 가이드

작성일: 2026-05-20

## 프로젝트 목표

교사가 만들고 싶은 앱, 웹앱, 프로그램, 수업 자료, 평가 자료, 학교 업무 자료를 짧게 입력하면 AI가 바로 실행할 수 있는 좋은 프롬프트로 정리해주는 브라우저 기반 도구를 만든다.

핵심 철학은 **AI 이전 사람 있고 / AI 이후 사람 있다**이다. AI가 바로 답을 만드는 도구가 아니라, 교사가 생각을 정리하고 중요한 판단 지점을 확인한 뒤 더 좋은 프롬프트를 만들도록 돕는 도구다.

## 현재 상태

현재 버전은 로컬 개발서버에서 동작하는 정적 웹앱이다.

```bash
npm run dev
```

접속 주소:

```text
http://127.0.0.1:5173/
```

## 주요 기능

- 질문형 프롬프트 가이드 제공
- 기본 질문 방식은 `꼼꼼` 모드
- `친절` 모드와 `꼼꼼` 모드 선택 가능
- 10개 핵심 흐름을 왼쪽 패널에 표시
- 현재 대화 위치에 맞춰 진행 단계 강조
- 왼쪽 현재 흐름 패널은 채팅이 길어져도 화면에 고정되어 따라오도록 처리
- 모바일에서는 ChatGPT 스타일로 좌우 패널을 펼쳐서 확인
- 엔터로 전송, Shift+Enter로 줄바꿈
- 중간에 `처음부터 다시시작` 가능
- 이전 작업을 참고하여 새 프롬프트 작성 가능
- 저장한 작업 다시 불러오기 가능
- 기본 AI 모델은 OpenAI `gpt-5.4-nano`
- 로컬 모델 선택지는 `e2b`
- AI 연결 상태에 현재 모델 표시
- e2b 사용 시 출력 중단을 줄이기 위해 질문 생성은 `3072`, 수정 요청은 `4096` 토큰을 기준으로 제한
- 일시적인 생성 실패는 1회 자동 재시도
- 모델 출력이 길어져 JSON 복구가 어렵게 잘린 경우, 대화 내용을 바탕으로 앱 내부 최종 프롬프트를 안전하게 생성
- OpenAI API 사용을 위한 `.env` 로드 지원
- LM Studio/OpenAI-compatible 서버 프록시 지원

## 최종 결과 구조

최종 결과는 세 영역으로 분리한다.

### 교사용 요약

교사가 빠르게 이해할 수 있도록 짧고 쉬운 말로 정리한다.

포함 내용:

- 만들 것
- 사용 장면
- 맥락
- 목표
- 확인한 핵심 조건
- 교사가 특히 확인할 점

### AI 실행용 프롬프트

제작 AI나 개발자가 바로 실행할 수 있도록 상세하게 작성한다.

포함 내용:

- 사용자 역할
- 핵심 기능
- 화면 흐름
- 기능별 모듈
- 데이터 모델
- 권한 설계
- 개인정보보호를 지키기 위한 구현 계획
- 심의 대응에 필요한 구현 계획
- 테스트 기준
- 완료 기준

중요한 분리 원칙:

- 개인정보보호와 학습지원 소프트웨어 심의 규정 설명은 `참고 안내`에 둔다.
- `AI 실행용 프롬프트`에는 규정 설명이 아니라 이를 지키기 위한 구현 계획만 둔다.
- 예: 내부 ID, 가명, 마스킹, 역할별 권한, 삭제, 내보내기, 접근 로그, 데이터 보관 위치 확인 기능.

### 참고 안내

교사가 실제 서비스 사용 전에 확인해야 할 내용을 분리해서 보여준다.

포함 내용:

- 개인정보보호 고려할 점
- 학습지원 소프트웨어 심의 관련 고려할 점
- 수집 항목, 이용 목적, 보관 기간, 접근 권한, 삭제 방법
- 학생 로그인, 평가 결과, 오답 기록, 학습 활동 기록을 다룰 때의 검토 사항
- 외부 업체나 클라우드 사용 시 확인할 점
- 교원 의견수렴, 학교운영위원회 심의 등 학교 내부 절차 준비 사항

## 사용자 친화성 개선

- 초보 교사가 이해하기 어려운 기술 용어를 줄였다.
- `Draft`, `token`, `로컬 메모리` 같은 표현을 쉬운 말로 바꾸었다.
- `AI 확인`, `답변 가능`처럼 혼란을 주는 버튼과 문구를 제거했다.
- AI 관련 상태와 모델 선택 버튼을 한 영역에 묶었다.
- `참고할 점`의 의미를 개인정보보호/심의 준비 안내로 명확히 했다.
- `AI가 만든 결과` 영역은 제거했다. 이 앱은 결과물을 직접 생성하는 앱이 아니라 최종 프롬프트를 만드는 앱이다.
- 교사용 요약과 AI 실행용 프롬프트를 분리해 각각 복사할 수 있게 했다.
- 브라우저 권한 때문에 자동 복사가 막히면 해당 본문을 자동 선택하고 `⌘C` 안내를 보여준다.
- 진행 중 보조 선택지는 모두 존댓말 문장으로 통일했다.
- AI가 새 보조 선택지를 만들 때도 반말, 명사형 종결, `~함`, `~없음`, `~있음` 표현을 쓰지 않도록 지시하고 보정한다.
- OpenAI 확인 실패와 로컬 AI 확인 실패 메시지를 구분해 표시한다.

## 디자인과 브랜딩

- 페이지 제목: `AI 이전 사람 있고 AI 이후 사람 있다`
- 왼쪽 브랜드 타이틀: `AI 이전 사람 있고` / `AI 이후 사람 있다` 두 줄 구성
- 부제: `생각의 힘, 사고의 단단함`
- 파비콘 추가: 사람이 먼저이고 AI는 보조라는 의미의 아이콘
- 하단 저작권 문구 추가: `© HooniKim. All rights reserved.`
- Paperlogy 폰트 사용
- 라이트/다크 테마 지원

## 주요 파일

```text
dev-server.mjs
package.json
webapp/index.html
webapp/styles.css
webapp/main.js
webapp/assets/favicon.png
webapp/assets/apple-touch-icon.png
webapp/assets/fonts/
webapp/modules/conversationPlanner.js
webapp/modules/localLlmClient.js
webapp/modules/memory.js
webapp/modules/modelProfile.js
webapp/modules/promptBuilder.js
webapp/modules/referenceNotes.js
webapp/modules/revision.js
webapp/modules/state.js
webapp/modules/steps.js
webapp/modules/storage.js
webapp/modules/ui.js
tests/
```

## 환경 파일

OpenAI API 키는 `.env`에 둔다.

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5.4-nano

# LM Studio를 배포 환경에서 함께 쓸 때
LMSTUDIO_API_URL=https://lm.alluser.site
LMSTUDIO_API_KEY=필요한 경우에만 입력
LMSTUDIO_GEMMA_E2B_MODEL=google/gemma-4-e2b
LMSTUDIO_GEMMA_26B_MODEL=gemma-4-26b-a4b-it
```

호환 이름:

```text
LOCAL_LLM_ORIGIN=https://lm.alluser.site
```

`LMSTUDIO_API_URL`과 `LOCAL_LLM_ORIGIN`이 둘 다 있으면 `LMSTUDIO_API_URL`을 우선 사용한다.
LM Studio 프록시는 `Authorization: Bearer`가 아니라 `X-API-Key` 헤더를 사용한다.
요청에는 `Origin`, `Referer`, `reasoning_effort: "none"`, `stream: false`를 함께 보낸다.

주의:

- `.env`는 GitHub에 올리지 않는다.
- `.gitignore`에 포함한다.

## 검증 방법

```bash
npm test
npm run check
node --check dev-server.mjs
```

현재 검증 결과:

- `npm test`: 95개 통과
- `npm run check`: 통과
- `node --check dev-server.mjs`: 통과

브라우저 데모 확인 주소:

```text
http://127.0.0.1:5173/?runDemo=privacy
http://127.0.0.1:5173/?testScenario=nanoPrivacyDetailed
http://127.0.0.1:5173/?testScenario=e2bClassRules
```

확인한 내용:

- 꼼꼼 모드 기본 적용
- 10단계 흐름 진행 표시
- 현재 단계 색상 강조
- `보조 질문` 문구 제거
- 교사용 요약과 AI 실행용 프롬프트 분리
- 참고 안내에 개인정보보호/학습지원 소프트웨어 심의 고려사항 표시
- AI 실행용 프롬프트에는 구현 계획만 표시
- raw JSON 노출 없음
- 복사 버튼 동작 및 권한 차단 시 자동 선택 fallback 확인
- 기본 배포 모델 `gpt-5.4-nano` 적용
- 개인정보/상담 기록/수행평가 피드백 상세 예시 화면 확인
- e2b 샘플 데모 확인

## GitHub 배포 전 정리 기준

유지할 것:

- 앱 실행 파일
- 테스트 코드
- 디자인 토큰과 폰트
- 문서와 이슈 기록
- 파비콘 최종본

제외할 것:

- `.env`
- `.DS_Store`
- `.omx/`
- `.agents/`
- `test-results/`
- 임시 캡처 이미지
- 파비콘 생성 원본
- 개인 작업 handoff 문서

## GitHub 저장소

대상 저장소:

```text
https://github.com/HooniKims/prompt_for_teacher.git
```
