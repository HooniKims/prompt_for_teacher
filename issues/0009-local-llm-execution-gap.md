---
title: "앱 내부 로컬 LLM 실행 여부 결정"
labels:
  - hitl
  - decision-approved
status: approved-for-implementation
type: HITL
spec: "../docs/superpowers/specs/2026-05-18-modular-local-memory-design.md"
verification: "../docs/superpowers/verification/2026-05-18-modular-local-memory-audit.md"
---

## Why this exists

검증 중 로컬 LLM 관련 기대와 현재 스펙 사이의 경계가 드러났다.

현재 구현은 최종 프롬프트를 만들어 다른 AI 도구나 로컬 LLM에 붙여 넣을 수 있게 하는 앱이다.
앱 내부에서 LM Studio API를 직접 호출하지는 않는다.

현재 스펙과 PRD는 다음을 제외한다.

- LM Studio API 연동
- 특정 AI 벤더 또는 로컬 LLM 직접 실행
- 앱 안에서 AI 답변 생성 서비스 만들기

하지만 검증 목표에는 "로컬 LLM 사용은 잘 되는지"가 포함되어 있었다.
따라서 다음 범위로 앱 내부 로컬 LLM 실행까지 넣을지 사용자 결정이 필요하다.

## Evidence from verification

- `GET http://127.0.0.1:1234/v1/models`는 `google/gemma-4-e4b`를 반환했다.
- `POST /v1/chat/completions`는 `google/gemma-4-e4b`에서 텍스트 응답을 만들 수 있었다.
- 앱이 만든 최종 프롬프트를 로컬 LLM에 직접 보냈을 때 수업/활동지 관련 응답이 생성됐다.
- 단, `max_tokens: 1536`에서는 `finish_reason: length`가 발생했다.
- 현재 앱 코드에는 로컬 LLM 호출용 `fetch`, `XMLHttpRequest`, `WebSocket` 경로가 없다.

## Decision needed

둘 중 하나를 선택해야 한다.

1. 현재 버전을 스펙대로 승인한다.
   - 앱 역할: 교사와 함께 최종 프롬프트를 설계하고, 로컬 저장소/메모리로 이어서 작업하게 돕는다.
   - 로컬 LLM 사용 방식: 생성된 최종 프롬프트를 사용자가 LM Studio 등에 복사해서 실행한다.

2. 다음 범위로 앱 내부 로컬 LLM 실행을 추가한다.
   - `localLlmClient.js` 같은 모듈을 추가한다.
   - `http://127.0.0.1:1234/v1/models` health check를 제공한다.
   - `google/gemma-4-e4b` 또는 사용자가 선택한 모델로 `/v1/chat/completions`를 호출한다.
   - reasoning-only 응답, token length 종료, 서버 미실행, 모델 미로드를 UI에서 처리한다.
   - 최종 프롬프트 실행 결과를 별도 패널에 보여준다.

## Acceptance criteria if option 2 is approved

- [ ] 앱이 LM Studio OpenAI-compatible endpoint의 모델 목록을 확인한다.
- [ ] 모델이 없거나 서버가 꺼져 있으면 UI가 멈추지 않고 안내한다.
- [ ] 최종 프롬프트를 로컬 LLM에 보낼 수 있다.
- [ ] `content`가 비어 있고 `reasoning_content`만 있는 응답을 실패 또는 별도 상태로 처리한다.
- [ ] `finish_reason: length`가 발생하면 토큰 예산을 늘리거나 결과가 잘렸음을 알려준다.
- [ ] 로컬 LLM 실행 결과는 최종 프롬프트와 구분해서 표시한다.
- [ ] 기존 로컬 저장소/메모리 기능을 깨지 않는다.



## Decision update

Approved through `.omx/specs/deep-interview-webapp-ai-collaboration-theme.md` and planned in `.omx/plans/ralplan-webapp-ai-collaboration-theme.md`. The app should add in-browser LM Studio/OpenAI-compatible local LLM execution without login or server construction. Local LLM connection is a prerequisite for the core AI collaboration flow; if unavailable, the app should block conversation start while leaving setup guidance, retry, and theme controls available.
