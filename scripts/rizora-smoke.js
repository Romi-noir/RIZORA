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

  assert(!indexSource.includes("/rizora-v2-growth.js"), "frontend must not load the backend-only rizora-v2-growth.js module");
  assert(suiteSource.includes("function modal("), "Creator Suite modal constructor is missing");
  assert(serviceWorkerSource.includes('RIZORA_CACHE="rizora-v2-shell-v22-runtimeauth"'), "PWA cache version must be v22");
  assert(!serviceWorkerSource.includes('"/rizora-v2-growth.js"'), "PWA cache must not contain the backend-only growth module");

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

    const cookie = cookieFrom(signup.res);
    assert(cookie.startsWith("rizora_session="), "signup did not return a session cookie");

    const authHeaders = { Cookie: cookie, "Content-Type": "application/json" };

    const me = await request("/api/auth/me", { headers: authHeaders });
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
    assert(tasks.res.status === 200 && Array.isArray(tasks.data.tasks), "tasks failed");

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
