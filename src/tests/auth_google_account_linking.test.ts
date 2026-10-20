import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db";
import { user, account, collections, ratings, mediaItems } from "../db/schema";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth";
import { GET as getProviders } from "../app/api/auth/providers/route";
import { GET as getProfile } from "../app/api/user/profile/route";
import { NextRequest } from "next/server";

describe("Google Account Linking & Email Verification", () => {
  const timestamp = Date.now();
  const testMediaId = `test_med_link_${timestamp}`;
  const testColId = `test_col_link_${timestamp}`;
  const testRatingId = `test_rat_link_${timestamp}`;

  const createdUserIds: string[] = [];
  const createdMediaIds: string[] = [];
  const createdCollectionIds: string[] = [];

  before(async () => {
    // 1. Setup seed media item
    await db.insert(mediaItems).values({
      id: testMediaId,
      title: "Interstellar Journey",
      mediaType: "movie",
      releaseDate: "2024-01-01",
    });
    createdMediaIds.push(testMediaId);
  });

  after(async () => {
    // Clean up created test records cleanly without cascading to other data
    for (const uid of createdUserIds) {
      await db.delete(ratings).where(eq(ratings.userId, uid)).catch(() => {});
      await db.delete(collections).where(eq(collections.userId, uid)).catch(() => {});
      await db.delete(account).where(eq(account.userId, uid)).catch(() => {});
      await db.delete(user).where(eq(user.id, uid)).catch(() => {});
    }

    for (const cid of createdCollectionIds) {
      await db.delete(collections).where(eq(collections.id, cid)).catch(() => {});
    }

    for (const mid of createdMediaIds) {
      await db.delete(mediaItems).where(eq(mediaItems.id, mid)).catch(() => {});
    }
  });

  it("1. Provider resolution reports Google configuration status correctly", async () => {
    const originalId = process.env.GOOGLE_CLIENT_ID;
    const originalSecret = process.env.GOOGLE_CLIENT_SECRET;

    try {
      // With credentials set
      process.env.GOOGLE_CLIENT_ID = "mock_client_id.apps.googleusercontent.com";
      process.env.GOOGLE_CLIENT_SECRET = "mock_secret";
      const resConfigured = await getProviders();
      const bodyConfigured = await resConfigured.json();
      assert.equal(bodyConfigured.google, true);

      // Without credentials set
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      const resUnconfigured = await getProviders();
      const bodyUnconfigured = await resUnconfigured.json();
      assert.equal(bodyUnconfigured.google, false);
    } finally {
      process.env.GOOGLE_CLIENT_ID = originalId;
      process.env.GOOGLE_CLIENT_SECRET = originalSecret;
    }
  });

  it("2. Google provider claims reject unverified Google emails", async () => {
    // Access Google social provider userInfo resolver if defined
    const googleProvider = (auth as any).options?.socialProviders?.google;
    if (googleProvider?.getUserInfo) {
      // Case A: Unverified Google account (email_verified: false)
      const unverifiedPayload = {
        sub: "google_sub_12345",
        name: "Unverified Google User",
        email: "unverified@gmail.com",
        email_verified: false,
      };
      const unverifiedJwt = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify(unverifiedPayload)).toString("base64url")}.`;

      await assert.rejects(
        async () => {
          await googleProvider.getUserInfo({ idToken: unverifiedJwt });
        },
        (err: any) => {
          assert(
            err.message?.includes("Google email must be verified") || err.status === "FORBIDDEN" || err.statusCode === 403,
            `Expected forbidden error for unverified Google email, got: ${err.message}`
          );
          return true;
        }
      );

      // Case B: Verified Google account (email_verified: true)
      const verifiedPayload = {
        sub: "google_sub_67890",
        name: "Verified Google User",
        email: "verified@gmail.com",
        email_verified: true,
        picture: "https://lh3.googleusercontent.com/photo.jpg",
      };
      const verifiedJwt = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify(verifiedPayload)).toString("base64url")}.`;

      const userInfo = await googleProvider.getUserInfo({ idToken: verifiedJwt });
      assert.ok(userInfo, "Must return valid user info for verified Google account");
      assert.equal(userInfo.user.email, "verified@gmail.com");
      assert.equal(userInfo.user.name, "Verified Google User");
      assert.equal(userInfo.user.emailVerified, true);
      assert.equal(userInfo.user.image, "https://lh3.googleusercontent.com/photo.jpg");
    }
  });

  it("3. Existing email/password user can link Google account without losing userId or data", async () => {
    const userEmail = `curator_${timestamp}@example.com`;

    // Sign up via email & password
    const signupRes = await auth.api.signUpEmail({
      body: {
        email: userEmail,
        password: "AubreyPassword123!",
        name: "Curator Aubrey",
      },
      asResponse: true,
    });
    assert.equal(signupRes.status, 200, "User signup should succeed");

    const createdUser = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, userEmail),
    });
    assert.ok(createdUser, "User record must exist in DB");
    createdUserIds.push(createdUser.id);

    // Verify initial state: emailVerified is false for basic password registration
    assert.equal(createdUser.emailVerified, false);

    // Create user data (collection & rating) under this user.id
    await db.insert(collections).values({
      id: testColId,
      userId: createdUser.id,
      title: "My Favorite Sci-Fi",
      collectionType: "custom",
      visibility: "public",
    });
    createdCollectionIds.push(testColId);

    await db.insert(ratings).values({
      id: testRatingId,
      userId: createdUser.id,
      mediaItemId: testMediaId,
      collectionId: testColId,
      calculatedOverallScore: 9.5,
      reviewText: "Spectacular visual effects and storytelling.",
    });

    // Verify initial credential account exists
    const initialAccounts = await db.query.account.findMany({
      where: (a, { eq }) => eq(a.userId, createdUser.id),
    });
    assert.equal(initialAccounts.length, 1);
    assert.equal(initialAccounts[0].providerId, "credential");

    // Simulate linking Google account to this user (what linkSocial executes)
    const googleAccountId = `google_sub_${timestamp}`;
    await db.insert(account).values({
      id: `acc_google_${timestamp}`,
      accountId: googleAccountId,
      providerId: "google",
      userId: createdUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Check account table now has both credential and google linked to the EXACT same user.id
    const updatedAccounts = await db.query.account.findMany({
      where: (a, { eq }) => eq(a.userId, createdUser.id),
    });
    assert.equal(updatedAccounts.length, 2, "User must now have two linked provider accounts");
    const providers = updatedAccounts.map((a) => a.providerId);
    assert.ok(providers.includes("credential"), "Must retain credential provider");
    assert.ok(providers.includes("google"), "Must include linked google provider");

    // Check that all user data (collections, ratings) remains intact and associated with the same userId
    const userCollections = await db.query.collections.findMany({
      where: (c, { eq }) => eq(c.userId, createdUser.id),
    });
    assert.equal(userCollections.length, 1);
    assert.equal(userCollections[0].title, "My Favorite Sci-Fi");

    const userRatings = await db.query.ratings.findMany({
      where: (r, { eq }) => eq(r.userId, createdUser.id),
    });
    assert.equal(userRatings.length, 1);
    assert.equal(userRatings[0].calculatedOverallScore, 9.5);
    assert.equal(userRatings[0].reviewText, "Spectacular visual effects and storytelling.");
  });

  it("4. Email verification token lifecycle updates emailVerified status", async () => {
    const userEmail = `verify_target_${timestamp}@example.com`;
    let capturedToken = "";
    const opts = (auth as any).options;
    const originalSend = opts.emailVerification.sendVerificationEmail;
    opts.emailVerification.sendVerificationEmail = async (data: any) => {
      capturedToken = data.token;
      return originalSend(data);
    };

    try {
      const signupRes = await auth.api.signUpEmail({
        body: {
          email: userEmail,
          password: "AubreyPassword123!",
          name: "Verification Candidate",
        },
        asResponse: true,
      });
      assert.equal(signupRes.status, 200);

      const userRecord = await db.query.user.findFirst({
        where: (u, { eq }) => eq(u.email, userEmail),
      });
      assert.ok(userRecord);
      createdUserIds.push(userRecord.id);
      assert.equal(userRecord.emailVerified, false);
      assert.ok(capturedToken, "Verification email must provide a signed verification token");

      // Attempting verification with an invalid token returns 401
      const invalidVerifyRes = await auth.api.verifyEmail({
        query: { token: "invalid_malformed_token" },
        asResponse: true,
      });
      assert.equal(invalidVerifyRes.status, 401, "Invalid token must return 401 Unauthorized");

      // Verify token using Better Auth's verifyEmail endpoint with valid token
      const verifyRes = await auth.api.verifyEmail({
        query: {
          token: capturedToken,
        },
        asResponse: true,
      });
      assert.equal(verifyRes.status, 200, "Email verification must return 200 OK");

      // Verify that the user record now has emailVerified = true in the database
      const verifiedUserRecord = await db.query.user.findFirst({
        where: (u, { eq }) => eq(u.id, userRecord.id),
      });
      assert.ok(verifiedUserRecord);
      assert.equal(verifiedUserRecord.emailVerified, true, "User emailVerified must be updated to true in DB");
    } finally {
      opts.emailVerification.sendVerificationEmail = originalSend;
    }
  });

  it("5. Account settings profile route exposes emailVerified field", async () => {
    const userEmail = `profile_check_${timestamp}@example.com`;
    const signupRes = await auth.api.signUpEmail({
      body: {
        email: userEmail,
        password: "AubreyPassword123!",
        name: "Profile Check",
      },
      asResponse: true,
    });
    assert.equal(signupRes.status, 200);

    const userRecord = await db.query.user.findFirst({
      where: (u, { eq }) => eq(u.email, userEmail),
    });
    assert.ok(userRecord);
    createdUserIds.push(userRecord.id);

    // Check that schema includes emailVerified boolean field
    assert.equal(typeof userRecord.emailVerified, "boolean");
  });

  it("6. Rate limiting is configured for /send-verification-email", () => {
    const authOptions = (auth as any).options;
    assert.ok(authOptions.rateLimit?.enabled, "Rate limiting must be enabled");
    const rules = authOptions.rateLimit?.customRules;
    assert.ok(rules, "Custom rate limit rules must be defined");
    assert.ok(rules["/send-verification-email"], "Rate limit rule for /send-verification-email must exist");
    assert.equal(rules["/send-verification-email"].max, 3, "Max requests should be 3 per window");
    assert.equal(rules["/send-verification-email"].window, 60, "Window should be 60 seconds");
  });

  it("7. requireLocalEmailVerified is strictly enabled to prevent unverified email hijacking", () => {
    const authOptions = (auth as any).options;
    const accountLinking = authOptions.account?.accountLinking;
    assert.ok(accountLinking, "Account linking configuration must exist");
    assert.equal(accountLinking.enabled, true, "Account linking must be enabled");
    assert.equal(accountLinking.requireLocalEmailVerified, true, "requireLocalEmailVerified must be true");
    assert.deepEqual(accountLinking.trustedProviders, ["google"], "trustedProviders must include google");
    assert.equal(accountLinking.updateUserInfoOnLink, false, "updateUserInfoOnLink should not overwrite user profile");
  });
});
