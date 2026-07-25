"use client";

/**
 * Share a public negotiation replay to X via the post intent URL.
 * The replay URL is read from the browser at click time so shared links
 * always point at the page being viewed.
 */
export function ShareToXButton({ text }: { text: string }) {
  const share = () => {
    const intent = new URL("https://x.com/intent/post");
    intent.searchParams.set("text", text);
    intent.searchParams.set("url", window.location.href);
    window.open(intent.toString(), "_blank", "noopener,noreferrer");
  };

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-2 sketch-pill ink border border-border-subtle bg-surface px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-raised"
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      Share to X
    </button>
  );
}
