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
    jwt({ token }) {
      // Persist the UUID in the JWT so it's stable across sessions
      if (token.sub && !token.userId) {
        token.userId = googleSubToUUID(token.sub)
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
