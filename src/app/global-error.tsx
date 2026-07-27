"use client";

/** Catches errors thrown by the root layout itself, where the normal
 * error.tsx boundary can't reach (it wraps everything *below* layout.tsx,
 * not the layout). Must render its own <html>/<body> — global-error
 * replaces the root layout entirely when active, so none of globals.css's
 * theme variables are available here. */
export default function GlobalError({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", fontFamily: "Arial, Helvetica, sans-serif", textAlign: "center" }}>
        <h2>Something went wrong.</h2>
        <button
          onClick={() => unstable_retry()}
          style={{ borderRadius: "9999px", background: "#18181b", color: "#fafafa", padding: "0.5rem 1.25rem", fontSize: "0.875rem", fontWeight: 500, border: "none", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
