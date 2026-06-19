"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const ROLE_OPTIONS = [
  "Writer",
  "Editor",
  "DJ",
  "Photographer",
  "Music journalist",
  "Creative director",
  "Art director",
  "Stylist",
  "Producer",
  "Other",
];

export default function ProfileSetup() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    display_name: "",
    handle: "",
    role_label: "",
    bio: "",
  });

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (error) setError("");
  }

  function handleNameChange(value: string) {
    set("display_name", value);
    // Auto-suggest handle from name if handle is still empty / auto-derived
    const slug = value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 30);
    setForm((f) => ({ ...f, display_name: value, handle: slug }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.display_name.trim()) return setError("Please enter your name.");
    if (!form.handle.trim()) return setError("Please enter a handle.");
    if (!/^[a-z0-9-]{2,30}$/.test(form.handle))
      return setError("Handle can only contain lowercase letters, numbers, and hyphens (2–30 chars).");

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({}));
        throw new Error(msg ?? "Something went wrong.");
      }
      router.push(`/profile/${form.handle}`);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* Header */}
      <header className="border-b border-rule px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="text-2xl tracking-[0.12em] uppercase"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The Edit
        </Link>
        <span className="label">Set up your profile</span>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 py-16">
        <div className="w-full max-w-lg">
          <p className="label mb-3">Step 1 of 1</p>
          <h1
            className="text-3xl font-normal mb-2"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Create your profile
          </h1>
          <p className="text-sm text-muted mb-10 leading-relaxed">
            This is how you'll appear on The Edit. You can update everything later.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-7">
            {/* Display name */}
            <div>
              <label className="label block mb-2">Your name</label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Jarrad Jones"
                maxLength={80}
                className="w-full border border-rule bg-paper px-4 py-3 text-sm focus:outline-none focus:border-ink transition-colors"
              />
            </div>

            {/* Handle */}
            <div>
              <label className="label block mb-2">Handle</label>
              <div className="flex items-center border border-rule focus-within:border-ink transition-colors">
                <span className="label px-4 py-3 border-r border-rule bg-card shrink-0">
                  theedit.co/
                </span>
                <input
                  type="text"
                  value={form.handle}
                  onChange={(e) =>
                    set("handle", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
                  }
                  placeholder="your-name"
                  maxLength={30}
                  className="flex-1 bg-paper px-4 py-3 text-sm focus:outline-none"
                />
              </div>
              <p className="label mt-1.5 text-muted/70">
                Lowercase letters, numbers, and hyphens only.
              </p>
            </div>

            {/* Role */}
            <div>
              <label className="label block mb-2">What do you do?</label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => set("role_label", role === form.role_label ? "" : role)}
                    className={`label px-3 py-1.5 border transition-colors ${
                      form.role_label === role
                        ? "bg-ink text-paper border-ink"
                        : "border-rule hover:border-ink bg-paper"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
              {form.role_label === "Other" && (
                <input
                  type="text"
                  placeholder="Tell us your role"
                  maxLength={60}
                  className="mt-3 w-full border border-rule bg-paper px-4 py-3 text-sm focus:outline-none focus:border-ink transition-colors"
                  onChange={(e) => set("role_label", e.target.value)}
                />
              )}
            </div>

            {/* Bio */}
            <div>
              <label className="label block mb-2">
                Bio <span className="text-muted/60">(optional)</span>
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => set("bio", e.target.value)}
                placeholder="A sentence or two about yourself and your work."
                maxLength={400}
                rows={4}
                className="w-full border border-rule bg-paper px-4 py-3 text-sm focus:outline-none focus:border-ink transition-colors resize-none"
              />
              <p className="label text-right mt-1 text-muted/60">
                {form.bio.length}/400
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 border border-red-200 bg-red-50 px-4 py-3">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="border border-ink bg-ink text-paper px-7 py-3 text-xs tracking-[0.12em] uppercase hover:bg-ink/90 transition-colors disabled:opacity-50 self-start"
            >
              {saving ? "Saving…" : "Create profile →"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
