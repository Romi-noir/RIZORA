"use strict";

const assert = require("assert");
const {
  buildCreatorSitemap,
  creatorPublicSlug,
  renderCreatorProfilePage
} = require("../rizora-seo");

assert.strictEqual(creatorPublicSlug({ publicUsername: "@romi.noir" }), "romi.noir");
assert.strictEqual(creatorPublicSlug({ publicUsername: "bad/name" }), "");

const sitemap = buildCreatorSitemap("https://rizora.com.ng/", [
  { username: "romi.noir", status: "active" },
  { publicUsername: "romi.noir", username: "other", status: "active" },
  { username: "hidden", status: "blocked" },
  { username: "bad/name", status: "active" },
  { username: "rizora", status: "active" }
]);
assert(sitemap.includes("https://rizora.com.ng/"));
assert(sitemap.includes("https://rizora.com.ng/creator/romi.noir"));
assert(sitemap.includes("https://rizora.com.ng/creator/rizora"));
assert(!sitemap.includes("creator/hidden"));
assert(!sitemap.includes("bad%2Fname"));
assert.strictEqual((sitemap.match(/creator\/romi\.noir/g) || []).length, 1);

const page = renderCreatorProfilePage({
  baseUrl: "https://rizora.com.ng",
  creator: {
    publicUsername: "romi.noir",
    displayName: "RoMi Noir",
    avatarUrl: "https://cdn.example/avatar.jpg",
    followers: 1234,
    verified: true
  },
  profile: { bio: '<script>alert("x")</script> Creator bio' }
});
assert(page.includes('<link rel="canonical" href="https://rizora.com.ng/creator/romi.noir">'));
assert(page.includes('name="robots" content="index,follow"'));
assert(page.includes('"@type":"Person"'));
assert(page.includes("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"));
assert(!page.includes('<script>alert("x")</script>'));
assert(page.includes("1,234</strong> followers"));
assert(page.includes("© 2026 RIZORA. All rights reserved. Owned by RoMi Noir."));

console.log("RIZORA public profile SEO checks: PASS");
