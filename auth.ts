import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { v5 as uuidv5 } from "uuid"

// Stable namespace for converting Google sub → UUID v5.
// UUID v5 is deterministic: same sub always produces the same UUID.
const GOOGLE_ID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8" // URL namespace

export function googleSubToUUID(sub: string): string {
  return uuidv5(`google:${sub}`, GOOGLE_ID_NAMESPACE)
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    jwt({ token, account, profile }) {
      // On first sign-in (account present), pin userId to Google's stable sub → UUID v5.
      // On subsequent requests account/profile are absent; token.userId persists from cookie.
      if (account?.provider === "google" && (profile as { sub?: string })?.sub) {
        token.userId = googleSubToUUID((profile as { sub: string }).sub)
      }
      return token
    },
    session({ session, token }) {
      if (token.userId) {
        session.user.id = token.userId as string
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
})
