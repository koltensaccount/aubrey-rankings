CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artwork_overrides" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"media_item_id" text NOT NULL,
	"custom_artwork_url" text NOT NULL,
	"original_artwork_url" text,
	"crop_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"rating_id" text NOT NULL,
	"category_id" text NOT NULL,
	"score" real NOT NULL,
	"weight_applied" real DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"collection_id" text NOT NULL,
	"media_item_id" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"collection_type" text NOT NULL,
	"tmdb_id" integer,
	"is_public" boolean DEFAULT false NOT NULL,
	"share_slug" text,
	"default_rating_system_id" text,
	"custom_cover_image" text,
	"backdrop_image" text,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collections_share_slug_unique" UNIQUE("share_slug")
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" text PRIMARY KEY NOT NULL,
	"tmdb_id" integer,
	"media_type" text NOT NULL,
	"title" text NOT NULL,
	"overview" text,
	"poster_path" text,
	"backdrop_path" text,
	"still_path" text,
	"release_date" text,
	"season_number" integer,
	"episode_number" integer,
	"parent_media_id" text,
	"tmdb_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"rating_system_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"weight" real DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rating_systems" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"scale" integer DEFAULT 10 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_system_template" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"media_item_id" text NOT NULL,
	"collection_id" text,
	"rating_system_id" text,
	"calculated_overall_score" real,
	"watch_date" timestamp,
	"review_text" text,
	"personal_notes" text,
	"is_watched" boolean DEFAULT false NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_overrides" ADD CONSTRAINT "artwork_overrides_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artwork_overrides" ADD CONSTRAINT "artwork_overrides_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_scores" ADD CONSTRAINT "category_scores_rating_id_ratings_id_fk" FOREIGN KEY ("rating_id") REFERENCES "public"."ratings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_scores" ADD CONSTRAINT "category_scores_category_id_rating_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."rating_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_entries" ADD CONSTRAINT "collection_entries_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_entries" ADD CONSTRAINT "collection_entries_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_default_rating_system_id_rating_systems_id_fk" FOREIGN KEY ("default_rating_system_id") REFERENCES "public"."rating_systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_parent_media_id_media_items_id_fk" FOREIGN KEY ("parent_media_id") REFERENCES "public"."media_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_categories" ADD CONSTRAINT "rating_categories_rating_system_id_rating_systems_id_fk" FOREIGN KEY ("rating_system_id") REFERENCES "public"."rating_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rating_systems" ADD CONSTRAINT "rating_systems_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rating_system_id_rating_systems_id_fk" FOREIGN KEY ("rating_system_id") REFERENCES "public"."rating_systems"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_user_artwork" ON "artwork_overrides" USING btree ("user_id","media_item_id");--> statement-breakpoint
CREATE INDEX "idx_artwork_media" ON "artwork_overrides" USING btree ("media_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_rating_category" ON "category_scores" USING btree ("rating_id","category_id");--> statement-breakpoint
CREATE INDEX "idx_category_scores_rating" ON "category_scores" USING btree ("rating_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_collection_media" ON "collection_entries" USING btree ("collection_id","media_item_id");--> statement-breakpoint
CREATE INDEX "idx_entries_collection" ON "collection_entries" USING btree ("collection_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_entries_media" ON "collection_entries" USING btree ("media_item_id");--> statement-breakpoint
CREATE INDEX "idx_collections_user" ON "collections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_collections_public" ON "collections" USING btree ("is_public","share_slug");--> statement-breakpoint
CREATE INDEX "idx_media_tmdb" ON "media_items" USING btree ("tmdb_id","media_type");--> statement-breakpoint
CREATE INDEX "idx_media_parent" ON "media_items" USING btree ("parent_media_id");--> statement-breakpoint
CREATE INDEX "idx_media_type" ON "media_items" USING btree ("media_type");--> statement-breakpoint
CREATE INDEX "idx_categories_system" ON "rating_categories" USING btree ("rating_system_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_rating_systems_user" ON "rating_systems" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_user_default_rating_system" ON "rating_systems" USING btree ("user_id") WHERE "is_default" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_user_media_collection" ON "ratings" USING btree ("user_id","media_item_id","collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_user_media_global" ON "ratings" USING btree ("user_id","media_item_id") WHERE "collection_id" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_ratings_user" ON "ratings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_ratings_collection" ON "ratings" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "idx_ratings_media" ON "ratings" USING btree ("media_item_id");