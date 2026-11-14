"use strict";

const crypto = require("crypto");

const PRIVATE_BUCKET_DEFAULT = "rizora-private-media";

function envValue(...names) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return value;
  }
  return "";
}

function integrationsConfig() {
  const supabaseUrl = envValue("SUPABASE_URL").replace(/\/+$/, "");
  const supabaseAnonKey = envValue("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY");
  const supabaseServiceKey = envValue("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY");
  const cloudinaryCloudName = envValue("CLOUDINARY_CLOUD_NAME");
  const cloudinaryApiKey = envValue("CLOUDINARY_API_KEY");
  const cloudinaryApiSecret = envValue("CLOUDINARY_API_SECRET");
  const turnstileSiteKey = envValue("TURNSTILE_SITE_KEY", "CLOUDFLARE_TURNSTILE_SITE_KEY");
  const turnstileSecretKey = envValue("TURNSTILE_SECRET_KEY", "CLOUDFLARE_TURNSTILE_SECRET_KEY");
  return {
    supabaseUrl,
    supabaseAnonKey,
    supabaseServiceKey,
    supabasePrivateBucket: envValue("SUPABASE_PRIVATE_MEDIA_BUCKET") || PRIVATE_BUCKET_DEFAULT,
    cloudinaryCloudName,
    cloudinaryApiKey,
    cloudinaryApiSecret,
    turnstileSiteKey,
    turnstileSecretKey
  };
}

function integrationStatus() {
  const config = integrationsConfig();
  return {
    auth: Boolean(config.supabaseUrl && config.supabaseAnonKey),
    passwordMigration: Boolean(config.supabaseUrl && config.supabaseServiceKey),
    privateStorage: Boolean(config.supabaseUrl && config.supabaseServiceKey),
    publicStorage: Boolean(config.cloudinaryCloudName && config.cloudinaryApiKey && config.cloudinaryApiSecret),
    challenge: Boolean(config.turnstileSiteKey && config.turnstileSecretKey),
    turnstileSiteKey: config.turnstileSiteKey || ""
  };
}

function integrationError(message, status = 503, code = "INTEGRATION_NOT_CONFIGURED") {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function requireSupabaseAuth() {
  const config = integrationsConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw integrationError("Supabase Auth is not configured on RIZORA yet.");
  }
  return config;
}

function requireSupabaseAdmin() {
  const config = integrationsConfig();
  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    throw integrationError("Supabase private storage is not configured on RIZORA yet.");
  }
  return config;
}

function requireCloudinary() {
  const config = integrationsConfig();
  if (!config.cloudinaryCloudName || !config.cloudinaryApiKey || !config.cloudinaryApiSecret) {
    throw integrationError("Cloudinary uploads are not configured on RIZORA yet.");
  }
  return config;
}

async function responseJson(response) {
  const text = await response.text();
  let body = {};
  try { body = text ? JSON.parse(text) : {}; } catch (_) { body = {}; }
  if (!response.ok) {
    const error = new Error("The connected provider could not complete that request.");
    error.status = response.status >= 500 ? 502 : response.status;
    error.providerStatus = response.status;
    error.providerCode = String(body.code || body.error_code || body.error || "").slice(0, 80);
    throw error;
  }
  return body;
}

async function providerJson(url, options = {}) {
  const response = await fetch(url, Object.assign({
    signal: AbortSignal.timeout(15000),
    headers: { Accept: "application/json" }
  }, options));
  return responseJson(response);
}

function supabaseHeaders(config, { admin = false, accessToken = "" } = {}) {
  const key = admin ? config.supabaseServiceKey : config.supabaseAnonKey;
  const token = accessToken || (admin ? config.supabaseServiceKey : "");
  if (!key) throw integrationError("Supabase is not configured on RIZORA yet.");
  return {
    apikey: key,
    Authorization: "Bearer " + (token || key),
    "Content-Type": "application/json",
    Accept: "application/json"
  };
}

async function supabaseAuthRequest(pathname, body, options = {}) {
  const config = options.admin ? requireSupabaseAdmin() : requireSupabaseAuth();
  return providerJson(config.supabaseUrl + "/auth/v1" + pathname, {
    method: options.method || "POST",
    headers: supabaseHeaders(config, options),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function sendAuthOtp({ email, phone, createUser, metadata, captchaToken }) {
  const body = { create_user: createUser === true };
  if (email) body.email = email;
  if (phone) body.phone = phone;
  if (metadata && typeof metadata === "object") body.data = metadata;
  return supabaseAuthRequest("/otp", body);
}

async function verifyAuthOtp({ email, phone, token, type, captchaToken }) {
  const body = { token: String(token || ""), type: String(type || "") };
  if (email) body.email = email;
  if (phone) body.phone = phone;
  return supabaseAuthRequest("/verify", body);
}

async function signInWithPassword(identity, password) {
  const body = typeof identity === "string" ? { email: identity, password } : Object.assign({}, identity || {}, { password });
  return supabaseAuthRequest("/token?grant_type=password", body);
}

async function signInWithIdToken(provider, idToken, nonce) {
  const body = { provider: String(provider || ""), id_token: String(idToken || "") };
  if (nonce) body.nonce = String(nonce);
  return supabaseAuthRequest("/token?grant_type=id_token", body);
}

async function createLegacySupabaseUser({ email, phone, password, metadata }) {
  const body = { password, user_metadata: metadata || {} };
  if (email) { body.email = email; body.email_confirm = true; }
  if (phone) { body.phone = phone; body.phone_confirm = true; }
  return supabaseAuthRequest("/admin/users", body, { admin: true });
}

async function requestPasswordRecovery(email, captchaToken, redirectTo) {
  const params = redirectTo ? "?redirect_to=" + encodeURIComponent(redirectTo) : "";
  const body = { email };
  if (captchaToken) body.gotrue_meta_security = { captcha_token: captchaToken };
  return supabaseAuthRequest("/recover" + params, body);
}

async function updateSupabasePassword(accessToken, password) {
  return supabaseAuthRequest("/user", { password }, { method: "PUT", accessToken });
}

async function verifyTurnstile(token, remoteIp) {
  const config = integrationsConfig();
  if (!config.turnstileSecretKey) {
    if (process.env.NODE_ENV === "production") {
      throw integrationError("Cloudflare verification is not configured on RIZORA yet.");
    }
    return { success: true, skipped: true };
  }
  if (!String(token || "").trim()) {
    throw integrationError("Complete the security check and try again.", 400, "TURNSTILE_REQUIRED");
  }
  const body = new URLSearchParams({ secret: config.turnstileSecretKey, response: String(token).trim() });
  if (remoteIp) body.set("remoteip", String(remoteIp));
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(10000)
  });
  const result = await responseJson(response);
  if (result.success !== true) {
    throw integrationError("The security check expired. Please try again.", 403, "TURNSTILE_REJECTED");
  }
  return result;
}

function cloudinarySignature(params, secret) {
  const serialized = Object.keys(params).filter(key => params[key] !== undefined && params[key] !== null && params[key] !== "")
    .sort().map(key => key + "=" + params[key]).join("&") + secret;
  return crypto.createHash("sha1").update(serialized, "utf8").digest("hex");
}

function createCloudinaryUploadIntent({ id, ownerId, mimeType }) {
  const config = requireCloudinary();
  const safeOwner = String(ownerId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  if (!safeOwner || !id) throw integrationError("A valid media upload could not be prepared.", 400, "MEDIA_INTENT_INVALID");
  const resourceType = String(mimeType || "").startsWith("image/") ? "image" : "video";
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = "rizora/" + safeOwner + "/" + String(id).replace(/[^a-zA-Z0-9_-]/g, "");
  const params = { public_id: publicId, timestamp, overwrite: false };
  return {
    provider: "cloudinary",
    cloudName: config.cloudinaryCloudName,
    apiKey: config.cloudinaryApiKey,
    timestamp,
    publicId,
    overwrite: false,
    resourceType,
    signature: cloudinarySignature(params, config.cloudinaryApiSecret),
    uploadUrl: "https://api.cloudinary.com/v1_1/" + encodeURIComponent(config.cloudinaryCloudName) + "/" + resourceType + "/upload"
  };
}

function verifyCloudinaryUpload({ intent, response, expectedBytes }) {
  const config = requireCloudinary();
  if (!intent || !response || response.public_id !== intent.publicId) return false;
  const expectedHost = config.cloudinaryCloudName + ".res.cloudinary.com";
  let parsed;
  try { parsed = new URL(String(response.secure_url || "")); } catch (_) { return false; }
  if (parsed.protocol !== "https:" || parsed.hostname !== expectedHost) return false;
  if (Number(response.bytes) !== Number(expectedBytes)) return false;
  if (!/^\d+$/.test(String(response.version || ""))) return false;
  const expectedSignature = cloudinarySignature({ public_id: response.public_id, version: response.version }, config.cloudinaryApiSecret);
  const actual = String(response.signature || "").toLowerCase();
  return actual.length === expectedSignature.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expectedSignature));
}

function encodeObjectPath(value) {
  return String(value || "").split("/").map(encodeURIComponent).join("/");
}

async function createPrivateUploadIntent({ objectPath }) {
  const config = requireSupabaseAdmin();
  const bucket = config.supabasePrivateBucket;
  const url = config.supabaseUrl + "/storage/v1/object/upload/sign/" + encodeURIComponent(bucket) + "/" + encodeObjectPath(objectPath);
  const result = await providerJson(url, {
    method: "POST",
    headers: Object.assign(supabaseHeaders(config, { admin: true }), { "x-upsert": "false" }),
    body: JSON.stringify({ upsert: false })
  });
  const signed = String(result.signedURL || result.signedUrl || result.url || "");
  const token = String(result.token || "");
  if (!signed && !token) throw integrationError("Supabase Storage did not return a signed upload.", 502, "STORAGE_SIGN_FAILED");
  let uploadUrl = signed;
  if (uploadUrl && !/^https?:\/\//i.test(uploadUrl)) {
    if (uploadUrl.startsWith("/storage/v1/")) uploadUrl = config.supabaseUrl + uploadUrl;
    else uploadUrl = config.supabaseUrl + "/storage/v1/" + uploadUrl.replace(/^\/+/, "");
  }
  if (!uploadUrl) uploadUrl = config.supabaseUrl + "/storage/v1/object/upload/sign/" + encodeURIComponent(bucket) + "/" + encodeObjectPath(objectPath);
  if (token && !new URL(uploadUrl).searchParams.has("token")) {
    const parsed = new URL(uploadUrl);
    parsed.searchParams.set("token", token);
    uploadUrl = parsed.href;
  }
  if (new URL(uploadUrl).origin !== new URL(config.supabaseUrl).origin) {
    throw integrationError("Supabase Storage returned an invalid upload address.", 502, "STORAGE_SIGN_INVALID");
  }
  return { provider: "supabase", bucket, objectPath, uploadUrl, token };
}

async function fetchPrivateObject(objectPath, range = "") {
  const config = requireSupabaseAdmin();
  const url = config.supabaseUrl + "/storage/v1/object/" + encodeURIComponent(config.supabasePrivateBucket) + "/" + encodeObjectPath(objectPath);
  const headers = supabaseHeaders(config, { admin: true });
  if (range) headers.Range = String(range).slice(0, 100);
  return fetch(url, { headers, signal: AbortSignal.timeout(30000) });
}

async function deletePrivateObject(objectPath) {
  const config = requireSupabaseAdmin();
  const url = config.supabaseUrl + "/storage/v1/object/" + encodeURIComponent(config.supabasePrivateBucket);
  return providerJson(url, {
    method: "DELETE",
    headers: supabaseHeaders(config, { admin: true }),
    body: JSON.stringify({ prefixes: [String(objectPath || "")] })
  });
}

async function deleteCloudinaryObject({ publicId, resourceType }) {
  const config = requireCloudinary();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { public_id: publicId, timestamp };
  const form = new URLSearchParams(Object.assign({}, params, { api_key: config.cloudinaryApiKey, signature: cloudinarySignature(params, config.cloudinaryApiSecret) }));
  return providerJson("https://api.cloudinary.com/v1_1/" + encodeURIComponent(config.cloudinaryCloudName) + "/" + (resourceType === "image" ? "image" : "video") + "/destroy", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form.toString()
  });
}

module.exports = {
  integrationStatus,
  integrationsConfig,
  integrationError,
  sendAuthOtp,
  verifyAuthOtp,
  signInWithPassword,
  signInWithIdToken,
  createLegacySupabaseUser,
  requestPasswordRecovery,
  updateSupabasePassword,
  verifyTurnstile,
  cloudinarySignature,
  createCloudinaryUploadIntent,
  verifyCloudinaryUpload,
  createPrivateUploadIntent,
  fetchPrivateObject,
  deletePrivateObject,
  deleteCloudinaryObject
};
