export function analysisSourceLabel(provider: string, fallbackReason: string | null) {
  if (provider === "vertex-gemini" && !fallbackReason) {
    return "Gemini가 공개 URL 내용을 분석했습니다.";
  }
  if (fallbackReason === "instagram_access_limited") {
    return "Instagram이 로그인 화면을 보여줘 공개 지표는 직접 확인이 필요합니다. 사용자이름은 그대로 사용할 수 있어요.";
  }
  if (provider === "youtube-oembed") {
    return "YouTube 공개 메타데이터를 확인했습니다. 조회수와 구독자 수는 직접 확인해 주세요.";
  }
  if (provider === "youtube-data-api") {
    return "YouTube 공개 메타데이터와 공개 통계를 확인했습니다.";
  }
  if (provider === "secure-fetch") {
    return fallbackReason
      ? "URL 내용을 읽어 초안을 만들었습니다. 일부 항목은 직접 확인해 주세요."
      : "URL 내용을 읽어 초안을 만들었습니다.";
  }
  return "URL 내용을 자동으로 읽지 못했습니다. 직접 입력한 값으로 계속 진행할 수 있습니다.";
}
