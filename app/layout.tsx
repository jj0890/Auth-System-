import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_SITE_NAME ?? "The Edit",
  description: "An editorial platform for culture, music, and fashion.",
};

const hasRealClerkKey =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY !== "pk_test_placeholder";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const body = (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#fafaf9", color: "#1a1a1a" }}>
        {children}
      </body>
    </html>
  );

  return hasRealClerkKey ? <ClerkProvider>{body}</ClerkProvider> : body;
}
