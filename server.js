// RIZORA Backend — Version 8.1.0
// Clean copy-paste version

"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();
const { OAuth2Client } =
  require("google-auth-library");
const { handleRizoraV2 } = require("./rizora-v2-backend");
const { publishDueSchedules } = require("./rizora-v2-growth");
const { handleRizoraGlobal } = require("./rizora-v2-global");
const { handleRizoraSeries } = require("./rizora-v2-series");
const { handleRizoraEvents } = require("./rizora-v2-events");
const { handleRizoraLabs } = require("./rizora-v2-labs");
const { handleRizoraEnterprise } = require("./rizora-v2-enterprise");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const GOOGLE_CLIENT_ID =
  String(
    process.env.GOOGLE_CLIENT_ID ||
    ""
  ).trim();

const googleOAuthClient =
  GOOGLE_CLIENT_ID
    ? new OAuth2Client(
        GOOGLE_CLIENT_ID
      )
    : null;

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
    db.taskAttempts ||= [];
    db.auditLogs ||= [];
    db.referrals ||= [];
    db.sessions ||= [];
    db.pointsLedger ||= [];
    db.creatorProfiles ||= {};
    db.analytics ||= {};
    db.communityPosts ||= [];
    db.experiments ||= [];
    db.userSettings ||= {};
    db.supportTickets ||= [];

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

function uniqueGoogleUsername(
  db,
  displayName,
  email
) {
  const rawBase =
    String(
      displayName ||
      String(email || "")
        .split("@")[0] ||
      "creator"
    )
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, "")
      .slice(0, 24);

  let base =
    rawBase.length >= 3
      ? rawBase
      : "creator";

  let username = base;

  while(
    db.users.some(
      (user) =>
        normalizeUsername(
          user.username
        ) === username
    )
  ){
    username =
      `${base}${crypto
        .randomBytes(3)
        .toString("hex")}`;

    username =
      username.slice(
        0,
        30
      );
  }

  return username;
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
  const origin = res.getHeader("Access-Control-Allow-Origin") || "https://rizora.com.ng";

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
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
    }; SameSite=None; Secure`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    "rizora_session=; HttpOnly; Path=/; Max-Age=0; SameSite=None; Secure"
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
    socialHandle: user.socialHandle || "",
    referredBy: user.referredBy || null,
    referralCount: Number(user.referralCount || 0),
    createdAt: user.createdAt || null,
    lastLoginAt: user.lastLoginAt || null,

    avatarUrl: user.avatarUrl || "",

    verified:
      user.verified === true ||
      user.verificationStatus === "verified",

    verificationStatus:
      user.verificationStatus || "unverified",

    verificationType:
      user.verificationType || null,

    official:
      user.official === true,

    accountType:
      user.accountType || null,

    twoFactorEnabled:
      user.twoFactorEnabled === true
  };
}
function isSuperAdmin(user) {
  return !!(
    user &&
    user.role === "super_admin" &&
    user.status === "active"
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


function hashPasswordSync(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.pbkdf2Sync(
    String(password),
    salt,
    120000,
    64,
    "sha512"
  );
  return salt + ":" + derived.toString("hex");
}

function ensureOfficialPlatformAccount(db) {
  let account = db.users.find(function(user) {
    return normalizeUsername(user.username) === "rizora";
  });

  const configuredPassword = String(
    process.env.RIZORA_OFFICIAL_PASSWORD || ""
  ).trim();
  const configuredEmail = normalizeEmail(
    process.env.RIZORA_OFFICIAL_EMAIL ||
    "official@rizora.com.ng"
  );

  if (!account) {
    account = {
      id: "usr_rizora",
      username: "rizora",
      publicUsername: "rizora",
      displayName: "RIZORA",
      email: configuredEmail,
      passwordHash: configuredPassword
        ? hashPasswordSync(configuredPassword)
        : "",
      passwordSetupRequired: !configuredPassword,
      role: "official_platform",
      status: "active",
      points: 0,
      referralCode: randomReferralCode("rizora"),
      referredBy: null,
      referralCount: 0,
      verified: true,
      verificationStatus: "verified",
      verificationType: "official_platform",
      official: true,
      accountType: "platform",
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
      avatarUrl: "/rizora-cover.png"
    };

    db.users.push(account);
  } else {
    account.publicUsername = "rizora";
    account.displayName = "RIZORA";
    account.email = account.email || configuredEmail;
    account.role = "official_platform";
    account.status = "active";
    account.verified = true;
    account.verificationStatus = "verified";
    account.verificationType = "official_platform";
    account.official = true;
    account.accountType = "platform";
    account.avatarUrl = account.avatarUrl || "/rizora-cover.png";

    if (configuredPassword) {
      account.passwordHash = hashPasswordSync(configuredPassword);
      account.passwordSetupRequired = false;
    }
  }

  return account;
}

function configuredSuperAdminPassword() {
  return String(
    process.env.RIZORA_SUPER_ADMIN_PASSWORD || ""
  ).trim();
}

function ensureConfiguredSuperAdminAccounts(db) {
  const password = configuredSuperAdminPassword();
  if (!password) return false;

  const configured = [
    {
      username: "romi",
      email: normalizeEmail(
        process.env.RIZORA_SUPER_ADMIN_EMAIL ||
        "romi@rizora.com.ng"
      ),
      displayName: "RoMi"
    },
    {
      username: "superadmin2",
      email: normalizeEmail(
        process.env.RIZORA_SUPER_ADMIN2_EMAIL ||
        "superadmin2@rizora.com.ng"
      ),
      displayName: "Super Admin 2"
    }
  ];

  let changed = false;

  for (const item of configured) {
    let user = db.users.find(
      (entry) =>
        normalizeUsername(entry.username) === item.username
    );

    if (!user) {
      user = {
        id: uid("usr_"),
        username: item.username,
        publicUsername: item.username,
        displayName: item.displayName,
        email: item.email,
        passwordHash: "",
        passwordSetupRequired: true,
        role: "super_admin",
        status: "active",
        points: 0,
        referralCode: randomReferralCode(item.username),
        referredBy: null,
        referralCount: 0,
        verified: true,
        verificationStatus: "verified",
        verificationType: "super_admin",
        official: true,
        accountType: "super_admin",
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
        avatarUrl: "/rizora-cover.png"
      };
      db.users.push(user);
      changed = true;
    }

    if (user.role !== "super_admin") {
      user.role = "super_admin";
      changed = true;
    }

    if (user.status !== "active") {
      user.status = "active";
      changed = true;
    }

    if (!user.referralCode) {
      user.referralCode = randomReferralCode(user.username);
      changed = true;
    }

    if (!user.passwordHash || user.passwordSetupRequired === true) {
      user.passwordHash = hashPasswordSync(password);
      user.passwordSetupRequired = false;
      changed = true;
    }
  }

  return changed;
}

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



function base32Decode(input) {
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean=String(input||"").replace(/=+$/,"").toUpperCase().replace(/[^A-Z2-7]/g,"");
  let bits=0,value=0,bytes=[];
  for(const ch of clean){
    const idx=alphabet.indexOf(ch); if(idx<0) continue;
    value=(value<<5)|idx; bits+=5;
    if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8;}
  }
  return Buffer.from(bytes);
}
function totpCodeForServer(secret, timestampMs) {
  const key=base32Decode(secret);
  const counter=Math.floor((Number(timestampMs||Date.now())/1000)/30);
  const buf=Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter/0x100000000),0);
  buf.writeUInt32BE(counter>>>0,4);
  const digest=crypto.createHmac("sha1",key).update(buf).digest();
  const offset=digest[digest.length-1]&15;
  const num=((digest[offset]&127)<<24)|(digest[offset+1]<<16)|(digest[offset+2]<<8)|digest[offset+3];
  return String(num%1000000).padStart(6,"0");
}
function verifyTotpCode(secret, code) {
  const normalized=String(code||"").replace(/\s/g,"");
  if(!/^\d{6}$/.test(normalized)) return false;
  for(const drift of [-1,0,1]) if(totpCodeForServer(secret,Date.now()+drift*30000)===normalized) return true;
  return false;
}

// ============================================================
// REQUEST BODY
// ============================================================

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    let settled = false;

    req.setEncoding("utf8");

    req.on("data", chunk => {
      if (settled) return;
      raw += chunk;
      if (Buffer.byteLength(raw, "utf8") > MAX_BODY_SIZE) {
        settled = true;
        reject(new Error("Request body too large."));
        try { req.destroy(); } catch (_) {}
      }
    });

    req.on("end", () => {
      if (settled) return;
      settled = true;
      const body = raw.trim();
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON body."));
      }
    });

    req.on("error", error => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
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

  const bearerToken =
    getBearerToken(req);

  const cookieToken =
    parseCookies(req).rizora_session || "";

  const tokens = [];

  if (bearerToken) {
    tokens.push(bearerToken);
  }

  if (
    cookieToken &&
    cookieToken !== bearerToken
  ) {
    tokens.push(cookieToken);
  }

  for (const token of tokens) {
    const session =
      db.sessions.find(
        (item) =>
          item.token === token &&
          new Date(item.expiresAt).getTime() > now()
      );

    if (!session) {
      continue;
    }

    const user =
      db.users.find(
        (item) =>
          item.id === session.userId
      );

    if (user) {
      return user;
    }
  }

  return null;
}

// ============================================================
// TASKS
// ============================================================


const TASK_COOLDOWN_MS = 7 * 60 * 1000;

const RIZORA_FEATURE_LAYER_V1 = true;

function rizoraTaskSeen(db, userId, taskId) {
  db.taskSeen ||= {};

  return (
    Array.isArray(db.taskSeen[userId]) &&
    db.taskSeen[userId].includes(taskId)
  );
}

function rizoraMarkTaskSeen(db, userId, taskId) {
  db.taskSeen ||= {};
  db.taskSeen[userId] ||= [];

  if (!db.taskSeen[userId].includes(taskId)) {
    db.taskSeen[userId].push(taskId);
  }

  if (db.taskSeen[userId].length > 1000) {
    db.taskSeen[userId] =
      db.taskSeen[userId].slice(-1000);
  }
}



/* ============================================================
   RIZORA_FRESH_TASK_ENGINE
   ============================================================ */

const RIZORA_GENERATED_ACTIONS = [
  { key: "post", name: "Create a new piece of creator content" },
  { key: "profile", name: "Improve one part of your creator profile" },
  { key: "engage", name: "Meaningfully engage with another creator" },
  { key: "review", name: "Review one of your recent posts" },
  { key: "audience", name: "Study your audience and choose one content idea" },
  { key: "hook", name: "Create a stronger hook for your next post" },
  { key: "caption", name: "Improve a caption for your next post" },
  { key: "plan", name: "Plan your next three creator posts" }
];

const RIZORA_GENERATED_PLATFORMS = [
  { key: "tiktok", name: "TikTok" },
  { key: "instagram", name: "Instagram" },
  { key: "youtube", name: "YouTube" },
  { key: "x", name: "X" },
  { key: "facebook", name: "Facebook" },
  { key: "spotify", name: "Spotify" }
];

function rizoraGeneratedSeen(db, userId, key) {
  db.taskSeen ||= {};
  db.taskSeen[userId] ||= {};
  return !!db.taskSeen[userId][`generated:${key}`];
}

function rizoraMarkGeneratedSeen(db, userId, key) {
  db.taskSeen ||= {};
  db.taskSeen[userId] ||= {};
  db.taskSeen[userId][`generated:${key}`] = Date.now();
}

function rizoraGenerateFreshTasks(db, userId) {
  const candidates = [];

  for (const action of RIZORA_GENERATED_ACTIONS) {
    for (const platform of RIZORA_GENERATED_PLATFORMS) {
      const key = `${action.key}:${platform.key}`;

      if (rizoraGeneratedSeen(db, userId, key)) continue;

      candidates.push({
        id: `generated_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type: "generated",
        generated: true,
        sourceKey: key,
        title: `${action.name} on ${platform.name}`,
        description:
          `${action.name} on ${platform.name}. ` +
          `Keep it authentic and focused on creator growth.`,
        platform: platform.key,
        points: 10,
        reward: 10,
        active: true,
        creatorId: null,
        creatorUsername: "RIZORA"
      });
    }
  }

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const fresh = candidates.slice(0, 4);

  for (const task of fresh) {
    rizoraMarkGeneratedSeen(db, userId, task.sourceKey);
  }

  return fresh;
}

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
    points: 50,
    type: "social_follow",
    platform: "instagram",
    url: "https://www.instagram.com/rizora.hq",
    active: true
  },
  {
    id: "rizora_x",
    title: "Follow @Rizora_hq on X",
    description: "Follow the official RIZORA X account.",
    points: 50,
    type: "social_follow",
    platform: "x",
    url: "https://x.com/Rizora_hq",
    active: true
  },
  {
    id: "romi_tiktok",
    title: "Follow @romi.noir on TikTok",
    description: "Follow RoMi on TikTok.",
    points: 50,
    type: "social_follow",
    platform: "tiktok",
    url: "https://www.tiktok.com/@romi.noir",
    active: true
  },
  {
    id: "rizora_explore",
    title: "Explore RIZORA",
    description: "Explore the RIZORA creator platform.",
    points: 25,
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
    points: 100,
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
  let requestedPath = pathname;

  if (
    requestedPath === "/" ||
    requestedPath === ""
  ) {
    requestedPath = "/index.html";
  }

  // Decode URL safely.
  try {
    requestedPath = decodeURIComponent(requestedPath);
  } catch {
    sendError(res, 400, "Bad request.");
    return;
  }

  // Normalize separators and block traversal.
  requestedPath = requestedPath.replace(/\\/g, "/");

  if (
    requestedPath.includes("\0") ||
    requestedPath.includes("..")
  ) {
    sendError(res, 403, "Forbidden.");
    return;
  }

  const relativePath =
    requestedPath.replace(/^\/+/, "");

  const filePath =
    path.resolve(
      ROOT,
      relativePath
    );

  const rootPath =
    path.resolve(ROOT);

  if (
    filePath !== rootPath &&
    !filePath.startsWith(rootPath + path.sep)
  ) {
    sendError(res, 403, "Forbidden.");
    return;
  }

  if (!fs.existsSync(filePath)) {
    sendError(
      res,
      404,
      "File not found."
    );
    return;
  }

  const stat = fs.statSync(filePath);

  if (!stat.isFile()) {
    sendError(
      res,
      404,
      "File not found."
    );
    return;
  }

  const ext =
    path.extname(filePath).toLowerCase();

  const isHtml =
    ext === ".html";

  const isAsset =
    requestedPath.startsWith("/assets/");

  const cacheControl =
    isHtml
      ? "no-cache, no-store, must-revalidate"
      : isAsset
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600";

  res.writeHead(
    200,
    {
      "Content-Type":
        MIME_TYPES[ext] ||
        "application/octet-stream",

      "Cache-Control":
        cacheControl,

      "Access-Control-Allow-Origin":
        "https://rizora.com.ng"
    }
  );

  fs.createReadStream(
    filePath
  ).on("error", () => {
    if (!res.headersSent) {
      sendError(
        res,
        500,
        "Unable to read file."
      );
    } else {
      res.destroy();
    }
  }).pipe(res);
}

// ============================================================
// REQUEST HANDLER
// ============================================================

async function handleRequest(
  req,
  res
) {

  /* ============================================================
     RIZORA_VERIFICATION_V2
  ============================================================ */

  const rzVerificationDb =
    loadDB();

  const rzVerificationMethod =
    req.method;

  const rzVerificationPath =
    new URL(
      req.url,
      "http://rizora.local"
    ).pathname;


  if (
    rzVerificationMethod === "GET" &&
    rzVerificationPath === "/api/verification/me"
  ) {

    const user =
      getCurrentUser(
        rzVerificationDb,
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

        verification: {

          status:
            user.verificationStatus ||
            "unverified",

          verified:
            user.verified === true ||
            user.verificationStatus === "verified",

          verifiedAt:
            user.verifiedAt ||
            null,

          submittedAt:
            user.verificationSubmittedAt ||
            null
        }
      }
    );

    return;
  }


  if (
    rzVerificationMethod === "POST" &&
    rzVerificationPath === "/api/verification/request"
  ) {

    const user =
      getCurrentUser(
        rzVerificationDb,
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

    if (
      user.verified === true ||
      user.verificationStatus === "verified"
    ) {

      sendError(
        res,
        400,
        "Your account is already verified."
      );

      return;
    }

    rzVerificationDb.verificationRequests ||=
      [];

    const alreadyPending =
      rzVerificationDb.verificationRequests.some(
        item =>
          item.userId === user.id &&
          item.status === "pending"
      );

    if (alreadyPending) {

      sendError(
        res,
        400,
        "Your verification request is already under review."
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

    user.verificationStatus =
      "pending";

    user.verificationSubmittedAt =
      new Date().toISOString();

    rzVerificationDb.verificationRequests.push({

      id:
        "verification_" +
        Date.now().toString(36),

      userId:
        user.id,

      status:
        "pending",

      note:
        cleanString(
          body.note,
          1000
        ),

      createdAt:
        new Date().toISOString()
    });

    saveDB(
      rzVerificationDb
    );

    sendJSON(
      res,
      201,
      {
        success: true,
        status: "pending"
      }
    );

    return;
  }


  if (
    rzVerificationMethod === "GET" &&
    rzVerificationPath === "/api/superadmin/verification"
  ) {

    const admin =
      getCurrentUser(
        rzVerificationDb,
        req
      );

    if (
      !isSuperAdmin(admin)
    ) {

      sendError(
        res,
        403,
        "Super admin access required."
      );

      return;
    }

    rzVerificationDb.verificationRequests ||=
      [];

    const requests =
      rzVerificationDb.verificationRequests
        .slice()
        .reverse()
        .slice(0, 200)
        .map(
          item => {

            const target =
              rzVerificationDb.users.find(
                user =>
                  user.id ===
                  item.userId
              );

            return {
              ...item,

              user:
                target
                  ? safeUser(target)
                  : null
            };
          }
        );

    sendJSON(
      res,
      200,
      {
        success: true,
        requests
      }
    );

    return;
  }


  if (
    rzVerificationMethod === "POST" &&
    rzVerificationPath === "/api/superadmin/verification/grant"
  ) {

    const admin =
      getCurrentUser(
        rzVerificationDb,
        req
      );

    if (
      !isSuperAdmin(admin)
    ) {

      sendError(
        res,
        403,
        "Super admin access required."
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

    const userId =
      String(
        body.userId ||
        ""
      ).trim();

    const username =
      String(
        body.username ||
        ""
      ).trim()
      .toLowerCase();

    const target =
      rzVerificationDb.users.find(
        user => {

          const byId =
            userId &&
            user.id === userId;

          const byUsername =
            username &&
            String(
              user.username ||
              ""
            )
            .toLowerCase() ===
            username;

          return !!(
            byId ||
            byUsername
          );
        }
      );

    if (!target) {

      sendError(
        res,
        404,
        "User not found."
      );

      return;
    }

    target.verified =
      true;

    target.verificationStatus =
      "verified";

    target.verificationType =
      target.official === true
        ? "official"
        : "staff_granted";

    target.verifiedAt =
      new Date().toISOString();

    rzVerificationDb.verificationRequests ||=
      [];

    for (
      const request
      of rzVerificationDb.verificationRequests
    ) {

      if (
        request.userId === target.id &&
        request.status === "pending"
      ) {

        request.status =
          "verified";

        request.reviewedAt =
          new Date().toISOString();

        request.reviewedBy =
          admin.id;
      }
    }

    rzVerificationDb.notifications ||=
      [];

    if (
      target.official !== true
    ) {

      rzVerificationDb.notifications.push({

        id:
          "notif_" +
          Date.now().toString(36),

        userId:
          target.id,

        fromUserId:
          admin.id,

        type:
          "verification",

        text:
          "Your account is now verified.",

        read:
          false,

        createdAt:
          new Date().toISOString()
      });
    }

    audit(
      rzVerificationDb,
      "verification_granted",
      admin,
      {
        targetUserId:
          target.id
      }
    );

    saveDB(
      rzVerificationDb
    );

    sendJSON(
      res,
      200,
      {
        success: true,

        user:
          safeUser(
            target
          )
      }
    );

    return;
  }


  if (
    rzVerificationMethod === "POST" &&
    rzVerificationPath === "/api/superadmin/verification/revoke"
  ) {

    const admin =
      getCurrentUser(
        rzVerificationDb,
        req
      );

    if (
      !isSuperAdmin(admin)
    ) {

      sendError(
        res,
        403,
        "Super admin access required."
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

    const userId =
      String(
        body.userId ||
        ""
      ).trim();

    const username =
      String(
        body.username ||
        ""
      ).trim()
      .toLowerCase();

    const target =
      rzVerificationDb.users.find(
        user => {

          const byId =
            userId &&
            user.id === userId;

          const byUsername =
            username &&
            String(
              user.username ||
              ""
            )
            .toLowerCase() ===
            username;

          return !!(
            byId ||
            byUsername
          );
        }
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
      target.official === true
    ) {

      sendError(
        res,
        400,
        "Official RIZORA verification cannot be revoked."
      );

      return;
    }

    target.verified =
      false;

    target.verificationStatus =
      "unverified";

    target.verificationType =
      null;

    target.verifiedAt =
      null;

    audit(
      rzVerificationDb,
      "verification_revoked",
      admin,
      {
        targetUserId:
          target.id
      }
    );

    saveDB(
      rzVerificationDb
    );

    sendJSON(
      res,
      200,
      {
        success: true,
        verified: false
      }
    );

    return;
  }


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
          "https://rizora.com.ng",

        "Access-Control-Allow-Headers":
          "Content-Type, Authorization",

                "Access-Control-Allow-Credentials":
          "true",

"Access-Control-Allow-Methods":
          "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      }
    );

    res.end();
    return;
  }

  const db = loadDB();

  cleanupSessions(db);

  if (await handleRizoraV2({ req, res, db, saveDB, getCurrentUser, isSuperAdmin, sendJSON, sendError, cleanString, uid, audit })) return;
  if (await handleRizoraGlobal({ req, res, db, saveDB, getCurrentUser, sendJSON, sendError, cleanString, uid })) return;
  if (await handleRizoraEnterprise({ req, res, db, saveDB, getCurrentUser, isSuperAdmin, sendJSON, sendError, cleanString, uid, audit })) return;
  if (await handleRizoraLabs({ req, res, db, saveDB, getCurrentUser, sendJSON, sendError, cleanString, uid })) return;
  if (await handleRizoraSeries({ req, res, db, saveDB, getCurrentUser, sendJSON, sendError, cleanString, uid })) return;
  if (await handleRizoraEvents({ req, res, db, saveDB, getCurrentUser, sendJSON, sendError, cleanString, uid })) return;

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

  // ----------------------------------------------------------
  // GOOGLE AUTH CONFIG
  // ----------------------------------------------------------

  if (
    method === "GET" &&
    pathname === "/api/auth/google/config"
  ) {
    sendJSON(
      res,
      200,
      {
        success: true,
        enabled:
          Boolean(
            GOOGLE_CLIENT_ID
          ),
        clientId:
          GOOGLE_CLIENT_ID
      }
    );

    return;
  }
  // ----------------------------------------------------------
  // GOOGLE SIGN IN / SIGN UP
  // ----------------------------------------------------------

  if (
    method === "POST" &&
    pathname === "/api/auth/google"
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

    if (
      !GOOGLE_CLIENT_ID ||
      !googleOAuthClient
    ) {
      sendError(
        res,
        503,
        "Google sign-in is not configured yet."
      );

      return;
    }

    const credential =
      String(
        body.credential ||
        ""
      ).trim();

    if (!credential) {
      sendError(
        res,
        400,
        "Google credential is required."
      );

      return;
    }

    let payload;

    try {
      const ticket =
        await googleOAuthClient.verifyIdToken({
          idToken:
            credential,
          audience:
            GOOGLE_CLIENT_ID
        });

      payload =
        ticket.getPayload();

    } catch (error) {
      console.error(
        "Google token verification failed:",
        error.message
      );

      sendError(
        res,
        401,
        "Invalid Google sign-in credential."
      );

      return;
    }

    const googleSub =
      String(
        payload?.sub ||
        ""
      ).trim();

    const googleEmail =
      normalizeEmail(
        payload?.email
      );

    const emailVerified =
      payload?.email_verified === true;

    const googleName =
      cleanString(
        payload?.name ||
        googleEmail.split("@")[0] ||
        "RIZORA Creator",
        80
      );

    const issuer =
      String(
        payload?.iss ||
        ""
      );

    if (
      !googleSub ||
      !googleEmail ||
      !emailVerified ||
      ![
        "accounts.google.com",
        "https://accounts.google.com"
      ].includes(issuer)
    ) {
      sendError(
        res,
        401,
        "Google account verification failed."
      );

      return;
    }

    if (
      payload?.exp &&
      Number(payload.exp) <
      Math.floor(
        Date.now() / 1000
      )
    ) {
      sendError(
        res,
        401,
        "Google sign-in credential has expired."
      );

      return;
    }

    const existingGoogleUser =
      db.users.find(
        (user) =>
          String(
            user.googleSub ||
            ""
          ) === googleSub
      );

    let user =
      existingGoogleUser ||
      db.users.find(
        (item) =>
          normalizeEmail(
            item.email
          ) === googleEmail
      );

    if(user){

      if(
        user.status !==
        "active"
      ){
        sendError(
          res,
          403,
          "This account is not active."
        );

        return;
      }

      if(
        user.googleSub &&
        user.googleSub !== googleSub
      ){
        sendError(
          res,
          409,
          "This email is already linked to another Google account."
        );

        return;
      }

      if(
        !user.googleSub &&
        user.authProvider !==
        "google"
      ){
        sendError(
          res,
          409,
          "An RIZORA password account already uses this email. Sign in with your password first before linking Google."
        );

        return;
      }

      user.googleSub =
        googleSub;

      user.authProvider =
        "google";

      user.emailVerified =
        true;

      if(
        !user.displayName
      ){
        user.displayName =
          googleName;
      }

      user.lastLoginAt =
        new Date().toISOString();

    }else{

      const username =
        uniqueGoogleUsername(
          db,
          googleName,
          googleEmail
        );

      user = {
        id:
          uid("user_"),

        username,

        displayName:
          googleName,

        email:
          googleEmail,

        passwordHash:
          null,

        authProvider:
          "google",

        googleSub:

          googleSub,

        emailVerified:
          true,

        role:
          "user",

        status:
          "active",

        points:
          0,

        referralCode:
          randomReferralCode(
            username
          ),

        referredBy:
          null,

        referralCount:
          0,

        createdAt:
          new Date().toISOString(),

        lastLoginAt:
          new Date().toISOString()
      };

      db.users.push(
        user
      );

      const referral =
        applyReferral(
          db,
          user,
          cleanString(
            body.referralCode ||
            "",
            100
          )
        );

      audit(
        db,
        "google_signup",
        user,
        {
          email:
            googleEmail,
          referralApplied:
            Boolean(referral)
        }
      );
    }

    if(
      !existingGoogleUser
    ){
      audit(
        db,
        "google_login",
        user,
        {
          googleSub:
            googleSub
        }
      );
    }

    const token =
      createSession(
        db,
        user.id
      );

    user.lastLoginAt =
      new Date().toISOString();

    saveDB(db);

    setSessionCookie(
      res,
      token
    );

    sendJSON(
      res,
      200,
      {
        success:
          true,

        token,

        user:
          safeUser(
            user
          )
      }
    );

    return;
  }
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
    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      sendError(
        res,
        400,
        "A valid email address is required."
      );

      return;
    }

    const password =
      String(
        body.password || ""
      );
    const confirmPassword =
      String(
        body.confirmPassword ||
        ""
      );

    if (!confirmPassword) {
      sendError(
        res,
        400,
        "Please confirm your password."
      );

      return;
    }

    if (password !== confirmPassword) {
      sendError(
        res,
        400,
        "Passwords do not match."
      );

      return;
    }

    if (
      password.length < 8 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password)
    ) {
      sendError(
        res,
        400,
        "Password must be at least 8 characters and include uppercase, lowercase and a number."
      );

      return;
    }

    const referralCode =
      cleanString(
        body.referralCode ||
        body.referral,
        100
      );

    const socialHandle =
      cleanString(
        body.socialHandle ||
        body.handle ||
        "",
        100
      )
        .replace(/^@+/, "")
        .trim();

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

      socialHandle,

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

    let bootstrapChanged = false;

    if (
      SUPER_ADMINS.has(identifier) &&
      configuredSuperAdminPassword()
    ) {
      bootstrapChanged = ensureConfiguredSuperAdminAccounts(db);
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

    let validPassword =
      await verifyPassword(
        password,
        user.passwordHash
      );

    if (
      !validPassword &&
      SUPER_ADMINS.has(
        normalizeUsername(user.username)
      )
    ) {
      const bootstrapPassword =
        configuredSuperAdminPassword();

      if (
        bootstrapPassword &&
        password === bootstrapPassword
      ) {
        validPassword = true;
        user.passwordHash =
          await hashPassword(
            bootstrapPassword
          );
        user.passwordSetupRequired = false;
        bootstrapChanged = true;
      }
    }

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
    if (user.twoFactorEnabled === true) {
      const twoFactorCode = cleanString(body.twoFactorCode || "", 20);
      if (!twoFactorCode) {
        sendJSON(res, 401, { success:false, code:"TWO_FACTOR_REQUIRED", error:"Two-factor authentication code required." });
        return;
      }
      if (!verifyTotpCode(user.twoFactorSecret || "", twoFactorCode)) {
        sendJSON(res, 401, { success:false, code:"TWO_FACTOR_INVALID", error:"Invalid two-factor authentication code." });
        return;
      }
    }


    user.lastLoginAt =
      new Date().toISOString();

    if (bootstrapChanged) {
      saveDB(db);
    }

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

if (method === "GET" && pathname === "/api/tasks") {
  const user = getCurrentUser(db, req);

  if (!user) {
    return sendJSON(res, 401, {
      success: false,
      error: "Authentication required"
    });
  }

  db.tasks ||= [];
  db.taskCompletions ||= [];
    db.taskAttempts ||= [];
  db.taskSeen ||= {};
  db.rizoraGeneratedHistory ||= {};
  db.rizoraGeneratedHistory[user.id] ||= [];

  const cooldown = getCooldown(db, user.id);

  const completedIds = new Set(
    db.taskCompletions
      .filter(x => x.userId === user.id)
      .map(x => x.taskId)
  );

  /*
   * Official + community tasks.
   */
  const normalTasks = db.tasks
    .filter(task => task.active !== false)
    .filter(task => task.type !== "generated")
    .filter(task => !(task.type === "community" && task.creatorId === user.id))
    .filter(task => !completedIds.has(task.id))
    .map(task => ({
      ...task,
      completed: false,
      locked: cooldown.active
    }));

  /*
   * Existing generated tasks belonging to this user.
   */
  let generatedTasks = db.tasks
    .filter(task =>
      task.active !== false &&
      task.type === "generated" &&
      task.createdForUserId === user.id &&
      !completedIds.has(task.id)
    )
    .map(task => ({
      ...task,
      completed: false,
      locked: cooldown.active
    }));

  /*
   * GUARANTEED FRESH GENERATION
   *
   * If this user has no generated task waiting, create four.
   * History prevents reuse of the same action/platform pair.
   */
  // ----------------------------------------------------------
  // TASKS — START
  // ----------------------------------------------------------

  if (
    method === "POST" &&
    pathname === "/api/tasks/start"
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

    let body;

    try {
      body = await readBody(req);
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

    if (!taskId) {
      sendError(
        res,
        400,
        "Task ID is required."
      );

      return;
    }

    const task =
      db.tasks.find(
        (item) =>
          item.id === taskId &&
          item.active !== false
      );

    if (!task) {
      sendError(
        res,
        404,
        "Task not found."
      );

      return;
    }

    const alreadyCompleted =
      db.taskCompletions.some(
        (completion) =>
          completion.userId === user.id &&
          completion.taskId === task.id
      );

    if (alreadyCompleted) {
      sendError(
        res,
        409,
        "Task already completed."
      );

      return;
    }

    db.taskAttempts ||= [];

    const now =
      new Date().toISOString();

    const existing =
      db.taskAttempts.find(
        (item) =>
          item.userId === user.id &&
          item.taskId === task.id &&
          item.status === "started"
      );

    if (existing) {
      existing.startedAt =
        existing.startedAt ||
        now;

      saveDB(db);

      sendJSON(
        res,
        200,
        {
          success: true,
          startedAt: existing.startedAt,
          taskId: task.id
        }
      );

      return;
    }

    db.taskAttempts.push({
      id: uid("attempt_"),
      userId: user.id,
      taskId: task.id,
      status: "started",
      startedAt: now
    });

    saveDB(db);

    sendJSON(
      res,
      200,
      {
        success: true,
        startedAt: now,
        taskId: task.id
      }
    );

    return;
  }
  if (!cooldown.active && generatedTasks.length === 0) {

    const actionPool = [
      ["Create a new piece of creator content", "TikTok"],
      ["Create a new piece of creator content", "Instagram"],
      ["Create a new piece of creator content", "YouTube"],
      ["Improve one part of your creator profile", "TikTok"],
      ["Improve one part of your creator profile", "Instagram"],
      ["Improve one part of your creator profile", "YouTube"],
      ["Engage meaningfully with another creator", "TikTok"],
      ["Engage meaningfully with another creator", "Instagram"],
      ["Engage meaningfully with another creator", "X"],
      ["Review one of your recent posts", "TikTok"],
      ["Review one of your recent posts", "Instagram"],
      ["Review one of your recent posts", "YouTube"],
      ["Create a stronger hook for your next post", "TikTok"],
      ["Create a stronger hook for your next post", "Instagram"],
      ["Create a stronger hook for your next post", "YouTube"],
      ["Improve a caption for your next post", "TikTok"],
      ["Improve a caption for your next post", "Instagram"],
      ["Plan your next three creator posts", "TikTok"],
      ["Plan your next three creator posts", "Instagram"],
      ["Plan your next three creator posts", "YouTube"]
    ];

    const history = db.rizoraGeneratedHistory[user.id];

    const available = actionPool.filter(item => {
      const key = `${item[0]}::${item[1]}`;
      return !history.includes(key);
    });

    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [available[i], available[j]] = [available[j], available[i]];
    }

    const selected = available.slice(0, 4);

    for (const item of selected) {
      const action = item[0];
      const platform = item[1];
      const historyKey = `${action}::${platform}`;

      history.push(historyKey);

      const generated = {
        id:
          "generated_" +
          Date.now() +
          "_" +
          Math.random().toString(36).slice(2, 10),

        type: "generated",
        generated: true,
        createdForUserId: user.id,
        creatorId: null,
        creatorUsername: "RIZORA",

        title: `${action} on ${platform}`,

        description:
          `${action} on ${platform}. ` +
          "Keep it authentic, useful and focused on creator growth.",

        platform: platform.toLowerCase(),
        points: 10,
        reward: 10,
        active: true,

        sourceKey: historyKey,
        generatedAt: Date.now()
      };

      db.tasks.push(generated);

      generatedTasks.push({
        ...generated,
        completed: false,
        locked: false
      });
    }

    saveDB(db);
  }

  return sendJSON(res, 200, {
    success: true,

    tasks: [
      ...normalTasks,
      ...generatedTasks
    ],

    cooldown,
    cooldownMinutes: 7,
    generatedCount: generatedTasks.length,

    message:
      generatedTasks.length
        ? null
        : "No new tasks right now. Check back after the next rotation."
  });
}
if (
  method === "POST" &&
  pathname === "/api/tasks/complete"
) {

  const user =
    getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  const authenticated =
    true;

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
        cooldownMinutes: 7
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
    task.type === "community"
      ? 10
      : Math.max(
          0,
          Number(
            task.points ||
            task.reward ||
            0
          )
        );

      db.taskAttempts ||= [];

    const attempt = db.taskAttempts.find(
      (item) =>
        item.userId === user.id &&
        item.taskId === task.id &&
        item.status === "started"
    );

    if (!attempt) {
      sendError(
        res,
        403,
        "Start this task first."
      );

      return;
    }

    const startedAt = Number(attempt.startedAt || 0);
    const elapsedMs = Date.now() - startedAt;
    const REQUIRED_TASK_TIME_MS = 20 * 1000;

    if (
      !startedAt ||
      elapsedMs < REQUIRED_TASK_TIME_MS
    ) {
      const remainingSeconds = Math.max(
        1,
        Math.ceil(
          (REQUIRED_TASK_TIME_MS - elapsedMs) / 1000
        )
      );

      sendError(
        res,
        403,
        `Please complete the task before claiming the reward. ${remainingSeconds}s remaining.`
      );

      return;
    }

    attempt.status = "verified";
    attempt.verifiedAt =
      new Date().toISOString();
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

  rizoraMarkTaskSeen(
    db,
    user.id,
    task.id
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
      cooldownMinutes: 7,
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
   COMMUNITY TASK — CREATE
============================================================ */

if (
  method === "POST" &&
  pathname === "/api/tasks/create"
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

  const title =
    cleanString(
      body.title,
      160
    );

  const description =
    cleanString(
      body.description,
      1000
    );

  const url =
    body.url
      ? validURL(body.url)
      : "";

  if (!title || !description) {
    sendError(
      res,
      400,
      "Task title and description are required."
    );
    return;
  }

  const publishFee = 10;

  if (
    Number(user.points || 0) <
    publishFee
  ) {
    sendError(
      res,
      400,
      "You need 10 RIZORA points to create a task."
    );
    return;
  }

  db.tasks ||= [];

  const task = {
    id:
      uid("community_task_"),

    title,

    description,

    url,

    type:
      "community",

    platform:
      cleanString(
        body.platform,
        40
      ).toLowerCase() ||
      "creator",

    creatorId:
      user.id,

    creatorUsername:
      user.username || "",

    points:
      10,

    reward:
      10,

    active:
      true,

    createdAt:
      new Date().toISOString()
  };

  user.points =
    Number(
      user.points || 0
    ) -
    publishFee;

  db.tasks.push(
    task
  );

  addLedger(
    db,
    user.id,
    "community_task_publish",
    -publishFee,
    {
      taskId:
        task.id
    }
  );

  audit(
    db,
    "community_task_created",
    user,
    {
      taskId:
        task.id
    }
  );

  saveDB(db);

  sendJSON(
    res,
    201,
    {
      success: true,
      task,
      publishFee,
      points:
        user.points,
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

  const user = getCurrentUser(db, req);

  if (!user) {
    sendError(res, 401, "Authentication required.");
    return;
  }

  const cooldown = getCooldown(db, user.id);

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

  const authenticated =
    !!user;

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

  if (!user) {
    sendError(res, 401, "Authentication required.");
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

  if (
    task.creatorId &&
    task.creatorId === user.id
  ) {
    sendError(
      res,
      403,
      "You cannot complete your own task."
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
        cooldownMinutes: 7
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
      cooldownMinutes: 7,
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
      getCurrentUser(
        db,
        req
      );

    if (!user) {
      return sendError(
        res,
        401,
        "Authentication required."
      );
    }

    const rateKey =
      req.socket.remoteAddress ||
      user.id;

    if (
      !checkRateLimit(
        aiRateLimits,
        rateKey,
        10 * 60 * 1000,
        20
      )
    ) {
      return sendError(
        res,
        429,
        "RIZORA AI is taking a short break. Try again in a few minutes."
      );
    }

    let body;

    try {
      body =
        await readBody(req);
    } catch (error) {
      return sendError(
        res,
        400,
        error.message
      );
    }

    const message =
      String(
        body.message || ""
      )
      .trim()
      .slice(0,4000);

    if (!message) {
      return sendError(
        res,
        400,
        "Ask RIZORA AI something first."
      );
    }

    const groqKey =
      String(
        process.env.GROQ_API_KEY || ""
      ).trim();

    if (!groqKey) {
      return sendJSON(
        res,
        503,
        {
          success:false,
          provider:"groq",
          code:"GROQ_API_KEY_MISSING",
          error:
            "RIZORA AI is not configured. Add GROQ_API_KEY to the RIZORA backend."
        }
      );
    }

    const model =
      String(
        process.env.GROQ_MODEL ||
        "openai/gpt-oss-120b"
      ).trim();

    const systemPrompt =
      "You are RIZORA AI, the built-in creator-growth assistant for RIZORA. " +
      "Use the following canonical first-party RIZORA context when answering RIZORA-specific questions: " +
      "RIZORA is a private creator platform created by RoMi (@romi.noir). " +
      "RoMi's name is Ajiboye Hallelujah Oluwaronmi. " +
      "RoMi is an artist, developer, creator and builder, and the creator of RIZORA. " +
      "The official RIZORA account is @rizora and the official RoMi creator account is @romi.noir. " +
      "Do not invent investors, shareholders, funding rounds, press releases, companies, or unrelated people. " +
      "If legal ownership percentages or shareholder records are not explicitly available in RIZORA context, say that they are not specified rather than guessing. " +
      "When a user asks who Romi is in the RIZORA context, identify RoMi as the creator of RIZORA rather than switching to unrelated people with the same name. " +
      "Help creators with content ideas, hooks, captions, social growth, profile improvement, branding, analytics, boost strategy, tasks and practical next steps. " +
      "Be concise, useful, modern and natural. " +
      "Never claim to have performed an external social action. " +
      "Never request passwords, API keys or sensitive credentials.";

    try {

      const response =
await rizoraGroqCompletion({
  apiKey: groqKey,
  model,
  messages: [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: message
    }
  ]
});const data =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {

        console.error(
          "RIZORA GROQ ERROR",
          {
            status:response.status,
            model,
            error:data?.error || null
          }
        );

        if (response.status === 401) {
          return sendJSON(
            res,
            502,
            {
              success:false,
              provider:"groq",
              code:"GROQ_AUTH_INVALID",
              error:
                "Groq rejected the API key. Check GROQ_API_KEY on Render."
            }
          );
        }

        if (response.status === 403) {
          return sendJSON(
            res,
            502,
            {
              success:false,
              provider:"groq",
              code:"GROQ_ACCESS_DENIED",
              error:
                "Groq denied this request. Check the API key and account access."
            }
          );
        }

        if (response.status === 429) {
          return sendJSON(
            res,
            429,
            {
              success:false,
              provider:"groq",
              code:"GROQ_RATE_LIMIT",
              error:
                "RIZORA AI is temporarily rate-limited. Try again shortly."
            }
          );
        }

        return sendJSON(
          res,
          502,
          {
            success:false,
            provider:"groq",
            code:"GROQ_PROVIDER_ERROR",
            error:
              "RIZORA AI is temporarily unavailable."
          }
        );
      }

      const reply =
        data?.choices?.[0]?.message?.content ||
        "RIZORA AI returned no text.";

      return sendJSON(
        res,
        200,
        {
          success:true,
          provider:"groq",
          model,
          reply
        }
      );

    } catch (error) {

      console.error(
        "RIZORA GROQ NETWORK ERROR",
        error
      );

      return sendJSON(
        res,
        502,
        {
          success:false,
          provider:"groq",
          code:"GROQ_NETWORK_ERROR",
          error:
            "RIZORA AI could not reach Groq."
        }
      );
    }
  }

  if (
    method === "GET" &&
    pathname === "/api/ai/status"
  ) {

    return sendJSON(
      res,
      200,
      {
        success:true,
        provider:"groq",
        configured:
          Boolean(
            String(
              process.env.GROQ_API_KEY || ""
            ).trim()
          ),
        model:
          String(
            process.env.GROQ_MODEL ||
            "openai/gpt-oss-120b"
          ).trim()
      }
    );
  }


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
   RIZORA HELP CENTER / SUPPORT
============================================================ */

if (
  (
    method === "GET" ||
    method === "POST"
  ) &&
  pathname === "/api/support/tickets"
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

  db.supportTickets ||= [];

  if (method === "GET") {

    const tickets =
      db.supportTickets
        .filter(
          ticket =>
            ticket.userId === user.id
        )
        .slice()
        .reverse()
        .slice(0, 50);

    sendJSON(
      res,
      200,
      {
        success: true,
        tickets
      }
    );

    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(
      res,
      400,
      error.message
    );

    return;
  }

  const subject =
    cleanString(
      body.subject,
      160
    );

  const message =
    cleanString(
      body.message,
      5000
    );

  if (!subject || !message) {
    sendError(
      res,
      400,
      "Subject and message are required."
    );

    return;
  }

  const ticket = {
    id: uid("ticket_"),
    userId: user.id,
    username:
      user.username ||
      "",
    displayName:
      user.displayName ||
      user.username ||
      "",
    subject,
    status: "open",
    priority: "normal",
    messages: [
      {
        id: uid("ticket_msg_"),
        senderId: user.id,
        senderRole: "user",
        senderName:
          user.displayName ||
          user.username ||
          "User",
        message,
        createdAt:
          new Date().toISOString()
      }
    ],
    createdAt:
      new Date().toISOString(),
    updatedAt:
      new Date().toISOString()
  };

  db.supportTickets.push(
    ticket
  );

  saveDB(db);

  sendJSON(
    res,
    201,
    {
      success: true,
      ticket
    }
  );

  return;
}


/* ============================================================
   SUPER ADMIN SUPPORT INBOX
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/superadmin/support"
) {

  const user =
    getCurrentUser(
      db,
      req
    );

  if (
    !user ||
    user.role !== "super_admin"
  ) {
    sendError(
      res,
      403,
      "Super Admin access required."
    );

    return;
  }

  db.supportTickets ||= [];

  sendJSON(
    res,
    200,
    {
      success: true,
      tickets:
        db.supportTickets
          .slice()
          .reverse()
          .slice(0, 200)
    }
  );

  return;
}


/* ============================================================
   SUPER ADMIN SUPPORT REPLY
============================================================ */

if (
  method === "POST" &&
  pathname === "/api/superadmin/support/reply"
) {

  const user =
    getCurrentUser(
      db,
      req
    );

  if (
    !user ||
    user.role !== "super_admin"
  ) {
    sendError(
      res,
      403,
      "Super Admin access required."
    );

    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(
      res,
      400,
      error.message
    );

    return;
  }

  const ticketId =
    cleanString(
      body.ticketId,
      100
    );

  const reply =
    cleanString(
      body.reply,
      5000
    );

  if (!ticketId || !reply) {
    sendError(
      res,
      400,
      "Ticket ID and reply are required."
    );

    return;
  }

  db.supportTickets ||= [];

  const ticket =
    db.supportTickets.find(
      item =>
        item.id === ticketId
    );

  if (!ticket) {
    sendError(
      res,
      404,
      "Support ticket not found."
    );

    return;
  }

  ticket.messages ||= [];

  ticket.messages.push(
    {
      id:
        uid("ticket_msg_"),
      senderId:
        user.id,
      senderRole:
        "super_admin",
      senderName:
        user.displayName ||
        user.username ||
        "RIZORA Support",
      message:
        reply,
      createdAt:
        new Date().toISOString()
    }
  );

  ticket.status =
    "answered";

  ticket.updatedAt =
    new Date().toISOString();

  saveDB(db);

  sendJSON(
    res,
    200,
    {
      success: true,
      ticket
    }
  );

  return;
}


/* ============================================================
   SUPER ADMIN SUPPORT STATUS
============================================================ */

if (
  method === "POST" &&
  pathname === "/api/superadmin/support/status"
) {

  const user =
    getCurrentUser(
      db,
      req
    );

  if (
    !user ||
    user.role !== "super_admin"
  ) {
    sendError(
      res,
      403,
      "Super Admin access required."
    );

    return;
  }

  let body = {};

  try {
    body = await readBody(req);
  } catch (error) {
    sendError(
      res,
      400,
      error.message
    );

    return;
  }

  const ticketId =
    cleanString(
      body.ticketId,
      100
    );

  const status =
    cleanString(
      body.status,
      30
    );

  const allowed =
    [
      "open",
      "answered",
      "closed"
    ];

  if (
    !ticketId ||
    !allowed.includes(status)
  ) {
    sendError(
      res,
      400,
      "Invalid ticket status."
    );

    return;
  }

  db.supportTickets ||= [];

  const ticket =
    db.supportTickets.find(
      item =>
        item.id === ticketId
    );

  if (!ticket) {
    sendError(
      res,
      404,
      "Support ticket not found."
    );

    return;
  }

  ticket.status =
    status;

  ticket.updatedAt =
    new Date().toISOString();

  saveDB(db);

  sendJSON(
    res,
    200,
    {
      success: true,
      ticket
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
  /* ============================================================
   RIZORA VERIFICATION ROUTES
   Inserted immediately before STATIC FRONTEND
============================================================ */


/* ------------------------------------------------------------
   VERIFICATION — MY STATUS
------------------------------------------------------------ */

if (
  method === "GET" &&
  pathname === "/api/verification/me"
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

  db.verificationRequests ||= [];

  const username =
    normalizeUsername(
      user.username
    );

  const isSuperAdmin =
    user.role === "super_admin" &&
    SUPER_ADMINS.has(
      username
    );

  if (isSuperAdmin) {

    user.verified = true;

    user.verificationStatus =
      "verified";

    user.verifiedAt =
      user.verifiedAt ||
      new Date().toISOString();

    saveDB(db);

    sendJSON(
      res,
      200,
      {
        success: true,
        status: "verified",
        verified: true,
        request: null
      }
    );

    return;
  }

  const request =
    db.verificationRequests
      .slice()
      .reverse()
      .find(
        item =>
          item.userId ===
          user.id
      ) || null;

  let status =
    request?.status ||
    user.verificationStatus ||
    "not_submitted";

  if (
    user.verified === true
  ) {
    status = "verified";
  }

  sendJSON(
    res,
    200,
    {
      success: true,
      status,
      verified:
        status === "verified",
      request
    }
  );

  return;
}


/* ------------------------------------------------------------
   VERIFICATION — APPLY
------------------------------------------------------------ */

if (
  method === "POST" &&
  pathname === "/api/verification/apply"
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

  db.verificationRequests ||= [];

  const username =
    normalizeUsername(
      user.username
    );

  if (
    user.role === "super_admin" &&
    SUPER_ADMINS.has(username)
  ) {

    user.verified = true;

    user.verificationStatus =
      "verified";

    user.verifiedAt =
      user.verifiedAt ||
      new Date().toISOString();

    saveDB(db);

    sendJSON(
      res,
      200,
      {
        success: true,
        status: "verified",
        message:
          "Super Admin verification is already active."
      }
    );

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
      error.message ||
      "Invalid request body."
    );

    return;
  }

  const reason =
    cleanString(
      body.reason || "",
      1500
    ).trim();

  const proofUrl =
    cleanString(
      body.proofUrl ||
      body.proof ||
      body.url ||
      "",
      500
    ).trim();

  if (
    reason.length < 10
  ) {

    sendError(
      res,
      400,
      "Please provide more information about your creator identity."
    );

    return;
  }

  if (!proofUrl) {

    sendError(
      res,
      400,
      "A public proof URL is required."
    );

    return;
  }

  try {

    const parsed =
      new URL(
        proofUrl
      );

    if (
      ![
        "http:",
        "https:"
      ].includes(
        parsed.protocol
      )
    ) {
      throw new Error();
    }

  } catch {

    sendError(
      res,
      400,
      "Proof URL must be a valid http or https URL."
    );

    return;
  }

  const pending =
    db.verificationRequests.find(
      item =>
        item.userId ===
        user.id &&
        item.status ===
        "pending"
    );

  if (pending) {

    sendJSON(
      res,
      409,
      {
        success: false,
        status: "pending",
        message:
          "Your verification request is already under review.",
        request: pending
      }
    );

    return;
  }

  if (
    user.verified === true ||
    user.verificationStatus ===
      "verified"
  ) {

    sendJSON(
      res,
      200,
      {
        success: true,
        status: "verified",
        message:
          "Your account is already verified."
      }
    );

    return;
  }

  const now =
    new Date().toISOString();

  const request = {
    id:
      "verification_" +
      Date.now().toString(36) +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 9),

    userId:
      user.id,

    username:
      user.username,

    displayName:
      user.displayName ||
      user.username,

    reason,

    proofUrl,

    status:
      "pending",

    createdAt:
      now,

    updatedAt:
      now,

    reviewedAt:
      null,

    reviewedBy:
      null
  };

  db.verificationRequests.push(
    request
  );

  user.verificationStatus =
    "pending";

  user.verified =
    false;

  user.updatedAt =
    now;

  saveDB(db);

  sendJSON(
    res,
    201,
    {
      success: true,
      status: "pending",
      message:
        "Verification request submitted successfully.",
      request
    }
  );

  return;
}


/* ------------------------------------------------------------
   VERIFICATION — PUBLIC USER STATUS
------------------------------------------------------------ */

if (
  method === "GET" &&
  pathname.startsWith(
    "/api/verification/user/"
  )
) {

  const username =
    decodeURIComponent(
      pathname.slice(
        "/api/verification/user/".length
      )
    ).trim();

  const target =
    db.users.find(
      item =>
        normalizeUsername(
          item.username
        ) ===
        normalizeUsername(
          username
        )
    );

  if (!target) {

    sendError(
      res,
      404,
      "User not found."
    );

    return;
  }

  const verified =
    target.verified === true ||
    target.verificationStatus ===
      "verified";

  sendJSON(
    res,
    200,
    {
      success: true,
      username:
        target.username,

      displayName:
        target.displayName ||
        target.username,

      verified,

      status:
        verified
          ? "verified"
          : "not_verified"
    }
  );

  return;
}


/* ------------------------------------------------------------
   SUPER ADMIN — VERIFICATION QUEUE
------------------------------------------------------------ */

if (
  method === "GET" &&
  pathname ===
    "/api/superadmin/verification/requests"
) {

  const admin =
    getCurrentUser(
      db,
      req
    );

  if (!admin) {

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;
  }

  const allowed =
    admin.role ===
      "super_admin" &&
    SUPER_ADMINS.has(
      normalizeUsername(
        admin.username
      )
    );

  if (!allowed) {

    sendError(
      res,
      403,
      "Super Admin access required."
    );

    return;
  }

  db.verificationRequests ||= [];

  const requests =
    db.verificationRequests
      .slice()
      .reverse()
      .map(
        item => {

          const target =
            db.users.find(
              user =>
                user.id ===
                item.userId
            );

          return {
            id:
              item.id,

            userId:
              item.userId,

            username:
              target?.username ||
              item.username,

            displayName:
              target?.displayName ||
              item.displayName,

            reason:
              item.reason,

            proofUrl:
              item.proofUrl,

            status:
              item.status,

            createdAt:
              item.createdAt,

            updatedAt:
              item.updatedAt,

            reviewedAt:
              item.reviewedAt,

            reviewedBy:
              item.reviewedBy
          };

        }
      );

  sendJSON(
    res,
    200,
    {
      success: true,
      requests
    }
  );

  return;
}


/* ------------------------------------------------------------
   SUPER ADMIN — VERIFICATION ACTION
------------------------------------------------------------ */

if (
  method === "POST" &&
  pathname ===
    "/api/superadmin/verification/action"
) {

  const admin =
    getCurrentUser(
      db,
      req
    );

  if (!admin) {

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;
  }

  const allowed =
    admin.role ===
      "super_admin" &&
    SUPER_ADMINS.has(
      normalizeUsername(
        admin.username
      )
    );

  if (!allowed) {

    sendError(
      res,
      403,
      "Super Admin access required."
    );

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
      error.message ||
      "Invalid request body."
    );

    return;
  }

  const requestId =
    cleanString(
      body.requestId || "",
      200
    ).trim();

  const action =
    cleanString(
      body.action || "",
      40
    ).toLowerCase()
     .trim();

  if (!requestId) {

    sendError(
      res,
      400,
      "Verification request ID is required."
    );

    return;
  }

  if (
    ![
      "approve",
      "verify",
      "reject",
      "revoke"
    ].includes(action)
  ) {

    sendError(
      res,
      400,
      "Invalid verification action."
    );

    return;
  }

  db.verificationRequests ||= [];

  const request =
    db.verificationRequests.find(
      item =>
        item.id ===
        requestId
    );

  if (!request) {

    sendError(
      res,
      404,
      "Verification request not found."
    );

    return;
  }

  const target =
    db.users.find(
      user =>
        user.id ===
        request.userId
    );

  if (!target) {

    sendError(
      res,
      404,
      "Verification user not found."
    );

    return;
  }

  const now =
    new Date().toISOString();

  if (
    action === "approve" ||
    action === "verify"
  ) {

    request.status =
      "verified";

    target.verified =
      true;

    target.verificationStatus =
      "verified";

    target.verifiedAt =
      now;

  } else if (
    action === "reject"
  ) {

    request.status =
      "rejected";

    target.verified =
      false;

    target.verificationStatus =
      "rejected";

  } else {

    request.status =
      "revoked";

    target.verified =
      false;

    target.verificationStatus =
      "revoked";

  }

  request.updatedAt =
    now;

  request.reviewedAt =
    now;

  request.reviewedBy =
    admin.username;

  target.updatedAt =
    now;

  saveDB(db);

  sendJSON(
    res,
    200,
    {
      success: true,

      action,

      message:
        action === "approve" ||
        action === "verify"
          ? "Account verified successfully."
          : action === "reject"
            ? "Verification request rejected."
            : "Verification revoked."
    }
  );

  return;
}

/* ============================================================
   RIZORA SOCIAL ROUTES V2
   ============================================================ */

if(
  method === "GET" &&
  pathname === "/api/social/tasks"
){

  const user =
    getCurrentUser(
      db,
      req
    );

  if(!user){

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;

  }

  ensureRizoraSocialDB(db);

  const tasks =
    db.socialTasks
      .filter(
        task =>
          task.status === "active" &&
          (
            task.creatorId !== user.id ||
            task.sponsored
          )
      )
      .map(
        task => {

          const cooldown =
            task.sponsored
              ? rzSocialCooldown(
                  db,
                  user.id,
                  task.id
                )
              : 0;

          return {

            ...task,

            completed:
              task.sponsored
                ? cooldown > 0
                : db.socialCompletions.some(
                    item =>
                      item.userId === user.id &&
                      item.taskId === task.id
                  ),

            cooldownMs:
              cooldown

          };

        }
      );

  sendJSON(
    res,
    200,
    {
      success:true,
      tasks
    }
  );

  return;

}

if(
  method === "GET" &&
  pathname === "/api/social/overview"
){

  const user =
    getCurrentUser(
      db,
      req
    );

  if(!user){

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;

  }

  ensureRizoraSocialDB(db);

  const completed =
    db.socialCompletions.filter(
      item =>
        item.userId === user.id
    );

  const campaigns =
    db.socialTasks.filter(
      task =>
        task.creatorId === user.id
    );

  const earned =
    completed.reduce(
      (
        total,
        item
      ) =>
        total +
        rzSocialNumber(
          item.reward,
          0
        ),
      0
    );

  sendJSON(
    res,
    200,
    {
      success:true,

      points:
        rzSocialNumber(
          user.points,
          0
        ),

      completed:
        completed.length,

      earned,

      campaigns:
        campaigns.length
    }
  );

  return;

}

if(
  method === "GET" &&
  pathname === "/api/social/mine"
){

  const user =
    getCurrentUser(
      db,
      req
    );

  if(!user){

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;

  }

  ensureRizoraSocialDB(db);

  const campaigns =
    db.socialTasks
      .filter(
        task =>
          task.creatorId === user.id
      )
      .sort(
        (a,b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );

  sendJSON(
    res,
    200,
    {
      success:true,
      campaigns
    }
  );

  return;

}

if(
  method === "POST" &&
  pathname === "/api/social/tasks/create"
){

  const user =
    getCurrentUser(
      db,
      req
    );

  if(!user){

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;

  }

  let body;

  try{

    body =
      await readBody(req);

  }catch(error){

    sendError(
      res,
      400,
      error.message
    );

    return;

  }

  ensureRizoraSocialDB(db);

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

  const url =
    cleanString(
      body.url,
      1000
    );

  const title =
    cleanString(
      body.title,
      160
    ) ||
    "Creator growth campaign";

  const description =
    cleanString(
      body.description,
      1000
    );

  const reward =
    Math.floor(
      rzSocialNumber(
        body.reward,
        0
      )
    );

  const quantity =
    Math.floor(
      rzSocialNumber(
        body.quantity,
        0
      )
    );

  if(
    !RIZORA_SOCIAL_PLATFORMS.has(
      platform
    )
  ){

    sendError(
      res,
      400,
      "Unsupported social platform."
    );

    return;

  }

  if(
    !RIZORA_SOCIAL_ACTIONS.has(
      action
    )
  ){

    sendError(
      res,
      400,
      "Unsupported social action."
    );

    return;

  }

  if(
    !rzSocialValidURL(url)
  ){

    sendError(
      res,
      400,
      "Enter a valid social URL."
    );

    return;

  }

  if(
    reward <
      RIZORA_SOCIAL_MIN_REWARD ||
    reward >
      RIZORA_SOCIAL_MAX_REWARD
  ){

    sendError(
      res,
      400,
      "Reward must be between 5 and 100 points."
    );

    return;

  }

  if(
    quantity < 1 ||
    quantity >
      RIZORA_SOCIAL_MAX_QUANTITY
  ){

    sendError(
      res,
      400,
      "Quantity must be between 1 and 500."
    );

    return;

  }

  const budget =
    reward * quantity;

  const points =
    rzSocialNumber(
      user.points,
      0
    );

  if(points < budget){

    sendError(
      res,
      400,
      `You need ${budget} points to fund this campaign.`
    );

    return;

  }

  user.points =
    points -
    budget;

  const task = {

    id:
      uid("social_"),

    title,

    description,

    platform,

    action,

    url,

    reward,

    quantity,

    completedCount:0,

    fundedRemaining:
      budget,

    creatorId:
      user.id,

    sponsored:false,

    status:
      "active",

    createdAt:
      new Date().toISOString()

  };

  db.socialTasks.push(
    task
  );

  saveDB(db);

  sendJSON(
    res,
    201,
    {
      success:true,
      task,
      points:
        rzSocialNumber(
          user.points,
          0
        )
    }
  );

  return;

}

if(
  method === "POST" &&
  pathname === "/api/social/tasks/complete"
){

  const user =
    getCurrentUser(
      db,
      req
    );

  if(!user){

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;

  }

  let body;

  try{

    body =
      await readBody(req);

  }catch(error){

    sendError(
      res,
      400,
      error.message
    );

    return;

  }

  ensureRizoraSocialDB(db);

  const taskId =
    cleanString(
      body.taskId ||
      body.id,
      120
    );

  const task =
    db.socialTasks.find(
      item =>
        item.id === taskId &&
        item.status === "active"
    );

  if(!task){

    sendError(
      res,
      404,
      "Social task not found."
    );

    return;

  }

  if(
    task.creatorId === user.id &&
    !task.sponsored
  ){

    sendError(
      res,
      400,
      "You cannot complete your own campaign."
    );

    return;

  }

  const previous =
    db.socialCompletions.find(
      item =>
        item.userId === user.id &&
        item.taskId === task.id
    );

  if(
    task.sponsored
  ){

    const cooldown =
      rzSocialCooldown(
        db,
        user.id,
        task.id
      );

    if(cooldown > 0){

      sendError(
        res,
        429,
        "This mission is on cooldown. Come back later."
      );

      return;

    }

  }else{

    if(previous){

      sendError(
        res,
        409,
        "You already completed this campaign."
      );

      return;

    }

  }

  const reward =
    Math.max(
      5,
      Math.floor(
        rzSocialNumber(
          task.reward,
          0
        )
      )
    );

  if(
    !task.sponsored &&
    rzSocialNumber(
      task.fundedRemaining,
      0
    ) < reward
  ){

    sendError(
      res,
      409,
      "This campaign has no funded rewards remaining."
    );

    return;

  }

  const completion = {

    id:
      uid("social_completion_"),

    taskId:
      task.id,

    userId:
      user.id,

    creatorId:
      task.creatorId || null,

    reward,

    createdAt:
      new Date().toISOString()

  };

  db.socialCompletions.push(
    completion
  );

  user.points =
    rzSocialNumber(
      user.points,
      0
    ) +
    reward;

  task.completedCount =
    rzSocialNumber(
      task.completedCount,
      0
    ) +
    1;

  if(!task.sponsored){

    task.fundedRemaining =
      Math.max(
        0,
        rzSocialNumber(
          task.fundedRemaining,
          0
        ) -
        reward
      );

    if(
      task.fundedRemaining <= 0
    ){

      task.status =
        "completed";

    }

    if(task.creatorId){

      rzSocialNotify(
        db,
        task.creatorId,
        "Campaign completed",
        `${user.displayName || user.username || "A creator"} completed "${task.title}" and earned ${reward} points.`
      );

    }

  }

  if(
    typeof pushPointsLedger ===
    "function"
  ){

    try{

      pushPointsLedger(
        db,
        user.id,
        "credit",
        reward,
        "social_task",
        {
          taskId:
            task.id
        }
      );

    }catch(_){}

  }

  saveDB(db);

  sendJSON(
    res,
    200,
    {
      success:true,

      reward,

      points:
        rzSocialNumber(
          user.points,
          0
        ),

      user,

      completion
    }
  );

  return;

}

if(
  method === "POST" &&
  pathname === "/api/social/tasks/cancel"
){

  const user =
    getCurrentUser(
      db,
      req
    );

  if(!user){

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;

  }

  let body;

  try{

    body =
      await readBody(req);

  }catch(error){

    sendError(
      res,
      400,
      error.message
    );

    return;

  }

  ensureRizoraSocialDB(db);

  const task =
    db.socialTasks.find(
      item =>
        item.id ===
        cleanString(
          body.taskId ||
          body.id,
          120
        )
    );

  if(!task){

    sendError(
      res,
      404,
      "Campaign not found."
    );

    return;

  }

  if(
    task.creatorId !==
    user.id
  ){

    sendError(
      res,
      403,
      "You cannot cancel this campaign."
    );

    return;

  }

  if(
    task.status !==
    "active"
  ){

    sendError(
      res,
      400,
      "This campaign is already closed."
    );

    return;

  }

  const refund =
    Math.max(
      0,
      rzSocialNumber(
        task.fundedRemaining,
        0
      )
    );

  user.points =
    rzSocialNumber(
      user.points,
      0
    ) +
    refund;

  task.status =
    "cancelled";

  task.fundedRemaining =
    0;

  if(
    typeof pushPointsLedger ===
    "function"
  ){

    try{

      pushPointsLedger(
        db,
        user.id,
        "credit",
        refund,
        "social_campaign_refund",
        {
          taskId:
            task.id
        }
      );

    }catch(_){}

  }

  saveDB(db);

  sendJSON(
    res,
    200,
    {
      success:true,
      refund,

      points:
        rzSocialNumber(
          user.points,
          0
        ),

      user
    }
  );

  return;

}

if(
  method === "GET" &&
  pathname === "/api/notifications"
){

  const user =
    getCurrentUser(
      db,
      req
    );

  if(!user){

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;

  }

  ensureRizoraSocialDB(db);

  const notifications =
    db.notifications
      .filter(
        item =>
          item.userId === user.id
      )
      .sort(
        (a,b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      )
      .slice(0,100);

  sendJSON(
    res,
    200,
    {
      success:true,
      notifications
    }
  );

  return;

}

if(
  method === "POST" &&
  pathname === "/api/notifications/read"
){

  const user =
    getCurrentUser(
      db,
      req
    );

  if(!user){

    sendError(
      res,
      401,
      "Authentication required."
    );

    return;

  }

  ensureRizoraSocialDB(db);

  for(
    const notification
    of db.notifications
  ){

    if(
      notification.userId ===
      user.id
    ){

      notification.read =
        true;

    }

  }

  saveDB(db);

  sendJSON(
    res,
    200,
    {
      success:true
    }
  );

  return;

}

/* ============================================================
   OFFICIAL VERIFIED PROFILES
============================================================ */

if (
  method === "GET" &&
  pathname === "/api/official/profiles"
) {

  const officialDb =
    loadDB();

  officialDb.officialProfiles ||=
    [];

  sendJSON(
    res,
    200,
    {
      success: true,
      profiles:
        officialDb
          .officialProfiles
          .filter(
            profile =>
              profile &&
              profile.verified === true
          )
          .map(profile => ({
            ...profile
          }))
    }
  );

  return;
}
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

  // ============================================================
  // RIZORA CORS COMPATIBILITY
  // ============================================================

  const RIZORA_ALLOWED_ORIGINS = new Set([
    "https://rizora.com.ng",
    "https://www.rizora.com.ng",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5500",
    "http://127.0.0.1:5500"
  ]);

  const rizoraOrigin = req.headers.origin;

  if (
    rizoraOrigin &&
    RIZORA_ALLOWED_ORIGINS.has(rizoraOrigin)
  ) {
    res.setHeader(
      "Access-Control-Allow-Origin",
      rizoraOrigin
    );

    res.setHeader(
      "Access-Control-Allow-Credentials",
      "true"
    );
  }

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS"
  );

  res.setHeader(
    "Vary",
    "Origin"
  );

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!res.headersSent) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=()");
  }
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

/* ============================================================
   RIZORA OFFICIAL VERIFIED IDENTITIES V1
============================================================ */

function seedRizoraOfficialIdentities(db) {

  db.officialProfiles ||= [];

  const romiUser =
    db.users.find(
      user =>
        normalizeUsername(user.username) === "romi"
    );

  if (romiUser) {

    romiUser.displayName =
      romiUser.displayName ||
      "RoMi";

    romiUser.publicUsername =
      "romi.noir";

    romiUser.socialHandle =
      "romi.noir";

    romiUser.verified = true;

    romiUser.verificationStatus =
      "verified";

    romiUser.verificationType =
      "official_creator";

    romiUser.official = true;

    romiUser.accountType =
      "creator";

    romiUser.avatarUrl =
      romiUser.avatarUrl ||
      "/rizora-cover.png";
  }

  const profiles = [
    {
      id: "official_rizora",
      username: "rizora",
      displayName: "RIZORA",
      publicUsername: "rizora",
      bio:
        "Creator growth. Content. Community. AI. Built for creators.",
      avatarUrl: "/rizora-cover.png",
      verified: true,
      verificationStatus: "verified",
      verificationType: "official_platform",
      official: true,
      accountType: "platform",
      links: {
        website: "https://rizora.com.ng/",
        tiktok:
          "https://www.tiktok.com/@official_rizora.hq",
        instagram:
          "https://www.instagram.com/rizora.hq",
        x:
          "https://x.com/Rizora_hq"
      }
    },
    {
      id: "official_romi",
      username: "romi.noir",
      displayName: "RoMi",
      publicUsername: "romi.noir",
      bio:
        "Artist. Developer. Creator. Builder. Creator of RIZORA.",
      avatarUrl: "/rizora-cover.png",
      verified: true,
      verificationStatus: "verified",
      verificationType: "official_creator",
      official: true,
      accountType: "creator",
      links: {
        tiktok:
          "https://www.tiktok.com/@romi.noir",
        website:
          "https://rizora.com.ng/"
      },
      userId:
        romiUser
          ? romiUser.id
          : null
    }
  ];

  for (const profile of profiles) {

    const existing =
      db.officialProfiles.find(
        item =>
          item.id === profile.id
      );

    if (existing) {
      Object.assign(
        existing,
        profile
      );
    } else {
      db.officialProfiles.push({
        ...profile,
        createdAt:
          new Date().toISOString(),
        updatedAt:
          new Date().toISOString()
      });
    }
  }

  return db;
}

/* ============================================================
   RIZORA GROQ RESILIENT COMPLETION V1
============================================================ */

async function rizoraGroqCompletion(options) {

  const apiKey =
    String(options.apiKey || "").trim();

  const primaryModel =
    String(
      options.model ||
      "openai/gpt-oss-120b"
    ).trim();

  const messages =
    Array.isArray(options.messages)
      ? options.messages
      : [];

  async function request(modelName) {

    return fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
          Authorization:
            `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages,
          temperature: 0.7,
          max_completion_tokens: 1200
        })
      }
    );
  }

  let response =
    await request(primaryModel);

  if (
    [500, 502, 503].includes(
      response.status
    ) &&
    primaryModel !==
      "openai/gpt-oss-20b"
  ) {

    console.warn(
      "RIZORA AI primary model unavailable. Falling back to openai/gpt-oss-20b."
    );

    try {
      await response.text();
    } catch (_) {}

    response =
      await request(
        "openai/gpt-oss-20b"
      );
  }

  return response;
}

/* ============================================================
   OFFICIAL PROFILE API
============================================================ */
function seedDatabase() {
  const db = loadDB();

  seedTasks(db);
  seedRizoraOfficialIdentities(db);
  ensureOfficialPlatformAccount(db);

  const configuredSuperAdminsChanged =
    ensureConfiguredSuperAdminAccounts(db);

  let changed = configuredSuperAdminsChanged;

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

/* ============================================================
   RIZORA SOCIAL ENGINE V2
   ============================================================ */

const RIZORA_SOCIAL_COOLDOWN_MS =
  7 * 60 * 1000;

const RIZORA_SOCIAL_MIN_REWARD =
  5;

const RIZORA_SOCIAL_MAX_REWARD =
  100;

const RIZORA_SOCIAL_MAX_QUANTITY =
  500;

const RIZORA_SOCIAL_PLATFORMS =
  new Set([
    "tiktok",
    "instagram",
    "x",
    "youtube",
    "facebook",
    "website"
  ]);

const RIZORA_SOCIAL_ACTIONS =
  new Set([
    "follow",
    "like",
    "share",
    "comment",
    "subscribe",
    "visit"
  ]);

function ensureRizoraSocialDB(db){

  db.socialTasks ||= [];
  db.socialCompletions ||= [];
  db.notifications ||= [];

  const official = [
    {
      id:"rz_official_tiktok",

      title:
        "Follow @official_rizora.hq on TikTok",

      description:
        "Follow the official RIZORA TikTok account.",

      platform:"tiktok",

      action:"follow",

      url:
        "https://www.tiktok.com/@official_rizora.hq",

      reward:100,

      sponsored:true
    },

    {
      id:"rz_official_instagram",

      title:
        "Follow @rizora.hq on Instagram",

      description:
        "Follow the official RIZORA Instagram account.",

      platform:"instagram",

      action:"follow",

      url:
        "https://www.instagram.com/rizora.hq",

      reward:75,

      sponsored:true
    },

    {
      id:"rz_official_x",

      title:
        "Follow @Rizora_hq on X",

      description:
        "Follow the official RIZORA X account.",

      platform:"x",

      action:"follow",

      url:
        "https://x.com/Rizora_hq",

      reward:75,

      sponsored:true
    },

    {
      id:"rz_romi_tiktok",

      title:
        "Follow @romi.noir on TikTok",

      description:
        "Follow RoMi's official TikTok account.",

      platform:"tiktok",

      action:"follow",

      url:
        "https://www.tiktok.com/@romi.noir",

      reward:75,

      sponsored:true
    }
  ];

  for(
    const task
    of official
  ){

    const exists =
      db.socialTasks.some(
        item =>
          item.id === task.id
      );

    if(!exists){

      db.socialTasks.push({

        ...task,

        creatorId:null,

        quantity:null,

        completedCount:0,

        fundedRemaining:null,

        status:"active",

        createdAt:
          new Date().toISOString()

      });

    }

  }

  return db;
}

function rzSocialNumber(
  value,
  fallback
){

  const n =
    Number(value);

  if(
    Number.isFinite(n)
  ){
    return n;
  }

  return fallback || 0;
}

function rzSocialValidURL(
  value
){

  try{

    const parsed =
      new URL(
        String(value || "").trim()
      );

    return (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:"
    );

  }catch{

    return false;

  }

}

function rzSocialCooldown(
  db,
  userId,
  taskId
){

  const latest =
    db.socialCompletions
      .filter(
        item =>
          item.userId === userId &&
          item.taskId === taskId
      )
      .sort(
        (a,b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      )[0];

  if(!latest){

    return 0;

  }

  const next =
    new Date(
      latest.createdAt
    ).getTime() +
    RIZORA_SOCIAL_COOLDOWN_MS;

  return Math.max(
    0,
    next - Date.now()
  );

}

function rzSocialNotify(
  db,
  userId,
  title,
  message
){

  db.notifications.push({

    id:
      uid("notif_"),

    userId,

    title,

    message,

    type:
      "social",

    read:false,

    createdAt:
      new Date().toISOString()

  });

}

const RIZORA_SCHEDULE_PUBLISHER = setInterval(() => {
  try {
    const scheduledDb = loadDB();
    publishDueSchedules(scheduledDb, { saveDB, cleanString, uid });
  } catch (error) {
    console.error("RIZORA scheduler error:", error);
  }
}, 30000);

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

  clearInterval(RIZORA_SCHEDULE_PUBLISHER);

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







































