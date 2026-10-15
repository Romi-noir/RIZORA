"use strict";

const crypto = require("crypto");

function uid(prefix) {
  return String(prefix || "id_") + crypto.randomBytes(8).toString("hex");
}

function ensure(db) {
  db.rzV2 ||= {};
  db.rzV2.messages ||= [];
  db.rzV2.conversations ||= [];
  db.rzV2.groups ||= [];
  db.rzV2.stickers ||= [];
  db.rzV2.chatTyping ||= {};
  db.rzV2.chatStreaks ||= {};
}

async function readBody(req) {
  let raw = "";
  try { for await (const chunk of req) raw += chunk; } catch (_) { throw new Error("Unable to read request body."); }
  if (raw.length > 1024 * 1024) throw new Error("Request body too large.");
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch (_) { throw new Error("Invalid JSON body."); }
}

function save(ctx) { ctx.saveDB(ctx.db); }
function activeUser(db, id) { return (db.users || []).find(user => user.id === id && (user.status || "active") === "active"); }
function isConversationMember(db, conversationId, userId) {
  const conversation = db.rzV2.conversations.find(item => item.id === conversationId);
  return !!conversation && Array.isArray(conversation.members) && conversation.members.includes(userId);
}
function canAccessMessage(db, message, userId) {
  if (!message) return false;
  if (message.from === userId || message.to === userId) return true;
  return message.groupId ? isConversationMember(db, message.groupId, userId) : false;
}
function updateStreak(db, a, b) {
  const key = [a, b].sort().join(":");
  const now = Date.now();
  const state = db.rzV2.chatStreaks[key] || { count: 0, last: 0 };
  state.count = now - state.last < 48 * 60 * 60 * 1000 ? state.count + 1 : 1;
  state.last = now;
  db.rzV2.chatStreaks[key] = state;
  return state;
}

async function handleRizoraMessaging(ctx) {
  const { req, res, db, saveDB, getCurrentUser, sendJSON, sendError } = ctx;
  const url = new URL(req.url, "http://localhost");
  const path = url.pathname;
  const method = String(req.method || "GET").toUpperCase();
  if (!path.startsWith("/api/messaging")) return false;

  ensure(db);
  const user = getCurrentUser(db, req);
  if (!user) { sendError(res, 401, "Authentication required."); return true; }

  if (method === "POST" && (path === "/api/messaging" || path === "/api/messaging/message")) {
    let body;
    try { body = await readBody(req); } catch (error) { sendError(res, 400, error.message); return true; }
    const to = body.to ? String(body.to).trim() : null;
    const groupId = body.groupId ? String(body.groupId).trim() : null;
    if (!to && !groupId) { sendError(res, 400, "Recipient required."); return true; }
    if (to && !activeUser(db, to)) { sendError(res, 404, "Recipient not found."); return true; }
    if (groupId && !isConversationMember(db, groupId, user.id)) { sendError(res, 403, "You are not a member of this group."); return true; }
    const text = String(body.text || "").trim().slice(0, 4000);
    const message = {
      id: uid("msg_"), from: user.id, to, groupId, text,
      mediaId: body.mediaId ? String(body.mediaId).slice(0, 120) : null,
      type: ["text", "voice", "image", "file"].includes(body.type) ? body.type : "text",
      stickerId: body.stickerId ? String(body.stickerId).slice(0, 120) : null,
      mentions: Array.isArray(body.mentions) ? body.mentions.slice(0, 50).map(String) : [],
      readBy: [user.id], reactions: {}, createdAt: new Date().toISOString()
    };
    if (!message.text && !message.mediaId && !message.stickerId) { sendError(res, 400, "Message content is required."); return true; }
    db.rzV2.messages.push(message);
    if (to) {
      let conversation = db.rzV2.conversations.find(item => Array.isArray(item.members) && item.members.length === 2 && item.members.includes(user.id) && item.members.includes(to));
      if (!conversation) {
        conversation = { id: uid("conversation_"), members: [user.id, to], createdAt: new Date().toISOString() };
        db.rzV2.conversations.push(conversation);
      }
      updateStreak(db, user.id, to);
    }
    save(ctx);
    sendJSON(res, 201, { success: true, message });
    return true;
  }

  if (method === "POST" && path === "/api/messaging/group/create") {
    let body;
    try { body = await readBody(req); } catch (error) { sendError(res, 400, error.message); return true; }
    const requested = Array.isArray(body.members) ? body.members.map(String) : [];
    const members = [...new Set([user.id, ...requested])].filter(id => activeUser(db, id)).slice(0, 100);
    if (members.length < 2) { sendError(res, 400, "Add at least one active member."); return true; }
    const group = { id: uid("group_"), owner: user.id, name: String(body.name || "New Group").trim().slice(0, 120) || "New Group", members, createdAt: new Date().toISOString() };
    db.rzV2.groups.push(group);
    db.rzV2.conversations.push({ id: group.id, members: group.members, groupId: group.id, createdAt: group.createdAt });
    save(ctx);
    sendJSON(res, 201, { success: true, group });
    return true;
  }

  if (method === "POST" && path === "/api/messaging/reaction") {
    let body;
    try { body = await readBody(req); } catch (error) { sendError(res, 400, error.message); return true; }
    const message = db.rzV2.messages.find(item => item.id === body.messageId);
    if (!canAccessMessage(db, message, user.id)) { sendError(res, 404, "Message not found."); return true; }
    message.reactions ||= {};
    const emoji = String(body.emoji || "").trim().slice(0, 16);
    if (!emoji) delete message.reactions[user.id]; else message.reactions[user.id] = emoji;
    save(ctx);
    sendJSON(res, 200, { success: true, message });
    return true;
  }

  if (method === "POST" && path === "/api/messaging/read") {
    let body;
    try { body = await readBody(req); } catch (error) { sendError(res, 400, error.message); return true; }
    const message = db.rzV2.messages.find(item => item.id === body.messageId);
    if (!canAccessMessage(db, message, user.id)) { sendError(res, 404, "Message not found."); return true; }
    message.readBy ||= [];
    if (!message.readBy.includes(user.id)) message.readBy.push(user.id);
    save(ctx);
    sendJSON(res, 200, { success: true });
    return true;
  }

  if (method === "POST" && path === "/api/messaging/typing") {
    let body;
    try { body = await readBody(req); } catch (error) { sendError(res, 400, error.message); return true; }
    db.rzV2.chatTyping[user.id] = { conversationId: body.conversationId ? String(body.conversationId).slice(0, 120) : null, active: body.active === true, updatedAt: new Date().toISOString() };
    save(ctx);
    sendJSON(res, 200, { success: true });
    return true;
  }

  if (method === "POST" && path === "/api/messaging/sticker") {
    let body;
    try { body = await readBody(req); } catch (error) { sendError(res, 400, error.message); return true; }
    const sticker = { id: uid("sticker_"), owner: user.id, url: String(body.url || "").trim().slice(0, 1200), name: String(body.name || "Sticker").trim().slice(0, 120) || "Sticker", createdAt: new Date().toISOString() };
    if (!sticker.url) { sendError(res, 400, "Sticker URL is required."); return true; }
    db.rzV2.stickers.push(sticker);
    save(ctx);
    sendJSON(res, 201, { success: true, sticker });
    return true;
  }

  if (method === "GET" && path.startsWith("/api/messaging/conversation/")) {
    const conversationId = decodeURIComponent(path.slice("/api/messaging/conversation/".length));
    if (!isConversationMember(db, conversationId, user.id)) { sendError(res, 404, "Conversation not found."); return true; }
    const conversation = db.rzV2.conversations.find(item => item.id === conversationId);
    const messages = db.rzV2.messages.filter(item => item.from === user.id || item.to === user.id || item.groupId === conversationId).slice(-200);
    sendJSON(res, 200, { success: true, conversation, messages });
    return true;
  }

  sendError(res, 404, "Messaging route not found.");
  return true;
}

module.exports = { handleRizoraMessaging };
