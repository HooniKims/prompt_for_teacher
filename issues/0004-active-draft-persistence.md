---
title: "진행 중 채팅 자동 저장과 복원"
labels:
  - ready-for-agent
  - afk
status: open
type: AFK
spec: "../docs/superpowers/specs/2026-05-18-modular-local-memory-design.md"
---

## What to build

교사가 10단계 흐름을 진행하는 중에도 현재 대화가 브라우저 로컬 저장소에 자동 저장되게 만든다.

페이지를 새로고침하거나 다시 접속해도 현재 단계, 채팅 메시지, 답변, 최종 프롬프트, 참고 안내를 복원해 이어서 작업할 수 있어야 한다. 사용자가 새로 시작하고 싶을 때는 현재 초안을 지울 수 있어야 한다.

## Acceptance criteria

- [ ] 사용자가 요청을 입력하거나 선택지에 답할 때마다 진행 중 초안이 저장된다.
- [ ] 페이지를 새로고침하면 저장된 진행 중 초안이 같은 단계와 메시지 상태로 복원된다.
- [ ] 10단계 흐름이 완료되어 세션으로 저장되면 진행 중 초안은 지워진다.
- [ ] 사용자가 현재 초안을 지우고 새 작업을 시작할 수 있다.
- [ ] 진행 중 초안은 요약 메모리로 사용되지 않는다.
- [ ] `node --test`로 초안 저장 대상 상태와 복원 동작을 검증할 수 있다.

## Blocked by

- `issues/0003-es-module-flow-refactor.md`
