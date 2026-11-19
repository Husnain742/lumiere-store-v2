import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// NOTE: Next.js route files sirf GET/POST jaise handlers export kar sakti hain.
// authOptions ab src/lib/auth.ts mein hai taake baaki API routes bhi use kar saken.
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
