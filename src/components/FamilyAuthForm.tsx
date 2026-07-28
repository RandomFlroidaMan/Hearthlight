"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function FamilyAuthForm() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [familyName, setFamilyName] = useState("");
  const [familyCode, setFamilyCode] = useState("");
  const [bootstrapCode, setBootstrapCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "login" ? { familyName, familyCode } : { bootstrapCode, familyName, familyCode },
      ),
    });

    setSubmitting(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.message ?? json.error ?? "Something went wrong.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-6">
      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`rounded-full px-4 py-2 ${mode === "login" ? "bg-zinc-50 text-zinc-950" : "border border-zinc-700 text-zinc-400"}`}
        >
          My family already has an account
        </button>
        <button
          type="button"
          onClick={() => setMode("register")}
          className={`rounded-full px-4 py-2 ${mode === "register" ? "bg-zinc-50 text-zinc-950" : "border border-zinc-700 text-zinc-400"}`}
        >
          Set up a new family
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {mode === "register" && (
          <label className="flex flex-col gap-1">
            <span className="text-sm text-zinc-400">Invite code</span>
            <input
              value={bootstrapCode}
              onChange={(e) => setBootstrapCode(e.target.value)}
              placeholder="The code you were given to set this up"
              className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
            />
          </label>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-400">Family name</span>
          <input
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            placeholder="e.g. The Fugetts"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm text-zinc-400">{mode === "login" ? "Family code" : "Choose a family code"}</span>
          <input
            value={familyCode}
            onChange={(e) => setFamilyCode(e.target.value)}
            placeholder="A simple code everyone in the family knows"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
          />
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !familyName || !familyCode || (mode === "register" && !bootstrapCode)}
          className="rounded-full bg-zinc-50 px-5 py-3 font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
        >
          {submitting ? "One moment…" : mode === "login" ? "Enter" : "Create our family"}
        </button>
      </form>
    </div>
  );
}
