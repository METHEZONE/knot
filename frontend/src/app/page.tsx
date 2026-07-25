import { SplitStage } from "@/features/stage/SplitStage";

/**
 * 앱의 첫 화면은 데모 스테이지 그 자체다.
 *
 * 마케팅 랜딩(thezonebio.com/knot)이 설명을 담당하니 여기서는 설명하지 않고
 * 바로 보여준다 — 두 유저, 두 매니저, 매니저끼리 붙는 딜. 대시보드·협상
 * 시어터·에이전트 맵 같은 감사 화면은 지워지지 않았고 상단바의 작은 링크로만
 * 남아 있다(데모 심사 게이트가 그 화면들을 요구한다).
 *
 * `?demo=` 딥링크는 이제 여기서 처리하지 않는다. 스테이지 자체가 양쪽 유저를
 * 동시에 보여주므로 역할을 하나 골라 들어갈 필요가 없어졌다.
 */
export default function Home() {
  return <SplitStage />;
}
