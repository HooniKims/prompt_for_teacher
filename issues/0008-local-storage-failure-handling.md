---
title: "로컬 저장 실패와 깨진 데이터 대응"
labels:
  - ready-for-agent
  - afk
status: open
type: AFK
spec: "../docs/superpowers/specs/2026-05-18-modular-local-memory-design.md"
---

## What to build

브라우저 로컬 저장소가 없거나, 저장된 JSON이 깨졌거나, 저장 용량이 부족하거나, 기존 데이터 이관에 실패해도 앱이 멈추지 않게 만든다.

사용자는 저장 실패를 알 수 있어야 하지만, 현재 진행 중인 대화 자체는 가능한 한 계속 사용할 수 있어야 한다. 앱은 자신이 관리하는 키 외의 다른 로컬 저장소 값을 건드리면 안 된다.

## Acceptance criteria

- [ ] 저장된 JSON이 깨져 있으면 빈 기본값으로 앱을 계속 실행한다.
- [ ] 저장 용량 초과나 쓰기 실패가 발생하면 토스트로 알려준다.
- [ ] 기존 데이터 이관에 실패하면 기존 값을 삭제하지 않는다.
- [ ] 로컬 저장소 접근이 불가능해도 현재 세션의 인메모리 흐름은 사용할 수 있다.
- [ ] 앱이 관리하는 저장 키 외의 다른 로컬 저장소 값은 수정하거나 삭제하지 않는다.
- [ ] `node --test`로 깨진 JSON, 쓰기 실패, 이관 실패, 기본값 반환을 검증할 수 있다.

## Blocked by

- `issues/0004-active-draft-persistence.md`
- `issues/0005-completed-session-migration.md`
- `issues/0006-summary-memory-extraction.md`
