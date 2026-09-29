"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = path.join(root, "www");

function copyFile(relative) {
  const source = path.join(root, relative);
  const target = path.join(out, relative);
  if (!fs.existsSync(source)) throw new Error("Missing frontend asset: " + relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
fs.mkdirSync(out, { recursive: true });
for (const name of fs.readdirSync(out)) {
  const target = path.join(out, name);
  if (fs.statSync(target).isFile()) fs.unlinkSync(target);
}

copyFile("index.html");
copyFile("manifest.json");
copyFile("service-worker.js");
copyFile("rizora-cover.png");
copyFile("assets/rizora_verified_badge.svg");
copyFile("assets/rizora_verified_mark.svg");

const refs = new Set();
for (const match of index.matchAll(/(?:src|href)=["']\/([^"']+)["']/gi)) {
  const ref = match[1].split("?")[0];
  if (ref && !ref.includes("://") && !ref.startsWith("api/")) refs.add(ref);
}
for (const ref of refs) {
  if (ref === "index.html" || ref === "manifest.json" || ref === "service-worker.js" || ref === "rizora-cover.png") continue;
  if (fs.existsSync(path.join(root, ref))) copyFile(ref);
}
console.log("RIZORA Capacitor web bundle prepared in www/");
