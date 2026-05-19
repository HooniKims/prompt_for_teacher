# 모듈화/로컬 메모리 검증 감사

검증일: 2026-05-18

## 검증 목표

이번 검증은 다음 질문에 답하기 위한 것이다.

- 구현이 `docs/superpowers/specs/2026-05-18-modular-local-memory-design.md` 기준을 만족하는가?
- 로컬 저장소 기능이 실제 브라우저 흐름에서도 동작하는가?
- 최종 프롬프트가 교사의 생각과 가능성을 확장하는 방향으로 구성되는가?
- 로컬 LLM은 현재 프로젝트 기준에서 실제로 사용할 수 있는가?

## 결론

- 스펙에 포함된 모듈화, 로컬 저장소, 로컬 메모리, 프롬프트 품질, 디자인 기준은 검증을 통과했다.
- 실제 브라우저에서 10단계 흐름, 완료 세션 저장, 진행 중 초안 새로고침 복원, 저장 세션 불러오기, 메모리 ON/OFF, 메모리 삭제를 확인했다.
- 로컬 LLM 서버(`http://127.0.0.1:1234`)와 `google/gemma-4-e4b` 모델은 응답 가능하다.
- 그러나 현재 앱은 로컬 LLM을 내부에서 호출하지 않는다. 이 상태는 스펙과 PRD의 "LM Studio/API 연동 제외"와 일치하지만, "앱 안에서 로컬 LLM을 직접 사용한다"는 기대가 있다면 추가 구현이 필요하다.

## 요구사항별 체크리스트

| 요구사항 | 증거 | 판정 |
| --- | --- | --- |
| 기능별 ES 모듈 분리 | `webapp/modules/steps.js`, `state.js`, `promptBuilder.js`, `referenceNotes.js`, `revision.js`, `storage.js`, `memory.js`, `modelProfile.js`, `ui.js`; `webapp/main.js`는 import 기반 오케스트레이션 | 통과 |
| 기존 10단계 질문 흐름 유지 | `tests/state.test.js`, 브라우저 감사에서 첫 요청 후 `.option-button` 4개 확인 및 10회 선택으로 완료 | 통과 |
| 최종 프롬프트 품질 구조 | `tests/promptBuilder.test.js`; 브라우저 감사에서 `[역할]`, `[상황]`, `[목표]`, `[교사 판단 지점]`, `[사용 가능한 정보]`, `[작업 지시]`, `[반드시 지킬 조건]`, `[출력 형식]`, `[품질 기준]`, `[정보가 부족할 때]` 확인 | 통과 |
| 교사 판단을 대신하지 않음 | `promptBuilder.js`가 "교사의 판단을 대신 확정하지 말고", "선택지와 장단점"을 포함; `tests/promptBuilder.test.js`에서 검증 | 통과 |
| 참고 안내와 최종 프롬프트 분리 | `referenceNotes.js` 분리; `tests/state.test.js`, 브라우저 감사에서 `#referencePreview` 별도 확인 | 통과 |
| 수정 요청이 덧붙임 조각이 아니라 깨끗한 프롬프트로 반영됨 | `tests/revision.test.js` 4개 테스트 통과 | 통과 |
| 완료 세션 저장 | 브라우저 감사에서 완료 후 `teacherPromptGuide.sessions.v1` 세션 1개 확인; `tests/storage.test.js` 저장/20개 제한 검증 | 통과 |
| 진행 중 초안 자동 저장/복원 | 브라우저 감사에서 2단계 진행 후 새로고침, `2 / 10`과 기존 채팅 복원 확인; `tests/storage.test.js`, `tests/state.test.js` 검증 | 통과 |
| 저장 세션 불러오기 | 브라우저 감사에서 저장 세션 클릭 후 최종 프롬프트 표시 및 stale active draft 제거 확인 | 통과 |
| 메모리는 완료 세션에서만 생성 | `tests/memory.test.js`; 브라우저 감사에서 완료 후 memory 5개 생성 | 통과 |
| 메모리는 전체 채팅 전문이 아니라 요약만 저장 | `memory.js`는 `context`, `output`, `useScene`, `quality`, 위험 선택지만 사용; multiline/prompt-like 문자열 sanitizing 테스트 있음 | 통과 |
| 메모리 ON/OFF가 최종 프롬프트에 반영됨 | 브라우저 감사에서 OFF 상태 최종 프롬프트에 `[이전 작업 참고]` 없음, ON 상태에서는 있음 | 통과 |
| 메모리 삭제 | 브라우저 감사에서 `CLEAR MEMORY` 후 memory key 제거 및 UI `0개` 확인 | 통과 |
| 로컬 저장 실패와 깨진 JSON 대응 | `tests/storage.test.js`에서 malformed JSON, failing storage methods, blocked `globalThis.localStorage`, unrelated key 보존 검증 | 통과 |
| 디자인 기준 | `styles.css`가 `../design/variables.css` import 유지, Paperlogy local font 적용, `letter-spacing: -0.02em`, `line-height: 1.3`; Playwright screenshot으로 dark monochrome UI 확인 | 통과 |
| Paperlogy 로컬 사용 | `webapp/assets/fonts/Paperlogy-4Regular.woff2`, `5Medium`, `6SemiBold`, `7Bold`; `@font-face` 확인 | 통과 |
| 로컬 LLM 서버 사용 가능성 | `GET /v1/models`에서 `google/gemma-4-e4b` 확인; chat completion에서 `content: "검증 완료."` 확인 | 부분 통과 |
| 앱 내부 로컬 LLM 호출 | `rg` 검사에서 `fetch`, `XMLHttpRequest`, `WebSocket` 기반 LLM 호출 없음; PRD와 스펙은 AI answer service/LM Studio API 연동을 제외 | 스펙 기준 통과, 기대 기준 미구현 |

## 실행한 검증 명령

```bash
node --check webapp/main.js
node --test
curl -I http://127.0.0.1:8087/webapp/
curl -I http://127.0.0.1:8087/design/variables.css
curl -sS -m 2 http://127.0.0.1:1234/v1/models
```

전체 Node 테스트 결과:

```text
tests 43
pass 43
fail 0
```

브라우저 감사 결과 요약:

```json
{
  "initialMemoryButton": "MEMORY ON",
  "firstFlowSessionCount": 1,
  "firstFlowMemoryCount": 5,
  "draftProgressAfterReload": "2 / 10",
  "memoryOffPromptHasMemory": false,
  "memoryOnPromptHasMemory": true,
  "memoryCleared": true
}
```

로컬 LLM 확인:

```text
GET http://127.0.0.1:1234/v1/models
- google/gemma-4-e4b
- qwen/qwen3.5-9b
- google/gemma-4-e2b
- text-embedding-nomic-embed-text-v1.5
```

```text
POST /v1/chat/completions model=google/gemma-4-e4b max_tokens=1024
content: "검증 완료."
finish_reason: "stop"
```

앱이 만든 최종 프롬프트를 로컬 LLM에 직접 보낸 검증:

```text
httpOk: true
model: google/gemma-4-e4b
promptLength: 1078
contentLength: 1692
hasActivityLanguage: true
finishReason: length
```

해석: 최종 프롬프트는 로컬 LLM에서 실제 결과를 만들 수 있다. 다만 `max_tokens: 1536`에서는 `finish_reason: length`가 발생했으므로, 실제 앱 내부 LLM 호출을 추가할 때는 계획서의 `2500-4000 tokens` 예산을 적용해야 한다.

## 발견한 갭

### 1. 앱 내부 로컬 LLM 호출은 없다

현재 앱은 로컬 LLM을 직접 호출하지 않는다. `webapp/index.html`에는 `MOCK FLOW`와 `LOCAL LLM PLAN`이 표시되고, `webapp/modules/modelProfile.js`에는 모델 ID와 토큰 예산만 있다.

이것은 현재 PRD/스펙과 일치한다.

- PRD: "Building a full AI answer-generation service inside the app is out of scope."
- PRD: "Integration with specific AI vendors is out of scope for the first version."
- 스펙: "LM Studio API 연동"은 이번 범위에서 제외.

따라서 현재 기준에서는 실패가 아니다. 다만 사용자가 "앱 안에서 로컬 LLM까지 직접 실행"을 기대한다면 다음 별도 작업이 필요하다.

- LM Studio OpenAI-compatible client 모듈 추가
- `/v1/models` health check
- `/v1/chat/completions` 호출
- reasoning-only 응답 처리
- 토큰 예산/중단 대응
- 오프라인/서버 미실행 시 fallback UI

### 2. 로컬 LLM 응답에는 충분한 토큰 예산이 필요하다

`google/gemma-4-e4b`는 짧은 `max_tokens`에서는 `reasoning_content`만 길게 생성하고 `content`가 비는 경우가 있었다.
`max_tokens: 1024`에서는 짧은 응답이 정상 생성됐고, 앱 최종 프롬프트 실행 검증은 `max_tokens: 1536`에서 텍스트를 만들었지만 길이 제한으로 잘렸다.

앱 내부 LLM 실행을 추가할 때는 `modelProfile.finalTokens`의 `2500-4000 tokens` 예산이 실제 호출에 반영되어야 한다.

## 최종 판단

현재 구현은 "프롬프트를 설계하고, 로컬에 저장하고, 다음 작업에서 요약 메모리를 참고하며, 다른 AI 도구에 복사 가능한 최종 프롬프트를 만드는 앱"이라는 스펙에는 부합한다.

교사의 생각과 가능성을 확장하는지에 대해서는 다음 근거가 있다.

- 시작부터 결과물을 바로 생성하지 않고, 10단계 질문으로 산출물/장면/맥락/목표/판단 지점/자료/안전/형식/품질을 묻는다.
- 교사 판단 지점을 별도 단계와 최종 프롬프트 섹션으로 보존한다.
- 최종 프롬프트가 교사 판단을 대신하지 말고 선택지와 장단점을 제시하게 한다.
- 이전 작업 메모리는 현재 요청을 덮어쓰지 않는 "참고 경향"으로만 들어간다.
- 개인정보와 외부 서비스 위험은 최종 프롬프트와 참고 안내에 분리 반영된다.

남은 결정은 하나다.

현재 버전을 스펙대로 "로컬 저장형 프롬프트 설계 앱"으로 승인할지, 아니면 다음 범위로 "앱 내부 LM Studio 실행"까지 추가할지 결정해야 한다.
