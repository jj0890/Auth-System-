export default function Home() {
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <p style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "#888", marginBottom: "0.5rem" }}>
        {process.env.NEXT_PUBLIC_SITE_NAME}
      </p>
      <h1 style={{ fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: "1rem" }}>
        Author profiles
      </h1>
      <p style={{ fontSize: 15, color: "#555", lineHeight: 1.65, marginBottom: "2rem" }}>
        Sign in to create your profile — showcase your top five albums, link your work, and let your taste speak for itself.
      </p>
      <a
        href="/sign-in"
        style={{
          display: "inline-block",
          padding: "10px 22px",
          background: "#1a1a1a",
          color: "#fff",
          fontSize: 13,
          fontWeight: 500,
          borderRadius: 8,
          textDecoration: "none",
        }}
      >
        Get started
      </a>
    </main>
  );
}
