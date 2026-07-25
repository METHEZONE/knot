/**
 * X unfurls `twitter:image` before `og:image` when both are present. Same
 * card either way, so this just re-exports the OG image route.
 */
export { default, alt, size, contentType } from "./opengraph-image";
