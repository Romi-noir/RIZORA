"use strict";

function ensureGlobal(db) {
  db.rzV2 = db.rzV2 || {};
  db.rzV2.channels = db.rzV2.channels || [];
  db.rzV2.channelMembers = db.rzV2.channelMembers || [];
  db.rzV2.channelMessages = db.rzV2.channelMessages || [];
  db.rzV2.channelReactions = db.rzV2.channelReactions || [];
  db.rzV2.creatorFeeds = db.rzV2.creatorFeeds || [];
}

function readBody(req) {
  return new Promise(function(resolve, reject) {
    var raw = "";
    req.on("data", function(chunk) {
      raw += chunk.toString();
      if (raw.length > 1024 * 1024) reject(new Error("Request body too large."));
    });
    req.on("end", function() {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (_) { reject(new Error("Invalid JSON.")); }
    });
    req.on("error", reject);
  });
}

function isoNow() { return new Date().toISOString(); }

function clean(ctx, value, max) {
  return ctx.cleanString(value == null ? "" : value, max);
}

function current(ctx, db, req) {
  return ctx.getCurrentUser(db, req);
}

function publicUser(db, id) {
  var u = (db.users || []).find(function(x) { return x.id === id; });
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    publicUsername: u.publicUsername || u.username,
    displayName: u.displayName || u.username,
    avatarUrl: u.avatarUrl || "/rizora-cover.png",
    verified: !!u.verified,
    category: u.category || ""
  };
}

function channelDecorated(db, channel, viewerId) {
  var owner = publicUser(db, channel.ownerId);
  var members = db.rzV2.channelMembers.filter(function(m) { return m.channelId === channel.id; });
  return {
    id: channel.id,
    ownerId: channel.ownerId,
    owner: owner,
    name: channel.name,
    description: channel.description,
    createdAt: channel.createdAt,
    memberCount: members.length,
    joined: members.some(function(m) { return m.userId === viewerId; })
  };
}

function postMatchesFeed(db, post, feed) {
  var creatorIds = Array.isArray(feed.creatorIds) ? feed.creatorIds : [];
  var hashtags = Array.isArray(feed.hashtags) ? feed.hashtags.map(function(x) { return String(x).replace(/^#/, "").toLowerCase(); }) : [];
  var creatorMatch = creatorIds.length > 0 && creatorIds.includes(post.userId);
  var postTags = Array.isArray(post.hashtags) ? post.hashtags.map(function(x) { return String(x).replace(/^#/, "").toLowerCase(); }) : [];
  var tagMatch = hashtags.length > 0 && hashtags.some(function(t) { return postTags.includes(t); });
  if (!creatorIds.length && !hashtags.length) return true;
  return creatorMatch || tagMatch;
}

function assistantBrief(db, user) {
  var posts = (db.rzV2.posts || []).filter(function(p) { return p.userId === user.id; });
  var likes = (db.rzV2.likes || []).filter(function(x) {
    return posts.some(function(p) { return p.id === x.postId; });
  }).length;
  var comments = (db.rzV2.comments || []).filter(function(x) {
    return posts.some(function(p) { return p.id === x.postId; });
  }).length;
  var saves = (db.rzV2.saves || []).filter(function(x) {
    return posts.some(function(p) { return p.id === x.postId; });
  }).length;
  var reposts = (db.rzV2.reposts || []).filter(function(x) {
    return posts.some(function(p) { return p.id === x.postId; });
  }).length;
  var followers = (db.rzV2.follows || []).filter(function(f) { return f.followingId === user.id; }).length;
  var following = (db.rzV2.follows || []).filter(function(f) { return f.followerId === user.id; }).length;
  var engagement = posts.length ? Number(((likes + comments + saves + reposts) / posts.length).toFixed(2)) : 0;

  var actions = [];
  if (posts.length < 3) actions.push({type:"content", title:"Build a stronger content base", action:"Publish or schedule 3 useful posts so your profile has something to discover."});
  if (posts.length >= 3 && engagement < 2) actions.push({type:"content", title:"Increase interaction", action:"Try a poll, question-led post or collaboration instead of another one-way post."});
  if (following < 3) actions.push({type:"community", title:"Build your creator graph", action:"Follow a few relevant creators and join a community that matches your niche."});
  if (!user.bio) actions.push({type:"profile", title:"Finish your profile", action:"Add a clear creator bio and category so visitors immediately know what you make."});
  if (followers < 10) actions.push({type:"growth", title:"Use the growth system", action:"Complete active missions, use Boosts carefully and invite real creators."});
  actions.push({type:"distribution", title:"Turn good work into a series", action:"Save the best-performing idea as a repeatable format and schedule the next variation."});
  actions.push({type:"safety", title:"Protect your original work", action:"Register important original content in Content Protection before you share it widely."});

  return {
    generatedAt: isoNow(),
    goal: "Build, distribute and grow",
    metrics: {posts:posts.length, likes:likes, comments:comments, saves:saves, reposts:reposts, followers:followers, following:following, engagementPerPost:engagement},
    actions: actions.slice(0, 6),
    nextMove: actions[0] || {type:"content", title:"Create something", action:"Publish a piece of work and start the loop."}
  };
}

async function handleRizoraGlobal(ctx) {
  var req = ctx.req, res = ctx.res, db = ctx.db;
  ensureGlobal(db);
  var method = req.method;
  var url = new URL(req.url, "http://localhost");
  var pathname = url.pathname;
  var user = current(ctx, db, req);

  if (pathname === "/api/v2/channels" && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    var ownerParam = url.searchParams.get("owner") || "";
    var list = db.rzV2.channels.slice().reverse();
    if (ownerParam === "me") list = list.filter(function(c) { return c.ownerId === user.id; });
    ctx.sendJSON(res, 200, {success:true, channels:list.slice(0, 100).map(function(c) { return channelDecorated(db, c, user.id); })});
    return true;
  }

  if (pathname === "/api/v2/channels" && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    var body;
    try { body = await readBody(req); } catch (e) { ctx.sendError(res, 400, e.message); return true; }
    var name = clean(ctx, body.name, 80);
    var description = clean(ctx, body.description, 500);
    if (!name) { ctx.sendError(res, 400, "Channel name is required."); return true; }
    if (db.rzV2.channels.filter(function(c) { return c.ownerId === user.id; }).length >= 3) {
      ctx.sendError(res, 400, "You can create up to 3 broadcast channels.");
      return true;
    }
    var channel = {id:ctx.uid("chn_"), ownerId:user.id, name:name, description:description, createdAt:isoNow()};
    db.rzV2.channels.push(channel);
    db.rzV2.channelMembers.push({id:ctx.uid("chnm_"), channelId:channel.id, userId:user.id, createdAt:isoNow(), role:"owner"});
    ctx.saveDB(db);
    ctx.sendJSON(res, 201, {success:true, channel:channelDecorated(db, channel, user.id)});
    return true;
  }

  var cm = pathname.match(/^\/api\/v2\/channels\/([^/]+)$/);
  if (cm && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    var channel = db.rzV2.channels.find(function(c) { return c.id === cm[1]; });
    if (!channel) { ctx.sendError(res, 404, "Channel not found."); return true; }
    var messages = db.rzV2.channelMessages.filter(function(m) { return m.channelId === channel.id; }).slice(-50).map(function(m) {
      var actor = publicUser(db, m.userId);
      var reactions = {};
      db.rzV2.channelReactions.filter(function(r) { return r.messageId === m.id; }).forEach(function(r) { reactions[r.reaction] = Number(reactions[r.reaction] || 0) + 1; });
      return {id:m.id, channelId:m.channelId, user:actor, text:m.text, poll:m.poll || null, createdAt:m.createdAt, reactions:reactions};
    });
    ctx.sendJSON(res, 200, {success:true, channel:channelDecorated(db, channel, user.id), messages:messages});
    return true;
  }

  var cj = pathname.match(/^\/api\/v2\/channels\/([^/]+)\/join$/);
  if (cj && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    var targetChannel = db.rzV2.channels.find(function(c) { return c.id === cj[1]; });
    if (!targetChannel) { ctx.sendError(res, 404, "Channel not found."); return true; }
    var member = db.rzV2.channelMembers.find(function(m) { return m.channelId === targetChannel.id && m.userId === user.id; });
    if (!member) db.rzV2.channelMembers.push({id:ctx.uid("chnm_"), channelId:targetChannel.id, userId:user.id, createdAt:isoNow(), role:"member"});
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, {success:true, joined:true});
    return true;
  }

  var cl = pathname.match(/^\/api\/v2\/channels\/([^/]+)\/leave$/);
  if (cl && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    var leaveChannel = db.rzV2.channels.find(function(c) { return c.id === cl[1]; });
    if (!leaveChannel) { ctx.sendError(res, 404, "Channel not found."); return true; }
    if (leaveChannel.ownerId === user.id) { ctx.sendError(res, 400, "Owners cannot leave their own channel."); return true; }
    db.rzV2.channelMembers = db.rzV2.channelMembers.filter(function(m) { return !(m.channelId === leaveChannel.id && m.userId === user.id); });
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, {success:true, joined:false});
    return true;
  }

  var msg = pathname.match(/^\/api\/v2\/channels\/([^/]+)\/messages$/);
  if (msg && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    var target = db.rzV2.channels.find(function(c) { return c.id === msg[1]; });
    if (!target) { ctx.sendError(res, 404, "Channel not found."); return true; }
    var memberRow = db.rzV2.channelMembers.find(function(m) { return m.channelId === target.id && m.userId === user.id; });
    if (!memberRow) { ctx.sendError(res, 403, "Join the channel before posting a reply."); return true; }
    try { body = await readBody(req); } catch (e2) { ctx.sendError(res, 400, e2.message); return true; }
    var text = clean(ctx, body.text, 2000);
    if (!text && !body.poll) { ctx.sendError(res, 400, "Message text is required."); return true; }
    var poll = null;
    if (body.poll && Array.isArray(body.poll.options)) {
      var opts = body.poll.options.map(function(x) { return clean(ctx, x, 100); }).filter(Boolean).slice(0, 6);
      if (opts.length >= 2) poll = {question:clean(ctx, body.poll.question, 300) || text, options:opts, votes:{}};
    }
    var message = {id:ctx.uid("chnmsg_"), channelId:target.id, userId:user.id, text:text, poll:poll, createdAt:isoNow()};
    db.rzV2.channelMessages.push(message);
    ctx.saveDB(db);
    ctx.sendJSON(res, 201, {success:true, message:message});
    return true;
  }

  var react = pathname.match(/^\/api\/v2\/channels\/([^/]+)\/messages\/([^/]+)\/react$/);
  if (react && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    var targetMessage = db.rzV2.channelMessages.find(function(m) { return m.channelId === react[1] && m.id === react[2]; });
    if (!targetMessage) { ctx.sendError(res, 404, "Message not found."); return true; }
    try { body = await readBody(req); } catch (e3) { ctx.sendError(res, 400, e3.message); return true; }
    var reaction = clean(ctx, body.reaction, 24).toLowerCase();
    if (!reaction || !/^[a-z0-9_+\-]+$/.test(reaction)) { ctx.sendError(res, 400, "Invalid reaction."); return true; }
    var existingReaction = db.rzV2.channelReactions.find(function(r) { return r.messageId === targetMessage.id && r.userId === user.id && r.reaction === reaction; });
    if (existingReaction) {
      db.rzV2.channelReactions = db.rzV2.channelReactions.filter(function(r) { return r !== existingReaction; });
    } else {
      db.rzV2.channelReactions.push({id:ctx.uid("chnr_"), messageId:targetMessage.id, userId:user.id, reaction:reaction, createdAt:isoNow()});
    }
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, {success:true, active:!existingReaction});
    return true;
  }

  if (pathname === "/api/v2/feeds" && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    var feeds = db.rzV2.creatorFeeds.filter(function(f) { return f.userId === user.id; }).slice().reverse();
    ctx.sendJSON(res, 200, {success:true, feeds:feeds});
    return true;
  }

  if (pathname === "/api/v2/feeds" && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    try { body = await readBody(req); } catch (e4) { ctx.sendError(res, 400, e4.message); return true; }
    var feedName = clean(ctx, body.name, 80);
    var hashtags = Array.isArray(body.hashtags) ? body.hashtags.map(function(x) { return clean(ctx, x, 40).replace(/^#/, "").toLowerCase(); }).filter(Boolean).slice(0, 12) : [];
    var creatorRefs = Array.isArray(body.creatorIds) ? body.creatorIds.map(function(x) { return String(x).trim(); }).filter(Boolean).slice(0, 20) : [];
    var creatorIds = creatorRefs.map(function(ref) {
      var found = (db.users || []).find(function(u) {
        return u.id === ref || String(u.username || "").toLowerCase() === ref.toLowerCase() || String(u.publicUsername || "").toLowerCase() === ref.toLowerCase();
      });
      return found ? found.id : null;
    }).filter(Boolean);
    if (!feedName) { ctx.sendError(res, 400, "Feed name is required."); return true; }
    var custom = {id:ctx.uid("feed_"), userId:user.id, name:feedName, hashtags:hashtags, creatorIds:creatorIds, createdAt:isoNow()};
    db.rzV2.creatorFeeds.push(custom);
    ctx.saveDB(db);
    ctx.sendJSON(res, 201, {success:true, feed:custom});
    return true;
  }

  var feed = pathname.match(/^\/api\/v2\/feeds\/([^/]+)$/);
  if (feed && method === "DELETE") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    var ownFeed = db.rzV2.creatorFeeds.find(function(f) { return f.id === feed[1] && f.userId === user.id; });
    if (!ownFeed) { ctx.sendError(res, 404, "Feed not found."); return true; }
    db.rzV2.creatorFeeds = db.rzV2.creatorFeeds.filter(function(f) { return f !== ownFeed; });
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, {success:true, deleted:true});
    return true;
  }

  var items = pathname.match(/^\/api\/v2\/feeds\/([^/]+)\/items$/);
  if (items && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    var own = db.rzV2.creatorFeeds.find(function(f) { return f.id === items[1] && f.userId === user.id; });
    if (!own) { ctx.sendError(res, 404, "Feed not found."); return true; }
    var posts = (db.rzV2.posts || []).filter(function(p) { return postMatchesFeed(db, p, own); }).slice().sort(function(a,b) { return new Date(b.createdAt) - new Date(a.createdAt); }).slice(0, 60);
    var decorated = posts.map(function(p) {
      var author = publicUser(db, p.userId);
      if (!author) return null;
      var likeCount = (db.rzV2.likes || []).filter(function(l) { return l.postId === p.id; }).length;
      var commentCount = (db.rzV2.comments || []).filter(function(c) { return c.postId === p.id; }).length;
      return {id:p.id, text:p.text, mediaUrl:p.mediaUrl || "", hashtags:p.hashtags || [], createdAt:p.createdAt, author:author, likes:likeCount, comments:commentCount};
    }).filter(Boolean);
    ctx.sendJSON(res, 200, {success:true, feed:own, posts:decorated});
    return true;
  }

  if (pathname === "/api/v2/assistant/brief" && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    ctx.sendJSON(res, 200, {success:true, brief:assistantBrief(db, user)});
    return true;
  }

  return false;
}

module.exports = { handleRizoraGlobal };
