import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  real,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ==========================================
// BETTER AUTH CORE TABLES
// ==========================================

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    username: text("username").unique(),
    bio: text("bio"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("idx_user_username_lower").on(sql`LOWER(${table.username})`),
  ]
);

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ==========================================
// MEDIA & LIBRARY TABLES
// ==========================================

export const mediaItems = pgTable(
  "media_items",
  {
    id: text("id").primaryKey(), // Generated UUID
    tmdbId: integer("tmdb_id"), // Nullable for custom entries
    mediaType: text("media_type").notNull(), // 'movie' | 'tv' | 'season' | 'episode' | 'custom'
    title: text("title").notNull(),
    overview: text("overview"),
    posterPath: text("poster_path"),
    backdropPath: text("backdrop_path"),
    stillPath: text("still_path"),
    releaseDate: text("release_date"),
    seasonNumber: integer("season_number"),
    episodeNumber: integer("episode_number"),
    parentMediaId: text("parent_media_id").references((): any => mediaItems.id, {
      onDelete: "set null",
    }), // foreign key to parent season or show
    tmdbMetadata: jsonb("tmdb_metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_media_tmdb").on(table.tmdbId, table.mediaType),
    index("idx_media_parent").on(table.parentMediaId),
    index("idx_media_type").on(table.mediaType),
  ]
);

// ==========================================
// RATING SYSTEMS & WEIGHTS
// ==========================================

export const ratingSystems = pgTable(
  "rating_systems",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    scale: integer("scale").notNull().default(10), // 5, 10, or 100
    isDefault: boolean("is_default").notNull().default(false),
    isSystemTemplate: boolean("is_system_template").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_rating_systems_user").on(table.userId),
    uniqueIndex("uniq_user_default_rating_system")
      .on(table.userId)
      .where(sql`"is_default" = true`),
  ]
);

export const ratingCategories = pgTable(
  "rating_categories",
  {
    id: text("id").primaryKey(),
    ratingSystemId: text("rating_system_id")
      .notNull()
      .references(() => ratingSystems.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    weight: real("weight").notNull().default(1.0),
    sortOrder: integer("sort_order").notNull().default(0),
    isRequired: boolean("is_required").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_categories_system").on(table.ratingSystemId, table.sortOrder),
  ]
);

// ==========================================
// COLLECTIONS
// ==========================================

export const collections = pgTable(
  "collections",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    collectionType: text("collection_type").notNull(), // 'tv_show' | 'movie_franchise' | 'custom'
    tmdbId: integer("tmdb_id"), // Linked TMDB show or collection ID if applicable
    isPublic: boolean("is_public").notNull().default(false),
    visibility: text("visibility").notNull().default("private"), // 'private' | 'unlisted' | 'public'
    shareSlug: text("share_slug").unique(),
    defaultRatingSystemId: text("default_rating_system_id").references(
      () => ratingSystems.id,
      { onDelete: "set null" }
    ),
    customCoverImage: text("custom_cover_image"),
    backdropImage: text("backdrop_image"),
    isPinned: boolean("is_pinned").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_collections_user").on(table.userId),
    index("idx_collections_public").on(table.isPublic, table.shareSlug),
  ]
);

export const collectionEntries = pgTable(
  "collection_entries",
  {
    id: text("id").primaryKey(),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    mediaItemId: text("media_item_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_collection_media").on(
      table.collectionId,
      table.mediaItemId
    ),
    index("idx_entries_collection").on(table.collectionId, table.sortOrder),
    index("idx_entries_media").on(table.mediaItemId),
  ]
);

// ==========================================
// RATINGS & CATEGORY SCORES
// ==========================================

export const ratings = pgTable(
  "ratings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mediaItemId: text("media_item_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    collectionId: text("collection_id").references(() => collections.id, {
      onDelete: "cascade",
    }), // Nullable: allows collection-scoped or global rating
    ratingSystemId: text("rating_system_id").references(
      () => ratingSystems.id,
      { onDelete: "set null" }
    ),
    calculatedOverallScore: real("calculated_overall_score"),
    sourceRating: real("source_rating"),
    sourceScale: real("source_scale"),
    sourceService: text("source_service"),
    letterboxdUri: text("letterboxd_uri"),
    watchDate: timestamp("watch_date"),
    reviewText: text("review_text"),
    personalNotes: text("personal_notes"),
    isWatched: boolean("is_watched").notNull().default(false),
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_user_media_collection").on(
      table.userId,
      table.mediaItemId,
      table.collectionId
    ),
    uniqueIndex("uniq_user_media_global")
      .on(table.userId, table.mediaItemId)
      .where(sql`"collection_id" IS NULL`),
    index("idx_ratings_user").on(table.userId),
    index("idx_ratings_collection").on(table.collectionId),
    index("idx_ratings_media").on(table.mediaItemId),
  ]
);

export const categoryScores = pgTable(
  "category_scores",
  {
    id: text("id").primaryKey(),
    ratingId: text("rating_id")
      .notNull()
      .references(() => ratings.id, { onDelete: "cascade" }),
    categoryId: text("category_id")
      .notNull()
      .references(() => ratingCategories.id, { onDelete: "cascade" }),
    score: real("score").notNull(),
    weightApplied: real("weight_applied").notNull().default(1.0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_rating_category").on(table.ratingId, table.categoryId),
    index("idx_category_scores_rating").on(table.ratingId),
  ]
);

// ==========================================
// ARTWORK OVERRIDES
// ==========================================

export const artworkOverrides = pgTable(
  "artwork_overrides",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    mediaItemId: text("media_item_id")
      .notNull()
      .references(() => mediaItems.id, { onDelete: "cascade" }),
    customArtworkUrl: text("custom_artwork_url").notNull(),
    originalArtworkUrl: text("original_artwork_url"),
    cropData: jsonb("crop_data"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_user_artwork").on(table.userId, table.mediaItemId),
    index("idx_artwork_media").on(table.mediaItemId),
  ]
);

// ==========================================
// SOCIAL TABLES (STAGE 5)
// ==========================================

export const follows = pgTable(
  "follows",
  {
    id: text("id").primaryKey(),
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_follower_following").on(
      table.followerId,
      table.followingId
    ),
    index("idx_follows_follower").on(table.followerId),
    index("idx_follows_following").on(table.followingId),
  ]
);

export const likes = pgTable(
  "likes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_user_collection_like").on(
      table.userId,
      table.collectionId
    ),
    index("idx_likes_collection").on(table.collectionId),
    index("idx_likes_user").on(table.userId),
  ]
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_comments_collection").on(table.collectionId, table.createdAt),
    index("idx_comments_user").on(table.userId),
  ]
);

export const feedActivities = pgTable(
  "feed_activities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activityType: text("activity_type").notNull(), // 'published_collection' | 'rated_entry' | 'liked_collection'
    collectionId: text("collection_id").references(() => collections.id, {
      onDelete: "cascade",
    }),
    metadata: text("metadata"), // JSON string
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("idx_feed_activities_user_created").on(table.userId, table.createdAt),
    index("idx_feed_activities_collection").on(table.collectionId),
  ]
);

// ==========================================
// RELATIONS
// ==========================================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  collections: many(collections),
  ratings: many(ratings),
  ratingSystems: many(ratingSystems),
  artworkOverrides: many(artworkOverrides),
  followsGiven: many(follows, { relationName: "follower" }),
  followsReceived: many(follows, { relationName: "following" }),
  likes: many(likes),
  comments: many(comments),
  feedActivities: many(feedActivities),
}));

export const mediaItemsRelations = relations(mediaItems, ({ many, one }) => ({
  parent: one(mediaItems, {
    fields: [mediaItems.parentMediaId],
    references: [mediaItems.id],
  }),
  collectionEntries: many(collectionEntries),
  ratings: many(ratings),
  artworkOverrides: many(artworkOverrides),
}));

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  user: one(user, {
    fields: [collections.userId],
    references: [user.id],
  }),
  defaultRatingSystem: one(ratingSystems, {
    fields: [collections.defaultRatingSystemId],
    references: [ratingSystems.id],
  }),
  entries: many(collectionEntries),
  ratings: many(ratings),
  likes: many(likes),
  comments: many(comments),
  feedActivities: many(feedActivities),
}));

export const collectionEntriesRelations = relations(
  collectionEntries,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionEntries.collectionId],
      references: [collections.id],
    }),
    mediaItem: one(mediaItems, {
      fields: [collectionEntries.mediaItemId],
      references: [mediaItems.id],
    }),
  })
);

export const ratingSystemsRelations = relations(
  ratingSystems,
  ({ one, many }) => ({
    user: one(user, {
      fields: [ratingSystems.userId],
      references: [user.id],
    }),
    categories: many(ratingCategories),
    ratings: many(ratings),
  })
);

export const ratingCategoriesRelations = relations(
  ratingCategories,
  ({ one, many }) => ({
    system: one(ratingSystems, {
      fields: [ratingCategories.ratingSystemId],
      references: [ratingSystems.id],
    }),
    scores: many(categoryScores),
  })
);

export const ratingsRelations = relations(ratings, ({ one, many }) => ({
  user: one(user, {
    fields: [ratings.userId],
    references: [user.id],
  }),
  mediaItem: one(mediaItems, {
    fields: [ratings.mediaItemId],
    references: [mediaItems.id],
  }),
  collection: one(collections, {
    fields: [ratings.collectionId],
    references: [collections.id],
  }),
  ratingSystem: one(ratingSystems, {
    fields: [ratings.ratingSystemId],
    references: [ratingSystems.id],
  }),
  categoryScores: many(categoryScores),
}));

export const categoryScoresRelations = relations(categoryScores, ({ one }) => ({
  rating: one(ratings, {
    fields: [categoryScores.ratingId],
    references: [ratings.id],
  }),
  category: one(ratingCategories, {
    fields: [categoryScores.categoryId],
    references: [ratingCategories.id],
  }),
}));

export const artworkOverridesRelations = relations(artworkOverrides, ({ one }) => ({
  user: one(user, {
    fields: [artworkOverrides.userId],
    references: [user.id],
  }),
  mediaItem: one(mediaItems, {
    fields: [artworkOverrides.mediaItemId],
    references: [mediaItems.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(user, {
    fields: [follows.followerId],
    references: [user.id],
    relationName: "follower",
  }),
  following: one(user, {
    fields: [follows.followingId],
    references: [user.id],
    relationName: "following",
  }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  user: one(user, {
    fields: [likes.userId],
    references: [user.id],
  }),
  collection: one(collections, {
    fields: [likes.collectionId],
    references: [collections.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  user: one(user, {
    fields: [comments.userId],
    references: [user.id],
  }),
  collection: one(collections, {
    fields: [comments.collectionId],
    references: [collections.id],
  }),
}));

export const feedActivitiesRelations = relations(feedActivities, ({ one }) => ({
  user: one(user, {
    fields: [feedActivities.userId],
    references: [user.id],
  }),
  collection: one(collections, {
    fields: [feedActivities.collectionId],
    references: [collections.id],
  }),
}));

export const bugReports = pgTable("bug_reports", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  description: text("description").notNull(),
  pageUrl: text("page_url").notNull(),
  userAgent: text("user_agent"),
  screenshotUrl: text("screenshot_url"),
  status: text("status").notNull().default("open"), // "open" | "investigating" | "resolved"
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const bugReportsRelations = relations(bugReports, ({ one }) => ({
  user: one(user, {
    fields: [bugReports.userId],
    references: [user.id],
  }),
}));


