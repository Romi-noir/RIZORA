"use strict";

const crypto = require("crypto");

function ensureUpgrades(db) {
  db.rzV2 = db.rzV2 || {};
  db.rzV2.trials = db.rzV2.trials || [];
  db.rzV2.contentProofs = db.rzV2.contentProofs || [];
}

function readBody(req) {
  let raw = "";
  return (async function () {
    for await (const chunk of req) {
      raw += chunk.toString();
      if (raw.length > 1100000) throw new Error("Request body too large.");
    }
    return raw ? JSON.parse(raw) : {};
  })();
}

function clean(ctx, value, max) {
  return ctx.cleanString(value, max);
}

function findUser(db, key) {
  const q = String(key || "").trim().replace(/^@/, "").toLowerCase();
  return (db.users || []).find(function (u) {
    return String(u.username || "").toLowerCase() === q ||
      String(u.publicUsername || "").toLowerCase() === q;
  });
}

function profile(db, user) {
  const p = (db.creatorProfiles && db.creatorProfiles[user.id]) || {};
  return {
    id: user.id,
    username: user.username,
    publicUsername: user.publicUsername || user.username,
    displayName: user.displayName || user.username,
    avatarUrl: p.avatarUrl || user.avatarUrl || "/rizora-cover.png",
    bio: p.bio || user.bio || "",
    verified: user.verified === true || user.verificationStatus === "verified",
    official: user.official === true
  };
}

function blockedText(value) {
  const patterns = [
    /\bporn(?:ography)?\b/i, /\bxxx\b/i, /\bnudes?\b/i, /\bsex\s*tape\b/i,
    /\bsex(?:ual)?\s*(?:work|service|services)\b/i, /\berotic\b/i,
    /\bnsfw\b/i, /\bonlyfans\b/i, /\bpornhub\b/i, /\bxvideos?\b/i,
    /\bxnxx\b/i, /\bescort\b/i
  ];
  return patterns.some(function (p) {
    return p.test(String(value || "").normalize("NFKC"));
  });
}

function hashContent(title, text, mediaUrl) {
  const canonical = [
    String(title || "").trim(),
    String(text || "").trim(),
    String(mediaUrl || "").trim()
  ].join("\n---\n");
  return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
}

function trialView(db, trial) {
  return {
    id: trial.id,
    userId: trial.userId,
    title: trial.title,
    text: trial.text,
    mediaUrl: trial.mediaUrl,
    createdAt: trial.createdAt,
    endsAt: trial.endsAt,
    status: trial.status,
    views: Number(trial.views || 0),
    uniqueViewers: Array.isArray(trial.viewers) ? trial.viewers.length : 0
  };
}

async function handleRizoraUpgrades(ctx) {
  const db = ctx.db, req = ctx.req, res = ctx.res;
  const user = ctx.getCurrentUser(db, req);
  const url = new URL(req.url, "http://rizora.local");
  const path = url.pathname;
  const method = String(req.method || "GET").toUpperCase();

  ensureUpgrades(db);

  // ----------------------------------------------------------
  // Trial Content — test a post with non-followers before
  // deciding whether to publish it to the normal Flow.
  // ----------------------------------------------------------
  if (path === "/api/v2/trials" && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    if (user.status !== "active" || user.postingRestricted === true) {
      ctx.sendError(res, 403, "Your account cannot publish trial content right now.");
      return true;
    }

    let b = {};
    try { b = await readBody(req); } catch (e) {
      ctx.sendError(res, 400, e.message); return true;
    }

    const title = clean(ctx, b.title, 140);
    const text = clean(ctx, b.text || b.caption, 4000);
    const mediaUrl = clean(ctx, b.mediaUrl, 1200);

    if (!text && !mediaUrl) {
      ctx.sendError(res, 400, "Add text or media before starting a trial.");
      return true;
    }
    if (blockedText([title, text, mediaUrl].join(" "))) {
      ctx.sendError(res, 422, "That trial content is not allowed.");
      return true;
    }

    const durationHours = Math.min(72, Math.max(1, Number(b.durationHours || 24)));
    const now = Date.now();
    const trial = {
      id: ctx.uid("trial_"),
      userId: user.id,
      title,
      text,
      mediaUrl,
      audience: "non_followers",
      createdAt: new Date(now).toISOString(),
      endsAt: new Date(now + durationHours * 60 * 60 * 1000).toISOString(),
      status: "active",
      views: 0,
      viewers: []
    };

    db.rzV2.trials.push(trial);
    ctx.saveDB(db);
    ctx.sendJSON(res, 201, { success: true, trial: trialView(db, trial) });
    return true;
  }

  if (path === "/api/v2/trials/mine" && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const mine = db.rzV2.trials
      .filter(function (t) { return t.userId === user.id; })
      .slice()
      .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); })
      .map(function (t) {
        if (t.status === "active" && new Date(t.endsAt).getTime() <= Date.now()) {
          t.status = "expired";
        }
        return trialView(db, t);
      });
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, { success: true, trials: mine.slice(0, 100) });
    return true;
  }

  if (path === "/api/v2/trials/feed" && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }

    const followed = new Set((db.rzV2.follows || [])
      .filter(function (f) { return f.followerId === user.id; })
      .map(function (f) { return f.followingId; }));

    const blocked = new Set((db.rzV2.blocks || [])
      .filter(function (x) { return x.userId === user.id; })
      .map(function (x) { return x.targetUserId; }));

    const now = Date.now();
    const trials = db.rzV2.trials.filter(function (t) {
      if (t.status !== "active") return false;
      if (new Date(t.endsAt).getTime() <= now) return false;
      if (t.userId === user.id || followed.has(t.userId) || blocked.has(t.userId)) return false;
      return true;
    }).slice().sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    }).slice(0, 40);

    trials.forEach(function (t) {
      if (new Date(t.endsAt).getTime() <= now) t.status = "expired";
    });

    ctx.sendJSON(res, 200, {
      success: true,
      audience: "non_followers",
      trials: trials.map(function (t) {
        const author = db.users.find(function (u) { return u.id === t.userId; });
        return Object.assign({}, trialView(db, t), {
          author: author ? profile(db, author) : null
        });
      }).filter(function (x) { return !!x.author; })
    });
    return true;
  }

  const trialAction = path.match(/^\/api\/v2\/trials\/([^/]+)\/(view|promote|expire)$/);
  if (trialAction && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }

    const trial = db.rzV2.trials.find(function (t) {
      return t.id === trialAction[1];
    });
    if (!trial) { ctx.sendError(res, 404, "Trial not found."); return true; }

    const action = trialAction[2];

    if (action === "view") {
      if (trial.userId === user.id) {
        ctx.sendJSON(res, 200, { success: true, counted: false, trial: trialView(db, trial) });
        return true;
      }
      if (!Array.isArray(trial.viewers)) trial.viewers = [];
      if (!trial.viewers.includes(user.id)) {
        trial.viewers.push(user.id);
        if (trial.viewers.length > 5000) trial.viewers = trial.viewers.slice(-5000);
        trial.views = Number(trial.views || 0) + 1;
        ctx.saveDB(db);
      }
      ctx.sendJSON(res, 200, { success: true, counted: true, trial: trialView(db, trial) });
      return true;
    }

    if (trial.userId !== user.id) {
      ctx.sendError(res, 403, "Only the trial owner can manage it.");
      return true;
    }

    if (action === "expire") {
      trial.status = "expired";
      trial.updatedAt = new Date().toISOString();
      ctx.saveDB(db);
      ctx.sendJSON(res, 200, { success: true, trial: trialView(db, trial) });
      return true;
    }

    if (action === "promote") {
      if (trial.status !== "active") {
        ctx.sendError(res, 409, "Only an active trial can be promoted.");
        return true;
      }
      if (new Date(trial.endsAt).getTime() <= Date.now()) {
        trial.status = "expired";
        ctx.saveDB(db);
        ctx.sendError(res, 409, "This trial has expired.");
        return true;
      }
      if (blockedText([trial.title, trial.text, trial.mediaUrl].join(" "))) {
        ctx.sendError(res, 422, "That trial content is not allowed.");
        return true;
      }

      const post = {
        id: ctx.uid("post_"),
        userId: user.id,
        text: trial.text,
        mediaUrl: trial.mediaUrl,
        hashtags: [],
        mentions: [],
        trialSourceId: trial.id,
        createdAt: new Date().toISOString()
      };

      db.rzV2.posts = db.rzV2.posts || [];
      db.rzV2.posts.push(post);
      trial.status = "promoted";
      trial.promotedPostId = post.id;
      trial.promotedAt = new Date().toISOString();
      trial.updatedAt = new Date().toISOString();
      ctx.saveDB(db);

      ctx.sendJSON(res, 201, {
        success: true,
        message: "Trial promoted to your normal Flow.",
        postId: post.id,
        trial: trialView(db, trial)
      });
      return true;
    }
  }

  // ----------------------------------------------------------
  // Content Shield — durable SHA-256 proof-of-publication
  // without pretending to be a web-wide copyright scanner.
  // ----------------------------------------------------------
  if (path === "/api/v2/protection/register" && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }

    let b = {};
    try { b = await readBody(req); } catch (e) {
      ctx.sendError(res, 400, e.message); return true;
    }

    const title = clean(ctx, b.title, 140);
    const text = clean(ctx, b.text || b.caption, 4000);
    const mediaUrl = clean(ctx, b.mediaUrl, 1200);

    if (!title && !text && !mediaUrl) {
      ctx.sendError(res, 400, "Add a title, caption or media URL first.");
      return true;
    }

    const proofHash = hashContent(title, text, mediaUrl);
    const existing = db.rzV2.contentProofs.find(function (p) {
      return p.userId === user.id && p.proofHash === proofHash;
    });

    if (existing) {
      ctx.sendJSON(res, 200, { success: true, existing: true, proof: existing });
      return true;
    }

    const proof = {
      id: ctx.uid("proof_"),
      userId: user.id,
      title,
      mediaUrl,
      proofHash,
      algorithm: "SHA-256",
      createdAt: new Date().toISOString()
    };

    db.rzV2.contentProofs.push(proof);
    if (db.rzV2.contentProofs.length > 10000) {
      db.rzV2.contentProofs = db.rzV2.contentProofs.slice(-10000);
    }

    ctx.saveDB(db);
    ctx.sendJSON(res, 201, {
      success: true,
      proof: proof,
      note: "This proves that RIZORA recorded this exact content fingerprint at this time; it does not scan the wider web for copies."
    });
    return true;
  }

  if (path === "/api/v2/protection/mine" && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const proofs = db.rzV2.contentProofs
      .filter(function (p) { return p.userId === user.id; })
      .slice()
      .sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    ctx.sendJSON(res, 200, { success: true, proofs: proofs.slice(0, 200) });
    return true;
  }

  if (path === "/api/v2/protection/check" && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }

    let b = {};
    try { b = await readBody(req); } catch (e) {
      ctx.sendError(res, 400, e.message); return true;
    }

    const proofHash = clean(ctx, b.proofHash, 128) ||
      hashContent(clean(ctx, b.title, 140), clean(ctx, b.text || b.caption, 4000), clean(ctx, b.mediaUrl, 1200));

    const matches = db.rzV2.contentProofs
      .filter(function (p) { return p.proofHash === proofHash; })
      .slice(0, 20)
      .map(function (p) {
        const owner = db.users.find(function (u) { return u.id === p.userId; });
        return {
          proof: p,
          owner: owner ? profile(db, owner) : null
        };
      });

    ctx.sendJSON(res, 200, {
      success: true,
      protected: matches.length > 0,
      matches: matches
    });
    return true;
  }

  return false;
}

module.exports = { handleRizoraUpgrades };
