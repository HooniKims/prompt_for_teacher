import { steps } from "./steps.js";

const OPTION_IDS = ["A", "B", "C", "D"];

function safeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function summarizeTurns(turns = []) {
  return Array.isArray(turns)
    ? turns
        .map((turn) => `${turn.role === "assistant" ? "가이드" : "교사"}: ${safeText(turn.text)}`)
        .filter(Boolean)
        .join("\n")
    : "";
}

export function quickOptionsForIntent(intentProfile = {}) {
  const outputKind = safeText(intentProfile.outputKind).toLowerCase();
  let labels;

  if (/app|앱|program|프로그램|tool|도구/.test(outputKind)) {
    labels = ["웹앱 또는 웹사이트", "윈도우용 프로그램", "모바일 앱", "아직 구상 중"];
  } else if (/document|문서|admin|행정/.test(outputKind)) {
    labels = ["안내문", "계획서", "회의록 정리", "공문 초안"];
  } else if (/assessment|평가|rubric|루브릭/.test(outputKind)) {
    labels = ["평가 문항", "루브릭", "피드백 문장", "성취기준 정리"];
  } else {
    labels = [steps[0].options[0].label, steps[0].options[1].label, steps[0].options[2].label, steps[0].options[3].label];
  }

  return labels.slice(0, 4).map((label, index) => ({ id: OPTION_IDS[index], label, optional: true }));
}

export function buildNextQuestionMessages({ seed = "", turns = [], memoryItems = [], guideMode = "friendly" } = {}) {
  const memory = memoryItems.map((item) => `- ${safeText(item?.text)}`).filter((line) => line !== "- ").join("\n");
  const transcript = summarizeTurns(turns) || "아직 후속 대화 없음";
  const isThorough = guideMode === "thorough";
  const modeRules = isThorough
    ? `질문 방식: 꼼꼼 확인 모드.\n- grill-me 스타일로 모호한 답변을 그냥 넘기지 않는다.\n- 단, 말투는 초보 선생님에게 부담 없게 부드럽게 유지한다.\n- 만들 것이 웹앱, 웹사이트, 윈도우용 프로그램, 모바일 앱, 수업 자료, 문서 중 어디에 가까운지 초반에 확인한다.\n- 산출물, 사용 장면, 교육 맥락, 목표, 교사 판단, 필요한 자료, 개인정보/민감정보, 외부 서비스, 결과물 모습, 품질 기준 중 빈칸이 있으면 우선순위를 정해 되묻는다.\n- 개인정보, 학생 입력, 외부 서비스, 학습 콘텐츠 심의 신호가 나오면 반드시 쉬운 말로 추가 확인한다.\n- 왼쪽의 10개 항목은 핵심 체크리스트다. 꼼꼼 모드에서는 10번 안에 끝내려 서두르지 말고, 중요한 내용이 비어 있으면 추가 질문을 한다.\n- 충분하지 않으면 final_prompt_ready를 서두르지 않는다.`
    : `질문 방식: 친절 모드.\n- 초보 선생님이 부담 없이 답할 수 있게 부드럽게 묻는다.\n- 만들 것이 웹앱, 웹사이트, 윈도우용 프로그램, 모바일 앱, 수업 자료, 문서 중 어디에 가까운지 초반에 확인한다.\n- 꼭 필요한 내용부터 확인하고, 모호한 부분은 쉬운 선택지로 돕는다.`;

  return [
    {
      role: "system",
      content: `너는 교사용 질문형 프롬프트 가이드다. 초보 선생님이 짧은 자연어 씨앗에서 시작해 만들고 싶은 앱, 프로그램, 수업 자료, 평가 자료, 학교 업무 자료를 생성할 수 있는 최종 프롬프트를 함께 완성하도록 돕는다.\n\n${modeRules}\n\n공통 규칙:\n- 교사용 맥락을 기본으로 하되, 교사가 일반 사용자처럼 앱/프로그램/자료를 만들고 싶어 할 수 있음을 허용한다.\n- 질문, 최종 프롬프트, 참고 안내는 모두 한국어로 작성한다. 사용자가 영어로 입력해도 한국어로 정리한다.\n- 한 번에 하나의 질문만 한다.\n- A/B/C/D 선택지는 보조일 뿐이며 직접 입력이 우선이다.\n- 교사 판단 지점, 개인정보/민감정보, 학생의 외부 서비스 사용 여부를 필요할 때 쉬운 말로 확인한다.\n- 최종 프롬프트에는 교사가 이해하기 쉬운 짧은 요약과 AI가 실행할 상세 프롬프트를 분리한다.\n- AI 실행용 프롬프트는 짧게 요약하지 말고, 개발자나 제작 AI가 바로 실행할 수 있는 요구사항 정의서 수준으로 상세하게 작성한다.\n- AI 실행용 프롬프트에는 사용자 역할, 핵심 기능, 화면 흐름, 기능별 모듈, 데이터 모델, 권한 설계, 개인정보보호를 지키기 위한 구현 계획, 심의 대응에 필요한 구현 계획, 테스트 기준, 완료 기준을 포함한다.\n- 개인정보보호와 학습지원 소프트웨어 심의 규정 설명은 참고 안내로 분리하고, AI 실행용 프롬프트에는 이를 준수하기 위한 화면, 권한, 저장, 삭제, 로그, 내보내기 기능 계획만 담는다.\n- 앱, 웹앱, 프로그램, 복합 자료를 만드는 최종 프롬프트에는 기능별 모듈화를 반드시 요구한다. 예: 화면/UI, 인증과 권한, 데이터 모델, 입력/업로드, 평가 기록, 피드백, 알림, 보안, 개인정보보호 구현, 심의 대응 자료 생성, 테스트.\n- 각 모듈에는 역할, 주요 기능, 입력 데이터, 출력 데이터, 수정할 때 주의할 점을 포함하게 한다.\n- 충분히 모였으면 final_prompt_ready를 반환한다.\n- 반드시 JSON만 반환한다.`
    },
    {
      role: "user",
      content: `초기 씨앗: ${safeText(seed) || "없음"}\n\n누적 대화:\n${transcript}\n\n이전 작업 참고(있으면 참고만):\n${memory || "없음"}\n\n반환 JSON 형식 중 하나:\n{"kind":"question","question":"다음 한 가지 질문","rationale":"왜 이 질문이 필요한지","suggestedOptions":["선택지1","선택지2"],"capturedFacts":{"outputKind":"app|material|document|assessment|unknown"}}\n또는\n{"kind":"final_prompt_ready","finalPrompt":"복사 가능한 최종 프롬프트","referenceNotes":"분리된 참고 안내","rationale":"충분한 이유"}`
    }
  ];
}

export function buildFinalPromptMessages({ seed = "", turns = [], memoryItems = [] } = {}) {
  const transcript = summarizeTurns(turns) || "후속 대화 없음";
  const memory = memoryItems.map((item) => `- ${safeText(item?.text)}`).filter((line) => line !== "- ").join("\n");

  return [
    {
      role: "system",
      content: "너는 교사용 생성 프롬프트 설계자다. 최종 프롬프트와 참고 안내를 분리한다. 교사용 요약은 짧고 쉬워야 하지만, AI 실행용 프롬프트는 개발자나 제작 AI가 바로 실행할 수 있는 요구사항 정의서 수준으로 상세해야 한다. 교사 판단 지점과 안전 확인을 보존한다. 모든 내용은 한국어로 작성한다. 앱, 웹앱, 프로그램, 복합 자료는 기능별 모듈로 나누어 수정과 보완이 쉽도록 설계하게 한다."
    },
    {
      role: "user",
      content: `초기 요청: ${safeText(seed)}\n\n누적 대화:\n${transcript}\n\n이전 작업 참고:\n${memory || "없음"}\n\n복사 가능한 최종 프롬프트를 만들어라. 반드시 [교사용 요약]과 [AI 실행용 프롬프트]를 분리하라. 교사용 요약은 교사가 빠르게 이해할 수 있게 짧게 정리하고, AI 실행용 프롬프트는 실제 제작 AI가 바로 작업할 수 있도록 상세하게 작성하라. 사용자가 직접 요청하지 않았다면 전문 형식 이름을 넣지 말고, 결과물이 어떤 모습이면 좋은지 쉬운 말로 정리하라. 참고 안내가 필요하면 별도 섹션으로 분리하라.\n\nAI 실행용 프롬프트에는 다음을 구체적으로 포함하라: 사용자 역할, 핵심 기능, 화면 흐름, 기능별 모듈, 데이터 모델, 권한 설계, 개인정보보호를 지키기 위한 구현 계획, 심의 대응에 필요한 구현 계획, 테스트 기준, 완료 기준. 개인정보보호와 학습지원 소프트웨어 심의 규정 자체의 설명은 참고 안내로 분리하고, AI 실행용 프롬프트에는 이를 준수하기 위한 화면, 권한, 저장, 삭제, 로그, 내보내기 기능 계획만 담아라.\n\n앱, 웹앱, 프로그램, 복합 자료라면 기능별로 모듈화하라고 명시하라. 모듈 예시는 화면/UI, 인증과 권한, 데이터 모델, 입력/업로드, 평가 기록, 피드백, 알림, 보안, 개인정보보호 구현, 심의 대응 자료 생성, 테스트이다. 각 모듈에는 역할, 주요 기능, 입력 데이터, 출력 데이터, 예외 상황, 수정할 때 주의할 점을 포함하게 하라.`
    }
  ];
}

function optionObjects(values = []) {
  return values
    .map((value) => safeText(value))
    .filter(Boolean)
    .slice(0, 4)
    .map((label, index) => ({ id: OPTION_IDS[index], label, optional: true }));
}

function extractJsonText(text) {
  const trimmed = safeText(text);
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}

function cleanJsonishString(value = "") {
  return safeText(value)
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\")
    .trim();
}

function recoverMalformedFinalPrompt(text = "") {
  if (!/"kind"\s*:\s*"final_prompt_ready"/.test(text)) return null;

  const finalMatch =
    text.match(/"finalPrompt"\s*:\s*"([\s\S]*?)"\s*,\s*"referenceNotes"\s*:/) ||
    text.match(/"finalPrompt"\s*:\s*"([\s\S]*?)"\s*,\s*"rationale"\s*:/) ||
    text.match(/"finalPrompt"\s*:\s*"([\s\S]*?)"\s*}/);
  const referenceMatch =
    text.match(/"referenceNotes"\s*:\s*"([\s\S]*?)"\s*,\s*"rationale"\s*:/) ||
    text.match(/"referenceNotes"\s*:\s*"([\s\S]*?)"\s*}/);
  const finalPrompt = cleanJsonishString(finalMatch?.[1]);

  if (!finalPrompt) return null;

  return {
    kind: "final_prompt_ready",
    finalPrompt,
    referenceNotes: cleanJsonishString(referenceMatch?.[1]),
    rationale: "모델이 엄격한 JSON 대신 복구 가능한 최종 프롬프트 형식으로 응답했습니다."
  };
}

export function parsePlannerResponse(content = "") {
  const text = safeText(content);
  const jsonText = extractJsonText(text);
  if (!text) {
    return {
      ok: false,
      reason: "empty",
      fallback: { kind: "question", question: "응답이 비어 있습니다. 다시 한 번 어떤 자료나 앱을 만들고 싶은지 적어주세요.", suggestedOptions: [] }
    };
  }

  try {
    const parsed = JSON.parse(jsonText);
    if (parsed?.kind === "question" && safeText(parsed.question)) {
      const outputKind = safeText(parsed?.capturedFacts?.outputKind) || "unknown";
      const suggestedOptions = optionObjects(parsed.suggestedOptions);
      return {
        ok: true,
        value: {
          kind: "question",
          question: safeText(parsed.question),
          rationale: safeText(parsed.rationale),
          suggestedOptions: suggestedOptions.length ? suggestedOptions : quickOptionsForIntent({ outputKind }),
          capturedFacts: parsed.capturedFacts && typeof parsed.capturedFacts === "object" ? parsed.capturedFacts : { outputKind }
        }
      };
    }

    if (parsed?.kind === "final_prompt_ready" && safeText(parsed.finalPrompt)) {
      return {
        ok: true,
        value: {
          kind: "final_prompt_ready",
          finalPrompt: safeText(parsed.finalPrompt),
          referenceNotes: safeText(parsed.referenceNotes),
          rationale: safeText(parsed.rationale)
        }
      };
    }

    throw new Error("missing required fields");
  } catch {
    const recoveredFinalPrompt = recoverMalformedFinalPrompt(jsonText);
    if (recoveredFinalPrompt) {
      return {
        ok: true,
        value: recoveredFinalPrompt
      };
    }

    return {
      ok: false,
      reason: "invalid_json",
      fallback: {
        kind: "question",
        question: text.length > 240 ? `${text.slice(0, 240)}…` : text,
        rationale: "모델이 JSON 대신 일반 텍스트를 반환했습니다.",
        suggestedOptions: []
      }
    };
  }
}
