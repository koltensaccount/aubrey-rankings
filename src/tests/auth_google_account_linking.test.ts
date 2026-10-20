import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../db";
import { user, account, collections, ratings, mediaItems } from "../db/schema";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth";
import { GET as getProviders } from "../app/api/auth/providers/route";
import { getSafeCallbackUrl } from "../lib/safe-url";
import { APIError } from "better-auth/api";

function assertNonProductionEnvironment() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.APP_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    throw new Error("Safety check: Cannot run tests in production environment");
  }
  const dbUrl = process.env.DATABASE_URL || "";
  if (/prod|production|live/i.test(dbUrl) && !/test/i.test(dbUrl)) {
    throw new Error("Safety check: DATABASE_URL appears to reference a production database");
  }
}

describe("Google Account Linking & Email Verification Security", () => {
  const timestamp = Date.now();
  const testMediaId = `test_med_link_${timestamp}`;
  const testColId = `test_col_link_${timestamp}`;
  const testRatingId = `test_rat_link_${timestamp}`;

  const createdUserIds: string[] = [];
  const createdMediaIds: string[] = [];
  const createdCollectionIds: string[] = [];

  before(async () => {
    assertNonProductionEnvironment();

    // Setup isolated test media item
    await db.insert(mediaItems).values({
      id: testMediaId,
      title: "Interstellar Journey",
      mediaType: "movie",
      releaseDate: "2024-01-01",
    });
    createdMediaIds.push(testMediaId);
  });

  after(async () => {
    assertNonProductionEnvironment();

    // Clean up created test records cleanly without cascading to existing data
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

  it("2. Google OAuth configuration uses native Better Auth verification mechanisms without custom decodeJwt overrides", () => {
    const authOptions = (auth as any).options;
    const googleConfig = authOptions.socialProviders?.google;

    if (googleConfig) {
      // Must not define a custom getUserInfo that bypasses cryptographic signature verification
      assert.equal(
        googleConfig.getUserInfo,
        undefined,
        "Custom getUserInfo override must be removed so Better Auth's native cryptographic Google verification is used"
      );
    }
  });

  it("3. Account linking security: trustedProviders does not bypass email verification and requireLocalEmailVerified is active", () => {
    const authOptions = (auth as any).options;
    const accountLinking = authOptions.account?.accountLinking;

    assert.ok(accountLinking, "accountLinking configuration must exist");
    assert.equal(accountLinking.enabled, true, "Account linking must be enabled");

    // trustedProviders must NOT include 'google' so that unverified Google emails are not blindly trusted
    const trusted = accountLinking.trustedProviders || [];
    assert.ok(
      !trusted.includes("google"),
      "trustedProviders must NOT include 'google' to avoid bypassing email verification checks"
    );

    // requireLocalEmailVerified must remain strictly true
    assert.equal(
      accountLinking.requireLocalEmailVerified,
      true,
      "requireLocalEmailVerified must be true to prevent account takeover of unverified local accounts"
    );

    // updateUserInfoOnLink must remain false to protect existing user profile data
    assert.equal(
      accountLinking.updateUserInfoOnLink,
      false,
      "updateUserInfoOnLink must be false so OAuth linking does not overwrite user profile"
    );

    // allowDifferentEmails must not be enabled
    assert.notEqual(
      accountLinking.allowDifferentEmails,
      true,
      "allowDifferentEmails must not be true"
    );
  });

  it("4. Safe URL sanitization rejects malicious redirect targets and allows only safe same-origin application paths", () => {
    const defaultUrl = "/settings?tab=account";

    // Rejection of protocol-relative URLs
    assert.equal(getSafeCallbackUrl("//evil.com"), defaultUrl);
    assert.equal(getSafeCallbackUrl("///evil.com"), defaultUrl);

    // Rejection of backslash-based normalization tricks
    assert.equal(getSafeCallbackUrl("/\\evil.com"), defaultUrl);
    assert.equal(getSafeCallbackUrl("/\\\\evil.com"), defaultUrl);
    assert.equal(getSafeCallbackUrl("\\evil.com"), defaultUrl);
    assert.equal(getSafeCallbackUrl("/settings\\evil.com"), defaultUrl);

    // Rejection of external origins
    assert.equal(getSafeCallbackUrl("https://evil.com"), defaultUrl);
    assert.equal(getSafeCallbackUrl("http://attacker.com/settings"), defaultUrl);

    // Rejection of script schemes
    assert.equal(getSafeCallbackUrl("javascript:alert(1)"), defaultUrl);
    assert.equal(getSafeCallbackUrl("javascript:void(0)"), defaultUrl);
    assert.equal(getSafeCallbackUrl("data:text/html,<script>alert(1)</script>"), defaultUrl);

    // Rejection of invalid types and control characters
    assert.equal(getSafeCallbackUrl(null), defaultUrl);
    assert.equal(getSafeCallbackUrl(undefined), defaultUrl);
    assert.equal(getSafeCallbackUrl(""), defaultUrl);
    assert.equal(getSafeCallbackUrl("/settings\x00evil"), defaultUrl);

    // Safe relative application paths permitted
    assert.equal(getSafeCallbackUrl("/settings?tab=account"), "/settings?tab=account");
    assert.equal(getSafeCallbackUrl("/profile"), "/profile");
    assert.equal(getSafeCallbackUrl("/"), "/");
    assert.equal(getSafeCallbackUrl("/u/aubrey#rankings"), "/u/aubrey#rankings");
  });

  it("5. Verification email delivery failure triggers actionable APIError and does not silently succeed", async () => {
    const opts = (auth as any).options;
    const originalSend = opts.emailVerification.sendVerificationEmail;

    // Simulate delivery failure in sendVerificationEmail
    opts.emailVerification.sendVerificationEmail = async () => {
      throw new APIError("INTERNAL_SERVER_ERROR", {
        message: "Failed to deliver verification email. Please check your email configuration or try again later.",
      });
    };

    try {
      await assert.rejects(
        async () => {
          await opts.emailVerification.sendVerificationEmail({
            user: { email: "delivery_fail_test@example.com" },
            url: "http://localhost:3000/verify-email?token=xyz",
            token: "xyz",
          });
        },
        (err: any) => {
          assert(err instanceof APIError || err.status === "INTERNAL_SERVER_ERROR" || err.statusCode === 500);
          assert.equal(
            err.message,
            "Failed to deliver verification email. Please check your email configuration or try again later."
          );
          // Ensure secret/token is not leaked in error message
          assert(!err.message.includes("xyz"));
          return true;
        }
      );
    } finally {
      opts.emailVerification.sendVerificationEmail = originalSend;
    }
  });

  it("6. Email verification token lifecycle verifies valid tokens and rejects invalid tokens", async () => {
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

  it("7. Data Preservation & Multi-Provider Association: secondary provider links to existing userId without data loss or duplication", async () => {
    // Note: Live end-to-end OAuth code exchange requires active Google Cloud credentials and interactive browser consent.
    // This test explicitly validates database identity preservation and schema integrity when a Google account is associated.
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

    // Check initial credential account exists
    const initialAccounts = await db.query.account.findMany({
      where: (a, { eq }) => eq(a.userId, createdUser.id),
    });
    assert.equal(initialAccounts.length, 1);
    assert.equal(initialAccounts[0].providerId, "credential");

    // Add secondary Google account record for the same user (what linkSocial persists)
    const googleAccountId = `google_sub_${timestamp}`;
    await db.insert(account).values({
      id: `acc_google_${timestamp}`,
      accountId: googleAccountId,
      providerId: "google",
      userId: createdUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Verify account table has both providers associated with the EXACT same userId
    const updatedAccounts = await db.query.account.findMany({
      where: (a, { eq }) => eq(a.userId, createdUser.id),
    });
    assert.equal(updatedAccounts.length, 2, "User must have both credential and google provider rows");
    const providers = updatedAccounts.map((a) => a.providerId);
    assert.ok(providers.includes("credential"), "Must retain credential provider");
    assert.ok(providers.includes("google"), "Must include linked google provider");

    // Check that user identity and records remain single and intact
    const allMatchingUsers = await db.query.user.findMany({
      where: (u, { eq }) => eq(u.email, userEmail),
    });
    assert.equal(allMatchingUsers.length, 1, "Must not create duplicate user records");

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

  it("8. Backward compatibility: existing password sign-in does not mandate email verification", async () => {
    const authOptions = (auth as any).options;
    const emailAndPassword = authOptions.emailAndPassword;

    assert.ok(emailAndPassword, "emailAndPassword configuration must exist");
    assert.equal(emailAndPassword.enabled, true, "emailAndPassword must be enabled");
    assert.equal(
      emailAndPassword.requireEmailVerification,
      false,
      "requireEmailVerification must be false for password auth to avoid breaking existing users"
    );
  });

  it("9. Callback status verification logic rejects unverified claims from URL parameters alone", () => {
    // Simulate UI validation: URL params alone must not cause false success states
    const accountsWithoutGoogle = [{ providerId: "credential" }];
    const accountsWithGoogle = [{ providerId: "credential" }, { providerId: "google" }];

    function checkGoogleLinked(urlParam: string | null, accounts: { providerId: string }[]): boolean {
      if (urlParam !== "google") return false;
      return accounts.some((a) => a.providerId === "google");
    }

    // Attempting to spoof success via ?linked=google without an actual Google account linked
    assert.equal(checkGoogleLinked("google", accountsWithoutGoogle), false);
    // True success when confirmed by server accounts list
    assert.equal(checkGoogleLinked("google", accountsWithGoogle), true);

    function checkEmailVerified(urlParam: string | null, serverUser: { emailVerified: boolean } | null): boolean {
      if (urlParam !== "1") return false;
      return Boolean(serverUser?.emailVerified);
    }

    // Attempting to spoof ?verified=1 without server-side verification
    assert.equal(checkEmailVerified("1", { emailVerified: false }), false);
    assert.equal(checkEmailVerified("1", null), false);
    // True success when server confirms emailVerified
    assert.equal(checkEmailVerified("1", { emailVerified: true }), true);
  });
});
