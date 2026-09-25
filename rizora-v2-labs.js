"use strict";

function ensureLabs(db) {
  db.rzV2 = db.rzV2 || {};
  db.rzV2.customFeeds = db.rzV2.customFeeds || [];
  db.rzV2.experiments = db.rzV2.experiments || [];
  db.rzV2.deals = db.rzV2.deals || [];
  db.rzV2.dealApplications = db.rzV2.dealApplications || [];
}

async function body(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk.toString();
    if (raw.length > 1100000) throw new Error("Request body too large.");
  }
  return raw ? JSON.parse(raw) : {};
}

function clean(ctx, value, max) {
  return ctx.cleanString(value == null ? "" : value, max);
}

function publicUser(db, user) {
  const p = (db.creatorProfiles && db.creatorProfiles[user.id]) || {};
  return {
    id: user.id,
    username: user.username,
    publicUsername: user.publicUsername || user.username,
    displayName: user.displayName || user.username,
    avatarUrl: p.avatarUrl || user.avatarUrl || "/rizora-cover.png",
    bio: p.bio || user.bio || "",
    category: p.category || user.category || "",
    verified: user.verified === true || user.verificationStatus === "verified",
    official: user.official === true
  };
}

function blocked(value) {
  const patterns = [
    /\bporn(?:ography)?\b/i, /\bxxx\b/i, /\bnudes?\b/i, /\bsex\s*tape\b/i,
    /\bsex(?:ual)?\s*(?:work|service|services)\b/i, /\berotic\b/i,
    /\bnsfw\b/i, /\bonlyfans\b/i, /\bpornhub\b/i, /\bxvideos?\b/i,
    /\bxnxx\b/i, /\bes*cort\b/i
  ];
  return patterns.some((p) => p.test(String(value || "").normalize("NFKC")));
}

function own(db, userId, row) {
  return row && row.userId === userId;
}

function followsCreator(db, viewerId, creatorId) {
  return (db.rzV2.follows || []).some(
    (f) => f.followerId === viewerId && f.followingId === creatorId
  );
}

function engagement(db, post) {
  return (
    (db.rzV2.likes || []).filter((x) => x.postId === post.id).length +
    (db.rzV2.comments || []).filter((x) => x.postId === post.id).length * 2 +
    (db.rzV2.saves || []).filter((x) => x.postId === post.id).length * 2 +
    (db.rzV2.reposts || []).filter((x) => x.postId === post.id).length * 3
  );
}

function postView(db, post, viewerId) {
  const author = (db.users || []).find((u) => u.id === post.userId);
  if (!author) return null;
  return {
    id: post.id,
    text: post.text || "",
    mediaUrl: post.mediaUrl || "",
    hashtags: post.hashtags || [],
    createdAt: post.createdAt,
    engagement: engagement(db, post),
    author: publicUser(db, author),
    liked: (db.rzV2.likes || []).some((x) => x.postId === post.id && x.userId === viewerId),
    following: followsCreator(db, viewerId, author.id)
  };
}

function metricSnapshot(db, postId) {
  const post = (db.rzV2.posts || []).find((x) => x.id === postId);
  if (!post) return null;
  return {
    postId,
    likes: (db.rzV2.likes || []).filter((x) => x.postId === postId).length,
    comments: (db.rzV2.comments || []).filter((x) => x.postId === postId).length,
    saves: (db.rzV2.saves || []).filter((x) => x.postId === postId).length,
    reposts: (db.rzV2.reposts || []).filter((x) => x.postId === postId).length,
    engagement: engagement(db, post)
  };
}

function feedRows(db, user, feed) {
  let rows = (db.rzV2.posts || []).slice();
  const tags = Array.isArray(feed.hashtags) ? feed.hashtags.map((x) => String(x).replace(/^#/, "").toLowerCase()).filter(Boolean).slice(0, 20) : [];
  const creatorKeys = Array.isArray(feed.creators) ? feed.creators.map((x) => String(x).replace(/^@/, "").toLowerCase()).filter(Boolean).slice(0, 20) : [];
  const q = String(feed.query || "").trim().toLowerCase();

  rows = rows.filter((post) => {
    if (q && !String(post.text || "").toLowerCase().includes(q)) return false;
    if (tags.length && !tags.some((tag) => (post.hashtags || []).includes(tag))) return false;
    const author = (db.users || []).find((u) => u.id === post.userId);
    if (!author) return false;
    if (creatorKeys.length) {
      const keys = [author.username, author.publicUsername].filter(Boolean).map((x) => String(x).toLowerCase());
      if (!creatorKeys.some((key) => keys.includes(key))) return false;
    }
    if (feed.followingOnly && !followsCreator(db, user.id, author.id) && author.id !== user.id) return false;
    if (feed.verifiedOnly && !(author.verified === true || author.verificationStatus === "verified")) return false;
    return true;
  });

  if (feed.sort === "engagement") rows.sort((a, b) => engagement(db, b) - engagement(db, a));
  else rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return rows.slice(0, 60).map((post) => postView(db, post, user.id)).filter(Boolean);
}

async function handleRizoraLabs(ctx) {
  const db = ctx.db;
  const req = ctx.req;
  const res = ctx.res;
  const user = ctx.getCurrentUser(db, req);
  const url = new URL(req.url, "http://rizora.local");
  const path = url.pathname;
  const method = String(req.method || "GET").toUpperCase();

  ensureLabs(db);

  if (path === "/api/v2/custom-feeds" && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const rows = db.rzV2.customFeeds
      .filter((x) => x.userId === user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50)
      .map((x) => Object.assign({}, x, { resultCount: feedRows(db, user, x).length }));
    ctx.sendJSON(res, 200, { success: true, feeds: rows });
    return true;
  }

  if (path === "/api/v2/custom-feeds" && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    let b = {};
    try { b = await body(req); } catch (e) { ctx.sendError(res, 400, e.message); return true; }
    const title = clean(ctx, b.title, 80);
    if (!title) { ctx.sendError(res, 400, "Feed name is required."); return true; }
    const query = clean(ctx, b.query, 160);
    const hashtags = Array.isArray(b.hashtags) ? b.hashtags.map((x) => clean(ctx, String(x).replace(/^#/, ""), 40).toLowerCase()).filter(Boolean).slice(0, 20) : [];
    const creators = Array.isArray(b.creators) ? b.creators.map((x) => clean(ctx, String(x).replace(/^@/, ""), 40).toLowerCase()).filter(Boolean).slice(0, 20) : [];
    const feed = {
      id: ctx.uid("feed_"),
      userId: user.id,
      title,
      query,
      hashtags,
      creators,
      followingOnly: b.followingOnly === true,
      verifiedOnly: b.verifiedOnly === true,
      sort: b.sort === "engagement" ? "engagement" : "recent",
      createdAt: new Date().toISOString()
    };
    db.rzV2.customFeeds.push(feed);
    db.rzV2.customFeeds = db.rzV2.customFeeds.slice(-500);
    ctx.saveDB(db);
    ctx.sendJSON(res, 201, { success: true, feed: feed, posts: feedRows(db, user, feed) });
    return true;
  }

  const feedMatch = path.match(/^\/api\/v2\/custom-feeds\/([^/]+)$/);
  if (feedMatch && method === "DELETE") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const row = db.rzV2.customFeeds.find((x) => x.id === feedMatch[1] && x.userId === user.id);
    if (!row) { ctx.sendError(res, 404, "Custom feed not found."); return true; }
    db.rzV2.customFeeds = db.rzV2.customFeeds.filter((x) => x.id !== row.id);
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, { success: true });
    return true;
  }

  const feedPostsMatch = path.match(/^\/api\/v2\/custom-feeds\/([^/]+)\/posts$/);
  if (feedPostsMatch && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const row = db.rzV2.customFeeds.find((x) => x.id === feedPostsMatch[1] && x.userId === user.id);
    if (!row) { ctx.sendError(res, 404, "Custom feed not found."); return true; }
    ctx.sendJSON(res, 200, { success: true, feed: row, posts: feedRows(db, user, row) });
    return true;
  }

  if (path === "/api/v2/experiments" && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const experiments = db.rzV2.experiments
      .filter((x) => x.userId === user.id)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50)
      .map((experiment) => Object.assign({}, experiment, {
        variants: experiment.variants.map((variant) => Object.assign({}, variant, {
          metrics: variant.postId ? metricSnapshot(db, variant.postId) : null
        }))
      }));
    ctx.sendJSON(res, 200, { success: true, experiments });
    return true;
  }

  if (path === "/api/v2/experiments" && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    let b = {};
    try { b = await body(req); } catch (e) { ctx.sendError(res, 400, e.message); return true; }
    const title = clean(ctx, b.title, 100);
    if (!title) { ctx.sendError(res, 400, "Experiment name is required."); return true; }
    if (blocked(b.hypothesis) || blocked(b.variantA) || blocked(b.variantB)) {
      ctx.sendError(res, 422, "Adult or sexually explicit content is not allowed on RIZORA.");
      return true;
    }
    const experiment = {
      id: ctx.uid("exp_"),
      userId: user.id,
      title,
      hypothesis: clean(ctx, b.hypothesis, 500),
      metric: ["likes", "comments", "saves", "reposts", "engagement"].includes(b.metric) ? b.metric : "engagement",
      status: "draft",
      variants: [
        { id: ctx.uid("var_"), label: "A", caption: clean(ctx, b.variantA, 2400), mediaUrl: clean(ctx, b.mediaA, 1200), postId: null },
        { id: ctx.uid("var_"), label: "B", caption: clean(ctx, b.variantB, 2400), mediaUrl: clean(ctx, b.mediaB, 1200), postId: null }
      ],
      createdAt: new Date().toISOString()
    };
    db.rzV2.experiments.push(experiment);
    db.rzV2.experiments = db.rzV2.experiments.slice(-300);
    ctx.saveDB(db);
    ctx.sendJSON(res, 201, { success: true, experiment });
    return true;
  }

  const expVariant = path.match(/^\/api\/v2\/experiments\/([^/]+)\/variants\/([^/]+)\/attach$/);
  if (expVariant && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const experiment = db.rzV2.experiments.find((x) => x.id === expVariant[1] && x.userId === user.id);
    if (!experiment) { ctx.sendError(res, 404, "Experiment not found."); return true; }
    const variant = experiment.variants.find((x) => x.id === expVariant[2]);
    if (!variant) { ctx.sendError(res, 404, "Variant not found."); return true; }
    let b = {};
    try { b = await body(req); } catch (e) { ctx.sendError(res, 400, e.message); return true; }
    const post = db.rzV2.posts.find((x) => x.id === clean(ctx, b.postId, 120) && x.userId === user.id);
    if (!post) { ctx.sendError(res, 404, "Your post was not found."); return true; }
    variant.postId = post.id;
    experiment.status = "testing";
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, { success: true, experiment });
    return true;
  }

  if (path.startsWith("/api/v2/experiments/") && method === "POST" && path.endsWith("/close")) {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const id = path.split("/")[4];
    const experiment = db.rzV2.experiments.find((x) => x.id === id && x.userId === user.id);
    if (!experiment) { ctx.sendError(res, 404, "Experiment not found."); return true; }
    experiment.status = "closed";
    experiment.closedAt = new Date().toISOString();
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, { success: true, experiment });
    return true;
  }

  if (path === "/api/v2/deals" && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const rows = db.rzV2.deals
      .filter((x) => x.status === "open" && new Date(x.deadlineAt).getTime() > Date.now())
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(0, 60)
      .map((deal) => {
        const owner = db.users.find((u) => u.id === deal.creatorId);
        return Object.assign({}, deal, { creator: owner ? publicUser(db, owner) : null });
      });
    ctx.sendJSON(res, 200, { success: true, deals: rows });
    return true;
  }

  if (path === "/api/v2/deals" && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    let b = {};
    try { b = await body(req); } catch (e) { ctx.sendError(res, 400, e.message); return true; }
    if (blocked(b.title) || blocked(b.description) || blocked(b.deliverables)) {
      ctx.sendError(res, 422, "This brief contains prohibited adult content.");
      return true;
    }
    const title = clean(ctx, b.title, 100);
    const description = clean(ctx, b.description, 1400);
    const deliverables = clean(ctx, b.deliverables, 1000);
    const category = clean(ctx, b.category, 80) || "Creator collaboration";
    const budgetNaira = Math.max(0, Math.min(50000000, Number(b.budgetNaira || 0)));
    const deadlineAt = new Date(b.deadlineAt || "").toISOString();
    if (!title || !description || !deliverables || Number.isNaN(new Date(b.deadlineAt || "").getTime())) {
      ctx.sendError(res, 400, "Title, description, deliverables and a valid deadline are required.");
      return true;
    }
    const deal = {
      id: ctx.uid("deal_"),
      creatorId: user.id,
      title,
      description,
      category,
      deliverables,
      budgetNaira,
      deadlineAt,
      status: "open",
      createdAt: new Date().toISOString()
    };
    db.rzV2.deals.push(deal);
    ctx.saveDB(db);
    ctx.sendJSON(res, 201, { success: true, deal });
    return true;
  }

  if (path === "/api/v2/deals/mine" && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const mine = db.rzV2.deals.filter((x) => x.creatorId === user.id).slice(-100).reverse();
    const apps = db.rzV2.dealApplications.filter((x) => mine.some((d) => d.id === x.dealId));
    ctx.sendJSON(res, 200, { success: true, deals: mine, applications: apps });
    return true;
  }

  const dealApply = path.match(/^\/api\/v2\/deals\/([^/]+)\/apply$/);
  if (dealApply && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const deal = db.rzV2.deals.find((x) => x.id === dealApply[1] && x.status === "open");
    if (!deal) { ctx.sendError(res, 404, "Deal brief not found."); return true; }
    if (deal.creatorId === user.id) { ctx.sendError(res, 400, "You cannot apply to your own brief."); return true; }
    if (db.rzV2.dealApplications.some((x) => x.dealId === deal.id && x.userId === user.id)) {
      ctx.sendError(res, 409, "You already applied to this brief."); return true;
    }
    let b = {};
    try { b = await body(req); } catch (e) { ctx.sendError(res, 400, e.message); return true; }
    const pitch = clean(ctx, b.pitch, 1400);
    const portfolioUrl = clean(ctx, b.portfolioUrl, 1200);
    if (!pitch) { ctx.sendError(res, 400, "Add a short pitch."); return true; }
    if (blocked(pitch) || blocked(portfolioUrl)) {
      ctx.sendError(res, 422, "This application contains prohibited adult content.");
      return true;
    }
    const application = {
      id: ctx.uid("dealapp_"),
      dealId: deal.id,
      userId: user.id,
      pitch,
      portfolioUrl,
      status: "pending",
      createdAt: new Date().toISOString()
    };
    db.rzV2.dealApplications.push(application);
    ctx.saveDB(db);
    ctx.sendJSON(res, 201, { success: true, application });
    return true;
  }

  return false;
}

module.exports = { handleRizoraLabs };
