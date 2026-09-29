"use strict";

const { spawn } = require("child_process");

const port = 3410;
const base = "http://127.0.0.1:" + port;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function request(path, options) {
  const res = await fetch(base + path, options || {});
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { raw: text }; }
  return { res, data };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cookieFrom(response) {
  const getter = response.headers.getSetCookie;
  const values = typeof getter === "function" ? getter.call(response.headers) : [];
  const joined = values.join("; ");
  if (joined) return joined.split(";")[0];
  const raw = response.headers.get("set-cookie") || "";
  return raw.split(";")[0];
}

async function main() {
  const indexSource = require("fs").readFileSync("index.html", "utf8");
  const suiteSource = require("fs").readFileSync("rizora-v2-suite.js", "utf8");
  const serviceWorkerSource = require("fs").readFileSync("service-worker.js", "utf8");
  const vercelConfig = JSON.parse(require("fs").readFileSync("vercel.json", "utf8"));
  const vercelIgnore = require("fs").readFileSync(".vercelignore", "utf8");
  const frontendModules = [
    "rizora-v2.js",
    "rizora-v2-enterprise-ui.js",
    "rizora-v2-suite.js",
    "rizora-v2-next.js",
    "rizora-v2-growth-ui.js",
    "rizora-v2-modern-ui.js",
    "rizora-v2-upgrades-ui.js",
    "rizora-v2-global-ui.js",
    "rizora-v2-media.js",
    "rizora-v2-voice.js",
    "rizora-v2-series-ui.js",
    "rizora-v2-events-ui.js",
    "rizora-v2-business-ui.js",
    "rizora-v2-comments-ui.js",
    "rizora-v2-labs-ui.js",
    "rizora-v2-hub.js",
    "rizora-v2-downloads.js"
  ];
  for (const modulePath of frontendModules) {
    const checked = require("child_process").spawnSync(process.execPath, ["--check", modulePath], { encoding: "utf8" });
    assert(checked.status === 0, "Frontend module syntax check failed: " + modulePath + "\n" + (checked.stderr || checked.stdout || ""));
  }

  assert(/(^|\n)database\/(?:\r?\n|$)/.test(vercelIgnore), "Vercel ignore must block the backend database directory");
  const backendFiles = [
    "server.js",
    "rizora-v2-backend.js",
    "rizora-v2-enterprise.js",
    "rizora-v2-global.js",
    "rizora-v2-labs.js",
    "rizora-v2-series.js",
    "rizora-v2-events.js",
    "rizora-v2-platform.js",
    "rizora-v2-growth.js",
    "rizora-v2-modern.js",
    "rizora-v2-upgrades.js",
    "rizora-v2-fans.js",
    "rizora-v2-comments.js",
    "rizora-v2-media-backend.js",
    "rizora-v2-business.js"
  ];
  for (const backendFile of backendFiles) {
    assert(vercelIgnore.split(/\r?\n/).includes(backendFile), "Vercel ignore must block backend module: " + backendFile);
  }
  const serviceWorkerAssets = Array.from(serviceWorkerSource.matchAll(/["']\/(?:[^"'?]+\.(?:js|css|png|json|html))["']/g)).map(m => m[1] || m[0].slice(1,-1));
  const premiumUiSource = require("fs").readFileSync("rizora-v2-enterprise-ui.js", "utf8");
  const coreUiSource = require("fs").readFileSync("rizora-v2.js", "utf8");

  assert(!indexSource.includes("/rizora-v2-growth.js"), "frontend must not load the backend-only rizora-v2-growth.js module");
  assert(suiteSource.includes("function modal("), "Creator Suite modal constructor is missing");
  assert(suiteSource.includes("function toast("), "Creator Suite toast helper is missing");
  assert(suiteSource.includes("bindSuiteButtons(b);"), "Creator Suite controls are not bound");
  assert(/RIZORA_CACHE="rizora-v2-shell-v\d+-voice-badge-ai"/.test(serviceWorkerSource), "PWA cache version must be a voice/badge cache");
  assert(!serviceWorkerSource.includes('"/rizora-v2-growth.js"'), "PWA cache must not contain the backend-only growth module");
  assert(!("framework" in vercelConfig), "Static Vercel config should not force a framework");
  assert(!("buildCommand" in vercelConfig), "Static Vercel config should not force a build command");
  assert(!("installCommand" in vercelConfig), "Static Vercel config should not force an install command");
  assert(!("outputDirectory" in vercelConfig), "Static Vercel config should serve the repository root directly");
  assert(Array.isArray(vercelConfig.rewrites) && vercelConfig.rewrites.some(x => x.source === "/login" && x.destination === "/"), "Vercel login rewrite is missing");
  for (const assetPath of new Set(serviceWorkerAssets)) {
    const fsPath = String(assetPath).replace(/^\//, "");
    assert(require("fs").existsSync(fsPath), "Service worker asset is missing: " + assetPath);
  }
  assert(indexSource.includes("/rizora-v2-experience.css"), "RIZORA experience stylesheet is not linked");
  assert(indexSource.includes("/rizora-v2-voice.js"), "RIZORA voice module is not linked");
  const voiceSource = require("fs").readFileSync("rizora-v2-voice.js", "utf8");
  const commentsSource = require("fs").readFileSync("rizora-v2-comments.js", "utf8");
   const mediaSource = require("fs").readFileSync("rizora-v2-media.js", "utf8");
  assert(voiceSource.includes('"/api/ai/transcribe"'), "AI voice transcription route is missing from voice module");
  assert(voiceSource.includes('data-chat-target'), "Voice module is not wired to one-to-one chats");
  assert(voiceSource.includes('data-post-id'), "Voice module is not wired to comments");
  assert(voiceSource.includes('id="aiInput"') || voiceSource.includes("#aiInput"), "Voice module is not wired to the AI composer");
  assert(voiceSource.includes("RIZORA_UPLOAD_FILE"), "Voice module is not wired to the media uploader");
  assert(voiceSource.includes("RIZORA_AI_SPEAK"), "AI voice playback helper is missing");
   assert(coreUiSource.includes("data-ai-speak"), "AI voice playback controls are missing from the AI UI");
  assert(mediaSource.includes('"audio/webm"'), "Media uploader must allow recorded WebM voice notes");
  assert(commentsSource.includes("mediaUrl:comment.mediaUrl||\"\""), "Comment moderation formatter must preserve voice media URL");
  assert(commentsSource.includes("messageType:comment.messageType||\"text\""), "Comment moderation formatter must preserve message type");

  assert(require("fs").existsSync("assets/rizora_verified_badge.svg"), "RIZORA verified badge asset is missing");
  assert(indexSource.includes("/assets/rizora_verified_badge.svg"), "RIZORA full verified badge is not wired into the landing UI");
  assert(serviceWorkerSource.includes("/rizora-v2-experience.css"), "RIZORA experience stylesheet is not cached by the PWA shell");
  assert(serviceWorkerSource.includes("/assets/rizora_verified_badge.svg"), "RIZORA verified badge is not cached by the PWA shell");
  assert(serviceWorkerSource.includes("/assets/rizora_verified_mark.svg"), "RIZORA verified mark is not cached by the PWA shell");
  assert(serviceWorkerSource.includes("/rizora-v2-voice.js"), "RIZORA voice module is not cached by the PWA shell");
  assert(premiumUiSource.includes("premium_plus"), "Premium+ UI wiring is missing");
  assert(premiumUiSource.includes('plan:"premium_plus"'), "Premium+ checkout plan is missing");
  assert(coreUiSource.includes("rzPremiumVerificationHint"), "Premium suggestion block is missing");
  assert(coreUiSource.includes("rzDismissPremiumSuggestion"), "Premium suggestion dismiss control is missing");
  const assetRefs = [
    ...Array.from(indexSource.matchAll(/src=["']\/([^"'?]+\.js)(?:\?[^"']*)?["']/g)).map(m => m[1]),
    ...Array.from(indexSource.matchAll(/href=["']\/([^"'?]+\.css)(?:\?[^"']*)?["']/g)).map(m => m[1])
  ].filter(Boolean);
  for (const asset of new Set(assetRefs)) {
    assert(require("fs").existsSync(asset), "Indexed frontend asset is missing: " + asset);
  }
  assert(!("buildCommand" in vercelConfig), "Static Vercel config should not force a Node build command");
  assert(!("installCommand" in vercelConfig), "Static Vercel config should not force dependency installation");
  assert(!("outputDirectory" in vercelConfig), "Static Vercel config should serve the repository root directly");

  const child = spawn(process.execPath, ["server.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      RIZORA_PUBLIC_URL: base
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let logs = "";
  child.stdout.on("data", chunk => { logs += chunk.toString(); });
  child.stderr.on("data", chunk => { logs += chunk.toString(); });

  try {
    let healthy = false;
    for (let i = 0; i < 60; i++) {
      try {
        const out = await request("/api/health");
        if (out.res.status === 200 && out.data.ok === true) {
          healthy = true;
          break;
        }
      } catch (_) {}
      await sleep(250);
    }
    assert(healthy, "Server did not become healthy.\n" + logs);

    for (const path of [
      "/api/auth/google/config",
      "/api/official/profiles",
      "/api/verification/me",
      "/robots.txt",
      "/sitemap.xml"
    ]) {
      const out = await request(path);
      if (path === "/api/verification/me") {
        assert([401, 200].includes(out.res.status), path + " unexpected status " + out.res.status);
      } else {
        assert(out.res.status === 200, path + " returned " + out.res.status);
      }
    }

    const badgeAsset = await request("/assets/rizora_verified_badge.svg");
    assert(badgeAsset.res.status === 200, "RIZORA verified badge asset is not publicly available");

    const officialProfiles = await request("/api/official/profiles");
    assert(officialProfiles.res.status === 200 && Array.isArray(officialProfiles.data.profiles), "official profiles endpoint failed");
    const officialHandles = new Set((officialProfiles.data.profiles || []).map(p => String(p.publicUsername || p.username || "").toLowerCase()));
    assert(officialHandles.has("rizora"), "RIZORA official verified profile is missing");
    assert(officialHandles.has("romi.noir"), "RoMi official verified profile is missing");
    assert((officialProfiles.data.profiles || []).filter(p => p.verified === true).length >= 2, "Expected two verified official identities");
    const rizoraOfficial = (officialProfiles.data.profiles || []).find(p => String(p.publicUsername || p.username || "").toLowerCase() === "rizora");
    const romiOfficial = (officialProfiles.data.profiles || []).find(p => String(p.publicUsername || p.username || "").toLowerCase() === "romi.noir");
    assert(rizoraOfficial && rizoraOfficial.links && rizoraOfficial.links.tiktok, "RIZORA official social links are missing");
    assert(romiOfficial && romiOfficial.links && romiOfficial.links.tiktok, "RoMi official social link is missing");

    const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const username = "smoke_" + suffix;
    const email = username + "@example.com";

    const signup = await request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        displayName: "RIZORA Smoke",
        email,
        password: "SmokePass123",
        confirmPassword: "SmokePass123"
      })
    });
    assert(signup.res.status === 201, "signup failed: " + JSON.stringify(signup.data));
    assert(signup.data.emailDelivery && typeof signup.data.emailDelivery.configured === "boolean", "signup email delivery status is missing");

    const cookie = cookieFrom(signup.res);
    assert(cookie.startsWith("rizora_session="), "signup did not return a session cookie");

    const authHeaders = { Cookie: cookie, "Content-Type": "application/json" };

    const me = await request("/api/auth/me", { headers: authHeaders });
    const welcomeNotifications = await request("/api/v2/notifications", { headers: authHeaders });
    assert(welcomeNotifications.res.status === 200 && (welcomeNotifications.data.notifications || []).some(n => n.type === "system" && /welcome/i.test(String(n.title || ""))), "welcome notification was not created");
    assert(me.res.status === 200 && me.data.user && me.data.user.username === username, "auth/me cookie session failed");

    const bearerHeaders = {
      Authorization: "Bearer " + signup.data.token,
      "Content-Type": "application/json"
    };

    const bearerMe = await request("/api/auth/me", { headers: bearerHeaders });
    assert(bearerMe.res.status === 200 && bearerMe.data.user && bearerMe.data.user.username === username, "auth/me bearer session failed");

    const v2me = await request("/api/v2/me", { headers: bearerHeaders });
    assert(v2me.res.status === 200 && v2me.data.user, "v2/me bearer session failed");

    const feed = await request("/api/v2/feed?tab=for-you", { headers: authHeaders });
    assert(feed.res.status === 200 && Array.isArray(feed.data.posts), "feed failed");

    const tasks = await request("/api/tasks", { headers: authHeaders });
    const corsPreflight = await request("/api/v2/profile", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:3000",
        "Access-Control-Request-Method": "PATCH"
      }
    });
    assert(corsPreflight.res.status === 204 && /PATCH/i.test(corsPreflight.res.headers.get("access-control-allow-methods") || ""), "CORS preflight does not allow PATCH requests");

    assert(tasks.res.status === 200 && Array.isArray(tasks.data.tasks), "tasks failed");
    assert(!(tasks.data.tasks || []).some(t => t.type === "social_follow"), "legacy social missions are still duplicated in the general task feed");
    const exploreTask = (tasks.data.tasks || []).find(t => t.id === "rizora_explore");
    assert(exploreTask && Number(exploreTask.points || exploreTask.reward || 0) === 50, "Explore task reward is not 50 points");
    const taskStart = await request("/api/tasks/start", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ taskId: exploreTask.id })
    });
    assert(taskStart.res.status === 200 && taskStart.data.success === true, "task start route is not working");
    await sleep(21000);
    const taskComplete = await request("/api/tasks/complete", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ taskId: exploreTask.id })
    });
    assert(taskComplete.res.status === 200 && Number(taskComplete.data.reward) === 50, "task completion/reward flow failed: " + JSON.stringify(taskComplete.data));
    assert(Number(taskComplete.data.cooldownMinutes || 0) === 7, "task cooldown is not 7 minutes");

    const socialTasks = await request("/api/social/tasks", { headers: authHeaders });
    assert(socialTasks.res.status === 200 && Array.isArray(socialTasks.data.tasks), "social tasks endpoint failed");
    const officialSocial = (socialTasks.data.tasks || []).filter(t => ["rz_official_tiktok","rz_official_instagram","rz_official_x","rz_romi_tiktok"].includes(t.id));
    assert(officialSocial.length === 4, "official social mission set is incomplete");
    const socialRewards = Object.fromEntries(officialSocial.map(t => [t.id, Number(t.reward || 0)]));
    assert(socialRewards.rz_official_tiktok === 100, "official TikTok social reward is not 100");
    assert(socialRewards.rz_official_instagram === 75, "official Instagram social reward is not 75");
    assert(socialRewards.rz_official_x === 75, "official X social reward is not 75");
    assert(socialRewards.rz_romi_tiktok === 75, "RoMi TikTok social reward is not 75");
    const socialComplete = await request("/api/social/tasks/complete", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ taskId: "rz_official_tiktok" })
    });
    assert(socialComplete.res.status === 200 && Number(socialComplete.data.reward) === 100, "official social task completion failed");
    assert(!socialComplete.data.user || !Object.prototype.hasOwnProperty.call(socialComplete.data.user, "passwordHash"), "social task response leaked passwordHash");

    const aiIdentity = await request("/api/ai/chat", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ message: "who is romi" })
    });
    assert(aiIdentity.res.status === 200 && aiIdentity.data.deterministic === true && /creator of RIZORA/i.test(aiIdentity.data.reply || ""), "RIZORA AI identity answer failed: " + aiIdentity.res.status + " " + JSON.stringify(aiIdentity.data));

    const aiUserIdentity = await request("/api/ai/chat", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ message: "who am i" })
    });
    assert(aiUserIdentity.res.status === 200 && aiUserIdentity.data.deterministic === true && new RegExp(username, "i").test(aiUserIdentity.data.reply || ""), "RIZORA AI signed-in identity answer failed: " + aiUserIdentity.res.status + " " + JSON.stringify(aiUserIdentity.data));

    const media = await request("/api/v2/media/config", { headers: authHeaders });
    assert(media.res.status === 200 && Number(media.data.maxFileBytes) > 0, "media config failed");

    const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const mediaUpload = await request("/api/v2/media/upload", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        filename: "smoke.png",
        mimeType: "image/png",
        data: tinyPng
      })
    });
    assert(mediaUpload.res.status === 201 && mediaUpload.data.media && mediaUpload.data.media.url, "media upload failed");
    const mediaFetch = await request(mediaUpload.data.media.url, { headers: { Cookie: cookie } });
    assert(mediaFetch.res.status === 200, "uploaded media could not be fetched");

    const voiceUpload = await request("/api/v2/media/upload", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        filename: "smoke-voice.webm",
        mimeType: "audio/webm",
        data: "AAAA"
      })
    });
    assert(voiceUpload.res.status === 201 && voiceUpload.data.media && voiceUpload.data.media.id, "voice media upload failed");

    const voicePeerUsername = "voicepeer_" + suffix;
    const voicePeerEmail = voicePeerUsername + "@example.com";
    const voicePeerSignup = await request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: voicePeerUsername,
        displayName: "RIZORA Voice Peer",
        email: voicePeerEmail,
        password: "SmokePass123",
        confirmPassword: "SmokePass123"
      })
    });
    assert(voicePeerSignup.res.status === 201, "voice peer signup failed: " + JSON.stringify(voicePeerSignup.data));
    const voiceRecipient = voicePeerUsername;
    const voiceMessage = await request("/api/v2/messages/" + encodeURIComponent(voiceRecipient), {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mediaId: voiceUpload.data.media.id,
        messageType: "voice"
      })
    });
    assert(voiceMessage.res.status === 201, "voice one-to-one message failed");

    const voiceThread = await request("/api/v2/messages/" + encodeURIComponent(voiceRecipient), { headers: authHeaders });
    const voiceRecord = (voiceThread.data.messages || []).find(m => m.messageType === "voice" && m.mediaUrl);
    assert(voiceRecord && voiceRecord.mediaUrl, "voice message media URL missing");
    const voiceOwnerFetch = await request(voiceRecord.mediaUrl, { headers: authHeaders });
    assert(voiceOwnerFetch.res.status === 200, "voice owner could not fetch the voice media");
    const voicePeerMe = await request("/api/auth/me", { headers: { Cookie: cookieFrom(voicePeerSignup.res) } });
    assert(voicePeerMe.res.status === 200 && voicePeerMe.data.user, "voice peer session failed");
    const voicePeerHeaders = { Cookie: cookieFrom(voicePeerSignup.res) };
    const voicePeerFetch = await request(voiceRecord.mediaUrl, { headers: voicePeerHeaders });
    assert(voicePeerFetch.res.status === 200, "voice recipient could not fetch the voice media");


    assert(voiceThread.res.status === 200 && voiceThread.data.messages.some(m => m.messageType === "voice" && m.mediaUrl), "voice one-to-one message did not round-trip");

    const postForVoice = await request("/api/v2/posts", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ text: "Voice comment smoke test" })
    });
    assert(postForVoice.res.status === 201 && postForVoice.data.post, "voice comment post creation failed");

    const voiceComment = await request("/api/v2/posts/" + encodeURIComponent(postForVoice.data.post.id) + "/comment", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        mediaId: voiceUpload.data.media.id,
        messageType: "voice"
      })
    });
    assert(voiceComment.res.status === 201, "voice comment creation failed");

    const voiceComments = await request("/api/v2/posts/" + encodeURIComponent(postForVoice.data.post.id) + "/comments", { headers: authHeaders });
    assert(voiceComments.res.status === 200 && voiceComments.data.comments.some(c => c.messageType === "voice" && c.mediaUrl), "voice comment did not round-trip");

    const transcribeReject = await request("/api/ai/transcribe", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ audio: "not-a-data-url", mimeType: "audio/webm" })
    });
    assert(transcribeReject.res.status === 400, "AI voice transcription validation route failed");

    const channel = await request("/api/v2/channels", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Smoke Channel", description: "Runtime test" })
    });
    assert(channel.res.status === 201 && channel.data.channel, "channel creation failed");

    const channelList = await request("/api/v2/channels", { headers: authHeaders });
    assert(channelList.res.status === 200 && Array.isArray(channelList.data.channels), "channel list failed");

    const post = await request("/api/v2/posts", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ text: "RIZORA smoke test #rizora" })
    });
    assert(post.res.status === 201 && post.data.post, "post creation failed");

    const feed2 = await request("/api/v2/feed?tab=for-you", { headers: authHeaders });
    assert(feed2.res.status === 200 && feed2.data.posts.some(p => p.id === post.data.post.id), "created post missing from feed");


    const draft = await request("/api/v2/drafts", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        title: "Smoke draft",
        text: "Draft content for runtime verification."
      })
    });
    assert(draft.res.status === 201 && draft.data.draft, "draft creation failed");

    const draftPublish = await request("/api/v2/drafts/" + encodeURIComponent(draft.data.draft.id) + "/publish", {
      method: "POST",
      headers: authHeaders,
      body: "{}"
    });
    assert(draftPublish.res.status === 201 && draftPublish.data.post, "draft publish failed");

    const scheduled = await request("/api/v2/schedules", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        scheduledFor: new Date(Date.now() + 120000).toISOString(),
        text: "Scheduled content for runtime verification."
      })
    });
    assert(scheduled.res.status === 201 && scheduled.data.schedule, "schedule creation failed");

    const scheduledPublish = await request("/api/v2/schedules/" + encodeURIComponent(scheduled.data.schedule.id) + "/publish", {
      method: "POST",
      headers: authHeaders,
      body: "{}"
    });
    assert(scheduledPublish.res.status === 201 && scheduledPublish.data.post, "scheduled publish failed");

    const poll = await request("/api/v2/polls", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        text: "Runtime poll",
        question: "Does the smoke test work?",
        options: ["Yes", "Absolutely"]
      })
    });
    assert(poll.res.status === 201 && poll.data.post && poll.data.post.poll, "poll creation failed");

    const series = await request("/api/v2/series", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        title: "Smoke Series",
        description: "Runtime series verification"
      })
    });
    assert(series.res.status === 201 && series.data.series, "series creation failed");

    const seriesEpisode = await request("/api/v2/series/" + encodeURIComponent(series.data.series.id) + "/episodes", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        postId: post.data.post.id,
        episodeNumber: 1,
        episodeTitle: "Episode One"
      })
    });
    assert(seriesEpisode.res.status === 200 && seriesEpisode.data.series, "series episode attach failed");

    const event = await request("/api/v2/events", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        title: "Smoke Event",
        description: "Runtime event verification",
        startsAt: new Date(Date.now() + 3600000).toISOString(),
        durationMinutes: 30,
        visibility: "public"
      })
    });
    assert(event.res.status === 201 && event.data.event, "event creation failed");

    const rsvp = await request("/api/v2/events/" + encodeURIComponent(event.data.event.id) + "/rsvp", {
      method: "POST",
      headers: authHeaders,
      body: "{}"
    });
    assert(rsvp.res.status === 200 && rsvp.data.event && rsvp.data.event.going === true, "event RSVP failed");

    const eventCancel = await request("/api/v2/events/" + encodeURIComponent(event.data.event.id) + "/cancel", {
      method: "POST",
      headers: authHeaders,
      body: "{}"
    });
    assert(eventCancel.res.status === 200 && eventCancel.data.event && eventCancel.data.event.status === "cancelled", "event cancel failed");

    const customFeed = await request("/api/v2/custom-feeds", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        title: "Smoke Feed",
        query: "rizora",
        hashtags: ["rizora"],
        creators: [username]
      })
    });
    assert(customFeed.res.status === 201 && customFeed.data.feed, "custom feed creation failed");

    const experiments = await request("/api/v2/experiments", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        title: "Smoke Experiment",
        hypothesis: "Variant B will improve engagement.",
        metric: "engagement",
        variantA: "Version A",
        variantB: "Version B"
      })
    });
    assert(experiments.res.status === 201 && experiments.data.experiment, "experiment creation failed");

    const memberships = await request("/api/v2/memberships/me", { headers: authHeaders });
    assert(memberships.res.status === 200 && Array.isArray(memberships.data.joined), "membership endpoint failed");

    const freeTier = await request("/api/v2/memberships/free-tiers", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Smoke Community",
        description: "Free membership runtime verification",
        perks: ["Community access"],
        priceNaira: 0
      })
    });
    assert(freeTier.res.status === 201 && freeTier.data.tier && Number(freeTier.data.tier.priceNaira) === 0, "free tier creation failed");

    const joinUsername = "smoke_join_" + suffix;
    const joinEmail = joinUsername + "@example.com";
    const signup2 = await request("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: joinUsername,
        displayName: "RIZORA Smoke Member",
        email: joinEmail,
        password: "SmokePass123",
        confirmPassword: "SmokePass123"
      })
    });
    assert(signup2.res.status === 201, "second signup failed: " + JSON.stringify(signup2.data));
    const cookie2 = cookieFrom(signup2.res);
    assert(cookie2.startsWith("rizora_session="), "second signup did not return a session cookie");

    const joinHeaders = { Cookie: cookie2, "Content-Type": "application/json" };
    const freeJoin = await request("/api/v2/memberships/free-tiers/" + encodeURIComponent(freeTier.data.tier.id) + "/join", {
      method: "POST",
      headers: joinHeaders,
      body: "{}"
    });
    assert(freeJoin.res.status === 201 && freeJoin.data.joined === true, "free membership join failed");

    const freeCancel = await request("/api/v2/memberships/free-memberships/" + encodeURIComponent(freeJoin.data.membership.id) + "/cancel", {
      method: "POST",
      headers: joinHeaders,
      body: "{}"
    });
    assert(freeCancel.res.status === 200 && freeCancel.data.status === "cancelled", "free membership cancel failed");

    const products = await request("/api/v2/products", { headers: authHeaders });
    assert(products.res.status === 200 && Array.isArray(products.data.products), "products endpoint failed");

    const contentAnalytics = await request("/api/v2/analytics/content", { headers: authHeaders });
    assert(contentAnalytics.res.status === 200 && Array.isArray(contentAnalytics.data.posts), "content analytics failed");

    const aiStatus = await request("/api/ai/status");
    assert(aiStatus.res.status === 200 && aiStatus.data.provider === "groq", "AI status failed");

    const preferences = await request("/api/v2/preferences", { headers: authHeaders });
    assert(preferences.res.status === 200 && preferences.data.preferences, "preferences endpoint failed");

    const trials = await request("/api/v2/trials/mine", { headers: authHeaders });
    assert(trials.res.status === 200 && Array.isArray(trials.data.trials), "creator trials endpoint failed");

    const protection = await request("/api/v2/protection/mine", { headers: authHeaders });
    assert(protection.res.status === 200 && Array.isArray(protection.data.proofs), "content protection endpoint failed");

    const dataExport = await request("/api/v2/data/export", { headers: authHeaders });
    assert(dataExport.res.status === 200 && dataExport.data.data, "data export endpoint failed");

    const premium = await request("/api/v2/premium/status", { headers: authHeaders });
    assert(premium.res.status === 200 && "active" in premium.data, "premium status failed");

    const assistant = await request("/api/v2/assistant/brief", { headers: authHeaders });
    assert(assistant.res.status === 200 && assistant.data.brief && Array.isArray(assistant.data.brief.actions), "creator assistant failed");

    const insight = await request("/api/v2/search-insights?q=rizora", { headers: authHeaders });
    assert(insight.res.status === 200 && insight.data.insights, "search insights failed");

    const onboarding = await request("/api/v2/onboarding", { headers: authHeaders });
    assert(onboarding.res.status === 200 && Array.isArray(onboarding.data.tasks), "onboarding endpoint failed");

    const profile = await request("/api/v2/profiles/" + encodeURIComponent(username), { headers: authHeaders });
    assert(profile.res.status === 200 && profile.data.profile && profile.data.profile.username === username, "public creator profile failed");

    const support = await request("/api/v2/support/tickets", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        subject: "Smoke support ticket",
        message: "Runtime support workflow verification."
      })
    });
    assert(support.res.status === 201 && support.data.ticket, "support ticket creation failed");

    const business = await request("/api/v2/business/summary", { headers: authHeaders });
    assert(business.res.status === 200 && business.data.business && business.data.business.totals, "business summary failed");

    const portfolio = await request("/api/v2/portfolio", { headers: authHeaders });
    assert(portfolio.res.status === 200 && portfolio.data.portfolio, "portfolio endpoint failed");

    const plans = await request("/api/v2/plans", { headers: authHeaders });
    assert(plans.res.status === 200 && Array.isArray(plans.data.plans), "planning endpoint failed");

    const globalFeed = await request("/api/v2/feeds", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        name: "Smoke Global Feed",
        hashtags: ["rizora"],
        creatorIds: [username]
      })
    });
    assert(globalFeed.res.status === 201 && globalFeed.data.feed, "global custom feed creation failed");

    const globalFeedItems = await request("/api/v2/feeds/" + encodeURIComponent(globalFeed.data.feed.id) + "/items", { headers: authHeaders });
    assert(globalFeedItems.res.status === 200 && Array.isArray(globalFeedItems.data.posts), "global custom feed items failed");

    const insights = await request("/api/v2/search-insights?q=rizora", { headers: authHeaders });
    assert(insights.res.status === 200 && insights.data.insights && Array.isArray(insights.data.insights.trending), "search insights failed");

    console.log("RIZORA runtime smoke test: PASS");
  } finally {
    child.kill("SIGTERM");
    await sleep(500);
  }
}

main().catch(error => {
  console.error("RIZORA runtime smoke test: FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
