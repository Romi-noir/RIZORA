// RIZORA Backend — Version 8.1.0
// Clean copy-paste version

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const ROOT = __dirname;
const DB_DIR = path.join(ROOT, "database");
const DB_FILE = path.join(DB_DIR, "db.json");

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BODY_SIZE = 1024 * 1024;

const REFERRAL_SIGNUP_REWARD = 100;
const REFERRAL_MILESTONE_REWARD = 250;

const SUPER_ADMINS = new Set([
  "romi",
  "superadmin2"
]);

const loginAttempts = new Map();
const signupAttempts = new Map();

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
const SIGNUP_MAX_ATTEMPTS = 10;


// ============================================================
// DATABASE
// ============================================================

function ensureDatabase() {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const initialDB = {
      users: [],
      tasks: [],
      taskCompletions: [],
      auditLogs: [],
      referrals: [],
      sessions: []
    };

    fs.writeFileSync(
      DB_FILE,
      JSON.stringify(initialDB, null, 2),
      "utf8"
    );
  }
}

function loadDB() {
  ensureDatabase();

  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    const db = JSON.parse(raw);

    db.users ||= [];
    db.tasks ||= [];
    db.taskCompletions ||= [];
    db.auditLogs ||= [];
    db.referrals ||= [];
    db.sessions ||= [];
    db.pointsLedger ||= [];
    db.creatorProfiles ||= {};
    db.analytics ||= {};
    db.communityPosts ||= [];
    db.experiments ||= [];
    db.userSettings ||= {};

    return db;
  } catch (error) {
    console.error("Database load error:", error);

    return {
      users: [],
      tasks: [],
      taskCompletions: [],
      auditLogs: [],
      referrals: [],
      sessions: []
    };
  }
}

function saveDB(db) {
  ensureDatabase();

  const tempFile = `${DB_FILE}.tmp`;

  fs.writeFileSync(
    tempFile,
    JSON.stringify(db, null, 2),
    "utf8"
  );

  fs.renameSync(tempFile, DB_FILE);
}


// ============================================================
// HELPERS
// ============================================================

function now() {
  return Date.now();
}

function uid(prefix = "") {
  return (
    prefix +
    crypto.randomBytes(12).toString("hex") +
    Date.now().toString(36)
  );
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanString(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function json(res, statusCode, data, extraHeaders = {}) {
  const body = JSON.stringify(data);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin":
      process.env.RIZORA_ALLOWED_ORIGINS || "*",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization",
    "Access-Control-Allow-Methods":
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    ...extraHeaders
  });

  res.end(body);
}

function sendJSON(res, statusCode, data) {
  return json(res, statusCode, data);
}

function sendError(res, statusCode, message) {
  return json(res, statusCode, {
    error: message
  });
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const cookies = {};

  header.split(";").forEach((part) => {
    const index = part.indexOf("=");

    if (index === -1) return;

    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();

    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      cookies[key] = value;
    }
  });

  return cookies;
}

function getBearerToken(req) {
  const auth = req.headers.authorization || "";

  if (!auth.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return auth.slice(7).trim();
}

function getSessionToken(req) {
  const bearer = getBearerToken(req);

  if (bearer) {
    return bearer;
  }

  const cookies = parseCookies(req);

  return cookies.rizora_session || "";
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `rizora_session=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${
      SESSION_TTL_MS / 1000
    }; SameSite=Lax`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "rizora_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax"
  );
}

function safeUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    email: user.email || "",
    role: user.role || "user",
    status: user.status || "active",
    points: Number(user.points || 0),
    referralCode: user.referralCode || "",
    referredBy: user.referredBy || null,
    referralCount: Number(user.referralCount || 0),
    createdAt: user.createdAt || null,
    lastLoginAt: user.lastLoginAt || null
  };
}

function isSuperAdmin(user) {
  if (!user) return false;

  return (
    user.role === "super_admin" &&
    SUPER_ADMINS.has(
      normalizeUsername(user.username)
    )
  );
}

function isAdmin(user) {
  return (
    user &&
    ["admin", "super_admin"].includes(user.role) &&
    user.status === "active"
  );
}

function randomReferralCode(username) {
  const base = normalizeUsername(username)
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 8);

  return `${base || "user"}${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

function getPublicBaseURL(req) {
  const forwardedProto =
    String(
      req.headers["x-forwarded-proto"] || ""
    ).split(",")[0].trim();

  const protocol =
    forwardedProto ||
    (
      process.env.RIZORA_PUBLIC_URL
        ? (() => {
            try {
              return new URL(
                process.env.RIZORA_PUBLIC_URL
              ).protocol.replace(":", "");
            } catch {
              return "http";
            }
          })()
        : "http"
    );

  if (process.env.RIZORA_PUBLIC_URL) {
    return String(
      process.env.RIZORA_PUBLIC_URL
    ).replace(/\/+$/, "");
  }

  const host =
    req.headers.host ||
    `localhost:${PORT}`;

  return `${protocol}://${host}`;
}


// ============================================================
// PASSWORD HASHING
// ============================================================

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString("hex");

    crypto.pbkdf2(
      password,
      salt,
      120000,
      64,
      "sha512",
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(
          `${salt}:${derivedKey.toString("hex")}`
        );
      }
    );
  });
}

function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    if (
      !storedHash ||
      !storedHash.includes(":")
    ) {
      resolve(false);
      return;
    }

    const [salt, originalHash] =
      storedHash.split(":");

    crypto.pbkdf2(
      password,
      salt,
      120000,
      64,
      "sha512",
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        const derivedHash =
          derivedKey.toString("hex");

        const a =
          Buffer.from(
            originalHash,
            "hex"
          );

        const b =
          Buffer.from(
            derivedHash,
            "hex"
          );

        if (a.length !== b.length) {
          resolve(false);
          return;
        }

        resolve(
          crypto.timingSafeEqual(a, b)
        );
      }
    );
  });
}


// ============================================================
// REQUEST BODY
// ============================================================

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;

      if (size > MAX_BODY_SIZE) {
        reject(
          new Error(
            "Request body too large."
          )
        );

        req.destroy();
        return;
      }

      body += chunk.toString();
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(
          new Error(
            "Invalid JSON body."
          )
        );
      }
    });

    req.on("error", reject);
  });
}


// ============================================================
// RATE LIMITING
// ============================================================

function checkRateLimit(
  map,
  key,
  windowMs,
  maxAttempts
) {
  const current = now();

  const existing = map.get(key);

  if (
    !existing ||
    current - existing.startedAt > windowMs
  ) {
    map.set(key, {
      startedAt: current,
      count: 1
    });

    return true;
  }

  existing.count += 1;

  if (existing.count > maxAttempts) {
    return false;
  }

  return true;
}


// ============================================================
// AUDIT
// ============================================================

function audit(
  db,
  action,
  actor,
  details = {}
) {
  db.auditLogs.unshift({
    id: uid("audit_"),

    action,

    actor: actor
      ? {
          id: actor.id,
          username: actor.username,
          role: actor.role
        }
      : null,

    details,

    createdAt:
      new Date().toISOString()
  });

  if (db.auditLogs.length > 2000) {
    db.auditLogs.length = 2000;
  }
}


// ============================================================
// AUTH / SESSIONS
// ============================================================

function cleanupSessions(db) {
  const current = now();

  if (!db.sessions) {
    db.sessions = [];
    return;
  }

  if (!Array.isArray(db.sessions)) {
    const sessions = [];

    for (
      const [key, session] of
      Object.entries(db.sessions)
    ) {
      if (
        !session ||
        typeof session !== "object"
      ) {
        continue;
      }

      if (
        session.expiresAt &&
        new Date(session.expiresAt)
          .getTime() > current
      ) {
        if (!session.token) {
          session.token = key;
        }

        sessions.push(session);
      }
    }

    db.sessions = sessions;
    return;
  }

  db.sessions = db.sessions.filter(
    (session) => {
      if (
        !session ||
        typeof session !== "object"
      ) {
        return false;
      }

      if (!session.expiresAt) {
        return false;
      }

      return (
        new Date(
          session.expiresAt
        ).getTime() > current
      );
    }
  );
}

function createSession(
  db,
  userId
) {
  cleanupSessions(db);

  const token =
    crypto.randomBytes(48).toString("hex");

  const session = {
    id: uid("session_"),
    token,
    userId,
    createdAt:
      new Date().toISOString(),
    expiresAt:
      new Date(
        now() + SESSION_TTL_MS
      ).toISOString()
  };

  db.sessions.push(session);

  return token;
}

function getCurrentUser(
  db,
  req
) {
  cleanupSessions(db);

  const token =
    getSessionToken(req);

  if (!token) {
    return null;
  }

  const session =
    db.sessions.find(
      (item) =>
        item.token === token &&
        new Date(item.expiresAt)
          .getTime() > now()
    );

  if (!session) {
    return null;
  }

  return (
    db.users.find(
      (user) =>
        user.id === session.userId
    ) || null
  );
}


// ============================================================
// TASKS
// ============================================================


const TASK_COOLDOWN_MS = 45 * 60 * 1000;

const RIZORA_FEATURE_LAYER_V1 = true;

const DEFAULT_TASKS = [
  {
    id: "rizora_tiktok",
    title: "Follow @official_rizora.hq on TikTok",
    description: "Follow the official RIZORA TikTok account.",
    points: 100,
    type: "social_follow",
    platform: "tiktok",
    url: "https://www.tiktok.com/@official_rizora.hq",
    active: true
  },
  {
    id: "rizora_instagram",
    title: "Follow @rizora.hq on Instagram",
    description: "Follow the official RIZORA Instagram account.",
    points: 75,
    type: "social_follow",
    platform: "instagram",
    url: "https://www.instagram.com/rizora.hq",
    active: true
  },
  {
    id: "rizora_x",
    title: "Follow @Rizora_hq on X",
    description: "Follow the official RIZORA X account.",
    points: 75,
    type: "social_follow",
    platform: "x",
    url: "https://x.com/Rizora_hq",
    active: true
  },
  {
    id: "romi_tiktok",
    title: "Follow @romi.noir on TikTok",
    description: "Follow RoMi on TikTok.",
    points: 75,
    type: "social_follow",
    platform: "tiktok",
    url: "https://www.tiktok.com/@romi.noir",
    active: true
  },
  {
    id: "rizora_explore",
    title: "Explore RIZORA",
    description: "Explore the RIZORA creator platform.",
    points: 50,
    type: "engagement",
    url: "/",
    active: true
  },
  {
    id: "rizora_share",
    title: "Share RIZORA",
    description: "Share RIZORA with another creator.",
    points: 50,
    type: "social_share",
    url: "/",
    active: true
  },
  {
    id: "rizora_create",
    title: "Create your first post",
    description: "Create and publish content.",
    points: 100,
    type: "creator",
    url: "/",
    active: true
  },
  {
    id: "rizora_profile",
    title: "Complete your profile",
    description: "Make your RIZORA profile ready.",
    points: 75,
    type: "profile",
    url: "/",
    active: true
  },
  {
    id: "rizora_invite",
    title: "Invite a creator",
    description: "Invite another creator to RIZORA.",
    points: 150,
    type: "referral",
    url: "/",
    active: true
  }
];

function seedTasks(db) {
  for (const task of DEFAULT_TASKS) {
    const existing = db.tasks.find(
      x => x.id === task.id
    );

    if (existing) {
      Object.assign(existing, task);
    } else {
      db.tasks.push({
        ...task,
        createdAt: new Date().toISOString()
      });
    }
  }
}

function getCooldown(db, userId) {
  db.taskCooldowns ||= {};

  const state =
    db.taskCooldowns[userId];

  if (!state) {
    return {
      active: false,
      remainingMs: 0,
      nextAvailableAt: null
    };
  }

  const next =
    new Date(
      state.nextAvailableAt
    ).getTime();

  const remaining =
    Math.max(
      0,
      next - Date.now()
    );

  return {
    active: remaining > 0,
    remainingMs: remaining,
    nextAvailableAt:
      remaining > 0
        ? state.nextAvailableAt
        : null
  };
}

function startCooldown(
  db,
  userId,
  taskId
) {
  db.taskCooldowns ||= {};

  const next =
    new Date(
      Date.now() + TASK_COOLDOWN_MS
    ).toISOString();

  db.taskCooldowns[userId] = {
    lastTaskId: taskId,
    nextAvailableAt: next
  };

  return next;
}

function addLedger(
  db,
  userId,
  type,
  amount,
  details
) {
  db.pointsLedger ||= [];

  db.pointsLedger.push({
    id:
      "ledger_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2),
    userId,
    type,
    amount,
    details: details || {},
    createdAt:
      new Date().toISOString()
  });
}

function validURL(value) {
  try {
    const u =
      new URL(
        String(value || "").trim()
      );

    if (
      u.protocol !== "http:" &&
      u.protocol !== "https:"
    ) {
      return "";
    }

    return u.toString();

  } catch {
    return "";
  }
}
// REFERRALS
// ============================================================

function applyReferral(
  db,
  newUser,
  referralCode
) {
  const code =
    cleanString(
      referralCode,
      100
    );

  if (!code) {
    return null;
  }

  const inviter =
    db.users.find(
      (user) =>
        user.referralCode &&
        user.referralCode.toLowerCase() ===
          code.toLowerCase()
    );

  if (!inviter) {
    return null;
  }

  if (inviter.id === newUser.id) {
    return null;
  }

  newUser.referredBy =
    inviter.id;

  inviter.referralCount =
    Number(
      inviter.referralCount || 0
    ) + 1;

  inviter.points =
    Number(
      inviter.points || 0
    ) + REFERRAL_SIGNUP_REWARD;

  newUser.points =
    Number(
      newUser.points || 0
    ) + REFERRAL_MILESTONE_REWARD;

  const referral = {
    id: uid("ref_"),
    referrerId: inviter.id,
    referredUserId: newUser.id,
    code: inviter.referralCode,
    reward: REFERRAL_SIGNUP_REWARD,
    createdAt:
      new Date().toISOString(),
    status: "completed"
  };

  db.referrals.push(
    referral
  );

  return referral;
}


// ============================================================
// GENERATORS
// ============================================================

const HOOKS = [
  "POV: you finally stopped overthinking and posted it.",
  "Nobody talks about this part of being a creator...",
  "This is your sign to stop waiting.",
  "I wish I knew this before I started creating.",
  "You are probably doing this wrong.",
  "Wait till you see the ending.",
  "Here is what actually changed everything for me.",
  "Small creators need to hear this."
];

const HASHTAGS = [
  "#fyp",
  "#viral",
  "#creator",
  "#contentcreator",
  "#tiktok",
  "#reels",
  "#growth",
  "#trending",
  "#explore",
  "#rizora"
];

const CAPTIONS = [
  "Building quietly. The results will speak.",
  "No pressure. Just progress.",
  "One post at a time.",
  "Still learning. Still creating.",
  "The journey is just getting started.",
  "Create it. Post it. Improve it.",
  "Small steps. Big aura.",
  "Consistency > motivation."
];

function randomItems(
  array,
  amount = 5
) {
  const copy = [...array];

  for (
    let i = copy.length - 1;
    i > 0;
    i--
  ) {
    const j =
      Math.floor(
        Math.random() * (i + 1)
      );

    [
      copy[i],
      copy[j]
    ] = [
      copy[j],
      copy[i]
    ];
  }

  return copy.slice(
    0,
    amount
  );
}


// ============================================================
// ADMIN HELPERS
// ============================================================

function requireAdmin(
  res,
  user
) {
  if (!user) {
    sendError(
      res,
      401,
      "Authentication required."
    );

    return false;
  }

  if (!isAdmin(user)) {
    sendError(
      res,
      403,
      "Admin access required."
    );

    return false;
  }

  return true;
}

function requireSuperAdmin(
  res,
  user
) {
  if (!user) {
    sendError(
      res,
      401,
      "Authentication required."
    );

    return false;
  }

  if (!isSuperAdmin(user)) {
    sendError(
      res,
      403,
      "Super admin access required."
    );

    return false;
  }

  return true;
}


// ============================================================
// ADMIN STATS
// ============================================================

function getAdminStats(db) {
  const totalUsers =
    db.users.length;

  const activeUsers =
    db.users.filter(
      (user) =>
        user.status === "active"
    ).length;

  const blockedUsers =
    db.users.filter(
      (user) =>
        user.status === "blocked"
    ).length;

  const admins =
    db.users.filter(
      (user) =>
        user.role === "admin"
    ).length;

  const superAdmins =
    db.users.filter(
      (user) =>
        user.role === "super_admin"
    ).length;

  const totalPoints =
    db.users.reduce(
      (sum, user) =>
        sum +
        Number(user.points || 0),
      0
    );

  const totalTaskCompletions =
    db.taskCompletions.length;

  const totalReferrals =
    db.referrals.length;

  return {
    totalUsers,
    activeUsers,
    blockedUsers,
    admins,
    superAdmins,
    totalPoints,
    totalTaskCompletions,
    totalReferrals
  };
}


// ============================================================
// STATIC FILES
// ============================================================

const MIME_TYPES = {
  ".html":
    "text/html; charset=utf-8",

  ".js":
    "application/javascript; charset=utf-8",

  ".css":
    "text/css; charset=utf-8",

  ".json":
    "application/json; charset=utf-8",

  ".webmanifest":
    "application/manifest+json",

  ".png":
    "image/png",

  ".jpg":
    "image/jpeg",

  ".jpeg":
    "image/jpeg",

  ".gif":
    "image/gif",

  ".svg":
    "image/svg+xml",

  ".ico":
    "image/x-icon",

  ".webp":
    "image/webp",

  ".txt":
    "text/plain; charset=utf-8"
};

function serveStatic(
  req,
  res,
  pathname
) {
  let requestedPath =
    pathname;

  if (
    requestedPath === "/" ||
    requestedPath === ""
  ) {
    requestedPath =
      "/index.html";
  }

  let filePath =
    path.normalize(
      path.join(
        ROOT,
        requestedPath
      )
    );

  if (!filePath.startsWith(ROOT)) {
    sendError(
      res,
      403,
      "Forbidden."
    );

    return;
  }

  if (!fs.existsSync(filePath)) {
    filePath =
      path.join(
        ROOT,
        "index.html"
      );
  }

  if (!fs.existsSync(filePath)) {
    sendError(
      res,
      404,
      "File not found."
    );

    return;
  }

  const stat =
    fs.statSync(filePath);

  if (!stat.isFile()) {
    sendError(
      res,
      404,
      "File not found."
    );

    return;
  }

  const ext =
    path.extname(
      filePath
    ).toLowerCase();

  res.writeHead(
    200,
    {
      "Content-Type":
        MIME_TYPES[ext] ||
        "application/octet-stream",

      "Cache-Control":
        ext === ".html"
          ? "no-cache"
          : "public, max-age=3600",

      "Access-Control-Allow-Origin":
        process.env.RIZORA_ALLOWED_ORIGINS ||
        "*"
    }
  );

  fs.createReadStream(
    filePath
  ).pipe(res);
}


// ============================================================
// REQUEST HANDLER
// ============================================================

async function handleRequest(
  req,
  res
) {
  const url =
    new URL(
      req.url,
      `http://${req.headers.host || "localhost"}`
    );

  const pathname =
    url.pathname;

  const method =
    String(req.method || "")
      .toUpperCase();

  // ----------------------------------------------------------
  // CORS PREFLIGHT
  // ----------------------------------------------------------

  if (method === "OPTIONS") {
    res.writeHead(
      204,
      {
        "Access-Control-Allow-Origin":
          process.env.RIZORA_ALLOWED_ORIGINS ||
          "*",

        "Access-Control-Allow-Headers":
          "Content-Type, Authorization",

        "Access-Control-Allow-Methods":
          "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      }
    );

    res.end();
    return;
  }

  const db = loadDB();

  cleanupSessions(db);

  // ----------------------------------------------------------
  // HEALTH
  // ----------------------------------------------------------

  if (
    method === "GET" &&
    pathname === "/api/health"
  ) {
    sendJSON(
      res,
      200,
      {
        ok: true,
        service: "RIZORA",
        version: "8.1.0",
        status: "online",
        time:
          new Date().toISOString()
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // SIGNUP
  // ----------------------------------------------------------

  if (
    method === "POST" &&
    pathname === "/api/auth/signup"
  ) {
    let body;

    try {
      body =
        await readBody(req);
    } catch (error) {
      sendError(
        res,
        400,
        error.message
      );

      return;
    }

    const username =
      normalizeUsername(
        body.username
      );

    const email =
      normalizeEmail(
        body.email
      );

    const password =
      String(
        body.password || ""
      );

    const referralCode =
      cleanString(
        body.referralCode ||
        body.referral,
        100
      );

    const rateKey =
      req.socket.remoteAddress ||
      "unknown";

    if (
      !checkRateLimit(
        signupAttempts,
        rateKey,
        SIGNUP_WINDOW_MS,
        SIGNUP_MAX_ATTEMPTS
      )
    ) {
      sendError(
        res,
        429,
        "Too many signup attempts. Try again later."
      );

      return;
    }

    if (!username) {
      sendError(
        res,
        400,
        "Username is required."
      );

      return;
    }

    if (
      !/^[a-zA-Z0-9_.-]{3,30}$/
        .test(username)
    ) {
      sendError(
        res,
        400,
        "Username must be 3-30 characters and may contain letters, numbers, dots, underscores or hyphens."
      );

      return;
    }

    if (password.length < 6) {
      sendError(
        res,
        400,
        "Password must be at least 6 characters."
      );

      return;
    }

    if (
      email &&
      !email.includes("@")
    ) {
      sendError(
        res,
        400,
        "Invalid email address."
      );

      return;
    }

    const usernameExists =
      db.users.some(
        (user) =>
          normalizeUsername(
            user.username
          ) === username
      );

    if (usernameExists) {
      sendError(
        res,
        409,
        "Username already exists."
      );

      return;
    }

    if (email) {
      const emailExists =
        db.users.some(
          (user) =>
            normalizeEmail(
              user.email
            ) === email
        );

      if (emailExists) {
        sendError(
          res,
          409,
          "Email is already registered."
        );

        return;
      }
    }

    const passwordHash =
      await hashPassword(
        password
      );

    const isProtected =
      SUPER_ADMINS.has(
        username
      );

    const user = {
      id: uid("user_"),

      username,

      displayName:
        cleanString(
          body.displayName ||
          username,
          80
        ),

      email,

      passwordHash,

      role:
        isProtected
          ? "super_admin"
          : "user",

      status: "active",

      points: 0,

      referralCode:
        randomReferralCode(
          username
        ),

      referredBy: null,

      referralCount: 0,

      createdAt:
        new Date().toISOString(),

      lastLoginAt: null
    };

    db.users.push(user);

    const referral =
      applyReferral(
        db,
        user,
        referralCode
      );

    const token =
      createSession(
        db,
        user.id
      );

    audit(
      db,
      "user_signup",
      user,
      {
        referralApplied:
          Boolean(referral)
      }
    );

    saveDB(db);

    setSessionCookie(
      res,
      token
    );

    sendJSON(
      res,
      201,
      {
        success: true,
        token,
        user:
          safeUser(user)
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // LOGIN
  // ----------------------------------------------------------

  if (
    method === "POST" &&
    pathname === "/api/auth/login"
  ) {
    let body;

    try {
      body =
        await readBody(req);
    } catch (error) {
      sendError(
        res,
        400,
        error.message
      );

      return;
    }

    const identifier =
      cleanString(
        body.username ||
        body.email ||
        body.identifier,
        100
      ).toLowerCase();

    const password =
      String(
        body.password || ""
      );

    const rateKey =
      `${
        req.socket.remoteAddress ||
        "unknown"
      }:${identifier}`;

    if (
      !checkRateLimit(
        loginAttempts,
        rateKey,
        LOGIN_WINDOW_MS,
        LOGIN_MAX_ATTEMPTS
      )
    ) {
      sendError(
        res,
        429,
        "Too many login attempts. Try again later."
      );

      return;
    }

    if (
      !identifier ||
      !password
    ) {
      sendError(
        res,
        400,
        "Username/email and password are required."
      );

      return;
    }

    const user =
      db.users.find(
        (item) =>
          normalizeUsername(
            item.username
          ) === identifier ||
          normalizeEmail(
            item.email
          ) === identifier
      );

    if (!user) {
      sendError(
        res,
        401,
        "Invalid username/email or password."
      );

      return;
    }

    const validPassword =
      await verifyPassword(
        password,
        user.passwordHash
      );

    if (!validPassword) {
      sendError(
        res,
        401,
        "Invalid username/email or password."
      );

      return;
    }

    if (
      user.status !== "active"
    ) {
      sendError(
        res,
        403,
        "This account is not active."
      );

      return;
    }

    user.lastLoginAt =
      new Date().toISOString();

    const token =
      createSession(
        db,
        user.id
      );

    audit(
      db,
      "user_login",
      user
    );

    saveDB(db);

    setSessionCookie(
      res,
      token
    );

    sendJSON(
      res,
      200,
      {
        success: true,
        token,
        user:
          safeUser(user)
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // LOGOUT
  // ----------------------------------------------------------

  if (
    method === "POST" &&
    pathname === "/api/auth/logout"
  ) {
    const sessionToken =
      getSessionToken(req);

    if (sessionToken) {
      db.sessions =
        db.sessions.filter(
          (session) =>
            session.token !==
            sessionToken
        );

      saveDB(db);
    }

    clearSessionCookie(res);

    sendJSON(
      res,
      200,
      {
        success: true
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // AUTH / ME
  // ----------------------------------------------------------

  if (
    method === "GET" &&
    pathname === "/api/auth/me"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!user) {
      sendError(
        res,
        401,
        "Not authenticated."
      );

      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        user:
          safeUser(user)
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // POINTS
  // ----------------------------------------------------------

  if (
    method === "GET" &&
    pathname === "/api/points"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!user) {
      sendError(
        res,
        401,
        "Authentication required."
      );

      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        points:
          Number(
            user.points || 0
          )
      }
    );

    return;
  }

  // ----------------------------------------------------------
  
// ============================================================
// RIZORA FEATURE LAYER
// ============================================================

if (
  method === "GET" &&
  pathname === "/api/tasks"
) {

  const user =
    getCurrentUser(db, req);

  if (!user) {
    sendError(
      res,
      401,
      "Authentication required."
    );
    return;
  }

  const cooldown =
    getCooldown(
      db,
      user.id
    );

  const tasks =
    db.tasks
      .filter(
        task =>
          task.active !== false
      )
      .map(
        task => ({
          ...task,
          completed:
            db.taskCompletions.some(
              c =>
                c.userId === user.id &&
                c.taskId === task.id
            ),
          locked:
            cooldown.active
        })
      );

  sendJSON(
    res,
    200,
    {
      success: true,
      tasks,
      cooldown,
      cooldownMinutes: 45
    }
  );

  return;
}


/* ============================================================
   COMPLETE OFFICIAL TASK
============================================================ */

if (
  method === "POST" &&
  pathname === "/api/tasks/complete"
) {

  const user =
    getCurrentUser(db, req);

  if (!user) {
    sendError(
      res,
      401,
      "Authentication required."
    );
    return;
  }

  let body = {};

  try {
    body =
      await readBody(req);
  } catch (error) {
    sendError(
      res,
      400,
      error.message
    );
    return;
  }

  const taskId =
    cleanString(
      body.taskId ||
      body.id,
      100
    );

  const task =
    db.tasks.find(
      x =>
        x.id === taskId &&
        x.active !== false
    );

  if (!task) {
    sendError(
      res,
      404,
      "Task not found."
    );
    return;
  }

  const cooldown =
    getCooldown(
      db,
      user.id
    );

  if (cooldown.active) {
    sendJSON(
      res,
      429,
      {
        error:
          "Your next RIZORA task is still on cooldown.",
        cooldown,
        cooldownMinutes: 45
      }
    );
    return;
  }

  const already =
    db.taskCompletions.some(
      c =>
        c.userId === user.id &&
        c.taskId === task.id
    );

  if (already) {
    sendError(
      res,
      409,
      "Task already completed."
    );
    return;
  }

  const reward =
    Math.max(
      0,
      Number(
        task.points ||
        task.reward ||
        0
      )
    );

  const completion = {
    id:
      uid("completion_"),
    userId:
      user.id,
    taskId:
      task.id,
    points:
      reward,
    completedAt:
      new Date().toISOString()
  };

  db.taskCompletions.push(
    completion
  );

  user.points =
    Number(user.points || 0) +
    reward;

  addLedger(
    db,
    user.id,
    "task_reward",
    reward,
    {
      taskId:
        task.id
    }
  );

  const nextTaskAt =
    startCooldown(
      db,
      user.id,
      task.id
    );

  audit(
    db,
    "task_completed",
    user,
    {
      taskId:
        task.id,
      points:
        reward
    }
  );

  saveDB(db);

  sendJSON(
    res,
    200,
    {
      success: true,
      completion,
      reward,
      points:
        user.points,
      nextTaskAt,
      cooldownMinutes: 45,
      cooldown:
        getCooldown(
          db,
          user.id
        ),
      user:
        safeUser(user)
    }
  );

  return;
}


/* ============================================================
   BOOSTS — AVAILABLE
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/boosts"
) {

  const user =
    getCurrentUser(db, req);

  if (!user) {
    sendError(
      res,
      401,
      "Authentication required."
    );
    return;
  }

  const cooldown =
    getCooldown(
      db,
      user.id
    );

  const boosts =
    (db.boostTasks || [])
      .filter(
        b =>
          b.status === "active" &&
          b.ownerId !== user.id &&
          Number(b.remaining || 0) > 0 &&
          !(db.boostCompletions || [])
            .some(
              c =>
                c.userId === user.id &&
                c.boostId === b.id
            )
      );

  sendJSON(
    res,
    200,
    {
      success: true,
      boosts,
      cooldown
    }
  );

  return;
}


/* ============================================================
   BOOSTS — CREATE
============================================================ */

if (
  method === "POST" &&
  pathname === "/api/boosts/create"
) {

  const user =
    getCurrentUser(db, req);

  if (!user) {
    sendError(
      res,
      401,
      "Authentication required."
    );
    return;
  }

  let body = {};

  try {
    body =
      await readBody(req);
  } catch (error) {
    sendError(
      res,
      400,
      error.message
    );
    return;
  }

  const platforms = [
    "tiktok",
    "instagram",
    "x",
    "youtube",
    "spotify",
    "facebook"
  ];

  const actions = [
    "follow",
    "like",
    "subscribe",
    "view"
  ];

  const platform =
    cleanString(
      body.platform,
      30
    ).toLowerCase();

  const action =
    cleanString(
      body.action,
      30
    ).toLowerCase();

  const username =
    cleanString(
      body.username,
      100
    );

  const url =
    validURL(body.url);

  const reward =
    Math.floor(
      Number(body.reward)
    );

  const quantity =
    Math.floor(
      Number(
        body.maxCompletions
      )
    );

  if (!platforms.includes(platform)) {
    sendError(
      res,
      400,
      "Invalid platform."
    );
    return;
  }

  if (!actions.includes(action)) {
    sendError(
      res,
      400,
      "Invalid action."
    );
    return;
  }

  if (!username || !url) {
    sendError(
      res,
      400,
      "Username and valid URL are required."
    );
    return;
  }

  if (
    !Number.isFinite(reward) ||
    reward < 1 ||
    reward > 10000
  ) {
    sendError(
      res,
      400,
      "Reward must be between 1 and 10000."
    );
    return;
  }

  if (
    !Number.isFinite(quantity) ||
    quantity < 1 ||
    quantity > 10000
  ) {
    sendError(
      res,
      400,
      "Completion count must be between 1 and 10000."
    );
    return;
  }

  const budget =
    reward * quantity;

  if (
    Number(user.points || 0) <
    budget
  ) {
    sendError(
      res,
      400,
      "Not enough RIZORA points."
    );
    return;
  }

  user.points =
    Number(user.points || 0) -
    budget;

  db.boostTasks ||= [];

  const boost = {
    id:
      uid("boost_"),
    ownerId:
      user.id,
    ownerUsername:
      user.username,
    platform,
    action,
    username,
    url,
    reward,
    maxCompletions:
      quantity,
    completedCount:
      0,
    remaining:
      quantity,
    totalBudget:
      budget,
    status:
      "active",
    createdAt:
      new Date().toISOString()
  };

  db.boostTasks.push(
    boost
  );

  addLedger(
    db,
    user.id,
    "boost_fund",
    -budget,
    {
      boostId:
        boost.id
    }
  );

  audit(
    db,
    "boost_created",
    user,
    {
      boostId:
        boost.id,
      budget
    }
  );

  saveDB(db);

  sendJSON(
    res,
    201,
    {
      success: true,
      boost,
      totalBudget:
        budget,
      user:
        safeUser(user)
    }
  );

  return;
}


/* ============================================================
   BOOSTS — COMPLETE
============================================================ */

if (
  method === "POST" &&
  pathname === "/api/boosts/complete"
) {

  const user =
    getCurrentUser(db, req);

  if (!user) {
    sendError(
      res,
      401,
      "Authentication required."
    );
    return;
  }

  let body = {};

  try {
    body =
      await readBody(req);
  } catch (error) {
    sendError(
      res,
      400,
      error.message
    );
    return;
  }

  const boostId =
    cleanString(
      body.boostId ||
      body.id,
      100
    );

  const boost =
    (db.boostTasks || [])
      .find(
        b =>
          b.id === boostId &&
          b.status === "active"
      );

  if (!boost) {
    sendError(
      res,
      404,
      "Boost not found."
    );
    return;
  }

  if (
    boost.ownerId === user.id
  ) {
    sendError(
      res,
      403,
      "You cannot complete your own boost."
    );
    return;
  }

  const cooldown =
    getCooldown(
      db,
      user.id
    );

  if (cooldown.active) {
    sendJSON(
      res,
      429,
      {
        error:
          "Your next task is still on cooldown.",
        cooldown,
        cooldownMinutes: 45
      }
    );
    return;
  }

  db.boostCompletions ||= [];

  const duplicate =
    db.boostCompletions.some(
      c =>
        c.userId === user.id &&
        c.boostId === boost.id
    );

  if (duplicate) {
    sendError(
      res,
      409,
      "You already completed this boost."
    );
    return;
  }

  if (
    Number(boost.remaining || 0) <= 0
  ) {
    boost.status =
      "completed";

    saveDB(db);

    sendError(
      res,
      409,
      "Boost already completed."
    );
    return;
  }

  const reward =
    Math.max(
      1,
      Number(boost.reward || 0)
    );

  db.boostCompletions.push({
    id:
      uid("boost_completion_"),
    boostId:
      boost.id,
    userId:
      user.id,
    reward,
    completedAt:
      new Date().toISOString()
  });

  boost.completedCount =
    Number(
      boost.completedCount || 0
    ) + 1;

  boost.remaining =
    Math.max(
      0,
      Number(
        boost.maxCompletions || 0
      ) -
      boost.completedCount
    );

  if (
    boost.remaining === 0
  ) {
    boost.status =
      "completed";
  }

  user.points =
    Number(user.points || 0) +
    reward;

  addLedger(
    db,
    user.id,
    "boost_reward",
    reward,
    {
      boostId:
        boost.id
    }
  );

  const nextTaskAt =
    startCooldown(
      db,
      user.id,
      boost.id
    );

  audit(
    db,
    "boost_completed",
    user,
    {
      boostId:
        boost.id,
      reward
    }
  );

  saveDB(db);

  sendJSON(
    res,
    200,
    {
      success: true,
      reward,
      points:
        user.points,
      nextTaskAt,
      cooldownMinutes: 45,
      cooldown:
        getCooldown(
          db,
          user.id
        ),
      user:
        safeUser(user)
    }
  );

  return;
}


/* ============================================================
   RIZORA AI
============================================================ */

if (
  method === "POST" &&
  pathname === "/api/ai/chat"
) {

  const user =
    getCurrentUser(db, req);

  if (!user) {
    sendError(
      res,
      401,
      "Authentication required."
    );
    return;
  }

  let body = {};

  try {
    body =
      await readBody(req);
  } catch (error) {
    sendError(
      res,
      400,
      error.message
    );
    return;
  }

  const message =
    cleanString(
      body.message,
      4000
    );

  if (!message) {
    sendError(
      res,
      400,
      "Message required."
    );
    return;
  }

  const apiKey =
    String(
      process.env.OPENAI_API_KEY || ""
    ).trim();

  if (!apiKey) {

    const q =
      message.toLowerCase();

    let reply =
      "RIZORA AI: ";

    if (
      q.includes("caption")
    ) {
      reply +=
        "Give me your topic and vibe and I will build a stronger caption.";
    } else if (
      q.includes("idea")
    ) {
      reply +=
        "Try a behind-the-scenes post, opinion, tutorial, before/after or story-led post.";
    } else if (
      q.includes("growth") ||
      q.includes("followers")
    ) {
      reply +=
        "Build around a clear niche, strong hooks, consistency and formats that hold attention.";
    } else if (
      q.includes("boost")
    ) {
      reply +=
        "Choose one clear social action, add the target URL, set the reward and fund the completion budget.";
    } else {
      reply +=
        "I can help with captions, hooks, ideas, creator growth and RIZORA boosts.";
    }

    sendJSON(
      res,
      200,
      {
        success:
          true,
        mode:
          "local",
        reply
      }
    );

    return;
  }

  try {

    const response =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method:
            "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              "Bearer " +
              apiKey
          },
          body:
            JSON.stringify({
              model:
                process.env.RIZORA_AI_MODEL ||
                "gpt-5.6-luna",
              input: [
                {
                  role:
                    "system",
                  content: [
                    {
                      type:
                        "input_text",
                      text:
                        "You are RIZORA AI, the built-in creator-growth assistant. Help with content ideas, captions, hooks, creator strategy, profile improvement and RIZORA boosting. Be practical and concise. Never request passwords or secrets."
                    }
                  ]
                },
                {
                  role:
                    "user",
                  content: [
                    {
                      type:
                        "input_text",
                      text:
                        message
                    }
                  ]
                }
              ]
            })
        }
      );

    const data =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (!response.ok) {
      sendError(
        res,
        502,
        "RIZORA AI provider error."
      );
      return;
    }

    sendJSON(
      res,
      200,
      {
        success:
          true,
        mode:
          "openai",
        reply:
          data.output_text ||
          "RIZORA AI returned no response."
      }
    );

  } catch (error) {

    sendError(
      res,
      502,
      "RIZORA AI is temporarily unavailable."
    );

  }

  return;
}


/* ============================================================
   SEARCH ENGINE
============================================================ */

if (
  method === "GET" &&
  pathname === "/robots.txt"
) {

  const base =
    getPublicBaseURL(req);

  res.writeHead(
    200,
    {
      "Content-Type":
        "text/plain; charset=utf-8"
    }
  );

  res.end(
    "User-agent: *\n" +
    "Allow: /\n\n" +
    "Sitemap: " +
    base +
    "/sitemap.xml\n"
  );

  return;
}

if (
  method === "GET" &&
  pathname === "/sitemap.xml"
) {

  const base =
    getPublicBaseURL(req);

  const pages = [
    "/",
    "/about",
    "/login",
    "/signup"
  ];

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    pages.map(
      p =>
        "<url><loc>" +
        base +
        p +
        "</loc></url>"
    ).join("") +
    "</urlset>";

  res.writeHead(
    200,
    {
      "Content-Type":
        "application/xml; charset=utf-8"
    }
  );

  res.end(xml);

  return;
}

// REFERRALS — ME
  // ----------------------------------------------------------

  if (
    method === "GET" &&
    pathname === "/api/referrals/me"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!user) {
      sendError(
        res,
        401,
        "Authentication required."
      );

      return;
    }

    const referrals =
      db.referrals.filter(
        (referral) =>
          referral.referrerId === user.id
      );

    const referralCode =
      user.referralCode || "";

    const baseURL =
      getPublicBaseURL(req);

    const referralLink =
      referralCode
        ? `${baseURL}/?ref=${encodeURIComponent(
            referralCode
          )}`
        : "";

    const referralPoints =
      referrals.reduce(
        (total, referral) =>
          total +
          Number(
            referral.reward || 0
          ),
        0
      );

    sendJSON(
      res,
      200,
      {
        success: true,

        referralCode,

        referralLink,

        count:
          Number(
            user.referralCount || 0
          ),

        referralCount:
          Number(
            user.referralCount || 0
          ),

        points:
          referralPoints,

        referrals
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // ROMI PROFILE
  // ----------------------------------------------------------

  if (
    method === "GET" &&
    pathname === "/api/romi/profile"
  ) {
    sendJSON(
      res,
      200,
      {
        success: true,
        profile: {
          username: "romi",
          displayName: "Romi",
          platform: "RIZORA",
          creator: true,
          tiktok:
            "https://www.tiktok.com/@romi.noir"
        }
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // CREATOR TOOLS
  // Supports GET and POST
  // ----------------------------------------------------------

  if (
    (
      method === "GET" ||
      method === "POST"
    ) &&
    pathname === "/api/generate/hooks"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!user) {
      sendError(
        res,
        401,
        "Authentication required."
      );

      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        hooks:
          randomItems(
            HOOKS,
            5
          )
      }
    );

    return;
  }

  if (
    (
      method === "GET" ||
      method === "POST"
    ) &&
    pathname === "/api/generate/hashtags"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!user) {
      sendError(
        res,
        401,
        "Authentication required."
      );

      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        hashtags:
          randomItems(
            HASHTAGS,
            8
          )
      }
    );

    return;
  }

  if (
    (
      method === "GET" ||
      method === "POST"
    ) &&
    pathname === "/api/generate/captions"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!user) {
      sendError(
        res,
        401,
        "Authentication required."
      );

      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        captions:
          randomItems(
            CAPTIONS,
            5
          )
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // ADMIN — STATS
  // ----------------------------------------------------------

  if (
    method === "GET" &&
    pathname === "/api/admin/stats"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireAdmin(
      res,
      user
    )) {
      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        stats:
          getAdminStats(db)
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // ADMIN — USERS
  // ----------------------------------------------------------

  if (
    method === "GET" &&
    pathname === "/api/admin/users"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireAdmin(
      res,
      user
    )) {
      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        users:
          db.users.map(
            safeUser
          )
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // ADMIN — REFERRALS
  // ----------------------------------------------------------

  if (
    method === "GET" &&
    pathname === "/api/admin/referrals"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireAdmin(
      res,
      user
    )) {
      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        referrals:
          db.referrals
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // ADMIN — AUDIT
  // ----------------------------------------------------------

  if (
    method === "GET" &&
    pathname === "/api/admin/audit"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireAdmin(
      res,
      user
    )) {
      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        logs:
          db.auditLogs
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // ADMIN — TASKS
  // ----------------------------------------------------------

  if (
    method === "GET" &&
    pathname === "/api/admin/tasks"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireAdmin(
      res,
      user
    )) {
      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        tasks:
          db.tasks
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // ADMIN — CHANGE ROLE
  // ----------------------------------------------------------

  if (
    method === "POST" &&
    pathname === "/api/admin/users/role"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireSuperAdmin(
      res,
      user
    )) {
      return;
    }

    let body;

    try {
      body =
        await readBody(req);
    } catch (error) {
      sendError(
        res,
        400,
        error.message
      );

      return;
    }

    const userId =
      cleanString(
        body.userId,
        100
      );

    const role =
      cleanString(
        body.role,
        50
      );

    if (
      ![
        "user",
        "admin",
        "super_admin"
      ].includes(role)
    ) {
      sendError(
        res,
        400,
        "Invalid role."
      );

      return;
    }

    const target =
      db.users.find(
        (item) =>
          item.id === userId
      );

    if (!target) {
      sendError(
        res,
        404,
        "User not found."
      );

      return;
    }

    if (
      SUPER_ADMINS.has(
        normalizeUsername(
          target.username
        )
      ) &&
      role !== "super_admin"
    ) {
      sendError(
        res,
        403,
        "Protected super admin cannot be demoted."
      );

      return;
    }

    target.role = role;

    audit(
      db,
      "role_changed",
      user,
      {
        targetUserId:
          target.id,

        targetUsername:
          target.username,

        role
      }
    );

    saveDB(db);

    sendJSON(
      res,
      200,
      {
        success: true,
        user:
          safeUser(target)
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // ADMIN — CHANGE STATUS
  // ----------------------------------------------------------

  if (
    method === "POST" &&
    pathname === "/api/admin/users/status"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireSuperAdmin(
      res,
      user
    )) {
      return;
    }

    let body;

    try {
      body =
        await readBody(req);
    } catch (error) {
      sendError(
        res,
        400,
        error.message
      );

      return;
    }

    const userId =
      cleanString(
        body.userId,
        100
      );

    const status =
      cleanString(
        body.status,
        50
      );

    if (
      ![
        "active",
        "blocked"
      ].includes(status)
    ) {
      sendError(
        res,
        400,
        "Invalid status."
      );

      return;
    }

    const target =
      db.users.find(
        (item) =>
          item.id === userId
      );

    if (!target) {
      sendError(
        res,
        404,
        "User not found."
      );

      return;
    }

    if (
      SUPER_ADMINS.has(
        normalizeUsername(
          target.username
        )
      ) &&
      status !== "active"
    ) {
      sendError(
        res,
        403,
        "Protected super admin cannot be blocked."
      );

      return;
    }

    target.status =
      status;

    audit(
      db,
      "user_status_changed",
      user,
      {
        targetUserId:
          target.id,

        targetUsername:
          target.username,

        status
      }
    );

    saveDB(db);

    sendJSON(
      res,
      200,
      {
        success: true,
        user:
          safeUser(target)
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // ADMIN — POINTS
  // ----------------------------------------------------------

  if (
    method === "POST" &&
    pathname === "/api/admin/users/points"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireSuperAdmin(
      res,
      user
    )) {
      return;
    }

    let body;

    try {
      body =
        await readBody(req);
    } catch (error) {
      sendError(
        res,
        400,
        error.message
      );

      return;
    }

    const userId =
      cleanString(
        body.userId,
        100
      );

    const amount =
      Number(
        body.amount ??
        body.points
      );

    if (
      !Number.isFinite(amount)
    ) {
      sendError(
        res,
        400,
        "Invalid points amount."
      );

      return;
    }

    const target =
      db.users.find(
        (item) =>
          item.id === userId
      );

    if (!target) {
      sendError(
        res,
        404,
        "User not found."
      );

      return;
    }

    target.points =
      Math.max(
        0,
        Number(
          target.points || 0
        ) + amount
      );

    audit(
      db,
      "points_changed",
      user,
      {
        targetUserId:
          target.id,

        targetUsername:
          target.username,

        amount
      }
    );

    saveDB(db);

    sendJSON(
      res,
      200,
      {
        success: true,
        user:
          safeUser(target)
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // SUPER ADMIN — DASHBOARD
  // ----------------------------------------------------------

  if (
    method === "GET" &&
    pathname === "/api/superadmin/dashboard"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireSuperAdmin(
      res,
      user
    )) {
      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        stats:
          getAdminStats(db),

        users:
          db.users.map(
            safeUser
          ),

        tasks:
          db.tasks,

        referrals:
          db.referrals,

        audit:
          db.auditLogs.slice(
            0,
            200
          )
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // SUPER ADMIN — USERS
  // ----------------------------------------------------------

  if (
    method === "GET" &&
    pathname === "/api/superadmin/users"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireSuperAdmin(
      res,
      user
    )) {
      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        users:
          db.users.map(
            safeUser
          )
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // SUPER ADMIN — AUDIT
  // ----------------------------------------------------------

  if (
    method === "GET" &&
    pathname === "/api/superadmin/audit"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireSuperAdmin(
      res,
      user
    )) {
      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        logs:
          db.auditLogs
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // SUPER ADMIN — REFERRALS
  // ----------------------------------------------------------

  if (
    method === "GET" &&
    pathname === "/api/superadmin/referrals"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireSuperAdmin(
      res,
      user
    )) {
      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        referrals:
          db.referrals
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // SUPER ADMIN — ROLE
  // ----------------------------------------------------------

  if (
    method === "POST" &&
    pathname === "/api/superadmin/users/role"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireSuperAdmin(
      res,
      user
    )) {
      return;
    }

    let body;

    try {
      body =
        await readBody(req);
    } catch (error) {
      sendError(
        res,
        400,
        error.message
      );

      return;
    }

    const userId =
      cleanString(
        body.userId,
        100
      );

    const role =
      cleanString(
        body.role,
        50
      );

    if (
      ![
        "user",
        "admin",
        "super_admin"
      ].includes(role)
    ) {
      sendError(
        res,
        400,
        "Invalid role."
      );

      return;
    }

    const target =
      db.users.find(
        (item) =>
          item.id === userId
      );

    if (!target) {
      sendError(
        res,
        404,
        "User not found."
      );

      return;
    }

    if (
      SUPER_ADMINS.has(
        normalizeUsername(
          target.username
        )
      ) &&
      role !== "super_admin"
    ) {
      sendError(
        res,
        403,
        "Protected super admin cannot be demoted."
      );

      return;
    }

    target.role = role;

    audit(
      db,
      "superadmin_role_changed",
      user,
      {
        targetUserId:
          target.id,

        role
      }
    );

    saveDB(db);

    sendJSON(
      res,
      200,
      {
        success: true,
        user:
          safeUser(target)
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // SUPER ADMIN — STATUS
  // ----------------------------------------------------------

  if (
    method === "POST" &&
    pathname === "/api/superadmin/users/status"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireSuperAdmin(
      res,
      user
    )) {
      return;
    }

    let body;

    try {
      body =
        await readBody(req);
    } catch (error) {
      sendError(
        res,
        400,
        error.message
      );

      return;
    }

    const userId =
      cleanString(
        body.userId,
        100
      );

    const status =
      cleanString(
        body.status,
        50
      );

    if (
      ![
        "active",
        "blocked"
      ].includes(status)
    ) {
      sendError(
        res,
        400,
        "Invalid status."
      );

      return;
    }

    const target =
      db.users.find(
        (item) =>
          item.id === userId
      );

    if (!target) {
      sendError(
        res,
        404,
        "User not found."
      );

      return;
    }

    if (
      SUPER_ADMINS.has(
        normalizeUsername(
          target.username
        )
      ) &&
      status !== "active"
    ) {
      sendError(
        res,
        403,
        "Protected super admin cannot be blocked."
      );

      return;
    }

    target.status =
      status;

    audit(
      db,
      "superadmin_status_changed",
      user,
      {
        targetUserId:
          target.id,

        status
      }
    );

    saveDB(db);

    sendJSON(
      res,
      200,
      {
        success: true,
        user:
          safeUser(target)
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // SUPER ADMIN — POINTS
  // ----------------------------------------------------------

  if (
    method === "POST" &&
    pathname === "/api/superadmin/users/points"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireSuperAdmin(
      res,
      user
    )) {
      return;
    }

    let body;

    try {
      body =
        await readBody(req);
    } catch (error) {
      sendError(
        res,
        400,
        error.message
      );

      return;
    }

    const userId =
      cleanString(
        body.userId,
        100
      );

    const amount =
      Number(
        body.amount ??
        body.points
      );

    if (
      !Number.isFinite(amount)
    ) {
      sendError(
        res,
        400,
        "Invalid points amount."
      );

      return;
    }

    const target =
      db.users.find(
        (item) =>
          item.id === userId
      );

    if (!target) {
      sendError(
        res,
        404,
        "User not found."
      );

      return;
    }

    target.points =
      Math.max(
        0,
        Number(
          target.points || 0
        ) + amount
      );

    audit(
      db,
      "superadmin_points_changed",
      user,
      {
        targetUserId:
          target.id,

        amount
      }
    );

    saveDB(db);

    sendJSON(
      res,
      200,
      {
        success: true,
        user:
          safeUser(target)
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // SUPER ADMIN — TASKS
  // ----------------------------------------------------------

  if (
    method === "GET" &&
    pathname === "/api/superadmin/tasks"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireSuperAdmin(
      res,
      user
    )) {
      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        tasks:
          db.tasks
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // SUPER ADMIN — TASK STATUS
  // ----------------------------------------------------------

  if (
    method === "POST" &&
    pathname === "/api/superadmin/tasks/status"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireSuperAdmin(
      res,
      user
    )) {
      return;
    }

    let body;

    try {
      body =
        await readBody(req);
    } catch (error) {
      sendError(
        res,
        400,
        error.message
      );

      return;
    }

    const taskId =
      cleanString(
        body.taskId,
        100
      );

    const active =
      Boolean(
        body.active
      );

    const task =
      db.tasks.find(
        (item) =>
          item.id === taskId
      );

    if (!task) {
      sendError(
        res,
        404,
        "Task not found."
      );

      return;
    }

    task.active =
      active;

    audit(
      db,
      "task_status_changed",
      user,
      {
        taskId,
        active
      }
    );

    saveDB(db);

    sendJSON(
      res,
      200,
      {
        success: true,
        task
      }
    );

    return;
  }

  // ----------------------------------------------------------
  // SUPER ADMIN — TASK LIST
  // ----------------------------------------------------------

  if (
    method === "POST" &&
    pathname === "/api/superadmin/tasks/list"
  ) {
    const user =
      getCurrentUser(
        db,
        req
      );

    if (!requireSuperAdmin(
      res,
      user
    )) {
      return;
    }

    sendJSON(
      res,
      200,
      {
        success: true,
        tasks:
          db.tasks
      }
    );

    return;
  }


/* ============================================================
   RIZORA CREATOR INTELLIGENCE
============================================================ */

function creatorProfileFor(db, userId) {
  db.creatorProfiles ||= {};

  if (!db.creatorProfiles[userId]) {
    db.creatorProfiles[userId] = {
      niche: "",
      platforms: [],
      goals: [],
      bio: "",
      strengths: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  return db.creatorProfiles[userId];
}

function creatorAnalyticsFor(db, userId) {
  db.analytics ||= {};

  if (!db.analytics[userId]) {
    db.analytics[userId] = {
      posts: [],
      scores: [],
      ideasGenerated: 0
    };
  }

  return db.analytics[userId];
}

function analyzeCreatorPost(body = {}) {
  const hook = cleanString(body.hook, 1000);
  const caption = cleanString(body.caption, 3000);
  const hashtags = cleanString(body.hashtags, 1500);
  const topic = cleanString(body.topic, 300);

  let hookScore = 45;
  let captionScore = 45;
  let hashtagScore = 45;
  let clarityScore = 45;
  let engagementScore = 45;

  if (hook.length >= 15 && hook.length <= 90) hookScore += 15;
  if (/[?!]/.test(hook)) hookScore += 8;
  if (/\b(secret|truth|mistake|why|how|before|after|nobody|stop|wait|pov)\b/i.test(hook)) hookScore += 15;
  if (/\b(you|your)\b/i.test(hook)) hookScore += 7;

  if (caption.length >= 30 && caption.length <= 500) captionScore += 20;
  if (caption.includes("\n") || caption.length > 80) captionScore += 10;

  const tagList = hashtags
    .split(/[,\s]+/)
    .map(x => x.trim())
    .filter(Boolean);

  if (tagList.length >= 3 && tagList.length <= 8) hashtagScore += 25;
  if (tagList.length > 10) hashtagScore -= 20;

  const totalText = `${topic} ${hook} ${caption}`.trim();

  if (totalText.length >= 40) clarityScore += 20;
  if (/\b(follow|comment|save|share|tell me|what do you think)\b/i.test(totalText)) {
    engagementScore += 30;
  }

  hookScore = Math.max(0, Math.min(100, hookScore));
  captionScore = Math.max(0, Math.min(100, captionScore));
  hashtagScore = Math.max(0, Math.min(100, hashtagScore));
  clarityScore = Math.max(0, Math.min(100, clarityScore));
  engagementScore = Math.max(0, Math.min(100, engagementScore));

  const score = Math.round(
    hookScore * 0.30 +
    captionScore * 0.20 +
    hashtagScore * 0.15 +
    clarityScore * 0.15 +
    engagementScore * 0.20
  );

  const improvements = [];

  if (hookScore < 70) improvements.push("Make the opening more curiosity-driven.");
  if (captionScore < 70) improvements.push("Give the caption a clearer reason to keep reading.");
  if (hashtagScore < 70) improvements.push("Use a smaller, more focused hashtag mix.");
  if (clarityScore < 70) improvements.push("Make the message easier to understand quickly.");
  if (engagementScore < 70) improvements.push("Add a simple interaction prompt.");

  let rating = "Needs Work";
  if (score >= 90) rating = "Elite";
  else if (score >= 80) rating = "Strong";
  else if (score >= 70) rating = "Promising";
  else if (score >= 60) rating = "Needs polish";

  return {
    score,
    rating,
    componentScores: {
      hook: hookScore,
      caption: captionScore,
      hashtags: hashtagScore,
      clarity: clarityScore,
      engagement: engagementScore
    },
    improvements
  };
}

function generateCreatorIdeas(niche = "content") {
  return [
    `3 things I wish I knew about ${niche}.`,
    `Before vs after: ${niche}.`,
    `A hot take about ${niche}.`,
    `A common misconception about ${niche}.`,
    `Beginner vs expert: ${niche}.`,
    `Behind the scenes of my ${niche} process.`,
    `Answer the most common ${niche} question.`,
    `React to a trending ${niche} topic.`,
    `Tell a short story about ${niche}.`,
    `Things nobody tells you about ${niche}.`
  ];
}

/* ============================================================
   CREATOR PROFILE
============================================================ */

if (
  (method === "GET" || method === "POST") &&
  pathname === "/api/creator/profile"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  if (method === "GET") {
    sendJSON(res, 200, {
      success: true,
      profile: creatorProfileFor(db, user.id)
    });
    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(res, 400, error.message);
    return;
  }

  const profile = creatorProfileFor(db, user.id);

  profile.niche = cleanString(body.niche, 120);
  profile.platforms = Array.isArray(body.platforms)
    ? body.platforms.slice(0, 10).map(x => cleanString(x, 30))
    : [];
  profile.goals = Array.isArray(body.goals)
    ? body.goals.slice(0, 10).map(x => cleanString(x, 80))
    : [];
  profile.bio = cleanString(body.bio, 500);
  profile.updatedAt = new Date().toISOString();

  saveDB(db);

  sendJSON(res, 200, {
    success: true,
    profile
  });

  return;
}

/* ============================================================
   CREATOR ANALYTICS
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/creator/analytics"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  const analytics = creatorAnalyticsFor(db, user.id);

  const scores = Array.isArray(analytics.scores)
    ? analytics.scores
    : [];

  const averageScore = scores.length
    ? Math.round(
        scores.reduce((a, b) => a + Number(b.score || 0), 0) /
        scores.length
      )
    : 0;

  const bestScore = scores.length
    ? Math.max(...scores.map(x => Number(x.score || 0)))
    : 0;

  sendJSON(res, 200, {
    success: true,
    posts: analytics.posts || [],
    scores,
    ideasGenerated: Number(analytics.ideasGenerated || 0),
    averageScore,
    bestScore,
    totalPosts: analytics.posts?.length || 0
  });

  return;
}

/* ============================================================
   POST ANALYSIS
============================================================ */

if (
  method === "POST" &&
  pathname === "/api/creator/analyze"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(res, 400, error.message);
    return;
  }

  const result = analyzeCreatorPost(body);
  const analytics = creatorAnalyticsFor(db, user.id);

  analytics.scores.push({
    id: uid("score_"),
    score: result.score,
    rating: result.rating,
    createdAt: new Date().toISOString()
  });

  if (analytics.scores.length > 100) {
    analytics.scores = analytics.scores.slice(-100);
  }

  saveDB(db);

  sendJSON(res, 200, {
    success: true,
    ...result
  });

  return;
}

/* ============================================================
   IDEAS
============================================================ */

if (
  method === "POST" &&
  pathname === "/api/creator/ideas"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(res, 400, error.message);
    return;
  }

  const ideas = generateCreatorIdeas(
    cleanString(body.niche, 120) || "content"
  );

  const analytics = creatorAnalyticsFor(db, user.id);

  analytics.ideasGenerated =
    Number(analytics.ideasGenerated || 0) + ideas.length;

  saveDB(db);

  sendJSON(res, 200, {
    success: true,
    ideas
  });

  return;
}

/* ============================================================
   LEADERBOARD
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/leaderboard"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  const leaderboard = [...db.users]
    .filter(x => x.status === "active")
    .sort((a, b) =>
      Number(b.points || 0) -
      Number(a.points || 0)
    )
    .slice(0, 50)
    .map((item, index) => ({
      rank: index + 1,
      username: item.username,
      displayName: item.displayName || item.username,
      points: Number(item.points || 0)
    }));

  sendJSON(res, 200, {
    success: true,
    leaderboard
  });

  return;
}

/* ============================================================
   COMMUNITY
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/community"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  db.communityPosts ||= [];

  sendJSON(res, 200, {
    success: true,
    posts: db.communityPosts
      .slice()
      .reverse()
      .slice(0, 50)
  });

  return;
}

if (
  method === "POST" &&
  pathname === "/api/community"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(res, 400, error.message);
    return;
  }

  const text = cleanString(body.text, 500);

  if (!text) {
    sendError(res, 400, "Community message required.");
    return;
  }

  db.communityPosts ||= [];

  const post = {
    id: uid("community_"),
    userId: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    text,
    createdAt: new Date().toISOString()
  };

  db.communityPosts.push(post);

  if (db.communityPosts.length > 500) {
    db.communityPosts =
      db.communityPosts.slice(-500);
  }

  saveDB(db);

  sendJSON(res, 201, {
    success: true,
    post
  });

  return;
}

/* ============================================================
   EXPERIMENT LAB
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/experiments"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  db.experiments ||= [];

  sendJSON(res, 200, {
    success: true,
    experiments:
      db.experiments
        .filter(x => x.userId === user.id)
        .reverse()
        .slice(0, 50)
  });

  return;
}

if (
  method === "POST" &&
  pathname === "/api/experiments"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(res, 400, error.message);
    return;
  }

  const experiment = {
    id: uid("experiment_"),
    userId: user.id,
    name: cleanString(body.name, 120) || "New experiment",
    hookA: cleanString(body.hookA, 500),
    hookB: cleanString(body.hookB, 500),
    notes: cleanString(body.notes, 1000),
    createdAt: new Date().toISOString()
  };

  db.experiments ||= [];
  db.experiments.push(experiment);

  saveDB(db);

  sendJSON(res, 201, {
    success: true,
    experiment
  });

  return;
}

/* ============================================================
   HISTORY
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/history"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  const ledger =
    (db.pointsLedger || [])
      .filter(x => x.userId === user.id)
      .slice()
      .reverse()
      .slice(0, 100);

  const scores =
    (creatorAnalyticsFor(db, user.id).scores || [])
      .slice()
      .reverse()
      .slice(0, 50)
      .map(x => ({
        type: "content_score",
        amount: x.score,
        details: {
          rating: x.rating
        },
        createdAt: x.createdAt
      }));

  sendJSON(res, 200, {
    success: true,
    history: [
      ...ledger.map(x => ({
        type: x.type,
        amount: x.amount,
        details: x.details || {},
        createdAt: x.createdAt
      })),
      ...scores
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime()
    )
  });

  return;
}

/* ============================================================
   SETTINGS
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/settings"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  db.userSettings ||= {};

  sendJSON(res, 200, {
    success: true,
    settings:
      db.userSettings[user.id] || {
        notifications: true,
        compactMode: false
      }
  });

  return;
}

if (
  method === "POST" &&
  pathname === "/api/settings"
) {
  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(res, 400, error.message);
    return;
  }

  db.userSettings ||= {};

  db.userSettings[user.id] = {
    notifications: Boolean(body.notifications),
    compactMode: Boolean(body.compactMode)
  };

  saveDB(db);

  sendJSON(res, 200, {
    success: true,
    settings:
      db.userSettings[user.id]
  });

  return;
}

  // ----------------------------------------------------------
  // STATIC FRONTEND
  // ----------------------------------------------------------

  serveStatic(
    req,
    res,
    pathname
  );
}


// ============================================================
// GLOBAL ERROR HANDLING
// ============================================================

async function requestHandler(
  req,
  res
) {
  try {

    await handleRequest(
      req,
      res
    );

  } catch (error) {

    console.error(
      "Request error:",
      error
    );

    if (!res.headersSent) {

      sendError(
        res,
        500,
        "Internal server error."
      );

    } else {

      res.end();

    }
  }
}


// ============================================================
// INITIAL SEEDING
// ============================================================

function seedDatabase() {
  const db = loadDB();

  seedTasks(db);

  let changed = false;

  for (
    const username of
    SUPER_ADMINS
  ) {

    let user =
      db.users.find(
        (item) =>
          normalizeUsername(
            item.username
          ) === username
      );

    if (!user) {

      console.log(
        `Super admin account "${username}" does not exist yet.`
      );

      continue;
    }

    if (
      user.role !==
      "super_admin"
    ) {
      user.role =
        "super_admin";

      changed = true;
    }

    if (
      user.status !==
      "active"
    ) {
      user.status =
        "active";

      changed = true;
    }

    if (!user.referralCode) {

      user.referralCode =
        randomReferralCode(
          user.username
        );

      changed = true;
    }
  }

  cleanupSessions(db);

  if (changed) {
    saveDB(db);
  } else {
    saveDB(db);
  }
}


// ============================================================
// START SERVER
// ============================================================

ensureDatabase();
seedDatabase();

const server =
  http.createServer(
    requestHandler
  );

server.on(
  "error",
  (error) => {
    console.error(
      "Server error:",
      error
    );
  }
);

server.listen(
  PORT,
  HOST,
  () => {

    console.log("");
    console.log(
      "=========================================="
    );
    console.log(
      "           RIZORA BACKEND"
    );
    console.log(
      "=========================================="
    );
    console.log(
      "Version:  8.1.0"
    );
    console.log(
      `Server:   http://${HOST}:${PORT}`
    );
    console.log(
      `DB:       ${DB_FILE}`
    );
    console.log(
      "Status:   ONLINE"
    );
    console.log(
      "=========================================="
    );
    console.log("");
  }
);


// ============================================================
// SHUTDOWN
// ============================================================

function shutdown(signal) {

  console.log(
    `\n${signal} received. Shutting down...`
  );

  server.close(
    () => {

      console.log(
        "RIZORA server stopped."
      );

      process.exit(0);
    }
  );

  setTimeout(
    () => {
      process.exit(1);
    },
    5000
  );
}

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "uncaughtException",
  (error) => {
    console.error(
      "Uncaught exception:",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  (error) => {
    console.error(
      "Unhandled rejection:",
      error
    );
  }
);





