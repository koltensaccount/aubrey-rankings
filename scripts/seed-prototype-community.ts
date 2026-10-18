import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";

const BASE_URL = process.env.TARGET_URL || "https://aubrey.koltensserver.com";
const CREDENTIALS_DIR = path.join(process.env.HOME || "", ".aubrey-rankings");
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, "demo-credentials.json");
const MANIFEST_FILE = path.join(CREDENTIALS_DIR, "demo-manifest.json");

interface DemoAccountConfig {
  key: string;
  name: string;
  email: string;
  username: string;
  bio: string;
  accentColor: string;
}

const DEMO_ACCOUNTS: DemoAccountConfig[] = [
  {
    key: "aubrey",
    name: "Aubrey (Demo)",
    email: "koltenbendickson+demo_aubrey@gmail.com",
    username: "demo_aubrey",
    bio: "Evaluating media by narrative rigor, visual texture, and weighted rubrics. (Demo account)",
    accentColor: "#89D5D5",
  },
  {
    key: "julian",
    name: "Julian Vance (Demo)",
    email: "koltenbendickson+demo_julian@gmail.com",
    username: "demo_julian",
    bio: "Science fiction & big screens. Analyzing narrative puzzle architecture and practical mechanical scale. (Demo account)",
    accentColor: "#F59E0B",
  },
  {
    key: "marcus",
    name: "Marcus Chen (Demo)",
    email: "koltenbendickson+demo_marcus@gmail.com",
    username: "demo_marcus",
    bio: "Thrillers, frame by frame. Surgical editing, sound design, and controlled paranoia. (Demo account)",
    accentColor: "#10B981",
  },
  {
    key: "elena",
    name: "Elena (Demo)",
    email: "koltenbendickson+demo_elena@gmail.com",
    username: "demo_elena",
    bio: "Lover of cinematic order and contrasting perspectives. (Demo account)",
    accentColor: "#EC4899",
  },
];

const BLACK_MIRROR_ITEMS = [
  {
    season: 3,
    episode: 4,
    title: "San Junipero",
    score: 9.6,
    review: "A rare transcendent romance in an otherwise bleak anthology. Clint Mansell's synth score and Gugu Mbatha-Raw's performance elevate it to sublime art.",
    categories: { writing: 9.5, acting: 9.8, cinematography: 9.5, music: 10.0, vibes: 9.8 },
  },
  {
    season: 2,
    episode: 4,
    title: "White Christmas",
    score: 9.5,
    review: "Three interwoven horrors culminating in the most terrifying punishment ever conceived on television. Jon Hamm at his absolute best.",
    categories: { writing: 10.0, acting: 9.5, cinematography: 9.0, music: 8.5, vibes: 9.5 },
  },
  {
    season: 4,
    episode: 1,
    title: "USS Callister",
    score: 9.4,
    review: "Toby Haynes balances high-camp Star Trek technicolor pastiche with genuinely chilling psychological workplace abuse.",
    categories: { writing: 9.2, acting: 9.5, cinematography: 9.6, music: 9.0, vibes: 9.4 },
  },
  {
    season: 1,
    episode: 3,
    title: "The Entire History of You",
    score: 9.3,
    review: "The definitive early episode. Relentless, intimate paranoia where memory itself becomes a self-inflicted interrogation device.",
    categories: { writing: 9.5, acting: 9.2, cinematography: 8.8, music: 8.5, vibes: 9.4 },
  },
  {
    season: 1,
    episode: 2,
    title: "Fifteen Million Merits",
    score: 9.1,
    review: "Daniel Kaluuya's monologue against the monolithic judges remains the series' rawest emotional eruption.",
    categories: { writing: 9.0, acting: 9.5, cinematography: 9.2, music: 8.5, vibes: 9.0 },
  },
  {
    season: 3,
    episode: 1,
    title: "Nosedive",
    score: 9.0,
    review: "Joe Wright's pastel aesthetic renders social-media validation anxiety into a darkly hilarious pastel panic.",
    categories: { writing: 8.8, acting: 9.2, cinematography: 9.6, music: 8.6, vibes: 9.0 },
  },
  {
    season: 2,
    episode: 1,
    title: "Be Right Back",
    score: 8.9,
    review: "Hayley Atwell and Domhnall Gleeson deliver an emotionally devastating study on grief and AI replicas.",
    categories: { writing: 9.0, acting: 9.2, cinematography: 8.5, music: 8.5, vibes: 8.8 },
  },
  {
    season: 4,
    episode: 6,
    title: "Black Museum",
    score: 8.8,
    review: "Grim carnival of high-tech atrocities that doubles as an encyclopedia of easter eggs.",
    categories: { writing: 8.8, acting: 9.0, cinematography: 8.5, music: 8.0, vibes: 8.9 },
  },
];

const NOLAN_FILMS = [
  {
    tmdbId: 157336,
    title: "Interstellar",
    score: 9.5,
    review: "The docking sequence still gets me. Zimmer’s organ score makes something impossibly vast feel completely human.",
    categories: { writing: 9.2, acting: 9.4, cinematography: 9.8, music: 10.0, vibes: 9.7 },
  },
  {
    tmdbId: 1124,
    title: "The Prestige",
    score: 9.5,
    review: "Obsession, stagecraft, and the sacrifice demanded by absolute devotion to an illusion.",
    categories: { writing: 9.8, acting: 9.6, cinematography: 9.2, music: 9.0, vibes: 9.5 },
  },
  {
    tmdbId: 872585,
    title: "Oppenheimer",
    score: 9.4,
    review: "A three-hour biographical suspense thriller structured as a relentless psychological chain reaction.",
    categories: { writing: 9.5, acting: 9.8, cinematography: 9.6, music: 9.4, vibes: 9.2 },
  },
  {
    tmdbId: 27205,
    title: "Inception",
    score: 9.3,
    review: "Masterclass in cinematic architecture and cross-cutting dream layers.",
    categories: { writing: 9.4, acting: 9.0, cinematography: 9.5, music: 9.5, vibes: 9.4 },
  },
  {
    tmdbId: 374720,
    title: "Dunkirk",
    score: 8.8,
    review: "Pure kinetic temporal editing where survival is the only narrative arc.",
    categories: { writing: 8.5, acting: 8.8, cinematography: 9.6, music: 9.2, vibes: 8.9 },
  },
];

const FINCHER_FILMS = [
  {
    tmdbId: 1949,
    title: "Zodiac",
    score: 9.8,
    review: "The ultimate procedural obsession. Fincher turns investigative tedium into the most engrossing mystery in modern cinema.",
    categories: { writing: 9.9, acting: 9.7, cinematography: 9.8, music: 9.4, vibes: 9.9 },
  },
  {
    tmdbId: 37799,
    title: "The Social Network",
    score: 9.7,
    review: "Sorkin's razor prose meeting Fincher's cold precision and Reznor's ambient industrial pulse.",
    categories: { writing: 10.0, acting: 9.8, cinematography: 9.6, music: 9.8, vibes: 9.6 },
  },
  {
    tmdbId: 550,
    title: "Fight Club",
    score: 9.6,
    review: "Visceral satire on consumer isolation and hyper-masculinity, executed with radical visual swagger.",
    categories: { writing: 9.5, acting: 9.7, cinematography: 9.8, music: 9.4, vibes: 9.8 },
  },
  {
    tmdbId: 807,
    title: "Se7en",
    score: 9.5,
    review: "Relentless rain, decay, and moral rot. The defining modern neo-noir crime thriller.",
    categories: { writing: 9.4, acting: 9.6, cinematography: 9.8, music: 9.0, vibes: 9.8 },
  },
  {
    tmdbId: 210577,
    title: "Gone Girl",
    score: 9.4,
    review: "Ice-cold dissection of marital performative theater and media manipulation.",
    categories: { writing: 9.4, acting: 9.7, cinematography: 9.4, music: 9.2, vibes: 9.5 },
  },
];

async function api(endpoint: string, options: { method?: string; body?: any; cookie?: string } = {}) {
  const headers: Record<string, string> = {
    Origin: BASE_URL,
    ...(options.cookie ? { Cookie: options.cookie } : {}),
  };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const cookies = res.headers.getSetCookie?.() || [];
  const cookieHeader = cookies.map((c) => c.split(";")[0]).join("; ");

  let data: any = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await res.json().catch(() => null);
  } else {
    data = await res.text().catch(() => "");
  }

  return { res, status: res.status, data, cookie: cookieHeader };
}

(async () => {
  console.log(`\n=======================================================`);
  console.log(`POPULATING REAL PROTOTYPE COMMUNITY ON: ${BASE_URL}`);
  console.log(`=======================================================\n`);

  fs.mkdirSync(CREDENTIALS_DIR, { mode: 0o700, recursive: true });

  // Load existing credentials if present
  let credentials: Record<string, { id: string; email: string; password: string; username: string }> = {};
  if (fs.existsSync(CREDENTIALS_FILE)) {
    try {
      credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, "utf8"));
    } catch {
      credentials = {};
    }
  }

  const userSessions: Record<string, { id: string; cookie: string; username: string }> = {};

  // -------------------------------------------------------------------------
  // Stage 3: Create & Initialize Dedicated Demo Accounts
  // -------------------------------------------------------------------------
  console.log("--- 1. Authenticating Demo Accounts ---");

  for (const acct of DEMO_ACCOUNTS) {
    let cred = credentials[acct.key];
    let cookie = "";
    let userId = "";

    if (cred && cred.password) {
      // Try to sign in with existing credentials
      let signInRes = await api("/api/auth/sign-in/email", {
        method: "POST",
        body: { email: cred.email, password: cred.password },
      });
      if (signInRes.status === 429) {
        console.log(`[Rate Limited on Sign-In] Waiting 30s before retrying sign-in for ${acct.name}...`);
        await new Promise((r) => setTimeout(r, 30000));
        signInRes = await api("/api/auth/sign-in/email", {
          method: "POST",
          body: { email: cred.email, password: cred.password },
        });
      }
      if (signInRes.status === 200 && signInRes.cookie) {
        cookie = signInRes.cookie;
        userId = signInRes.data?.user?.id || cred.id;
        console.log(`[Signed In] ${acct.name} (@${acct.username}) -> ID: ${userId}`);
      } else {
        console.warn(`Sign-in for ${acct.name} returned status ${signInRes.status}: ${JSON.stringify(signInRes.data)}`);
      }
    }

    if (!cookie) {
      // Create new account with rate limit retry
      const password = randomBytes(24).toString("base64url") + "!Aa9";
      console.log(`[Registering] ${acct.name} (${acct.email})...`);

      let signUpRes = await api("/api/auth/sign-up/email", {
        method: "POST",
        body: { name: acct.name, email: acct.email, password },
      });

      if (signUpRes.status === 429) {
        console.log("Rate limited by Better Auth. Waiting 35 seconds before retrying signup...");
        await new Promise((r) => setTimeout(r, 35000));
        signUpRes = await api("/api/auth/sign-up/email", {
          method: "POST",
          body: { name: acct.name, email: acct.email, password },
        });
      }

      if (signUpRes.status !== 200) {
        console.warn(`Sign-up returned ${signUpRes.status}: ${JSON.stringify(signUpRes.data)}`);
        throw new Error(`Failed to initialize ${acct.name}`);
      }

      cookie = signUpRes.cookie;
      userId = signUpRes.data?.user?.id;
      assert.ok(userId, `Missing user ID for ${acct.name}`);

      cred = {
        id: userId,
        email: acct.email,
        password,
        username: acct.username,
      };
      credentials[acct.key] = cred;

      // Save credentials immediately to disk
      fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), { mode: 0o600 });
      fs.chmodSync(CREDENTIALS_FILE, 0o600);

      // Complete onboarding and appearance
      await api("/api/user/profile", {
        method: "PATCH",
        cookie,
        body: {
          username: acct.username,
          bio: acct.bio,
          preferredTheme: "dark",
          accentColor: acct.accentColor,
        },
      });

      console.log(`[Registered & Onboarded] ${acct.name} (@${acct.username}) -> ID: ${userId}`);
      // Polite pause between registrations to avoid tripping rate limits
      await new Promise((r) => setTimeout(r, 2000));
    } else {
      // Ensure bio and appearance settings are synchronized
      await api("/api/user/profile", {
        method: "PATCH",
        cookie,
        body: {
          username: acct.username,
          bio: acct.bio,
          preferredTheme: "dark",
          accentColor: acct.accentColor,
        },
      });
    }

    userSessions[acct.key] = { id: userId, cookie, username: acct.username };
  }

  // Persist updated credentials securely
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2), { mode: 0o600 });
  fs.chmodSync(CREDENTIALS_FILE, 0o600);
  console.log(`Credentials safely recorded at: ${CREDENTIALS_FILE} (0600)\n`);

  // Manifest structure
  const manifest: {
    baseUrl: string;
    seededAt: string;
    accounts: Record<string, any>;
    collections: Record<string, any>;
  } = {
    baseUrl: BASE_URL,
    seededAt: new Date().toISOString(),
    accounts: Object.fromEntries(
      Object.entries(userSessions).map(([k, s]) => [k, { id: s.id, username: s.username }])
    ),
    collections: {},
  };

  // Helper to ensure collection exists
  async function ensureCollection(
    userKey: string,
    title: string,
    createPayload: any
  ): Promise<any> {
    const session = userSessions[userKey];
    const existing = await api("/api/collections", { cookie: session.cookie });
    if (existing.status === 200 && Array.isArray(existing.data)) {
      const match = existing.data.find((c: any) => c.title === title);
      if (match) {
        console.log(`[Found Collection] "${title}" by ${userKey} (${match.id})`);
        return match;
      }
    }

    console.log(`[Creating Collection] "${title}" for ${userKey}...`);
    const createRes = await api("/api/collections", {
      method: "POST",
      cookie: session.cookie,
      body: createPayload,
    });
    assert.equal(createRes.status, 200, `Failed to create collection ${title}: ${JSON.stringify(createRes.data)}`);
    const collectionId = createRes.data?.id || createRes.data?.collection?.id;
    console.log(`-> Created collection "${title}" (${collectionId})`);
    return { id: collectionId, title };
  }

  // -------------------------------------------------------------------------
  // Stage 4: Recreate Prototype Rankings & Ratings
  // -------------------------------------------------------------------------
  console.log("--- 2. Recreating Prototype Collections & Rankings ---");

  // 1. Aubrey's "Black Mirror, ranked"
  const aubreyCol = await ensureCollection("aubrey", "Black Mirror, ranked", {
    title: "Black Mirror, ranked",
    description: "The complete mathematical ranking of Charlie Brooker's dystopian anthology, graded on writing, acting, cinematography, sound, and resonant dread.",
    collectionType: "tv_show",
    tmdbId: 42009,
    importAllEpisodes: false,
    selectedSeasonNumbers: [1, 2, 3, 4, 5, 6],
  });

  // Set Aubrey's collection public, pinned, and add custom artwork
  await api(`/api/collections/${aubreyCol.id}`, {
    method: "PATCH",
    cookie: userSessions.aubrey.cookie,
    body: {
      visibility: "public",
      isPinned: true,
      backdropImage: "/prototype-art/black-mirror-wall.jpg",
      clearLogoUrl: "/prototype-art/black-mirror-logo.png",
    },
  });

  manifest.collections["black_mirror"] = {
    id: aubreyCol.id,
    title: "Black Mirror, ranked",
    owner: "demo_aubrey",
    url: `${BASE_URL}/collection/${aubreyCol.id}`,
  };

  // Helper to map category names to rating system category IDs
  function mapCategoriesToScores(categories: any[], scoreInputs: Record<string, number>) {
    const scores: Record<string, number> = {};
    for (const [key, value] of Object.entries(scoreInputs)) {
      const match = categories.find((c: any) => {
        const n = c.name.toLowerCase();
        if (key === "writing") return n.includes("writing");
        if (key === "acting") return n.includes("acting");
        if (key === "cinematography") return n.includes("cinemat");
        if (key === "sound" || key === "music") return n.includes("sound") || n.includes("music");
        if (key === "vibes") return n.includes("vibe") || n.includes("dread") || n.includes("resonance");
        return false;
      });
      if (match) scores[match.id] = value;
    }
    return scores;
  }

  // Add the 8 key Black Mirror episodes to Aubrey's ranking
  console.log("Adding and rating 8 Black Mirror episodes for Aubrey (Demo)...");
  const colDetailsAubrey = await api(`/api/collections/${aubreyCol.id}`, { cookie: userSessions.aubrey.cookie });
  const collectionAubrey = colDetailsAubrey.data?.collection || colDetailsAubrey.data || {};
  const existingEntriesAubrey = collectionAubrey.entries || [];
  const systemAubrey = collectionAubrey.defaultRatingSystem;
  const keptAubreyEntryIds = new Set<string>();

  for (const item of BLACK_MIRROR_ITEMS) {
    let entry = existingEntriesAubrey.find(
      (e: any) =>
        e.mediaItem?.seasonNumber === item.season &&
        e.mediaItem?.episodeNumber === item.episode
    );

    if (!entry) {
      const addRes = await api(`/api/collections/${aubreyCol.id}/entries`, {
        method: "POST",
        cookie: userSessions.aubrey.cookie,
        body: {
          tmdbId: 42009,
          mediaType: "episode",
          seasonNumber: item.season,
          episodeNumber: item.episode,
        },
      });
      if (addRes.status === 200 && addRes.data?.entry) {
        entry = addRes.data.entry;
      }
    }

    if (entry?.mediaItemId) {
      keptAubreyEntryIds.add(entry.id);
      const scores = mapCategoriesToScores(systemAubrey?.categories || [], item.categories);
      await api("/api/ratings", {
        method: "POST",
        cookie: userSessions.aubrey.cookie,
        body: {
          mediaItemId: entry.mediaItemId,
          collectionId: aubreyCol.id,
          ratingSystemId: systemAubrey?.id,
          reviewText: item.review,
          scores,
        },
      });
    }
  }

  // Prune any extraneous unrated episodes so Aubrey's ranking has exactly the 8 prototype episodes
  for (const entry of existingEntriesAubrey) {
    if (!keptAubreyEntryIds.has(entry.id)) {
      await api(`/api/collections/${aubreyCol.id}/entries/${entry.id}`, {
        method: "DELETE",
        cookie: userSessions.aubrey.cookie,
      });
    }
  }

  // 2. Julian Vance's "The worlds of Christopher Nolan"
  const julianCol = await ensureCollection("julian", "The worlds of Christopher Nolan", {
    title: "The worlds of Christopher Nolan",
    description: "Examined for narrative puzzle architecture, practical mechanical scale, and relentless propulsive momentum.",
    collectionType: "movie_franchise",
  });

  await api(`/api/collections/${julianCol.id}`, {
    method: "PATCH",
    cookie: userSessions.julian.cookie,
    body: {
      visibility: "public",
      isPinned: true,
      backdropImage: "/prototype-art/nolan.jpg",
    },
  });

  manifest.collections["nolan"] = {
    id: julianCol.id,
    title: "The worlds of Christopher Nolan",
    owner: "demo_julian",
    url: `${BASE_URL}/collection/${julianCol.id}`,
  };

  console.log("Adding and rating 5 Nolan films for Julian Vance (Demo)...");
  const colDetailsJulian = await api(`/api/collections/${julianCol.id}`, { cookie: userSessions.julian.cookie });
  const collectionJulian = colDetailsJulian.data?.collection || colDetailsJulian.data || {};
  const existingEntriesJulian = collectionJulian.entries || [];
  const systemJulian = collectionJulian.defaultRatingSystem;

  for (const film of NOLAN_FILMS) {
    let entry = existingEntriesJulian.find((e: any) => e.mediaItem?.tmdbId === film.tmdbId);
    if (!entry) {
      const addRes = await api(`/api/collections/${julianCol.id}/entries`, {
        method: "POST",
        cookie: userSessions.julian.cookie,
        body: {
          tmdbId: film.tmdbId,
          mediaType: "movie",
        },
      });
      if (addRes.status === 200 && addRes.data?.entry) {
        entry = addRes.data.entry;
      }
    }

    if (entry?.mediaItemId) {
      const scores = mapCategoriesToScores(systemJulian?.categories || [], film.categories);
      await api("/api/ratings", {
        method: "POST",
        cookie: userSessions.julian.cookie,
        body: {
          mediaItemId: entry.mediaItemId,
          collectionId: julianCol.id,
          ratingSystemId: systemJulian?.id,
          reviewText: film.review,
          scores,
        },
      });
    }
  }

  // 3. Marcus Chen's "Fincher, in order"
  const marcusCol = await ensureCollection("marcus", "Fincher, in order", {
    title: "Fincher, in order",
    description: "From Se7en and Fight Club to Zodiac and The Social Network. Evaluated for surgical editing, sound design, and controlled paranoia.",
    collectionType: "movie_franchise",
  });

  await api(`/api/collections/${marcusCol.id}`, {
    method: "PATCH",
    cookie: userSessions.marcus.cookie,
    body: {
      visibility: "public",
      isPinned: true,
      backdropImage: "/prototype-art/fincher.jpg",
    },
  });

  manifest.collections["fincher"] = {
    id: marcusCol.id,
    title: "Fincher, in order",
    owner: "demo_marcus",
    url: `${BASE_URL}/collection/${marcusCol.id}`,
  };

  console.log("Adding and rating 5 Fincher films for Marcus Chen (Demo)...");
  const colDetailsMarcus = await api(`/api/collections/${marcusCol.id}`, { cookie: userSessions.marcus.cookie });
  const collectionMarcus = colDetailsMarcus.data?.collection || colDetailsMarcus.data || {};
  const existingEntriesMarcus = collectionMarcus.entries || [];
  const systemMarcus = collectionMarcus.defaultRatingSystem;

  for (const film of FINCHER_FILMS) {
    let entry = existingEntriesMarcus.find((e: any) => e.mediaItem?.tmdbId === film.tmdbId);
    if (!entry) {
      const addRes = await api(`/api/collections/${marcusCol.id}/entries`, {
        method: "POST",
        cookie: userSessions.marcus.cookie,
        body: {
          tmdbId: film.tmdbId,
          mediaType: "movie",
        },
      });
      if (addRes.status === 200 && addRes.data?.entry) {
        entry = addRes.data.entry;
      }
    }

    if (entry?.mediaItemId) {
      const scores = mapCategoriesToScores(systemMarcus?.categories || [], film.categories);
      await api("/api/ratings", {
        method: "POST",
        cookie: userSessions.marcus.cookie,
        body: {
          mediaItemId: entry.mediaItemId,
          collectionId: marcusCol.id,
          ratingSystemId: systemMarcus?.id,
          reviewText: film.review,
          scores,
        },
      });
    }
  }

  // -------------------------------------------------------------------------
  // Stage 5: Recreate Follow Relationships
  // -------------------------------------------------------------------------
  console.log("\n--- 3. Recreating Follow Relationships ---");

  const followsToEstablish = [
    { from: "aubrey", to: "julian" },
    { from: "julian", to: "marcus" },
    { from: "marcus", to: "aubrey" },
    { from: "elena", to: "aubrey" },
    { from: "elena", to: "julian" },
  ];

  for (const f of followsToEstablish) {
    const fromUser = userSessions[f.from];
    const toUser = userSessions[f.to];
    const checkRes = await api(`/api/social/follow?targetUserId=${toUser.id}`, { cookie: fromUser.cookie });
    if (!checkRes.data?.isFollowing) {
      console.log(`[Follow] @${fromUser.username} follows @${toUser.username}`);
      await api("/api/social/follow", {
        method: "POST",
        cookie: fromUser.cookie,
        body: { targetUserId: toUser.id },
      });
    } else {
      console.log(`[Follow Exists] @${fromUser.username} -> @${toUser.username}`);
    }
  }

  // -------------------------------------------------------------------------
  // Stage 6: Recreate Comments
  // -------------------------------------------------------------------------
  console.log("\n--- 4. Recreating Prototype Comments ---");

  const commentsToSeed = [
    {
      userKey: "elena",
      collectionId: aubreyCol.id,
      content: "I love seeing how everyone’s order differs.",
    },
    {
      userKey: "marcus",
      collectionId: aubreyCol.id,
      content: "What made your top pick stand out?",
    },
  ];

  for (const c of commentsToSeed) {
    const userSession = userSessions[c.userKey];
    const existingComments = await api(`/api/social/comments?collectionId=${c.collectionId}`);
    const hasComment = existingComments.data?.comments?.some(
      (existing: any) =>
        (existing.author?.id || existing.userId) === userSession.id &&
        existing.content.trim() === c.content.trim()
    );

    if (!hasComment) {
      console.log(`[Comment] @${userSession.username} commented on collection ${c.collectionId}: "${c.content}"`);
      await api("/api/social/comments", {
        method: "POST",
        cookie: userSession.cookie,
        body: {
          collectionId: c.collectionId,
          content: c.content,
        },
      });
    } else {
      console.log(`[Comment Exists] @${userSession.username}: "${c.content}"`);
    }
  }

  // -------------------------------------------------------------------------
  // Stage 7: Recreate Real Likes
  // -------------------------------------------------------------------------
  console.log("\n--- 5. Recreating Real Likes ---");

  const likesToSeed = [
    { userKey: "julian", collectionId: aubreyCol.id },
    { userKey: "marcus", collectionId: aubreyCol.id },
    { userKey: "elena", collectionId: aubreyCol.id },
    { userKey: "aubrey", collectionId: julianCol.id },
    { userKey: "julian", collectionId: marcusCol.id },
  ];

  for (const l of likesToSeed) {
    const userSession = userSessions[l.userKey];
    const likeStatus = await api(`/api/social/like?collectionId=${l.collectionId}`, { cookie: userSession.cookie });
    if (!likeStatus.data?.isLiked) {
      console.log(`[Like] @${userSession.username} likes collection ${l.collectionId}`);
      await api("/api/social/like", {
        method: "POST",
        cookie: userSession.cookie,
        body: {
          collectionId: l.collectionId,
          action: "like",
        },
      });
    } else {
      console.log(`[Like Exists] @${userSession.username} -> collection ${l.collectionId}`);
    }
  }

  // -------------------------------------------------------------------------
  // Stage 8: Recreate Saved Rankings (Bookmarks)
  // -------------------------------------------------------------------------
  console.log("\n--- 6. Seeding Saved Rankings (Bookmarks) ---");

  const savesToSeed = [
    { userKey: "julian", collectionId: aubreyCol.id },
    { userKey: "marcus", collectionId: julianCol.id },
    { userKey: "elena", collectionId: aubreyCol.id },
    { userKey: "aubrey", collectionId: marcusCol.id },
  ];

  for (const s of savesToSeed) {
    const userSession = userSessions[s.userKey];
    const saveStatus = await api(`/api/social/saved?collectionId=${s.collectionId}`, { cookie: userSession.cookie });
    if (!saveStatus.data?.isSaved) {
      console.log(`[Save] @${userSession.username} saved collection ${s.collectionId}`);
      await api("/api/social/saved", {
        method: "POST",
        cookie: userSession.cookie,
        body: {
          collectionId: s.collectionId,
          action: "save",
        },
      });
    } else {
      console.log(`[Save Exists] @${userSession.username} -> collection ${s.collectionId}`);
    }
  }

  // Save manifest
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), { mode: 0o600 });
  fs.chmodSync(MANIFEST_FILE, 0o600);
  console.log(`\nManifest securely written to: ${MANIFEST_FILE}`);

  console.log("\n=======================================================");
  console.log("PROTOTYPE COMMUNITY SEEDING COMPLETED SUCCESSFULLY!");
  console.log("=======================================================\n");
})().catch((err) => {
  console.error("Seeding failed:", err);
  process.exitCode = 1;
});
