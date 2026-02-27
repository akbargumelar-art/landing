import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "", // Default to current origin
});

export const { signIn, signUp, signOut, useSession } = authClient;
