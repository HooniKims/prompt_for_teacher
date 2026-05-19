---
title: "기존 10단계 흐름을 ES 모듈 구조로 유지하기"
labels:
  - ready-for-agent
  - afk
status: open
type: AFK
spec: "../docs/superpowers/specs/2026-05-18-modular-local-memory-design.md"
---

## What to build

현재 정적 웹앱의 10단계 질문형 흐름을 유지하면서, 한 파일에 몰린 책임을 기능별 ES 모듈로 나눈다.

사용자는 이전과 같이 자연어 요청을 입력하고, 한 번에 하나씩 질문에 답하고, 최종 프롬프트와 참고 안내를 분리해서 볼 수 있어야 한다. 구현 구조만 나뉘어야 하며, 기존 교사-facing 경험이 깨지면 안 된다.

## Acceptance criteria

- [ ] 브라우저는 ES 모듈 진입점을 통해 앱을 실행한다.
- [ ] 기존 10단계 질문 순서와 A/B/C/D 선택 흐름이 유지된다.
- [ ] 최종 프롬프트와 참고 안내가 기존처럼 분리되어 표시된다.
- [ ] 복사 버튼, 단계 진행 표시, 저장된 세션 목록 렌더링이 기존 동작을 유지한다.
- [ ] 새 UI나 변경된 UI는 기존 `/design` 기준의 dark monochrome 스타일을 따른다.
- [ ] 앱 타이포그래피는 로컬 Paperlogy 웹폰트를 우선 사용하고, 기본 자간 `-0.02em`, 줄간격 `1.3` 기준을 따른다.
- [ ] `node --test`와 `node --check`로 분리된 순수 모듈과 진입점 문법을 검증할 수 있다.

## Blocked by

- `issues/0002-prompt-quality-contract.md`
