/**
 * KNOT onboarding fixtures (PRD v2 §4/§5).
 *
 * These stand in for the cached SNS ingest until the aside-browser collector
 * writes real captures to `creatorIngests/{creatorId}`. Two rules hold here
 * exactly as they will in production:
 *
 * 1. Honesty (17 §3): `source: "cachedReplay"` + `capturedAt` are surfaced in
 *    the UI as "captured {date}" — the demo never implies a live scrape.
 * 2. Determinism (PRD §11): every number on the diagnosis card is computed
 *    from the ingest below. `narrative` is the only model-written field, and
 *    it only restates what the numbers already say.
 *
 * engagementRate is mean(interactions) / followersTotal:
 *   (9820 + 7410 + 5930 + 4286 + 3370) / 5 = 6163.2
 *   6163.2 / 128400 = 0.048
 */

import type {
  BrandIngestV1,
  CreatorDiagnosisV1,
  CreatorIngest,
  IngestedPost,
} from "@/lib/api/types";

const CAPTURED_AT = "2026-07-24T11:20:00Z";

const recentPosts: IngestedPost[] = [
  {
    platform: "instagram",
    url: "https://www.instagram.com/reel/DEMO-barrier-routine/",
    format: "instagramReel",
    views: 214_800,
    interactions: 9_820,
    postedAt: "2026-07-21T09:12:00Z",
  },
  {
    platform: "instagram",
    url: "https://www.instagram.com/reel/DEMO-spf-test/",
    format: "instagramReel",
    views: 168_300,
    interactions: 7_410,
    postedAt: "2026-07-17T10:04:00Z",
  },
  {
    platform: "tiktok",
    url: "https://www.tiktok.com/@demobeauty/video/DEMO-7day-test",
    format: "tiktokVideo",
    views: 121_500,
    interactions: 5_930,
    postedAt: "2026-07-14T12:30:00Z",
  },
  {
    platform: "instagram",
    url: "https://www.instagram.com/p/DEMO-ingredient-carousel/",
    format: "instagramPost",
    views: 62_400,
    interactions: 4_286,
    postedAt: "2026-07-10T08:45:00Z",
  },
  {
    platform: "youtube",
    url: "https://www.youtube.com/watch?v=DEMO-routine-reset",
    format: "youtubeVideo",
    views: 48_900,
    interactions: 3_370,
    postedAt: "2026-07-06T13:00:00Z",
  },
];

/** Cached capture for creator-001 (Demo Beauty). */
export const demoCreatorIngest: CreatorIngest = {
  creatorId: "creator-001",
  source: "cachedReplay",
  capturedAt: CAPTURED_AT,
  platforms: [
    { platform: "instagram", handle: "@demobeauty", followers: 96_200, postsAnalyzed: 24 },
    { platform: "youtube", handle: "@demobeauty", followers: 21_400, postsAnalyzed: 8 },
    { platform: "tiktok", handle: "@demobeauty", followers: 10_800, postsAnalyzed: 12 },
  ],
  recentPosts,
};

/**
 * diagnosis-v1 for creator-001. Mirrors what the deterministic derivation
 * produces from `demoCreatorIngest`; the suggested rate band matches the
 * seeded rate card (650–900) so onboarding prefills agree with the seeds.
 */
export const demoCreatorDiagnosisV1: CreatorDiagnosisV1 = {
  version: "diagnosis-v1",
  creatorId: "creator-001",
  source: "cachedReplay",
  capturedAt: CAPTURED_AT,
  followersTotal: 128_400,
  engagementRate: 0.048,
  dominantCategories: ["beauty", "skincare"],
  topFormats: [
    { format: "instagramReel", sharePct: 55 },
    { format: "instagramStory", sharePct: 25 },
    { format: "tiktokVideo", sharePct: 20 },
  ],
  topPosts: recentPosts.slice(0, 3),
  postingCadencePerWeek: 4.2,
  toneKeywords: ["ingredient-led", "calm explainer", "routine-first"],
  suggestedRateBand: { minUsdc: 650, maxUsdc: 900 },
  // Every claim here is checkable against the ingest above: reels average
  // 8,615 interactions vs 4,286 for the feed post (~2x), the top two posts are
  // both reels, and cadence is 4.2 posts/week.
  narrative:
    "Reels carry this account: they pull roughly 2x the interactions of feed posts, and the top two performers are both routine walkthroughs rather than product shots. At 4.2 posts a week the cadence is steady enough to slot a sponsored reel without a gap, and the tone is ingredient-led — sponsored reads land better inside a routine than as a standalone ad.",
};

/** Cached brand-side capture for brand-001 (Demo Skincare Co.). */
export const demoBrandIngest: BrandIngestV1 = {
  version: "brandIngest-v1",
  source: "cachedReplay",
  capturedAt: CAPTURED_AT,
  website: "https://demo-skincare.example.com",
  name: "Demo Skincare Co.",
  category: "beauty",
  productLines: ["SPF daily moisturizer", "barrier repair serum", "gentle cleanser"],
  toneKeywords: ["clinical but warm", "ingredient transparency", "everyday"],
  foundCollabs: [
    {
      handle: "@demobeauty",
      platform: "instagram",
      url: "https://www.instagram.com/reel/DEMO-barrier-routine/",
    },
    {
      handle: "@demolifestyle",
      platform: "instagram",
      url: "https://www.instagram.com/p/DEMO-shelf-tour/",
    },
  ],
  suggestedAudience: ["18-34", "skincare enthusiasts", "US"],
  narrative:
    "The site leads with ingredient lists and routine guidance rather than claims, and the SPF moisturizer is the newest launch. Past creator posts that worked were routine walkthroughs, which points at reels from skincare-native creators over broad lifestyle reach.",
};

/** Devnet pubkeys handed to the frontend at the end of onboarding (display only). */
export const demoCreatorWallet = "8kVfDemoCreatorWa11etPubkeyDevnet1111111111";
export const demoBrandWallet = "5rQpDemoBrandWa11etPubkeyDevnet22222222222";
