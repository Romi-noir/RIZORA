"use strict";

function tagAllowed(db, authorId, targetId) {
  if (!targetId || targetId === authorId) return false;
  var target = (db.users || []).find(function (user) { return user.id === targetId; });
  if (!target || target.status !== "active") return false;
  var blocked = (db.rzV2.blocks || []).some(function (row) {
    return (row.userId === authorId && row.targetUserId === targetId) ||
      (row.userId === targetId && row.targetUserId === authorId);
  });
  if (blocked) return false;
  var preferences = db.rzV2.preferences && db.rzV2.preferences[targetId] || {};
  var policy = String(preferences.tagPolicy || "everyone").toLowerCase();
  if (policy === "none") return false;
  if (policy === "followers") {
    return (db.rzV2.follows || []).some(function (row) {
      return row.followerId === authorId && row.followingId === targetId;
    });
  }
  return true;
}

function mediaTypeFromUrl(url, storedType) {
  if (["image", "video", "audio", "file"].includes(storedType)) return storedType;
  var path = String(url || "").toLowerCase().split("?")[0];
  if (/\.(jpg|jpeg|png|webp|gif)$/.test(path)) return "image";
  if (/\.(mp4|webm|mov)$/.test(path)) return "video";
  if (/\.(mp3|m4a|wav|ogg)$/.test(path)) return "audio";
  return url ? "file" : "text";
}

function normalizePeopleTags(db, authorId, input) {
  if (!Array.isArray(input)) return [];
  var seen = new Set(), result = [];
  input.slice(0, 30).forEach(function (item) {
    if (!item || typeof item !== "object" || result.length >= 10) return;
    var targetId = String(item.userId || "").slice(0, 120);
    var target = (db.users || []).find(function (user) {
      return targetId ? user.id === targetId :
        String(user.publicUsername || user.username || "").toLowerCase() === String(item.username || "").replace(/^@/, "").toLowerCase();
    });
    if (!target || seen.has(target.id) || !tagAllowed(db, authorId, target.id)) return;
    var x = Number(item.x), y = Number(item.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    seen.add(target.id);
    result.push({ userId: target.id, x: Math.round(Math.max(0, Math.min(100, x)) * 10) / 10, y: Math.round(Math.max(0, Math.min(100, y)) * 10) / 10 });
  });
  return result;
}

function decoratePeopleTags(db, authorId, input) {
  return (Array.isArray(input) ? input : []).map(function (tag) {
    var target = (db.users || []).find(function (user) { return user.id === tag.userId; });
    if (!target || !tagAllowed(db, authorId, target.id)) return null;
    var x = Number(tag.x), y = Number(tag.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
      userId: target.id,
      username: String(target.publicUsername || target.username || ""),
      displayName: String(target.displayName || target.username || "Creator"),
      x: Math.round(Math.max(0, Math.min(100, x)) * 10) / 10,
      y: Math.round(Math.max(0, Math.min(100, y)) * 10) / 10
    };
  }).filter(Boolean).slice(0, 10);
}

function notifyNewPeopleTags(db, author, post, previous) {
  db.notifications = db.notifications || [];
  var old = new Set((Array.isArray(previous) ? previous : []).map(function (tag) { return tag.userId; }));
  var authorName = String(author.displayName || author.publicUsername || author.username || "A creator");
  (post.peopleTags || []).forEach(function (tag) {
    if (old.has(tag.userId)) return;
    db.notifications.push({
      id: "n_tag_" + Date.now().toString(36) + "_" + String(tag.userId).slice(-10),
      userId: tag.userId,
      title: authorName + " tagged you in a post",
      message: "You were tagged in a RIZORA post.",
      type: "tags",
      read: false,
      createdAt: new Date().toISOString(),
      target: { type: "post", id: post.id }
    });
  });
}

module.exports = { tagAllowed, mediaTypeFromUrl, normalizePeopleTags, decoratePeopleTags, notifyNewPeopleTags };
