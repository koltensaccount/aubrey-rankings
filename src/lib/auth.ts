import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
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
      name: "Standard Rubric",
      description: "Default balanced 5-part rubric (Scale 1–10).",
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

export const auth = betterAuth({
  plugins: [nextCookies()],
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      requireLocalEmailVerified: false,
      updateUserInfoOnLink: true,
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  user: {
    additionalFields: {
      username: {
        type: "string",
        required: false,
        input: false,
      },
      bio: {
        type: "string",
        required: false,
      },
    },
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword(data) {
      const delivery = await sendEmail({
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
      if (!delivery.success) console.error("[Password Recovery] Email delivery failed; check email configuration.");
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
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
});
