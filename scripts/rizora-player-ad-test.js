"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

class FakeAudio {
  constructor() {
    this.src = "";
    this.paused = true;
    this.currentTime = 0;
    this.duration = 30;
    this.volume = 1;
  }
  load() {}
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}

async function main() {
  const source = fs.readFileSync(path.join(__dirname, "..", "rizora-v2-player.js"), "utf8");
  const window = { RIZORA_CURRENT_USER: null };
  const context = {
    window,
    location: { origin: "https://rizora.test", hostname: "rizora.test" },
    Audio: FakeAudio,
    URL,
    Set,
    Date,
    Math,
    localStorage: { getItem: () => "[]", setItem: () => {} },
    setTimeout,
    clearTimeout,
    console
  };
  vm.runInNewContext(source, context, { filename: "rizora-v2-player.js" });
  const player = window.RIZORA_PLAYER;
  const makeTrack = id => ({ id, title: "Test song " + id, artist: "Test artist", audioUrl: "/track-" + id + ".mp3", source: "audius" });

  await player.playTrack(makeTrack("one"));
  await player.playTrack(makeTrack("two"));
  assert.strictEqual(player.adDue, true, "a free listener should reach an ad break after starting two songs");
  player.nextTrack();
  assert.strictEqual(player.isAd, true, "manual next must play the due ad before another song");
  assert.strictEqual(player.audio.src, "/assets/ads/rizora-ad-1.mp3");
  assert.strictEqual(player.activeAd.id, "rizora_ad_1");

  player.handleEnded();
  await player.playTrack(makeTrack("three"));
  await player.playTrack(makeTrack("four"));
  player.handleEnded();
  assert.strictEqual(player.audio.src, "/assets/ads/rizora-ad-2.mp3", "ads should rotate across the supplied audio files");

  player.handleEnded();
  await player.playTrack(makeTrack("five"));
  await player.playTrack(makeTrack("six"));
  player.handleEnded();
  assert.strictEqual(player.audio.src, "/assets/ads/rizora-ad-3-orekelewa.mp3");

  player.handleEnded();
  window.RIZORA_CURRENT_USER = { plan: "premium" };
  await player.playTrack(makeTrack("premium-one"));
  await player.playTrack(makeTrack("premium-two"));
  assert.strictEqual(player.isAd, false, "Premium listeners must not receive audio ads");
  assert.strictEqual(player.adDue, false);

  window.RIZORA_CURRENT_USER = { plan: "free", ownerAccount: true };
  await player.playTrack(makeTrack("owner-one"));
  await player.playTrack(makeTrack("owner-two"));
  assert.strictEqual(player.isAd, false, "owner bypass must be ad-free");

  for (const asset of [
    "assets/ads/rizora-ad-1.mp3",
    "assets/ads/rizora-ad-2.mp3",
    "assets/ads/rizora-ad-3-orekelewa.mp3",
    "assets/ads/rizora-video-ad.mp4",
    "assets/rizora-play-logo.jpg"
  ]) assert(fs.existsSync(path.join(__dirname, "..", asset)), "Missing supplied media asset: " + asset);

  console.log("RIZORA player ad checks: PASS");
}

main().catch(error => {
  console.error("RIZORA player ad checks: FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
