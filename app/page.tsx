import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Masthead */}
      <header className="border-b border-rule px-6 py-4 flex items-center justify-between">
        <span className="label">Est. 2024</span>
        <h1
          className="text-3xl tracking-[0.12em] uppercase"
          style={{ fontFamily: "var(--font-display)" }}
        >
          The Edit
        </h1>
        <nav className="flex gap-5">
          <Link href="/sign-in" className="label hover:text-ink transition-colors">
            Sign in
          </Link>
          <Link href="/sign-up" className="label hover:text-ink transition-colors">
            Join
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <p className="label mb-6">Author profiles</p>
        <h2
          className="text-5xl md:text-7xl font-normal leading-[1.08] tracking-[-0.01em] max-w-3xl mb-6"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Where taste<br />
          <em>speaks for itself.</em>
        </h2>
        <hr className="rule w-16 my-8" />
        <p className="text-muted text-sm leading-relaxed max-w-md mb-10">
          A platform for writers, DJs, photographers, and editors to curate their identity —
          top albums, published work, and everything in between.
        </p>
        <Link
          href="/sign-up"
          className="inline-block border border-ink px-7 py-3 text-xs tracking-[0.12em] uppercase hover:bg-ink hover:text-paper transition-all duration-200"
        >
          Create a profile
        </Link>
      </section>

      {/* Feature strip — what a profile looks like */}
      <section className="border-t border-rule px-6 py-12">
        <p className="label text-center mb-8">What you get</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-rule max-w-4xl mx-auto">
          {[
            { num: "01", title: "Top 5 albums", body: "Your taste, ranked. Album art pulled from MusicBrainz." },
            { num: "02", title: "Contributions", body: "Articles, mixes, interviews, features, photo essays." },
            { num: "03", title: "Your links", body: "Linktree, Bandcamp, portfolio — wherever you live online." },
          ].map((f) => (
            <div key={f.num} className="bg-paper px-8 py-10">
              <span className="label mb-3 block">{f.num}</span>
              <h3
                className="text-xl mb-3 font-normal"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {f.title}
              </h3>
              <p className="text-muted text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-rule px-6 py-5 flex items-center justify-between">
        <span className="label">The Edit</span>
        <span className="label">Culture · Music · Fashion</span>
      </footer>
    </main>
  );
}
