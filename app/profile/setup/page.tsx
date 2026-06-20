"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

const ROLE_OPTIONS = [
  "Writer", "Editor", "DJ", "Photographer", "Music journalist",
  "Creative director", "Art director", "Stylist", "Producer", "Other",
];

interface AlbumResult {
  mb_id: string;   // stored as mb_id in DB
  title: string;
  artist: string;
  year: string;
  cover_url: string | null;
}

// Shape returned by /api/music/search
interface MBResult {
  id: string;
  title: string;
  artist: string;
  year: string | null;
  coverArtUrl: string | null;
}

interface AlbumSlot {
  rank: number;
  album: AlbumResult | null;
}

export default function ProfileSetup() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) { router.replace("/sign-in"); return; }
    if (isLoaded && isSignedIn) loadExisting();
  }, [isLoaded, isSignedIn]);

  async function loadExisting() {
    try {
      const [profileRes, albumsRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/profile/albums"),
      ]);
      if (profileRes.ok) {
        const p = await profileRes.json();
        setForm({ display_name: p.display_name ?? "", handle: p.handle ?? "", bio: p.bio ?? "" });
        setRoleLabels(p.role_labels ?? []);
        setIsPublic(p.is_public ?? true);
      }
      if (albumsRes.ok) {
        const a: any[] = await albumsRes.json();
        if (a.length) {
          setSlots((prev) => prev.map((slot) => {
            const existing = a.find((x) => x.rank === slot.rank);
            return existing ? { ...slot, album: existing } : slot;
          }));
        }
      }
    } catch {}
  }

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [handleStatus, setHandleStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const handleCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<"idle" | "uploading" | "pending">("idle");

  const [form, setForm] = useState({ display_name: "", handle: "", bio: "" });
  const [roleLabels, setRoleLabels] = useState<string[]>([]);

  // Album picker state
  const [slots, setSlots] = useState<AlbumSlot[]>([1, 2, 3, 4, 5].map((r) => ({ rank: r, album: null })));
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AlbumResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setField(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (error) setError("");
  }

  function checkHandle(handle: string) {
    if (handleCheckRef.current) clearTimeout(handleCheckRef.current);
    if (!handle || !/^[a-z0-9-]{2,30}$/.test(handle)) { setHandleStatus("idle"); return; }
    setHandleStatus("checking");
    handleCheckRef.current = setTimeout(async () => {
      const res = await fetch(`/api/profile/check-handle?handle=${encodeURIComponent(handle)}`);
      const { available } = await res.json();
      setHandleStatus(available ? "available" : "taken");
    }, 500);
  }

  function toggleRole(role: string) {
    setRoleLabels((prev) => {
      if (prev.includes(role)) return prev.filter((r) => r !== role);
      if (prev.length >= 3) return prev;
      return [...prev, role];
    });
  }

  function handleNameChange(value: string) {
    const slug = value.toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 30);
    setForm((f) => ({ ...f, display_name: value, handle: slug }));
    checkHandle(slug);
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError("Photo must be under 5 MB."); return; }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarStatus("idle");
  }

  const searchAlbums = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/music/search?q=${encodeURIComponent(q)}`);
      const raw: MBResult[] = await res.json();
      setResults((raw ?? []).slice(0, 6).map((r) => ({
        mb_id: r.id,
        title: r.title,
        artist: r.artist,
        year: r.year ?? "",
        cover_url: r.coverArtUrl,
      })));
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAlbums(value), 400);
  }

  function openSlot(rank: number) {
    setActiveSlot(rank);
    setQuery("");
    setResults([]);
    setTimeout(() => searchRef.current?.focus(), 50);
  }

  function pickAlbum(album: AlbumResult) {
    if (activeSlot === null) return;
    setSlots((prev) => prev.map((s) => s.rank === activeSlot ? { ...s, album } : s));
    setActiveSlot(null);
    setQuery("");
    setResults([]);
  }

  function clearSlot(rank: number) {
    setSlots((prev) => prev.map((s) => s.rank === rank ? { ...s, album: null } : s));
  }

  async function uploadAvatar(): Promise<void> {
    if (!avatarFile) return;
    setAvatarStatus("uploading");
    const formData = new FormData();
    formData.append("file", avatarFile);
    const res = await fetch("/api/profile/avatar", { method: "POST", body: formData });
    if (!res.ok) {
      const { error: msg } = await res.json().catch(() => ({}));
      throw new Error(msg ?? "Avatar upload failed.");
    }
    setAvatarStatus("pending");
  }

  async function saveAlbums(): Promise<void> {
    const filled = slots.filter((s) => s.album !== null);
    await Promise.all(
      filled.map((s) =>
        fetch("/api/profile/albums", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rank: s.rank, ...s.album }),
        })
      )
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.display_name.trim()) return setError("Please enter your name.");
    if (!form.handle.trim()) return setError("Please enter a handle.");
    if (!/^[a-z0-9-]{2,30}$/.test(form.handle))
      return setError("Handle: lowercase letters, numbers, and hyphens only (2–30 chars).");
    if (handleStatus === "taken")
      return setError("That handle is already taken — please choose another.");

    setSaving(true);
    try {
      if (avatarFile) await uploadAvatar();
      await saveAlbums();

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, role_labels: roleLabels, is_public: isPublic }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({}));
        throw new Error(msg ?? "Something went wrong.");
      }
      setSaved(true);
      setTimeout(() => router.push(`/profile/${form.handle}`), 1200);
    } catch (err: any) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (!isLoaded || !isSignedIn) return <div className="min-h-screen bg-paper" />;

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {saved && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-ink text-paper px-6 py-3 label tracking-widest">
          Profile saved ✓
        </div>
      )}
      <header className="border-b border-rule px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-2xl tracking-[0.12em] uppercase" style={{ fontFamily: "var(--font-display)" }}>
          The Edit
        </Link>
        <span className="label">{form.handle ? "Edit profile" : "Set up your profile"}</span>
      </header>

      <main className="flex-1 flex items-start justify-center px-6 py-16">
        <div className="w-full max-w-lg">
          <h1 className="text-3xl font-normal mb-2" style={{ fontFamily: "var(--font-display)" }}>
            {form.handle ? "Edit your profile" : "Create your profile"}
          </h1>
          <p className="text-sm text-muted mb-10 leading-relaxed">
            This is how you'll appear on The Edit.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-7">

            {/* Avatar */}
            <div>
              <label className="label block mb-3">Profile photo</label>
              <div className="flex items-center gap-5">
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="relative w-20 h-20 border border-rule bg-card flex items-center justify-center overflow-hidden hover:border-ink transition-colors shrink-0">
                  {avatarPreview
                    ? <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                    : <span className="label text-muted">+</span>}
                </button>
                <div>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="label underline underline-offset-2 hover:text-ink transition-colors block mb-1">
                    {avatarPreview ? "Change photo" : "Upload photo"}
                  </button>
                  <p className="label text-muted/70">JPG, PNG or WebP · max 5 MB</p>
                  {avatarStatus === "pending" && <p className="label text-muted/70 mt-1">Submitted for review ✓</p>}
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatarChange} className="hidden" />
            </div>

            {/* Name */}
            <div>
              <label className="label block mb-2">Your name</label>
              <input type="text" value={form.display_name} onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Jarrad Jones" maxLength={80}
                className="w-full border border-rule bg-paper px-4 py-3 text-sm focus:outline-none focus:border-ink transition-colors" />
            </div>

            {/* Handle */}
            <div>
              <label className="label block mb-2">Handle</label>
              <div className="flex items-center border border-rule focus-within:border-ink transition-colors">
                <span className="label px-4 py-3 border-r border-rule bg-card shrink-0">theedit.co/</span>
                <input type="text" value={form.handle}
                  onChange={(e) => { const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""); setField("handle", v); checkHandle(v); }}
                  placeholder="your-name" maxLength={30}
                  className="flex-1 bg-paper px-4 py-3 text-sm focus:outline-none" />
              </div>
              <p className={`label mt-1.5 ${
                handleStatus === "available" ? "text-green-600" :
                handleStatus === "taken" ? "text-red-600" : "text-muted/70"
              }`}>
                {handleStatus === "checking" && "Checking…"}
                {handleStatus === "available" && "✓ Available"}
                {handleStatus === "taken" && "✗ Already taken"}
                {handleStatus === "idle" && "Lowercase letters, numbers, and hyphens only."}
              </p>
            </div>

            {/* Role */}
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label className="label">What do you do?</label>
                <span className="label text-muted/60">{roleLabels.length}/3 selected</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((role) => {
                  const selected = roleLabels.includes(role);
                  const maxed = !selected && roleLabels.length >= 3;
                  return (
                    <button key={role} type="button" onClick={() => toggleRole(role)} disabled={maxed}
                      className={`label px-3 py-1.5 border transition-colors ${
                        selected ? "bg-ink text-paper border-ink"
                        : maxed ? "border-rule text-muted/40 bg-paper cursor-not-allowed"
                        : "border-rule hover:border-ink bg-paper"}`}>
                      {role}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Top 5 Albums */}
            <div>
              <label className="label block mb-3">Top 5 albums</label>
              <div className="grid grid-cols-5 gap-2">
                {slots.map((slot) => (
                  <div key={slot.rank} className="flex flex-col gap-1">
                    {slot.album ? (
                      <div className="relative group">
                        <div className="aspect-square bg-card border border-ink overflow-hidden">
                          {slot.album.cover_url
                            ? <img src={slot.album.cover_url} alt={slot.album.title} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center">
                                <span className="label text-muted text-center px-1 leading-tight">{slot.album.title}</span>
                              </div>}
                        </div>
                        <button type="button" onClick={() => clearSlot(slot.rank)}
                          className="absolute top-1 right-1 w-5 h-5 bg-ink text-paper text-xs leading-none hidden group-hover:flex items-center justify-center">
                          ×
                        </button>
                        <p className="text-[10px] font-medium leading-tight truncate mt-1">{slot.album.title}</p>
                        <p className="text-[10px] text-muted truncate">{slot.album.artist}</p>
                      </div>
                    ) : (
                      <button type="button" onClick={() => openSlot(slot.rank)}
                        className="aspect-square border border-dashed border-ink/40 bg-paper hover:border-ink hover:bg-card transition-colors flex flex-col items-center justify-center gap-1">
                        <span className="text-muted text-xl leading-none">+</span>
                        <span className="label text-muted/60">{slot.rank}</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Search modal */}
              {activeSlot !== null && (
                <div className="mt-3 border border-rule bg-paper">
                  <div className="flex items-center border-b border-rule">
                    <input ref={searchRef} type="text" value={query}
                      onChange={(e) => handleQueryChange(e.target.value)}
                      placeholder={`Search for album #${activeSlot}…`}
                      className="flex-1 bg-paper px-4 py-3 text-sm focus:outline-none" />
                    <button type="button" onClick={() => { setActiveSlot(null); setResults([]); }}
                      className="px-4 py-3 label text-muted hover:text-ink transition-colors">cancel</button>
                  </div>
                  {searching && <p className="label text-muted px-4 py-3">Searching…</p>}
                  {!searching && results.length > 0 && (
                    <ul>
                      {results.map((r) => (
                        <li key={r.mb_id}>
                          <button type="button" onClick={() => pickAlbum(r)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-card transition-colors text-left">
                            {r.cover_url
                              ? <img src={r.cover_url} alt={r.title} className="w-12 h-12 object-cover shrink-0 border border-ink" />
                              : <div className="w-12 h-12 bg-card border border-ink shrink-0 flex items-center justify-center"><span className="label text-muted/50">?</span></div>}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{r.title}</p>
                              <p className="text-xs text-muted truncate">{r.artist}{r.year ? ` · ${r.year}` : ""}</p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!searching && query.trim() && results.length === 0 && (
                    <p className="label text-muted px-4 py-3">No results found.</p>
                  )}
                </div>
              )}
            </div>

            {/* Bio */}
            <div>
              <label className="label block mb-2">Bio <span className="text-muted/60">(optional)</span></label>
              <textarea value={form.bio} onChange={(e) => setField("bio", e.target.value)}
                placeholder="A sentence or two about yourself and your work."
                maxLength={400} rows={4}
                className="w-full border border-rule bg-paper px-4 py-3 text-sm focus:outline-none focus:border-ink transition-colors resize-none" />
              <p className="label text-right mt-1 text-muted/60">{form.bio.length}/400</p>
            </div>

            {/* Visibility */}
            <div className="flex items-center justify-between border border-rule px-4 py-3">
              <div>
                <p className="label">Profile visibility</p>
                <p className="label text-muted/70 mt-0.5">
                  {isPublic ? "Public — visible in the contributor directory" : "Private — only you can see this profile"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPublic((v) => !v)}
                className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${isPublic ? "bg-ink" : "bg-rule"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-paper rounded-full shadow transition-transform ${isPublic ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            {error && (
              <p className="text-sm text-red-600 border border-red-200 bg-red-50 px-4 py-3">{error}</p>
            )}

            <button type="submit" disabled={saving}
              className="border border-ink bg-ink text-paper px-7 py-3 text-xs tracking-[0.12em] uppercase hover:bg-ink/90 transition-colors disabled:opacity-50 self-start">
              {saving ? "Saving…" : form.handle ? "Save changes →" : "Create profile →"}
            </button>

            <div className="border-t border-rule pt-6">
              <p className="label mb-2">Your work</p>
              <p className="text-sm text-muted mb-3">Add articles, mixes, interviews, and other pieces to your profile.</p>
              <Link href="/profile/contributions" className="label underline underline-offset-2 hover:text-ink transition-colors">
                Manage contributions →
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
