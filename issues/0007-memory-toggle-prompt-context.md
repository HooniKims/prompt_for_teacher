---
title: "메모리 켜기/끄기와 최종 프롬프트 반영"
labels:
  - ready-for-agent
  - hitl
status: open
type: HITL
spec: "../docs/superpowers/specs/2026-05-18-modular-local-memory-design.md"
---

## What to build

교사가 로컬 요약 메모리를 켜고 끌 수 있게 하고, 메모리가 켜져 있을 때만 최종 프롬프트에 이전 작업 참고를 반영한다.

메모리는 현재 요청을 덮어쓰는 근거가 아니라 이전 작업의 경향으로 표시되어야 한다. 화면에는 메모리 상태와 삭제 조작이 작게 보여야 하며, 기존 디자인 기준을 따라야 한다.

## Acceptance criteria

- [ ] 사용자는 메모리 사용을 켜고 끌 수 있다.
- [ ] 메모리 사용 설정은 새로고침 뒤에도 유지된다.
- [ ] 메모리가 켜져 있고 저장된 메모리가 있을 때만 최종 프롬프트에 `[이전 작업 참고]`가 포함된다.
- [ ] 메모리가 꺼져 있으면 저장된 메모리가 있어도 최종 프롬프트에 반영되지 않는다.
- [ ] 사용자는 저장된 메모리를 삭제할 수 있다.
- [ ] 메모리 UI는 왼쪽 히스토리 패널 안의 작은 설정 블록으로 표시되고 기존 디자인 토큰과 스타일을 따른다.
- [ ] HITL 검토에서 메모리 상태 문구와 조작 위치가 교사-facing 도구에 과하지 않은지 확인한다.

## Blocked by

- `issues/0002-prompt-quality-contract.md`
- `issues/0006-summary-memory-extraction.md`
