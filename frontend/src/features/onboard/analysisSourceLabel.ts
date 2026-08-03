export function analysisSourceLabel(provider: string, fallbackReason: string | null) {
  if (provider === "vertex-gemini" && !fallbackReason) {
    return "Gemini가 공개 URL 내용을 분석했습니다.";
  }
  if (provider === "secure-fetch") {
    return fallbackReason
      ? "URL 내용을 읽어 초안을 만들었습니다. 일부 항목은 직접 확인해 주세요."
      : "URL 내용을 읽어 초안을 만들었습니다.";
  }
  return "URL 내용을 자동으로 읽지 못했습니다. 직접 입력한 값으로 계속 진행할 수 있습니다.";
}
