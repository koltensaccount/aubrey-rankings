import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { decodeJwt } from "jose";
import { sql } from "drizzle-orm";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendEmail } from "./email";
import { ratingSystems, ratingCategories } from "@/db/schema";

export async function seedDefaultRatingSystem(userId: string) {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`rubrics:${userId}`},0))`);
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
      requireLocalEmailVerified: true,
      updateUserInfoOnLink: false,
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/send-verification-email": {
        window: 60,
        max: 3,
      },
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600 * 24, // 24 hours
    async sendVerificationEmail(data) {
      const delivery = await sendEmail({
        to: data.user.email,
        subject: "Verify your Aubrey Rankings email address",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
            <h2 style="color: #111; margin-bottom: 16px;">Verify your Aubrey Rankings email</h2>
            <p style="font-size: 14px; line-height: 1.5; margin-bottom: 24px;">Please click the button below to verify your email address and enable seamless Google account linking:</p>
            <p style="margin-bottom: 24px;">
              <a href="${data.url}" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Verify Email Address</a>
            </p>
            <p style="font-size: 12px; color: #666; line-height: 1.4;">Or copy and paste this link into your browser:<br/><a href="${data.url}" style="color: #10b981;">${data.url}</a></p>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
            <p style="font-size: 11px; color: #888;">This link will expire in 24 hours. If you did not create an Aubrey Rankings account, you can safely ignore this email.</p>
          </div>
        `,
        text: `Verify your Aubrey Rankings email at: ${data.url} (link expires in 24 hours)`,
      });
      if (!delivery.success) {
        console.error("[Email Verification] Delivery failed for:", data.user.email);
      }
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
            async getUserInfo(token) {
              let email = "";
              let emailVerified = false;
              let name = "";
              let picture: string | null = null;
              let sub = "";
              let data: any = {};

              if (token.idToken) {
                const claims = decodeJwt(token.idToken);
                sub = (claims.sub as string) || "";
                name = (claims.name as string) || "";
                email = (claims.email as string) || "";
                picture = (claims.picture as string) || null;
                emailVerified = Boolean(claims.email_verified);
                data = claims;
              } else if (token.accessToken) {
                try {
                  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
                    headers: { Authorization: `Bearer ${token.accessToken}` },
                  });
                  if (res.ok) {
                    data = await res.json();
                    sub = data.sub || "";
                    name = data.name || "";
                    email = data.email || "";
                    picture = data.picture || null;
                    emailVerified = Boolean(data.email_verified);
                  }
                } catch {}
              }

              if (!email || !sub) {
                return null;
              }

              // Tighten provider trust: Google MUST confirm email ownership
              if (!emailVerified) {
                throw new APIError("FORBIDDEN", {
                  message: "Google email must be verified to sign in or link your Aubrey account.",
                });
              }

              return {
                user: {
                  name: name || "Aubrey User",
                  email,
                  image: picture || undefined,
                  emailVerified: true,
                },
                data,
              };
            },
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
    "http://localhost:3100",
    "http://127.0.0.1:3100",
  ],
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
});
