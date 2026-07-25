/**
 * The squigglevision filter bank.
 *
 * Mounted once in the root layout; the `.squig*` utilities in globals.css point
 * at these ids. Each filter displaces its input with animated turbulence, which
 * is what makes ink line-work look hand-drawn and restless rather than printed.
 * Three variants at different frequencies so neighbouring elements wobble out of
 * sync — a single shared filter reads as a mechanical shimmer.
 *
 * `calcMode="discrete"` steps the seed instead of interpolating it: the drawing
 * redraws a few times a second, the way rough animation does, rather than
 * sliding continuously.
 *
 * Server component — no hooks, no client bundle cost. Reduced-motion users get
 * `filter: none` from CSS, so the animation is simply never applied.
 */
export function SquiggleFilters() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
    >
      <defs>
        <filter id="knot-squiggle-1" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.022"
            numOctaves={2}
            seed={1}
            result="noise"
          >
            <animate
              attributeName="seed"
              values="1;3;5;7;9"
              dur="0.45s"
              calcMode="discrete"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.4" />
        </filter>

        <filter id="knot-squiggle-2" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.038"
            numOctaves={2}
            seed={2}
            result="noise"
          >
            <animate
              attributeName="seed"
              values="2;6;10;14"
              dur="0.38s"
              calcMode="discrete"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" />
        </filter>

        <filter id="knot-squiggle-3" x="-15%" y="-15%" width="130%" height="130%">
          <feTurbulence
            type="turbulence"
            baseFrequency="0.012"
            numOctaves={2}
            seed={7}
            result="noise"
          >
            <animate
              attributeName="seed"
              values="7;11;15;19;23"
              dur="0.6s"
              calcMode="discrete"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.4" />
        </filter>
      </defs>
    </svg>
  );
}
