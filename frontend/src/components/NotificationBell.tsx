"use client";

/**
 * In-app notification feed.
 *
 * Client-side merge of timeline events across the user's promotions into one
 * reverse-chronological feed. Unread count is tracked against a local
 * last-seen watermark (localStorage); opening the dropdown marks the feed
 * read while still highlighting which items were new.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { knotProvider } from "@/lib/api/provider";
import { describeTimelineEvent } from "@/lib/timeline";
import { formatDateTime } from "@/lib/format";

const LAST_SEEN_KEY = "knot.notifications.lastSeenAt";
const MAX_PROMOTIONS = 6;
const MAX_ITEMS = 30;
const REFRESH_INTERVAL_MS = 30_000;

interface NotificationItem {
  id: string;
  promotionId: string;
  promotionTitle: string;
  type: string;
  message: string;
  createdAt: string;
}

function readLastSeen(): number {
  try {
    const raw = window.localStorage.getItem(LAST_SEEN_KEY);
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

function writeLastSeen(ms: number) {
  try {
    window.localStorage.setItem(LAST_SEEN_KEY, String(ms));
  } catch {
    // storage unavailable — unread state just resets next visit
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  // Server render has no items (unread is 0 either way), so reading the
  // watermark lazily on the client cannot cause a hydration mismatch.
  const [lastSeen, setLastSeen] = useState(() =>
    typeof window === "undefined" ? 0 : readLastSeen(),
  );
  /** Watermark captured when the dropdown opened, so new items stay marked. */
  const [openedWatermark, setOpenedWatermark] = useState(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const { promotions } = await knotProvider.listPromotions(signal);
      const recent = promotions.slice(0, MAX_PROMOTIONS);
      const timelines = await Promise.all(
        recent.map((p) =>
          knotProvider
            .getPromotionTimeline(p.promotionId, signal)
            .then(({ events }) =>
              events.map(
                (event): NotificationItem => ({
                  id: `${p.promotionId}:${event.eventId}`,
                  promotionId: p.promotionId,
                  promotionTitle: p.title,
                  type: event.type,
                  message: describeTimelineEvent(event),
                  createdAt: event.createdAt,
                }),
              ),
            )
            .catch(() => [] as NotificationItem[]),
        ),
      );
      const merged = timelines
        .flat()
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )
        .slice(0, MAX_ITEMS);
      setItems(merged);
    } catch {
      // keep whatever we had — the bell never fabricates notifications
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Initial feed fetch: every setState in `load` happens after an await,
    // never synchronously in the effect body.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(controller.signal);
    const timer = setInterval(() => load(controller.signal), REFRESH_INTERVAL_MS);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [load]);

  const unreadCount = items.filter(
    (item) => new Date(item.createdAt).getTime() > lastSeen,
  ).length;

  const toggle = () => {
    if (!open) {
      setOpenedWatermark(lastSeen);
      const now = Date.now();
      setLastSeen(now);
      writeLastSeen(now);
      load();
    }
    setOpen((v) => !v);
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        onClick={toggle}
        className={`relative rounded-full border border-border-subtle bg-surface p-2 transition-colors hover:text-foreground ${
          open ? "text-foreground" : "text-muted"
        }`}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center sketch-pill bg-accent px-1 font-mono text-[10px] font-semibold text-background">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away layer */}
          <button
            type="button"
            aria-label="Close notifications"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden sketch ink border border-border-subtle bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-2.5">
              <span className="text-xs font-medium text-foreground">
                Notifications
              </span>
              <span className="font-mono text-[10px] text-muted">
                across your promotions
              </span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted">
                  Agent activity on your promotions will appear here.
                </div>
              ) : (
                <ol className="divide-y divide-border-subtle">
                  {items.map((item) => {
                    const isNew =
                      new Date(item.createdAt).getTime() > openedWatermark;
                    return (
                      <li key={item.id}>
                        <Link
                          href={`/promotions/${item.promotionId}`}
                          onClick={() => setOpen(false)}
                          className="flex gap-3 px-4 py-3 transition-colors hover:bg-surface-raised"
                        >
                          <span
                            className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                              isNew ? "bg-accent" : "bg-border-subtle"
                            }`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs text-foreground">
                              {item.message}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-muted">
                              {item.promotionTitle} ·{" "}
                              {formatDateTime(item.createdAt)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
