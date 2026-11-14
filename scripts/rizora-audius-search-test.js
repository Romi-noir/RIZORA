"use strict";

const assert = require("assert");
const { handleRizoraMusic } = require("../rizora-v2-music");

async function callSearch(query, address) {
  let response;
  const req = {
    method: "GET",
    url: "/api/music/audius/search?q=" + encodeURIComponent(query),
    headers: {},
    socket: { remoteAddress: address }
  };
  const res = {};
  const handled = await handleRizoraMusic({
    req,
    res,
    db: {},
    getCurrentUser: () => null,
    sendJSON: (_res, status, data) => { response = { status, data }; },
    sendError: (_res, status, message) => { response = { status, data: { error: message } }; }
  });
  assert.strictEqual(handled, true);
  return response;
}

async function main() {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.AUDIUS_API_KEY;
  let providerCalls = 0;
  let providerUrl;
  let providerHeaders;

  process.env.AUDIUS_API_KEY = "test-audius-key";
  global.fetch = async (url, options) => {
    providerCalls++;
    providerUrl = String(url);
    providerHeaders = options.headers;
    return {
      ok: true,
      json: async () => ({
        data: [
          {
            id: "track-123",
            title: "Night Drive",
            duration: 187,
            genre: "Electronic",
            permalink: "https://audius.co/artist/night-drive",
            artwork: { "480x480": "https://cdn.audius.co/artwork.jpg" },
            user: { name: "Sample Artist" }
          }
        ]
      })
    };
  };

  try {
    const result = await callSearch("night drive", "127.0.0.42");
    assert.strictEqual(result.status, 200);
    assert.strictEqual(result.data.provider, "Audius");
    assert.strictEqual(result.data.tracks[0].source, "audius");
    assert.strictEqual(result.data.tracks[0].title, "Night Drive");
    assert.strictEqual(result.data.tracks[0].artist, "Sample Artist");
    assert.strictEqual(result.data.tracks[0].duration, "3:07");
    assert.strictEqual(result.data.tracks[0].audioUrl, "https://api.audius.co/v1/tracks/track-123/stream?app_name=RIZORA");
    assert.strictEqual(result.data.tracks[0].storeUrl, "https://audius.co/artist/night-drive");
    assert(providerUrl.startsWith("https://api.audius.co/v1/tracks/search?"));
    assert.strictEqual(providerHeaders["x-api-key"], "test-audius-key");

    const invalid = await callSearch("x", "127.0.0.43");
    assert.strictEqual(invalid.status, 400);
    assert.strictEqual(providerCalls, 1);

    for (let i = 1; i < 30; i++) {
      const limited = await callSearch("night drive", "127.0.0.42");
      assert.strictEqual(limited.status, 200);
    }
    const rateLimited = await callSearch("night drive", "127.0.0.42");
    assert.strictEqual(rateLimited.status, 429);
    assert.strictEqual(providerCalls, 30);
    console.log("RIZORA Audius search checks: PASS");
  } finally {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.AUDIUS_API_KEY;
    else process.env.AUDIUS_API_KEY = originalApiKey;
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
