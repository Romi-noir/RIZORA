"use strict";

function ensureSeries(db) {
  db.rzV2 = db.rzV2 || {};
  db.rzV2.series = db.rzV2.series || [];
}

function readBody(req) {
  return new Promise(function(resolve, reject) {
    let raw = "";
    req.on("data", function(chunk) {
      raw += chunk.toString();
      if (raw.length > 700000) reject(new Error("Request body too large."));
    });
    req.on("end", function() {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (_) { reject(new Error("Invalid JSON.")); }
    });
    req.on("error", reject);
  });
}

function clean(ctx, value, max) {
  return ctx.cleanString(value == null ? "" : value, max);
}

function publicUser(db, id) {
  const u = (db.users || []).find(function(x) { return x.id === id; });
  if (!u) return null;
  const p = (db.creatorProfiles && db.creatorProfiles[u.id]) || {};
  return {
    id: u.id,
    username: u.username,
    publicUsername: u.publicUsername || u.username,
    displayName: u.displayName || u.username,
    avatarUrl: p.avatarUrl || u.avatarUrl || "/rizora-cover.png",
    verified: u.verified === true || u.verificationStatus === "verified"
  };
}

function seriesView(db, series) {
  const owner = publicUser(db, series.creatorId);
  const posts = (db.rzV2.posts || []).filter(function(p) { return p.seriesId === series.id; })
    .slice()
    .sort(function(a, b) {
      return Number(a.seriesEpisodeNumber || 0) - Number(b.seriesEpisodeNumber || 0) ||
        new Date(a.createdAt) - new Date(b.createdAt);
    })
    .map(function(p) {
      return {
        id: p.id,
        title: p.seriesEpisodeTitle || "",
        episodeNumber: Number(p.seriesEpisodeNumber || 0),
        text: p.text || "",
        mediaUrl: p.mediaUrl || "",
        createdAt: p.createdAt
      };
    });
  return {
    id: series.id,
    title: series.title,
    description: series.description,
    coverUrl: series.coverUrl,
    creator: owner,
    createdAt: series.createdAt,
    episodeCount: posts.length,
    episodes: posts
  };
}

async function handleRizoraSeries(ctx) {
  const db = ctx.db, req = ctx.req, res = ctx.res;
  const user = ctx.getCurrentUser(db, req);
  const url = new URL(req.url, "http://rizora.local");
  const path = url.pathname;
  const method = String(req.method || "GET").toUpperCase();

  ensureSeries(db);

  if (path === "/api/v2/series" && method === "GET") {
    const key = clean(ctx, url.searchParams.get("creator"), 120);
    let rows = db.rzV2.series.slice();
    if (key) {
      const q = key.replace(/^@/, "").toLowerCase();
      const owner = (db.users || []).find(function(u) {
        return String(u.id || "").toLowerCase() === q ||
          String(u.username || "").toLowerCase() === q ||
          String(u.publicUsername || "").toLowerCase() === q;
      });
      rows = owner ? rows.filter(function(s) { return s.creatorId === owner.id; }) : [];
    } else if (user) {
      rows = rows.filter(function(s) { return s.creatorId === user.id; });
    } else {
      rows = [];
    }
    rows = rows.slice().sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    ctx.sendJSON(res, 200, {success:true, series:rows.slice(0,100).map(function(s){return seriesView(db,s);})});
    return true;
  }

  if (path === "/api/v2/series" && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    if (user.status !== "active" || user.postingRestricted === true) {
      ctx.sendError(res, 403, "Your account cannot create a series right now."); return true;
    }
    let b;
    try { b = await readBody(req); } catch (e) { ctx.sendError(res, 400, e.message); return true; }
    const title = clean(ctx, b.title, 100);
    const description = clean(ctx, b.description, 600);
    const coverUrl = clean(ctx, b.coverUrl, 1200);
    if (!title) { ctx.sendError(res, 400, "Series title is required."); return true; }
    if ((db.rzV2.series || []).filter(function(s) { return s.creatorId === user.id; }).length >= 25) {
      ctx.sendError(res, 400, "You can create up to 25 series.");
      return true;
    }
    const series = {
      id: ctx.uid("series_"),
      creatorId: user.id,
      title,
      description,
      coverUrl,
      createdAt: new Date().toISOString()
    };
    db.rzV2.series.push(series);
    if (db.rzV2.series.length > 5000) db.rzV2.series = db.rzV2.series.slice(-5000);
    ctx.saveDB(db);
    ctx.sendJSON(res, 201, {success:true, series:seriesView(db, series)});
    return true;
  }

  const seriesMatch = path.match(/^\/api\/v2\/series\/([^/]+)$/);
  if (seriesMatch && method === "GET") {
    const series = db.rzV2.series.find(function(s) { return s.id === seriesMatch[1]; });
    if (!series) { ctx.sendError(res, 404, "Series not found."); return true; }
    ctx.sendJSON(res, 200, {success:true, series:seriesView(db, series)});
    return true;
  }

  const episodeMatch = path.match(/^\/api\/v2\/series\/([^/]+)\/episodes$/);
  if (episodeMatch && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    let b;
    try { b = await readBody(req); } catch (e) { ctx.sendError(res, 400, e.message); return true; }
    const series = db.rzV2.series.find(function(s) { return s.id === episodeMatch[1]; });
    if (!series) { ctx.sendError(res, 404, "Series not found."); return true; }
    if (series.creatorId !== user.id) { ctx.sendError(res, 403, "Only the series owner can manage episodes."); return true; }
    const postId = clean(ctx, b.postId, 120);
    const post = (db.rzV2.posts || []).find(function(p) { return p.id === postId && p.userId === user.id; });
    if (!post) { ctx.sendError(res, 404, "Your post was not found."); return true; }
    const episodeTitle = clean(ctx, b.episodeTitle, 140);
    const episodeNumber = Math.max(1, Math.min(9999, Number(b.episodeNumber || 1)));
    const clash = (db.rzV2.posts || []).find(function(p) {
      return p.seriesId === series.id && p.id !== post.id && Number(p.seriesEpisodeNumber || 0) === episodeNumber;
    });
    if (clash) { ctx.sendError(res, 409, "That episode number is already used in this series."); return true; }
    post.seriesId = series.id;
    post.seriesEpisodeTitle = episodeTitle;
    post.seriesEpisodeNumber = episodeNumber;
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, {success:true, series:seriesView(db, series)});
    return true;
  }

  const removeMatch = path.match(/^\/api\/v2\/series\/([^/]+)\/episodes\/([^/]+)$/);
  if (removeMatch && method === "DELETE") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const series = db.rzV2.series.find(function(s) { return s.id === removeMatch[1]; });
    if (!series) { ctx.sendError(res, 404, "Series not found."); return true; }
    if (series.creatorId !== user.id) { ctx.sendError(res, 403, "Only the series owner can manage episodes."); return true; }
    const post = (db.rzV2.posts || []).find(function(p) { return p.id === removeMatch[2] && p.userId === user.id; });
    if (!post || post.seriesId !== series.id) { ctx.sendError(res, 404, "Episode not found."); return true; }
    delete post.seriesId;
    delete post.seriesEpisodeTitle;
    delete post.seriesEpisodeNumber;
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, {success:true, series:seriesView(db, series)});
    return true;
  }

  const deleteSeries = path.match(/^\/api\/v2\/series\/([^/]+)$/);
  if (deleteSeries && method === "DELETE") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const series = db.rzV2.series.find(function(s) { return s.id === deleteSeries[1]; });
    if (!series) { ctx.sendError(res, 404, "Series not found."); return true; }
    if (series.creatorId !== user.id) { ctx.sendError(res, 403, "Only the series owner can delete it."); return true; }
    (db.rzV2.posts || []).forEach(function(p) {
      if (p.seriesId === series.id) {
        delete p.seriesId;
        delete p.seriesEpisodeTitle;
        delete p.seriesEpisodeNumber;
      }
    });
    db.rzV2.series = db.rzV2.series.filter(function(s) { return s.id !== series.id; });
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, {success:true});
    return true;
  }

  return false;
}

module.exports = { handleRizoraSeries };
