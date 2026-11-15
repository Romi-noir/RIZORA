"use strict";

const assert = require("node:assert/strict");
const integrations = require("../rizora-integrations");
const { authContactForUser } = require("../rizora-auth-identity");

const ENV_KEYS = [
  "NODE_ENV",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PRIVATE_MEDIA_BUCKET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "TURNSTILE_SITE_KEY",
  "TURNSTILE_SECRET_KEY"
];
const previousEnv = Object.fromEntries(ENV_KEYS.map(key => [key, process.env[key]]));
const previousFetch = global.fetch;

function setEnv() {
  process.env.NODE_ENV = "test";
  process.env.SUPABASE_URL = "https://project.example.supabase.co";
  process.env.SUPABASE_ANON_KEY = "test-publishable-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  process.env.SUPABASE_PRIVATE_MEDIA_BUCKET = "rizora-private-media";
  process.env.CLOUDINARY_CLOUD_NAME = "rizora-test";
  process.env.CLOUDINARY_API_KEY = "test-cloudinary-key";
  process.env.CLOUDINARY_API_SECRET = "test-cloudinary-secret";
  process.env.TURNSTILE_SITE_KEY = "test-turnstile-site-key";
  process.env.TURNSTILE_SECRET_KEY = "test-turnstile-secret";
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function main() {
  assert.deepEqual(authContactForUser({ email: "creator@example.test", emailVerified: true, phone: "+2348012345678", phoneVerified: true }), {
    email: "creator@example.test",
    phone: ""
  });
  assert.deepEqual(authContactForUser({ email: "creator@example.test", emailVerified: false, phone: "+2348012345678", phoneVerified: true }), {
    email: "",
    phone: "+2348012345678"
  });
  assert.equal(authContactForUser({ username: "creator" }), null);
  setEnv();
  const status = integrations.integrationStatus();
  assert.equal(status.auth, true);
  assert.equal(status.privateStorage, true);
  assert.equal(status.publicStorage, true);
  assert.equal(status.challenge, true);

  const upload = integrations.createCloudinaryUploadIntent({
    id: "media-test-1",
    ownerId: "user-test-1",
    mimeType: "image/png"
  });
  assert.equal(upload.provider, "cloudinary");
  assert.equal(upload.overwrite, false);
  assert.equal(upload.resourceType, "image");
  assert.match(upload.signature, /^[a-f0-9]{40}$/);
  assert.equal(upload.signature, integrations.cloudinarySignature({
    public_id: upload.publicId,
    timestamp: upload.timestamp,
    overwrite: false
  }, process.env.CLOUDINARY_API_SECRET));

  const cloudinaryResponse = {
    public_id: upload.publicId,
    version: "1731610000",
    bytes: 2048,
    secure_url: "https://rizora-test.res.cloudinary.com/image/upload/v1731610000/rizora/test/media-test-1.png",
    signature: integrations.cloudinarySignature({ public_id: upload.publicId, version: "1731610000" }, process.env.CLOUDINARY_API_SECRET)
  };
  assert.equal(integrations.verifyCloudinaryUpload({ intent: upload, response: cloudinaryResponse, expectedBytes: 2048 }), true);
  assert.equal(integrations.verifyCloudinaryUpload({ intent: upload, response: cloudinaryResponse, expectedBytes: 2049 }), false);

  let supabaseRequest;
  global.fetch = async (url, options) => {
    supabaseRequest = { url: String(url), options };
    return jsonResponse({
      signedURL: "/storage/v1/object/upload/sign/rizora-private-media/user-test/media-test.mp4",
      token: "temporary-upload-token"
    });
  };
  const privateUpload = await integrations.createPrivateUploadIntent({ objectPath: "user-test/media-test.mp4" });
  assert.equal(privateUpload.bucket, "rizora-private-media");
  assert.equal(new URL(privateUpload.uploadUrl).origin, process.env.SUPABASE_URL);
  assert.equal(new URL(privateUpload.uploadUrl).searchParams.get("token"), "temporary-upload-token");
  assert.equal(supabaseRequest.options.headers.apikey, process.env.SUPABASE_SERVICE_ROLE_KEY);
  assert.equal(supabaseRequest.options.headers["x-upsert"], "false");

  let turnstileRequest;
  global.fetch = async (url, options) => {
    turnstileRequest = { url: String(url), options };
    return jsonResponse({ success: true });
  };
  const turnstile = await integrations.verifyTurnstile("single-use-test-token", "192.0.2.1");
  const turnstileBody = new URLSearchParams(turnstileRequest.options.body);
  assert.equal(turnstile.success, true);
  assert.equal(turnstileRequest.url, "https://challenges.cloudflare.com/turnstile/v0/siteverify");
  assert.equal(turnstileBody.get("secret"), "test-turnstile-secret");
  assert.equal(turnstileBody.get("response"), "single-use-test-token");
  assert.equal(turnstileBody.get("remoteip"), "192.0.2.1");

  let authRequest;
  global.fetch = async (url, options) => {
    authRequest = { url: String(url), options };
    return jsonResponse({ message: "OTP queued" });
  };
  await integrations.sendAuthOtp({ email: "creator@example.test", createUser: true, metadata: { username: "creator" } });
  assert.equal(authRequest.url, process.env.SUPABASE_URL + "/auth/v1/otp");
  assert.equal(authRequest.options.headers.apikey, "test-publishable-key");
  assert.deepEqual(JSON.parse(authRequest.options.body), { create_user: true, email: "creator@example.test", data: { username: "creator" } });

  global.fetch = async (url, options) => {
    authRequest = { url: String(url), options };
    return jsonResponse({ access_token: "google-access-token", user: { id: "google-user" } });
  };
  const googleSession = await integrations.signInWithIdToken("google", "google-id-token");
  assert.equal(googleSession.user.id, "google-user");
  assert.equal(authRequest.url, process.env.SUPABASE_URL + "/auth/v1/token?grant_type=id_token");
  assert.equal(authRequest.options.headers.apikey, "test-publishable-key");
  assert.deepEqual(JSON.parse(authRequest.options.body), {
    provider: "google",
    id_token: "google-id-token"
  });

  console.log("RIZORA provider integration tests: PASS");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  global.fetch = previousFetch;
  for (const key of ENV_KEYS) {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  }
});
