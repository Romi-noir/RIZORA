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
    assert(me.res.status === 200 && me.data.user && me.data.user.username === username, "auth/me failed");

    const v2me = await request("/api/v2/me", { headers: authHeaders });
    assert(v2me.res.status === 200 && v2me.data.user, "v2/me failed");

    const feed = await request("/api/v2/feed?tab=for-you", { headers: authHeaders });
    assert(feed.res.status === 200 && Array.isArray(feed.data.posts), "feed failed");

    const tasks = await request("/api/tasks", { headers: authHeaders });
    assert(tasks.res.status === 200 && Array.isArray(tasks.data.tasks), "tasks failed");

    const media = await request("/api/v2/media/config", { headers: authHeaders });
    assert(media.res.status === 200 && Number(media.data.maxFileBytes) > 0, "media config failed");

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
