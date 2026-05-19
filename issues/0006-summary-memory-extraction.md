---
title: "완료 세션에서 가벼운 요약 메모리 만들기"
labels:
  - ready-for-agent
  - afk
status: open
type: AFK
spec: "../docs/superpowers/specs/2026-05-18-modular-local-memory-design.md"
---

## What to build

완료된 세션의 답변에서 다음 작업에 참고할 수 있는 가벼운 요약 메모리를 만든다.

메모리는 전체 채팅 전문이 아니라 교육 및 업무 맥락, 산출물 선호, 사용 장면, 품질 기준, 안전 관련 경향만 담아야 한다. 작성 중인 초안은 메모리로 삼지 않는다.

## Acceptance criteria

- [ ] 완료된 세션에서만 요약 메모리가 생성된다.
- [ ] 요약 메모리는 규칙 기반으로 추출되며 AI 요약 호출을 사용하지 않는다.
- [ ] 메모리는 전체 채팅 전문을 저장하지 않는다.
- [ ] 메모리 목록은 최근 30개까지만 보관한다.
- [ ] 개인정보 또는 외부 서비스 위험 선택지는 안전 관련 메모리로 분류된다.
- [ ] `node --test`로 메모리 추출, 목록 제한, 진행 중 초안 제외를 검증할 수 있다.

## Blocked by

- `issues/0005-completed-session-migration.md`
