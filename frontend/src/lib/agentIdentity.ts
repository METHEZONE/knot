/**
 * Deterministic agent identity — the parametric character system (PRD v2 §13).
 *
 * An agent's look and name are derived, never stored: the same agentId and
 * diagnosis category always produce the same character, on every screen and in
 * every session, with no server round trip. Category drives palette and
 * accessory (documented table below); the agentId hash fills in the rest.
 *
 * Used by both the UI (AgentAvatar, AgentCharacter, hatching ceremony) and the
 * demo provider, so the agent that hatches is the agent that shows up later.
 */

export type AgentSide = "brand" | "creator";

export type Accessory =
  | "sparkle"
  | "headband"
  | "cap"
  | "visor"
  | "chefHat"
  | "leaf"
  | "antenna";

export type EyeStyle = "round" | "wide" | "calm";
export type BodyShape = "capsule" | "bell" | "block";
export type Prop = "briefcase" | "clipboard" | "phone" | "mic";

export interface AgentTraits {
  side: AgentSide;
  /** Display name the agent greets with. */
  name: string;
  hue: number;
  /**
   * KNOT draws in ink on paper, so every stroke is the same near-black and the
   * category hue survives as colored-pencil fill instead of as line colour:
   * - `ink` — all outlines. Never varies; that is what keeps it a drawing.
   * - `inkSoft` — pale wash inside shapes.
   * - `tint` — accessories and badges, where the category should be readable.
   * - `inkGlow` — translucent halo behind the character.
   */
  ink: string;
  inkSoft: string;
  tint: string;
  inkGlow: string;
  accessory: Accessory;
  eyes: EyeStyle;
  body: BodyShape;
  prop: Prop;
}

/** The single ink colour. Matches `--border` / `--foreground` in globals.css. */
export const INK = "#1c1c1a";

/**
 * Category → palette/accessory. Extend this table rather than hashing new
 * categories, so a beauty agent always reads as a beauty agent.
 */
const CATEGORY_TRAITS: Record<string, { hue: number; accessory: Accessory }> = {
  beauty: { hue: 330, accessory: "sparkle" },
  skincare: { hue: 192, accessory: "sparkle" },
  fitness: { hue: 145, accessory: "headband" },
  wellness: { hue: 168, accessory: "leaf" },
  lifestyle: { hue: 38, accessory: "cap" },
  food: { hue: 20, accessory: "chefHat" },
  tech: { hue: 250, accessory: "visor" },
  gaming: { hue: 278, accessory: "visor" },
  travel: { hue: 205, accessory: "cap" },
};

const NAMES = [
  "Nari",
  "Ollie",
  "Pim",
  "Tobi",
  "Juno",
  "Remi",
  "Kip",
  "Sora",
  "Wren",
  "Ida",
  "Momo",
  "Bo",
] as const;

const EYES: EyeStyle[] = ["round", "wide", "calm"];
const BODIES: BodyShape[] = ["capsule", "bell", "block"];

/** FNV-1a — small, stable, and identical across server and client renders. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function pick<T>(list: readonly T[], seed: number): T {
  return list[seed % list.length];
}

export function agentTraits(
  agentId: string,
  side: AgentSide,
  category?: string,
): AgentTraits {
  const seed = hash(agentId);
  const mapped = category ? CATEGORY_TRAITS[category.toLowerCase()] : undefined;

  // Uncategorised agents still get a stable hue, just not a meaningful one.
  const baseHue = mapped ? mapped.hue : seed % 360;
  // A brand manager and a creator manager in the same category would otherwise
  // come out identically coloured — which is exactly the case on the demo
  // stage, where both sides sit next to each other. Rotating the brand side
  // keeps the category readable while making the two sides instantly distinct.
  const hue = (side === "brand" ? baseHue + 158 : baseHue) % 360;
  const accessory = mapped ? mapped.accessory : "antenna";

  return {
    side,
    name: pick(NAMES, seed >>> 3),
    hue,
    ink: INK,
    inkSoft: `hsl(${hue} 72% 91%)`,
    tint: `hsl(${hue} 56% 56%)`,
    inkGlow: `hsl(${hue} 74% 88% / 0.55)`,
    accessory,
    eyes: pick(EYES, seed >>> 7),
    // Brand managers read as boxier; creator managers softer.
    body: side === "brand" ? "block" : pick(BODIES, seed >>> 11),
    prop: side === "brand" ? pick(["briefcase", "clipboard"] as const, seed >>> 13) : pick(["phone", "mic"] as const, seed >>> 13),
  };
}

/** Full name as shown in the greeting line: "Nari, your creator manager". */
export function agentRoleLine(traits: AgentTraits): string {
  return traits.side === "brand"
    ? `${traits.name}, your brand manager`
    : `${traits.name}, your creator manager`;
}
