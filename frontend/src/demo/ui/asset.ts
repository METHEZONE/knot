/**
 * basePath 대응 에셋 경로 — thezonebio.com/knot처럼 서브패스로 서빙될 때
 * public 에셋 참조("/demo/…")에 접두사를 붙인다. 외부 URL은 그대로.
 */
export function withBase(path: string): string {
  if (!path.startsWith("/")) return path;
  return (process.env.NEXT_PUBLIC_KNOT_BASE_PATH ?? "") + path;
}
