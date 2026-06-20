"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

const TYPES = ["Article", "Mix", "Interview", "Feature", "Photo essay"] as const;
type ContribType = (typeof TYPES)[number];

interface Contribution {
  id: string;
  type: ContribType;
  title: string;
  url: string | null;
  published_at: string | null;
}

const EMPTY_FORM = { type: "Article" as ContribType, title: "", url: "", published_at: "" };

export default function ContributionsPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  const [items, setItems] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isLoaded && !isSignedIn) { router.replace("/sign-in"); return; }
    if (isLoaded && isSignedIn) load();
  }, [isLoaded, isSignedIn]);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/contributions");
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  function startEdit(item: Contribution) {
    setEditingId(item.id);
    setForm({
      type: item.type,
      title: item.title,
      url: item.url ?? "",
      published_at: item.published_at ?? "",
    });
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return setError("Title is required.");
    setSaving(true);
    setError("");

    const body = {
      type: form.type,
      title: form.title,
      url: form.url || null,
      published_at: form.published_at || null,
    };

    const res = editingId
      ? await fetch(`/api/contributions/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/contributions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({}));
      setError(msg ?? "Something went wrong.");
      setSaving(false);
      return;
    }

    await load();
    cancelEdit();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/contributions/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((c) => c.id !== id));
    if (editingId === id) cancelEdit();
  }

  if (!isLoaded || !isSignedIn) return <div className="min-h-screen bg-paper" />;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <header className="border-b border-rule px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl tracking-[0.12em] uppercase" style={{ fontFamily: "var(--font-display)" }}>
          The Edit
        </Link>
        <Link href="/profile/setup" className="label hover:text-ink transition-colors">
          ← Profile
        </Link>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-14">
        <h1 className="text-3xl font-normal mb-2" style={{ fontFamily: "var(--font-display)" }}>
          Your work
        </h1>
        <p className="text-sm text-muted mb-10">Articles, mixes, interviews — anything you've made or been part of.</p>

        {/* Add / edit form */}
        <form onSubmit={handleSubmit} className="border border-rule p-6 mb-10">
          <h2 className="label mb-5">{editingId ? "Edit piece" : "Add a piece"}</h2>

          <div className="flex flex-col gap-4">
            {/* Type */}
            <div>
              <label className="label block mb-2">Type</label>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`label px-3 py-1.5 border transition-colors ${
                      form.type === t ? "bg-ink text-paper border-ink" : "border-rule hover:border-ink"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="label block mb-2">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. The Return of the Night Mix"
                maxLength={200}
                className="w-full border border-rule bg-paper px-4 py-3 text-sm focus:outline-none focus:border-ink transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* URL */}
              <div>
                <label className="label block mb-2">Link <span className="text-muted/60">(optional)</span></label>
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder="https://…"
                  className="w-full border border-rule bg-paper px-4 py-3 text-sm focus:outline-none focus:border-ink transition-colors"
                />
              </div>

              {/* Date */}
              <div>
                <label className="label block mb-2">Published <span className="text-muted/60">(optional)</span></label>
                <input
                  type="date"
                  value={form.published_at}
                  onChange={(e) => setForm((f) => ({ ...f, published_at: e.target.value }))}
                  className="w-full border border-rule bg-paper px-4 py-3 text-sm focus:outline-none focus:border-ink transition-colors"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 border border-red-200 bg-red-50 px-4 py-3 mt-4">{error}</p>
          )}

          <div className="flex items-center gap-4 mt-6">
            <button
              type="submit"
              disabled={saving}
              className="label border border-ink bg-ink text-paper px-5 py-2.5 hover:bg-ink/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving…" : editingId ? "Save changes" : "Add piece"}
            </button>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="label text-muted hover:text-ink transition-colors">
                Cancel
              </button>
            )}
          </div>
        </form>

        {/* List */}
        {loading ? (
          <p className="label text-muted">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted text-center py-10 border border-dashed border-rule">
            Nothing added yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-px bg-rule">
            {items.map((item) => (
              <li key={item.id} className="bg-paper px-5 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="label bg-ink text-paper px-2 py-0.5 shrink-0">{item.type}</span>
                    {item.published_at && (
                      <span className="label text-muted">
                        {new Date(item.published_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </span>
                    )}
                  </div>
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium hover:underline underline-offset-2 truncate block"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {item.title}
                    </a>
                  ) : (
                    <p className="text-sm font-medium truncate" style={{ fontFamily: "var(--font-display)" }}>
                      {item.title}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => startEdit(item)} className="label text-muted hover:text-ink transition-colors">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="label text-muted hover:text-red-600 transition-colors">
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
