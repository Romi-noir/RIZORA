"use strict";

const fs=require("fs");
const path=require("path");
const root=process.cwd();

function read(p){
  const f=path.join(root,p);
  if(!fs.existsSync(f)) throw new Error("Missing required file: "+p);
  return fs.readFileSync(f,"utf8");
}
function assert(ok,msg){
  if(!ok) throw new Error(msg);
}
function listRefs(html,regex){
  return [...html.matchAll(regex)]
    .map(m=>m[1].replace(/^\//,"").split("?")[0])
    .filter(p => !/^https?:\/\//i.test(p));
}

const index=read("index.html");
const scripts=listRefs(index,/<script[^>]+src=["']([^"']+\.js)(?:\?[^"']*)?["']/gi);
const styles=listRefs(index,/<link[^>]+href=["']([^"']+\.css)(?:\?[^"']*)?["']/gi);
const requiredScripts=[
  "rizora-v2.js","rizora-v2-enterprise-ui.js","rizora-v2-suite.js","rizora-v2-next.js",
  "rizora-v2-growth-ui.js","rizora-v2-growth.js","rizora-v2-modern-ui.js",
  "rizora-v2-upgrades-ui.js","rizora-v2-global-ui.js","rizora-v2-media.js",
  "rizora-v2-series-ui.js","rizora-v2-events-ui.js","rizora-v2-business-ui.js",
  "rizora-v2-comments-ui.js","rizora-v2-labs-ui.js","rizora-v2-hub.js"
];
const requiredStyles=[
  "rizora-v2.css","rizora-v2-enterprise.css","rizora-v2-suite.css","rizora-v2-next.css",
  "rizora-v2-growth.css","rizora-v2-modern.css","rizora-v2-upgrades.css","rizora-v2-global.css",
  "rizora-v2-media.css","rizora-v2-series.css","rizora-v2-events.css",
  "rizora-v2-business.css","rizora-v2-comments.css","rizora-v2-labs.css"
];
for(const p of requiredScripts) assert(scripts.includes(p),"index.html does not load "+p);
for(const p of requiredStyles) assert(styles.includes(p),"index.html does not load "+p);
for(const p of [...scripts,...styles,"manifest.json","service-worker.js","rizora-cover.png","assets/rizora_verified_badge.svg","assets/rizora_verified_mark.svg"]){
  assert(fs.existsSync(path.join(root,p)),"Missing frontend asset: "+p);
}

const jsFiles=scripts.filter(p=>fs.existsSync(path.join(root,p)));
const source=jsFiles.map(p=>fs.readFileSync(path.join(root,p),"utf8")).join("\n");
const exportNames=new Set();
for(const m of source.matchAll(/window\.([A-Z][A-Z0-9_]+)\s*=/g)) exportNames.add(m[1]);
const refs=new Set();
for(const m of source.matchAll(/window\.([A-Z][A-Z0-9_]+)\b/g)) refs.add(m[1]);
const ignore=new Set(["RIZORA_API_BASE","RIZORA_CURRENT_USER","RIZORA_SUITE_PROMPT","RIZORA_ADS_OBSERVER"]);
for(const x of [...refs].filter(x=>x.startsWith("RIZORA_")&&!ignore.has(x))) {
  assert(exportNames.has(x),"Undefined cross-module RIZORA export: window."+x);
}

const core=read("rizora-v2.js");
const media=read("rizora-v2-media.js");
const server=read("server.js");
const email=read("rizora-email.js");
const sw=read("service-worker.js");

assert((core.includes('id="aiInput"') || core.includes("id='aiInput'")) && (core.includes('id="aiForm"') || core.includes("id='aiForm'")),"AI composer wiring is missing.");
assert(media.includes('"audio/webm"') || media.includes("audio/webm"),"Media uploader checks are missing.");
assert(server.includes('pathname === "/api/ai/chat"'),"AI chat route is missing.");
assert(server.includes('pathname === "/api/ai/transcribe"'),"AI transcription route is missing.");
assert(server.includes('rz_official_tiktok'),"Official TikTok task is missing.");
assert(server.includes('rz_official_instagram'),"Official Instagram task is missing.");
assert(server.includes('rz_official_x'),"Official X task is missing.");
assert(server.includes('rz_romi_tiktok'),"Official RoMi TikTok task is missing.");
assert(server.includes("7 * 60 * 1000"),"7-minute social task cooldown is missing.");
assert(server.includes('require("./rizora-email")'),"Transactional email helper is not wired to backend.");
assert(server.includes("sendRizoraWelcomeEmail"),"Welcome email delivery is not wired.");
assert(email.includes("RESEND_API_KEY"),"Resend API key support is missing.");
assert(email.includes("RIZORA_EMAIL_FROM"),"RIZORA sender address configuration is missing.");
for (const p of [...scripts,...styles]) {
  assert(sw.includes("/"+p), "Service worker does not cache index asset: "+p);
}
assert(sw.includes("rizora_verified_badge.svg"),"Service worker does not cache verified badge.");

const verifiedPath=/verifiedBadgeUrl/;
assert(verifiedPath.test(server),"Backend public profile does not expose verified badge metadata.");
assert(server.includes('pathname === "/api/verification/apply"'),"Verification apply route is missing.");
assert(server.includes('rzVerificationPath === "/api/verification/request"'),"Verification request route is missing.");
assert(server.includes("proofUrl"),"Verification proof URL support is missing.");
assert(server.includes("7 * 60 * 1000"),"7-minute task cooldown is missing.");\nassert(server.includes("refusing to continue with an empty database"),"Database corruption must fail closed instead of resetting to an empty state.");
assert(server.includes("function isAllowedBrowserOrigin"),"CSRF origin guard is missing.");
assert(server.includes("!isAllowedBrowserOrigin(req)"),"CSRF origin guard is not enforced.");
assert(server.includes('cooldownMinutes: Math.ceil(TASK_COOLDOWN_MS / 60000)'),"Task cooldown response duration is not derived from the configured cooldown.");
assert(server.includes("publishDueSchedules("),"Schedule publisher wiring is missing.");
assert(server.includes("db.rzV2.schedules = db.rzV2.schedules || []"),"Schedule storage initialization is missing.");

assert(read("vercel.json").includes('"outputDirectory": "."'),"Vercel static deployment config is missing.");
console.log("RIZORA predeploy audit: PASS");
