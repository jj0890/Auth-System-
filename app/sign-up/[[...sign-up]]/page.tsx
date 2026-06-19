import { SignUp } from "@clerk/nextjs";
import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="min-h-screen grid md:grid-cols-2">
      {/* Left — editorial panel */}
      <div className="hidden md:flex flex-col justify-between bg-ink text-paper p-12">
        <Link href="/" className="label text-paper/50 hover:text-paper transition-colors">
          ← The Edit
        </Link>
        <div>
          <p className="label text-paper/40 mb-4">Join the platform</p>
          <h2
            className="text-5xl font-normal leading-[1.1] tracking-[-0.01em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Writers.<br />
            DJs.<br />
            <em>Editors.</em>
          </h2>
        </div>
        <p className="label text-paper/30">© The Edit 2024</p>
      </div>

      {/* Right — sign up form */}
      <div className="flex flex-col items-center justify-center px-6 py-16 bg-paper">
        <Link
          href="/"
          className="md:hidden label mb-10 hover:text-ink transition-colors"
        >
          ← The Edit
        </Link>
        <p className="label mb-6">Create your profile</p>
        <SignUp
          path="/sign-up"
          fallbackRedirectUrl="/profile/setup"
          signInUrl="/sign-in"
          appearance={{
            elements: {
              rootBox: "w-full max-w-sm",
              card: "shadow-none border border-rule bg-paper rounded-none p-8",
              headerTitle: "hidden",
              headerSubtitle: "hidden",
              socialButtonsBlockButton:
                "border border-rule rounded-none text-xs tracking-wide hover:bg-card transition-colors",
              formButtonPrimary:
                "bg-ink text-paper rounded-none text-xs tracking-[0.08em] uppercase hover:bg-ink/90",
              footerAction: "text-xs text-muted",
              formFieldInput:
                "rounded-none border-rule bg-paper focus:border-ink text-sm",
              dividerLine: "bg-rule",
              dividerText: "text-muted text-xs",
            },
          }}
        />
      </div>
    </div>
  );
}
