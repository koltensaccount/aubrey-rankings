import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { db } from "../db";
import { mediaItems, reviews, user } from "../db/schema";
import { MarkdownRenderer } from "../components/reviews/markdown-renderer";
import { getPublicReviews } from "../lib/public-reviews";

describe("Phase 12: Markdown review compatibility", () => {
  const suffix = Date.now().toString();
  const userId = `phase12_user_${suffix}`;
  const mediaId = `phase12_media_${suffix}`;

  before(async () => {
    await db.insert(user).values({ id: userId, email: `phase12-${suffix}@example.com`, name: "Markdown Author", username: `markdown_${suffix.slice(-6)}` });
    await db.insert(mediaItems).values({ id: mediaId, mediaType: "movie", title: "Safe Markdown" });
  });

  after(async () => {
    await db.delete(reviews).where(eq(reviews.userId, userId));
    await db.delete(mediaItems).where(eq(mediaItems.id, mediaId));
    await db.delete(user).where(eq(user.id, userId));
  });

  it("keeps legacy content plain while new reviews track Markdown independently", async () => {
    const legacyId = randomUUID();
    const markdownId = randomUUID();
    await db.insert(reviews).values([
      { id: legacyId, userId, mediaItemId: mediaId, content: "Asterisks *stay literal*.", status: "published", visibility: "public", contentFormat: "plain" },
      { id: markdownId, userId, mediaItemId: mediaId, content: "**Rendered emphasis**", draftContent: "# Separate draft", contentFormat: "markdown", draftContentFormat: "markdown", status: "published", visibility: "public" },
    ]);
    const legacy = await db.query.reviews.findFirst({ where: eq(reviews.id, legacyId) });
    const markdown = await db.query.reviews.findFirst({ where: eq(reviews.id, markdownId) });
    assert.equal(legacy?.contentFormat, "plain");
    assert.equal(markdown?.contentFormat, "markdown");
    assert.equal(markdown?.draftContent, "# Separate draft");
    assert.equal(markdown?.draftContentFormat, "markdown");
    const publicReviews = await getPublicReviews(userId);
    assert.equal(publicReviews.find((review) => review.id === legacyId)?.contentFormat, "plain");
    assert.equal(publicReviews.find((review) => review.id === markdownId)?.contentFormat, "markdown");
  });

  it("keeps private Markdown drafts out of public review surfaces", async () => {
    const privateId = randomUUID();
    await db.insert(reviews).values({
      id: privateId, userId, mediaItemId: mediaId, content: "# Private draft", draftContent: "**Never public**",
      contentFormat: "markdown", draftContentFormat: "markdown", status: "draft", visibility: "private",
    });
    const publicReviews = await getPublicReviews(userId);
    assert.equal(publicReviews.some((review) => review.id === privateId), false);
  });

  it("renders only safe Markdown and never enables raw HTML, images, or javascript links", () => {
    const html = renderToStaticMarkup(
      <MarkdownRenderer format="markdown" content={'## Heading\n\n[unsafe](javascript:alert(1))\n\n<img src=x onerror=alert(1)>\n\n![external](https://example.com/image.jpg)'} />
    );
    assert.match(html, /<h2>Heading<\/h2>/);
    assert.doesNotMatch(html, /href="javascript:/i);
    assert.doesNotMatch(html, /<img/i);
    assert.match(html, /&lt;img/);
  });
});
