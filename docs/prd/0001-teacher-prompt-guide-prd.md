# PRD: AI 이전에 사람이 있다 - 질문형 교사용 프롬프트 가이드

## Problem Statement

교사는 수업 준비와 행정업무에서 AI를 활용하고 싶지만, 기존 자료는 대부분 복사해서 쓰는 프롬프트 예시 모음에 머무른다. 이런 자료는 AI 모델이나 서비스가 바뀌면 쉽게 낡고, 교사의 수업 맥락, 행정 상황, 교육과정, 개인정보 보호, 외부 서비스 사용 여부를 충분히 반영하지 못한다.

교사에게 필요한 것은 특정 프롬프트 문장을 외우는 것이 아니라, 자신의 목적과 맥락을 정리하고 AI에게 무엇을 맡길지, 무엇은 교사가 직접 판단해야 하는지를 구분하는 과정이다. 교사의 판단과 질문을 중심에 두지 않으면 AI 활용은 편리해질 수는 있어도 교사 주도성을 약화시킬 수 있다.

## Solution

`AI 이전에 사람이 있다: 생각의 힘, 사고의 단단함`이라는 방향 아래, 수업 준비와 행정업무에서 교사의 판단과 질문을 중심으로 AI 프롬프트를 설계하도록 돕는 **질문형 프롬프트 가이드**를 만든다.

이 가이드는 단순한 프롬프트 모음집이 아니라, 교사가 산출물, 사용 장면, 교육 및 업무 맥락, 목표, 교사 판단 지점, 필요한 자료, 안전 확인, 외부 도구 및 서비스 여부, 출력 형식, 품질 기준을 차례로 점검하도록 돕는다. 최종 산출물은 다른 AI 서비스에 복사해 사용할 수 있는 `최종 프롬프트`와, 개인정보 보호 및 학습지원 소프트웨어 관련 근거를 쉬운 말로 설명하는 `참고 안내`로 분리한다.

사용자는 프롬프트가 마음에 들지 않을 경우 자연어로 수정 의견을 말할 수 있고, 시스템은 그 피드백을 반영해 프롬프트 전체를 다시 정리한다.

## User Stories

1. As a teacher, I want to describe my task in natural language, so that I do not need to classify it as lesson work or administrative work first.
2. As a teacher, I want the guide to infer whether my request is about teaching, administration, or both, so that the questions feel relevant to my actual work.
3. As a teacher, I want the guide to ask one focused question at a time, so that I can think without being overwhelmed.
4. As a teacher, I want the guide to first clarify the output I need, so that the final prompt is shaped around a concrete product.
5. As a teacher, I want the guide to ask where the output will be used, so that the prompt reflects whether it is for class preparation, class use, assessment, feedback, administration, guidance, or collaboration.
6. As a teacher, I want the guide to capture the educational and work context, so that school level, grade, subject, unit, class situation, and administrative background are reflected.
7. As a teacher, I want the guide to clarify the goal of the task, so that the AI output supports the actual improvement I want.
8. As a teacher, I want the guide to identify decisions that AI should not make for me, so that I remain the educational and professional decision maker.
9. As a teacher, I want the guide to ask what source material is available, so that achievement standards, existing materials, meeting notes, school forms, and prior student responses can be used appropriately.
10. As a teacher, I want the guide to check whether real student information is included, so that I avoid exposing names, faces, student numbers, contact details, grades, counseling details, or other sensitive information.
11. As a teacher, I want safety questions to be written in plain language, so that I can understand the risk without legal jargon.
12. As a teacher, I want the guide to ask whether students will use an external service directly, so that I can notice when learning support software review may be needed.
13. As a teacher, I want the guide to ask whether student information will enter an outside service, so that I can avoid unintended privacy risks.
14. As a teacher, I want the guide to ask whether vendor-provided learning content is involved, so that the connection to learning support software standards is not missed.
15. As a teacher, I want the guide to include concise reference notes when safety issues arise, so that I understand which rule or guideline the question is connected to.
16. As a teacher, I want the reference notes to point to the relevant part of the guideline, so that I do not only see a vague source title.
17. As a teacher, I want the final prompt and reference notes separated, so that I can copy only the prompt when I need to use another AI tool.
18. As a teacher, I want the final prompt to work across ChatGPT, Gemini, Claude, Copilot, and similar tools, so that I am not locked into one service.
19. As a teacher, I want the final prompt to have a stable structure, so that role, situation, goal, context, instructions, constraints, output format, quality criteria, and missing information handling are clear.
20. As a teacher, I want the prompt to tell the AI not to guess missing critical information, so that risky or inaccurate outputs are reduced.
21. As a teacher, I want the guide to recommend directions while asking for my judgment, so that AI supports my thinking rather than replacing it.
22. As a teacher, I want the guide to use a colleague-like tone, so that it feels like collaborative planning rather than inspection.
23. As a teacher, I want the guide to support both lesson preparation and administrative work, so that I can use one consistent process across my real workload.
24. As a teacher, I want the guide to handle mixed tasks, so that a request involving lesson design and parent communication can be treated as one coherent workflow.
25. As a teacher, I want to copy the final prompt with one action, so that I can quickly use it in another AI service.
26. As a teacher, I want to copy the reference notes separately, so that I can keep or share the rationale without mixing it into the prompt.
27. As a teacher, I want to point out what I dislike about the prompt, so that I can revise tone, specificity, structure, safety language, or educational focus.
28. As a teacher, I want the system to regenerate the full prompt after revisions, so that I always have a clean copy-ready version.
29. As a teacher, I want the system to briefly explain what changed after revision, so that I can evaluate whether my feedback was applied.
30. As a teacher, I want the system to avoid frightening or accusatory privacy language, so that safety checks remain usable in real school contexts.
31. As a teacher, I want the system to enforce privacy checks even when phrased gently, so that important safety obligations are not weakened.
32. As a teacher, I want the guide to help me distinguish teacher-only preparation tools from tools students directly use, so that I can judge whether additional review is needed.
33. As a guide author, I want the guide to avoid terms like "harness" in teacher-facing language, so that the concept is accessible to ordinary teachers.
34. As a guide author, I want the internal design to preserve the idea of a harness, so that input collection, context selection, safety checks, generation, quality review, and revision work together.
35. As a guide author, I want the terminology to remain consistent with the project glossary, so that future writing does not drift into "copy-paste promptbook" language.
36. As a future student-guide author, I want the teacher guide structure to be extensible, so that it can later support a student-facing question-centered AI collaboration guide.

## Implementation Decisions

- The product should be described to teachers as a **질문형 프롬프트 가이드**, not as a harness, even though the internal design follows harness engineering principles.
- The primary value is **교사 주도성**. Practicality, safety, educational context, and revision are not secondary decorations; they are required to make teacher agency real.
- The first internal classification should identify the intended output before classifying the request as teaching or administrative work.
- The guide should not require users to choose between teaching and administration at the start. It should infer whether the request is teaching-related, administrative, mixed, or other from the user's natural language.
- The question flow should follow ten conceptual stages: output, use scene, educational and work context, goal, teacher judgment point, source material, safety check, external tool and service check, output format, and quality or revision criteria.
- The ten stages should be an internal structure. The teacher-facing experience should ask one natural question at a time and optionally show lightweight progress.
- The safety layer should always be active. It should use plain language to check for real student information, sensitive information, external service entry, student login, student answer submission, and vendor-provided learning content.
- The guide should separate `최종 프롬프트` from `참고 안내`. The final prompt should remain copy-ready, while reference notes explain relevant privacy or learning support software criteria.
- Reference notes should not merely name a regulation. They should include the relevant part, a plain-language explanation, and why it matters for the current request.
- The prompt generator should produce generic prompts usable across major AI tools, while leaving room for future service-specific adaptation if requested.
- The final prompt structure should include role, situation, goal, available information, task instructions, required conditions, output format, quality criteria, and what to do when information is missing.
- The revision loop should accept natural-language feedback and regenerate the full prompt, while briefly summarizing meaningful changes.
- The user interface should support separate copy actions for the final prompt and the reference notes.
- A deep module should encapsulate request interpretation and stage selection behind a simple interface that receives the conversation state and returns the next best question or readiness to generate.
- A deep module should encapsulate safety and regulation matching behind a simple interface that receives detected risk signals and returns plain-language questions plus reference notes.
- A deep module should encapsulate final prompt assembly behind a simple interface that receives normalized answers and returns the copy-ready prompt plus separated reference notes.
- A deep module should encapsulate revision handling behind a simple interface that receives the current prompt and feedback, then returns a revised prompt and concise change summary.
- The regulation knowledge base should store source title, relevant section, plain-language explanation, teacher-facing question, risk signal, recommended action, source URL, and last-verified date.
- The system should be designed so future student-facing guides can reuse the same question-flow architecture while changing the value focus from teacher judgment to learner agency.

## Testing Decisions

- Tests should focus on external behavior: what question is asked next, what safety check is triggered, what prompt is generated, and how feedback changes the prompt.
- Tests should not assert internal chain-of-thought, hidden classifications, or implementation-specific prompt wording unless that wording is part of the user-facing contract.
- The request interpretation module should be tested with teaching, administrative, mixed, vague, and safety-sensitive examples.
- The question stage module should be tested to ensure it asks one focused question at a time and advances only when the needed information is present.
- The safety and regulation module should be tested with examples containing student names, grades, counseling details, external logins, answer submissions, vendor content, and teacher-only preparation work.
- The reference note module should be tested to ensure it returns relevant section names and plain-language explanations instead of only generic source titles.
- The final prompt assembly module should be tested to ensure the generated prompt includes role, situation, goal, available information, task instructions, required conditions, output format, quality criteria, and missing-information handling.
- The revision module should be tested with feedback about tone, specificity, student level, administrative formality, privacy language, and output format.
- Copy actions should be tested from the user's perspective: final prompt copy should exclude reference notes, and reference note copy should exclude the final prompt.
- Regression tests should include mixed teaching-administration scenarios, because these are central to the user's requirements.
- No prior implementation tests exist in the current workspace, so the first implementation should establish a small behavior-focused test suite around the deep modules before building a broad UI test suite.

## Out of Scope

- Building a full AI answer-generation service inside the app is out of scope. The core product is a prompt design and revision tool.
- Student-facing prompt guidance is out of scope for this PRD, although the architecture should remain extensible for it.
- Full legal compliance automation is out of scope. The product provides plain-language safety checks and reference guidance, not legal advice.
- Automatic submission to school committees or administrative approval workflows is out of scope.
- Integration with specific AI vendors is out of scope for the first version. The default output should be tool-agnostic.
- User account systems, school-wide deployment controls, analytics dashboards, and collaboration permissions are out of scope for the first version.
- Building the complete regulation database from every national and local source is out of scope for the first version, but the knowledge base schema should support future expansion.

## Further Notes

- The working title is `AI 이전에 사람이 있다`, with the subtitle `생각의 힘, 사고의 단단함`.
- The teacher-facing terminology should avoid "하네스" unless explaining internal methodology to developers or guide authors.
- The project should consistently use **질문형 프롬프트 가이드**, **교사 주도성**, **교사 판단 지점**, **안전 확인**, **참고 안내**, and **학습지원 소프트웨어** as defined in the glossary.
- The guide should be framed as a response to the limitation of copy-paste prompt collections: it is a process for preserving teacher judgment while making AI use practical.
- The first public-facing materials should emphasize that AI is a tool and that education is completed by human questions and judgment.
