import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendEmail } from "./email";
import { ratingSystems, ratingCategories } from "@/db/schema";

export async function seedDefaultRatingSystem(userId: string) {
  return await db.transaction(async (tx) => {
    const existing = await tx.query.ratingSystems.findFirst({
      where: (rs, { eq, and }) => and(eq(rs.userId, userId), eq(rs.isDefault, true)),
    });
    if (existing) return existing.id;

    const systemId = `rs_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    await tx.insert(ratingSystems).values({
      id: systemId,
      userId,
      name: "Aubrey's Correct Rating System",
      description: "Default weighted scale inspired by Aubrey's ratings (Scale 1–10).",
      scale: 10,
      isDefault: true,
      isSystemTemplate: false,
    });

    // Categories:
    // Music/Sound Design: 3
    // Acting: 8
    // Cinematography: 7
    // Writing: 8
    // Vibes: 8
    const categories = [
      { name: "Music / Sound Design", weight: 3, sortOrder: 1, isRequired: true },
      { name: "Acting", weight: 8, sortOrder: 2, isRequired: true },
      { name: "Cinematography", weight: 7, sortOrder: 3, isRequired: true },
      { name: "Writing", weight: 8, sortOrder: 4, isRequired: true },
      { name: "Vibes", weight: 8, sortOrder: 5, isRequired: true },
    ];

    for (const cat of categories) {
      await tx.insert(ratingCategories).values({
        id: `rc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ratingSystemId: systemId,
        name: cat.name,
        weight: cat.weight,
        sortOrder: cat.sortOrder,
        isRequired: cat.isRequired,
      });
    }

    return systemId;
  });
}

// Security Fix: Require explicit secret in production
const authSecret = process.env.BETTER_AUTH_SECRET;
if (process.env.NODE_ENV === "production" && !authSecret) {
  throw new Error("CRITICAL: BETTER_AUTH_SECRET environment variable is missing in production!");
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    async sendResetPassword(data) {
      await sendEmail({
        to: data.user.email,
        subject: "Reset your Aubrey Rankings password",
        html: `
          <h2>Aubrey Rankings Password Reset</h2>
          <p>Click the link below to reset your password:</p>
          <a href="${data.url}">Reset Password</a>
          <p>If you didn't request this, you can safely ignore this email.</p>
        `,
        text: `Reset your password at: ${data.url}`,
      });
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          if (createdUser?.id) {
            try {
              await seedDefaultRatingSystem(createdUser.id);
            } catch (err) {
              console.error("[Seed Default Rating System Error]", err);
            }
          }
        },
      },
    },
  },
  trustedOrigins: [
    "https://aubrey.koltensserver.com",
    "http://100.73.94.105:3200",
    "http://127.0.0.1:3200",
    "http://localhost:3000",
  ],
  secret:
    authSecret || "9c58715c7f3f67ff199150b1a4b2a3b25804c43657b0fd945f997ce752797c2e",
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
});
