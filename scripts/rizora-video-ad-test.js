"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

async function main() {
  const source = fs.readFileSync(path.join(__dirname, "..", "rizora-v2-ads-ui.js"), "utf8");
  const cards = [];
  const attributes = {};
  const host = {
    getAttribute: name => attributes[name] || null,
    setAttribute: (name, value) => { attributes[name] = value; },
    prepend: card => cards.unshift(card)
  };
  const document = {
    body: {},
    getElementById: id => id === "postForm" ? { parentElement: { querySelector: selector => selector === ".rz-feed" ? host : null } } : null,
    createElement: () => ({ style: {}, className: "", innerHTML: "" })
  };
  const window = { RIZORA_API_CALL: async () => ({ ads: [] }) };
  const context = {
    window,
    document,
    location: { origin: "https://rizora.test" },
    URL,
    MutationObserver: function MutationObserver() {},
    setTimeout: () => 0,
    console
  };
  vm.runInNewContext(source, context, { filename: "rizora-v2-ads-ui.js" });
  await window.RIZORA_ADS.render();
  assert.strictEqual(cards.length, 1, "the RIZORA media ad should render in the feed");
  assert(cards[0].innerHTML.includes("/assets/ads/rizora-video-ad.mp4"), "the supplied MP4 should be the feed creative");
  assert(cards[0].innerHTML.includes("controls playsinline"), "the video ad should have accessible playback controls");
  assert(cards[0].innerHTML.includes("© RIZORA"), "the RIZORA media watermark should appear over the video");
  assert(fs.existsSync(path.join(__dirname, "..", "assets/ads/rizora-video-ad.mp4")), "the video ad file is missing");
  console.log("RIZORA video ad checks: PASS");
}

main().catch(error => {
  console.error("RIZORA video ad checks: FAIL");
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
