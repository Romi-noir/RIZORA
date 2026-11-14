"use strict";

function creatorPublicSlug(user) {
  const preferred = String(user && user.publicUsername || "").trim().replace(/^@/, "");
  const fallback = String(user && user.username || "").trim().replace(/^@/, "");
  const handle = (/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(preferred) ? preferred : fallback)
    .trim()
    .replace(/^@/, "");
  return /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(handle) ? handle : "";
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function escapeXml(value) {
  return escapeHtml(value);
}

function normalizeBaseUrl(value) {
  const fallback = "https://rizora.com.ng";
  try {
    const parsed = new URL(String(value || fallback));
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return fallback;
    return parsed.origin;
  } catch (_) {
    return fallback;
  }
}

function buildCreatorSitemap(baseUrl, users) {
  const base = normalizeBaseUrl(baseUrl);
  const seen = new Set();
  const urls = [`${base}/`];

  for (const user of Array.isArray(users) ? users : []) {
    if (!user || (user.status && String(user.status).toLowerCase() !== "active")) continue;
    const slug = creatorPublicSlug(user);
    if (!slug || seen.has(slug.toLowerCase())) continue;
    seen.add(slug.toLowerCase());
    urls.push(`${base}/creator/${encodeURIComponent(slug)}`);
  }

  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    urls.map(url => `<url><loc>${escapeXml(url)}</loc></url>`).join("") +
    "</urlset>";
}

function safeAvatarUrl(value, baseUrl) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, baseUrl);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    if (raw.startsWith("//")) return "";
    return parsed.href;
  } catch (_) {
    return "";
  }
}

function renderCreatorProfilePage(options) {
  const input = options || {};
  const base = normalizeBaseUrl(input.baseUrl);
  const creator = input.creator || {};
  const profile = input.profile || {};
  const handle = creatorPublicSlug(creator);
  if (!handle) throw new Error("A valid public creator handle is required.");

  const displayName = String(creator.displayName || handle).trim().slice(0, 120) || handle;
  const bio = String(profile.bio || "").trim().slice(0, 500);
  const description = bio || `${displayName} is a creator on RIZORA.`;
  const canonical = `${base}/creator/${encodeURIComponent(handle)}`;
  const avatar = safeAvatarUrl(creator.avatarUrl || profile.avatarUrl, base);
  const followers = Math.max(0, Number(creator.followers) || 0);
  const verified = creator.verified === true || creator.verificationStatus === "verified";
  const person = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: displayName,
    alternateName: `@${handle}`,
    url: canonical,
    description
  };
  if (avatar) person.image = avatar;

  const htmlJson = JSON.stringify(person).replace(/</g, "\\u003c");
  const avatarMarkup = avatar
    ? `<img class="avatar" src="${escapeHtml(avatar)}" alt="${escapeHtml(displayName)}" width="112" height="112">`
    : `<div class="avatar avatar-placeholder" aria-hidden="true">${escapeHtml(displayName.slice(0, 1).toUpperCase())}</div>`;
  const verifiedMarkup = verified ? '<span class="verified" aria-label="Verified creator">Verified</span>' : "";
  const bioMarkup = bio ? `<p class="bio">${escapeHtml(bio)}</p>` : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(displayName)} (@${escapeHtml(handle)}) | RIZORA</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="profile">
<meta property="og:site_name" content="RIZORA">
<meta property="og:title" content="${escapeHtml(displayName)} (@${escapeHtml(handle)}) | RIZORA">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
${avatar ? `<meta property="og:image" content="${escapeHtml(avatar)}">` : ""}
<meta name="twitter:card" content="${avatar ? "summary_large_image" : "summary"}">
<script type="application/ld+json">${htmlJson}</script>
<style>
:root{color-scheme:dark;--ink:#101010;--surface:#181818;--text:#f5f3ef;--muted:#aaa69e;--gold:#c3a66b;--line:#33312d}
*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--text);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
header,main,footer{width:min(100% - 36px,760px);margin-inline:auto}header{padding:26px 0;border-bottom:1px solid var(--line)}
.brand{color:var(--text);font-size:14px;font-weight:750;letter-spacing:.22em;text-decoration:none}main{padding:64px 0 72px}
.card{padding:36px;border:1px solid var(--line);border-radius:20px;background:var(--surface)}.avatar{display:block;width:112px;height:112px;border-radius:50%;object-fit:cover;border:1px solid var(--line)}
.avatar-placeholder{display:grid;place-items:center;background:#27251f;color:var(--gold);font-size:36px;font-weight:700}.identity{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:26px}
h1{margin:0;font-size:clamp(28px,5vw,42px);line-height:1.15}.handle{margin:6px 0 0;color:var(--muted)}.verified{padding:4px 9px;border:1px solid var(--gold);border-radius:999px;color:var(--gold);font-size:12px;font-weight:650}
.bio{margin:24px 0 0;white-space:pre-wrap;color:#dedbd5}.stats{margin-top:30px;padding-top:22px;border-top:1px solid var(--line);color:var(--muted)}.stats strong{color:var(--text)}
footer{padding:22px 0 30px;border-top:1px solid var(--line);color:var(--muted);font-size:13px}footer a{color:var(--gold)}
@media(max-width:560px){main{padding:36px 0}.card{padding:25px}}
</style>
</head>
<body>
<header><a class="brand" href="${escapeHtml(base)}/">RIZORA</a></header>
<main><article class="card" itemscope itemtype="https://schema.org/Person">
${avatarMarkup}<div class="identity"><h1 itemprop="name">${escapeHtml(displayName)}</h1>${verifiedMarkup}</div>
<p class="handle" itemprop="alternateName">@${escapeHtml(handle)}</p>${bioMarkup}
<div class="stats"><strong>${followers.toLocaleString("en-US")}</strong> followers</div>
</article></main>
<footer><strong>New features are coming</strong>© 2026 RIZORA. All rights reserved. Owned by RoMi Noir.</footer>
</body>
</html>`;
}

module.exports = {
  buildCreatorSitemap,
  creatorPublicSlug,
  renderCreatorProfilePage
};
