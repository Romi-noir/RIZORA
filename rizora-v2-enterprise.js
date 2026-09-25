"use strict";

const crypto = require("crypto");

function hashPasswordSyncEnterprise(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.pbkdf2Sync(String(password), salt, 120000, 64, "sha512");
  return salt + ":" + derived.toString("hex");
}

function ensureEnterprise(db) {
  db.rzV2 = db.rzV2 || {};
  db.rzV2.supportTickets = db.rzV2.supportTickets || [];
  db.rzV2.reports = db.rzV2.reports || [];
  db.rzV2.transactions = db.rzV2.transactions || [];
  db.rzV2.paymentEvents = db.rzV2.paymentEvents || [];
  db.rzV2.profileViews = db.rzV2.profileViews || [];
  db.rzV2.onboardingCompletions = db.rzV2.onboardingCompletions || [];
}

async function readBody(req, limit) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk.toString();
    if (raw.length > (limit || 1100000)) throw new Error("Request body too large.");
  }
  return raw ? JSON.parse(raw) : {};
}

function safeString(value, max) {
  return String(value == null ? "" : value).trim().slice(0, max || 1200);
}

function currentUser(ctx) {
  return ctx.getCurrentUser(ctx.db, ctx.req);
}

function admin(ctx, user) {
  return !!user && typeof ctx.isSuperAdmin === "function" && ctx.isSuperAdmin(user);
}

function ensureProfile(db, user) {
  db.creatorProfiles = db.creatorProfiles || {};
  const p = db.creatorProfiles[user.id] || {};
  db.creatorProfiles[user.id] = p;
  return p;
}

function profilePayload(db, user) {
  const p = ensureProfile(db, user);
  const posts = (db.rzV2.posts || []).filter(x => x.userId === user.id);
  const likes = (db.rzV2.likes || []).filter(x => posts.some(pst => pst.id === x.postId)).length;
  const followers = (db.rzV2.follows || []).filter(x => x.followingId === user.id).length;
  const following = (db.rzV2.follows || []).filter(x => x.followerId === user.id).length;
  return {
    id: user.id,
    username: user.username,
    publicUsername: user.publicUsername || user.username,
    displayName: user.displayName || user.username,
    avatarUrl: p.avatarUrl || user.avatarUrl || "/rizora-cover.png",
    bio: p.bio || user.bio || "",
    category: p.category || user.category || "",
    location: p.location || user.location || "",
    links: p.links || user.links || {},
    verified: user.verified === true || user.verificationStatus === "verified",
    warningCount: Number(user.warningCount || 0),
    followers,
    following,
    posts: posts.length,
    likes,
    createdAt: user.createdAt || null
  };
}

function transactionForUser(db, userId, ref) {
  return (db.rzV2.transactions || []).find(t => t.userId === userId && (!ref || t.reference === ref));
}

function paystackConfigured() {
  return !!String(process.env.PAYSTACK_SECRET_KEY || "").trim();
}

async function paystackRequest(path, options) {
  const secret = String(process.env.PAYSTACK_SECRET_KEY || "").trim();
  if (!secret) throw new Error("Paystack is not configured on the server.");
  const response = await fetch("https://api.paystack.co" + path, Object.assign({
    headers: {
      "Authorization": "Bearer " + secret,
      "Content-Type": "application/json"
    }
  }, options || {}));
  const body = await response.text();
  let data = {};
  try { data = body ? JSON.parse(body) : {}; } catch (_) { data = { message: body }; }
  return { response, data };
}

function addAudit(ctx, user, action, details) {
  try {
    if (typeof ctx.audit === "function") ctx.audit(ctx.db, user, action, details);
  } catch (_) {}
}

async function handleRizoraEnterprise(ctx) {
  const db = ctx.db;
  const req = ctx.req;
  const res = ctx.res;
  const method = String(req.method || "GET").toUpperCase();
  const path = new URL(req.url, "http://rizora.local").pathname;
  const user = currentUser(ctx);

  ensureEnterprise(db);


  // ---------- post-signup onboarding ----------
  if (path === "/api/v2/onboarding" && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const targets = ["rizora", "romi.noir"];
    const tasks = targets.map(function(username) {
      const target = (db.users || []).find(function(u) {
        return String(u.username || "").toLowerCase() === username ||
          String(u.publicUsername || "").toLowerCase() === username;
      });
      if (!target) return null;
      const following = (db.rzV2.follows || []).some(function(f) {
        return f.followerId === user.id && f.followingId === target.id;
      });
      const completed = db.rzV2.onboardingCompletions.some(function(x) {
        return x.userId === user.id && x.targetUserId === target.id;
      }) || following;
      return {
        id: "follow_" + username.replace(/[^a-z0-9]+/g, "_"),
        type: "follow_creator",
        username: target.publicUsername || target.username,
        title: "Follow @" + (target.publicUsername || target.username) + " on RIZORA",
        description: "Follow the verified " + (target.official ? "official " : "") + (target.displayName || target.username) + " account.",
        targetUserId: target.id,
        points: 100,
        completed: completed
      };
    }).filter(Boolean).filter(function(t) { return t.targetUserId !== user.id; });
    ctx.sendJSON(res, 200, { success:true, tasks });
    return true;
  }

  if (path === "/api/v2/onboarding/follow" && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const b = await readBody(req, 100000);
    const targetUsername = safeString(b.username, 80).replace(/^@/, "").toLowerCase();
    if (!["rizora", "romi.noir"].includes(targetUsername)) {
      ctx.sendError(res, 400, "Invalid onboarding account.");
      return true;
    }
    const target = (db.users || []).find(function(u) {
      return String(u.username || "").toLowerCase() === targetUsername ||
        String(u.publicUsername || "").toLowerCase() === targetUsername;
    });
    if (!target) { ctx.sendError(res, 404, "Verified account not found."); return true; }
    if (target.id === user.id) { ctx.sendError(res, 400, "You cannot follow yourself."); return true; }

    db.rzV2.follows = db.rzV2.follows || [];
    let relation = db.rzV2.follows.find(function(f) {
      return f.followerId === user.id && f.followingId === target.id;
    });
    if (!relation) {
      relation = {
        id: ctx.uid("follow_"),
        followerId: user.id,
        followingId: target.id,
        createdAt: new Date().toISOString()
      };
      db.rzV2.follows.push(relation);
      notifyPlatform(db, target.id, "New follower", "@" + user.username + " followed you.");
    }

    let completion = db.rzV2.onboardingCompletions.find(function(x) {
      return x.userId === user.id && x.targetUserId === target.id;
    });
    let awarded = 0;
    if (!completion) {
      completion = {
        id: ctx.uid("onboarding_"),
        userId: user.id,
        targetUserId: target.id,
        reward: 100,
        completedAt: new Date().toISOString()
      };
      db.rzV2.onboardingCompletions.push(completion);
      user.points = Number(user.points || 0) + 100;
      awarded = 100;
      if (typeof ctx.audit === "function") {
        try { ctx.audit(db, user, "onboarding_follow_completed", { targetUserId: target.id, reward: awarded }); } catch (_) {}
      }
    }

    ctx.saveDB(db);
    ctx.sendJSON(res, 200, {
      success:true,
      following:true,
      awarded,
      points:Number(user.points || 0),
      username:target.publicUsername || target.username
    });
    return true;
  }

  // ---------- creator profile ----------
  const profileMatch = path.match(/^\/api\/v2\/profiles\/([^/]+)$/);
  if (profileMatch && method === "GET") {
    const key = decodeURIComponent(profileMatch[1]).toLowerCase();
    const target = (db.users || []).find(u =>
      u.id === profileMatch[1] ||
      String(u.username || "").toLowerCase() === key ||
      String(u.publicUsername || "").toLowerCase() === key
    );
    if (!target) { ctx.sendError(res, 404, "Creator not found."); return true; }
    const profile = profilePayload(db, target);
    if (user && user.id !== target.id) {
      db.rzV2.profileViews.push({
        id: "pview_" + Date.now().toString(36),
        viewerId: user.id,
        profileUserId: target.id,
        createdAt: new Date().toISOString()
      });
      if (db.rzV2.profileViews.length > 50000) db.rzV2.profileViews = db.rzV2.profileViews.slice(-50000);
      ctx.saveDB(db);
    }
    const posts = (db.rzV2.posts || [])
      .filter(p => p.userId === target.id)
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 24);
    ctx.sendJSON(res, 200, { success:true, profile, posts });
    return true;
  }

  // ---------- support ----------
  if (path === "/api/v2/support/tickets" && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const tickets = db.rzV2.supportTickets.filter(t => t.userId === user.id).slice().reverse().slice(0, 50);
    ctx.sendJSON(res, 200, { success:true, tickets });
    return true;
  }

  if (path === "/api/v2/support/tickets" && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const b = await readBody(req, 300000);
    const subject = safeString(b.subject, 120);
    const message = safeString(b.message, 3000);
    const category = safeString(b.category || "general", 40);
    if (!subject || !message) { ctx.sendError(res, 400, "Subject and message are required."); return true; }
    const ticket = {
      id: "ticket_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      userId: user.id,
      username: user.username,
      subject,
      message,
      category,
      status: "open",
      replies: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.rzV2.supportTickets.push(ticket);
    ctx.saveDB(db);
    addAudit(ctx, user, "support_ticket_created", { ticketId: ticket.id, category });
    ctx.sendJSON(res, 201, { success:true, ticket });
    return true;
  }

  const ticketMatch = path.match(/^\/api\/v2\/support\/tickets\/([^/]+)$/);
  if (ticketMatch && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const ticket = db.rzV2.supportTickets.find(t => t.id === ticketMatch[1]);
    if (!ticket) { ctx.sendError(res, 404, "Ticket not found."); return true; }
    if (ticket.userId !== user.id && !admin(ctx, user)) { ctx.sendError(res, 403, "Access denied."); return true; }
    ctx.sendJSON(res, 200, { success:true, ticket });
    return true;
  }

  if (ticketMatch && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const ticket = db.rzV2.supportTickets.find(t => t.id === ticketMatch[1]);
    if (!ticket) { ctx.sendError(res, 404, "Ticket not found."); return true; }
    if (ticket.userId !== user.id && !admin(ctx, user)) { ctx.sendError(res, 403, "Access denied."); return true; }
    const b = await readBody(req, 300000);
    const message = safeString(b.message, 3000);
    if (!message) { ctx.sendError(res, 400, "Reply message is required."); return true; }
    ticket.replies.push({
      id: "reply_" + Date.now().toString(36),
      userId: user.id,
      fromAdmin: admin(ctx, user),
      message,
      createdAt: new Date().toISOString()
    });
    ticket.status = admin(ctx, user) ? "in_progress" : "open";
    ticket.updatedAt = new Date().toISOString();
    ctx.saveDB(db);
    addAudit(ctx, user, "support_ticket_reply", { ticketId: ticket.id, admin: admin(ctx, user) });
    ctx.sendJSON(res, 201, { success:true, ticket });
    return true;
  }

  // ---------- reports / moderation ----------
  if (path === "/api/v2/reports" && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const b = await readBody(req, 300000);
    const targetType = safeString(b.targetType, 30);
    const targetId = safeString(b.targetId, 160);
    const reason = safeString(b.reason, 80);
    const details = safeString(b.details, 1500);
    if (!targetType || !targetId || !reason) { ctx.sendError(res, 400, "Target, reason and details are required."); return true; }
    const duplicate = db.rzV2.reports.find(r => r.reporterId === user.id && r.targetType === targetType && r.targetId === targetId && r.status === "open");
    if (duplicate) { ctx.sendError(res, 409, "You already reported this."); return true; }
    const report = {
      id: "report_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      reporterId: user.id,
      targetType,
      targetId,
      reason,
      details,
      status: "open",
      action: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.rzV2.reports.push(report);
    ctx.saveDB(db);
    addAudit(ctx, user, "content_report_created", { reportId: report.id, targetType, targetId });
    ctx.sendJSON(res, 201, { success:true, report });
    return true;
  }


  if (path === "/api/v2/admin/official/rizora/password" && method === "POST") {
    if (!admin(ctx, user)) { ctx.sendError(res, 403, "Super Admin access required."); return true; }
    const target = (db.users || []).find(function(u) {
      return String(u.username || "").toLowerCase() === "rizora";
    });
    if (!target) { ctx.sendError(res, 404, "The RIZORA official account has not been provisioned."); return true; }
    const b = await readBody(req, 100000);
    const password = String(b.password || "");
    if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      ctx.sendError(res, 400, "Password must be at least 8 characters and include uppercase, lowercase and a number.");
      return true;
    }
    target.passwordHash = hashPasswordSyncEnterprise(password);
    target.passwordSetupRequired = false;
    target.status = "active";
    target.verified = true;
    target.verificationStatus = "verified";
    target.verificationType = "official_platform";
    target.official = true;
    target.accountType = "platform";
    target.role = "official_platform";
    target.updatedAt = new Date().toISOString();
    ctx.saveDB(db);
    addAudit(ctx, user, "official_platform_password_set", { targetUserId: target.id });
    ctx.sendJSON(res, 200, { success:true, username:"rizora" });
    return true;
  }

  if (path === "/api/v2/admin/overview" && method === "GET") {
    if (!admin(ctx, user)) { ctx.sendError(res, 403, "Super Admin access required."); return true; }
    const users = db.users || [];
    const tickets = db.rzV2.supportTickets;
    const reports = db.rzV2.reports;
    const tx = db.rzV2.transactions;
    ctx.sendJSON(res, 200, {
      success:true,
      stats: {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.status === "active").length,
        suspendedUsers: users.filter(u => u.status === "suspended").length,
        verifiedUsers: users.filter(u => u.verified === true || u.verificationStatus === "verified").length,
        totalPosts: (db.rzV2.posts || []).length,
        totalCommunities: (db.rzV2.communities || []).length,
        totalStories: (db.rzV2.stories || []).length,
        totalMessages: (db.rzV2.messages || []).length,
        openReports: reports.filter(r => r.status === "open").length,
        openTickets: tickets.filter(t => t.status !== "resolved").length,
        successfulPayments: tx.filter(t => t.status === "success").length,
        pendingPayments: tx.filter(t => ["initialized","pending"].includes(t.status)).length,
        totalPoints: users.reduce((n,u) => n + Number(u.points || 0), 0),
        totalReferrals: Array.isArray(db.referrals) ? db.referrals.length : 0,
        referralPoints: Array.isArray(db.referrals) ? db.referrals.reduce((n,r) => n + Number(r.reward || r.points || 0), 0) : 0,
        totalAudits: Array.isArray(db.auditLogs) ? db.auditLogs.length : 0
      },
      latestReports: reports.slice().reverse().slice(0, 20),
      latestTickets: tickets.slice().reverse().slice(0, 20),
      latestTransactions: tx.slice().reverse().slice(0, 20)
    });
    return true;
  }

  if (path === "/api/v2/admin/support" && method === "GET") {
    if (!admin(ctx, user)) { ctx.sendError(res, 403, "Super Admin access required."); return true; }
    ctx.sendJSON(res, 200, { success:true, tickets: db.rzV2.supportTickets.slice().reverse().slice(0, 100) });
    return true;
  }

  if (path === "/api/v2/admin/reports" && method === "GET") {
    if (!admin(ctx, user)) { ctx.sendError(res, 403, "Super Admin access required."); return true; }
    ctx.sendJSON(res, 200, { success:true, reports: db.rzV2.reports.slice().reverse().slice(0, 100) });
    return true;
  }

  const adminTicketMatch = path.match(/^\/api\/v2\/admin\/support\/([^/]+)$/);
  if (adminTicketMatch && method === "POST") {
    if (!admin(ctx, user)) { ctx.sendError(res, 403, "Super Admin access required."); return true; }
    const ticket = db.rzV2.supportTickets.find(t => t.id === adminTicketMatch[1]);
    if (!ticket) { ctx.sendError(res, 404, "Ticket not found."); return true; }
    const b = await readBody(req, 300000);
    if (b.status && ["open","in_progress","resolved"].includes(String(b.status))) ticket.status = String(b.status);
    if (b.message) ticket.replies.push({ id:"reply_"+Date.now().toString(36), userId:user.id, fromAdmin:true, message:safeString(b.message,3000), createdAt:new Date().toISOString() });
    ticket.updatedAt = new Date().toISOString();
    db.notifications = db.notifications || [];
    db.notifications.push({ id:"notif_"+Date.now().toString(36), userId:ticket.userId, title:"Support update", message:"Your RIZORA support ticket has been updated.", type:"support", read:false, createdAt:new Date().toISOString() });
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, { success:true, ticket });
    return true;
  }

  const adminReportMatch = path.match(/^\/api\/v2\/admin\/reports\/([^/]+)$/);
  if (adminReportMatch && method === "POST") {
    if (!admin(ctx, user)) { ctx.sendError(res, 403, "Super Admin access required."); return true; }
    const report = db.rzV2.reports.find(r => r.id === adminReportMatch[1]);
    if (!report) { ctx.sendError(res, 404, "Report not found."); return true; }
    const b = await readBody(req, 300000);
    const action = safeString(b.action, 40);
    const valid = ["dismiss","remove_post","warn_user","suspend_user"];
    if (!valid.includes(action)) { ctx.sendError(res, 400, "Invalid moderation action."); return true; }

    if (action === "remove_post" && report.targetType === "post") {
      const post = (db.rzV2.posts || []).find(p => p.id === report.targetId);
      if (post) { post.removed = true; post.removedAt = new Date().toISOString(); post.removedBy = user.id; }
    }
    if ((action === "warn_user" || action === "suspend_user") && report.targetType === "user") {
      const target = (db.users || []).find(u => u.id === report.targetId);
      if (target) {
        target.warningCount = Number(target.warningCount || 0) + 1;
        target.moderationUpdatedAt = new Date().toISOString();
        if (action === "suspend_user" || target.warningCount >= 3) target.status = "suspended";
      }
    }
    report.status = action === "dismiss" ? "dismissed" : "actioned";
    report.action = action;
    report.updatedAt = new Date().toISOString();
    db.notifications = db.notifications || [];
    if (report.reporterId) db.notifications.push({ id:"notif_"+Date.now().toString(36), userId:report.reporterId, title:"Report reviewed", message:"Your report has been reviewed by RIZORA moderation.", type:"moderation", read:false, createdAt:new Date().toISOString() });
    ctx.saveDB(db);
    addAudit(ctx, user, "moderation_action", { reportId: report.id, action });
    ctx.sendJSON(res, 200, { success:true, report });
    return true;
  }

  // ---------- payment status ----------
  if (path === "/api/v2/payments/status" && method === "GET") {
    ctx.sendJSON(res, 200, { success:true, configured:paystackConfigured(), provider:"paystack", currency:String(process.env.RIZORA_CURRENCY || "NGN"), mode:String(process.env.PAYSTACK_MODE || "test") });
    return true;
  }

  if (path === "/api/v2/payments/transactions" && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    const mine = db.rzV2.transactions.filter(t => t.userId === user.id).slice().reverse().slice(0, 100).map(t => Object.assign({}, t, {metadata:undefined}));
    ctx.sendJSON(res, 200, { success:true, transactions:mine });
    return true;
  }

  if (path === "/api/v2/payments/initialize" && method === "POST") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    if (!paystackConfigured()) { ctx.sendError(res, 503, "Paystack is not configured on the RIZORA server yet."); return true; }
    const b = await readBody(req, 100000);
    const amountNaira = Number(b.amountNaira);
    if (!Number.isFinite(amountNaira) || amountNaira <= 0 || amountNaira > 10000000) { ctx.sendError(res, 400, "Enter a valid amount."); return true; }
    const amountKobo = String(Math.round(amountNaira * 100));
    const reference = ("RZ-" + Date.now() + "-" + Math.random().toString(36).slice(2,8)).replace(/[^A-Za-z0-9\-.=]/g, "");
    const email = safeString(b.email || user.email, 180);
    if (!email || !email.includes("@")) { ctx.sendError(res, 400, "A valid email is required for payment."); return true; }
    const metadata = {
      userId:user.id,
      purpose:safeString(b.purpose || "rizora_creator",80),
      campaignId:safeString(b.campaignId || "",120)
    };
    const payload = { email, amount:amountKobo, currency:String(process.env.RIZORA_CURRENCY || "NGN"), reference, metadata:JSON.stringify(metadata) };
    const callback = String(process.env.RIZORA_PAYMENT_CALLBACK || "https://rizora.com.ng/").trim();
    if (callback) payload.callback_url = callback;
    const ps = await paystackRequest("/transaction/initialize", { method:"POST", body:JSON.stringify(payload) });
    if (!ps.response.ok || !ps.data.status) { ctx.sendError(res, 502, ps.data.message || "Unable to initialize Paystack payment."); return true; }
    const record = {
      id:"tx_"+Date.now().toString(36),
      userId:user.id,
      provider:"paystack",
      reference:ps.data.data.reference || reference,
      amountNaira,
      amountSubunit:Number(amountKobo),
      currency:payload.currency,
      purpose:metadata.purpose,
      campaignId:metadata.campaignId || null,
      status:"initialized",
      authorizationUrl:ps.data.data.authorization_url || "",
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString()
    };
    db.rzV2.transactions.push(record);
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, { success:true, authorizationUrl:record.authorizationUrl, accessCode:ps.data.data.access_code || null, reference:record.reference });
    return true;
  }

  const verifyMatch = path.match(/^\/api\/v2\/payments\/verify\/([^/]+)$/);
  if (verifyMatch && method === "GET") {
    if (!user) { ctx.sendError(res, 401, "Authentication required."); return true; }
    if (!paystackConfigured()) { ctx.sendError(res, 503, "Paystack is not configured on the RIZORA server yet."); return true; }
    const reference = decodeURIComponent(verifyMatch[1]);
    const record = transactionForUser(db, user.id, reference);
    if (!record) { ctx.sendError(res, 404, "Payment reference not found."); return true; }
    const ps = await paystackRequest("/transaction/verify/" + encodeURIComponent(reference), { method:"GET" });
    if (!ps.response.ok || !ps.data.status) { ctx.sendError(res, 502, ps.data.message || "Unable to verify payment."); return true; }
    const data = ps.data.data || {};
    const successful = String(data.status || "").toLowerCase() === "success";
    record.status = successful ? "success" : String(data.status || "pending");
    record.paystackId = data.id || null;
    record.verifiedAt = new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, { success:true, status:record.status, transaction:record });
    return true;
  }

  // Paystack webhook: no user session is required.
  if (path === "/api/paystack/webhook" && method === "POST") {
    if (!paystackConfigured()) { ctx.sendError(res, 503, "Paystack webhook is not configured."); return true; }
    let rawText = "";
    for await (const chunk of req) {
      rawText += chunk.toString();
      if (rawText.length > 500000) { ctx.sendError(res, 413, "Webhook body too large."); return true; }
    }
    let raw;
    try { raw = rawText ? JSON.parse(rawText) : {}; } catch (_) { ctx.sendError(res, 400, "Invalid webhook JSON."); return true; }
    const signature = String(req.headers["x-paystack-signature"] || "");
    const expected = crypto.createHmac("sha512", String(process.env.PAYSTACK_SECRET_KEY)).update(rawText, "utf8").digest("hex");
    const sigBuf = Buffer.from(signature, "utf8");
    const expBuf = Buffer.from(expected, "utf8");
    if (!signature || sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      ctx.sendError(res, 401, "Invalid webhook signature."); return true;
    }
    const event = raw && raw.event ? raw.event : "";
    const data = raw && raw.data ? raw.data : {};
    const reference = data.reference || "";
    db.rzV2.paymentEvents.push({ id:"pe_"+Date.now().toString(36), event, reference, receivedAt:new Date().toISOString() });
    const tx = db.rzV2.transactions.find(t => t.reference === reference);
    if (tx) {
      if (event === "charge.success") tx.status = "success";
      else if (["charge.failed","transaction.failed"].includes(event)) tx.status = "failed";
      tx.paystackId = data.id || tx.paystackId || null;
      tx.updatedAt = new Date().toISOString();
    }
    if (db.rzV2.paymentEvents.length > 5000) db.rzV2.paymentEvents = db.rzV2.paymentEvents.slice(-5000);
    ctx.saveDB(db);
    ctx.sendJSON(res, 200, { received:true });
    return true;
  }

  return false;
}

module.exports = { handleRizoraEnterprise };