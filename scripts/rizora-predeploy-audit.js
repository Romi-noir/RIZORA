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
  return [...html.matchAll(regex)].map(m=>m[1].replace(/^\//,"").split("?")[0]);
}

const index=read("index.html");
const scripts=listRefs(index,/<script[^>]+src=["']([^"']+\.js)(?:\?[^"']*)?["']/gi);
const styles=listRefs(index,/<link[^>]+href=["']([^"']+\.css)(?:\?[^"']*)?["']/gi);
const requiredScripts=[
  "rizora-v2.js","rizora-v2-enterprise-ui.js","rizora-v2-suite.js","rizora-v2-next.js",
  "rizora-v2-growth-ui.js","rizora-v2-modern-ui.js","rizora-v2-upgrades-ui.js",
  "rizora-v2-global-ui.js","rizora-v2-media.js","rizora-v2-voice.js",
  "rizora-v2-series-ui.js","rizora-v2-events-ui.js","rizora-v2-business-ui.js",
  "rizora-v2-ads-ui.js","rizora-v2-comments-ui.js","rizora-v2-labs-ui.js",
  "rizora-v2-hub.js","rizora-v2-downloads.js"
];
const requiredStyles=[
  "rizora-v2.css","rizora-v2-enterprise.css","rizora-v2-suite.css","rizora-v2-next.css",
  "rizora-v2-growth.css","rizora-v2-modern.css","rizora-v2-upgrades.css","rizora-v2-global.css",
  "rizora-v2-media.css","rizora-v2-series.css","rizora-v2-events.css","rizora-v2-business.css",
  "rizora-v2-comments.css","rizora-v2-labs.css","rizora-v2-downloads.css","rizora-v2-experience.css"
];
for(const p of requiredScripts) assert(scripts.includes(p),"index.html does not load "+p);
for(const p of requiredStyles) assert(styles.includes(p),"index.html does not load "+p);
for(const p of [...scripts,...styles,"manifest.json","service-worker.js","rizora-cover.png","assets/rizora_verified_badge.svg","assets/rizora_verified_mark.svg"]){
  assert(fs.existsSync(path.join(root,p)),"Missing frontend asset: "+p);
}

const jsFiles=scripts.filter(p=>fs.existsSync(path.join(root,p)));
const source=jsFiles.map(p=>fs.readFileSync(path.join(root,p),"utf8")).join("\n");
const definedExports=new Set();
for(const m of source.matchAll(/window\.([A-Z][A-Z0-9_]+)\s*=/g)) definedExports.add(m[1]);
const refs=new Set();
for(const m of source.matchAll(/window\.([A-Z][A-Z0-9_]+)\b/g)) refs.add(m[1]);
const ignore=new Set(["RIZORA_API_BASE","RIZORA_CURRENT_USER","RIZORA_SUITE_PROMPT","RIZORA_ADS_OBSERVER"]);
for(const x of [...refs].filter(x=>x.startsWith("RIZORA_")&&!ignore.has(x))) {
  assert(definedExports.has(x),"Undefined cross-module RIZORA export: window."+x);
}

const core=read("rizora-v2.js");
const voice=read("rizora-v2-voice.js");
const media=read("rizora-v2-media.js");
const server=read("server.js");
const email=read("rizora-email.js");
const sw=read("service-worker.js");

assert(!/remita/i.test(source),"Deferred Remita UI must not expose unfinished frontend routes.");

assert(/id=[\'"]aiInput[\'"]/.test(core) && /id=[\'"]aiForm[\'"]/.test(core),"AI composer wiring is missing.");
assert(/data-ai-speak=[\'"]/.test(core),"AI voice playback controls are missing.");
assert(/data-chat-target=[\'"]/.test(core),"One-to-one chat voice target wiring is missing.");
assert(/data-post-id=[\'"]/.test(core),"Comment voice post wiring is missing.");
assert(voice.includes("RIZORA_AI_SPEAK"),"AI voice playback helper is missing.");
assert(voice.includes('/api/ai/transcribe'),"AI voice transcription wiring is missing.");
assert(voice.includes('/api/v2/messages/'),"One-to-one voice message wiring is missing.");
assert(voice.includes('/api/v2/posts/'),"Voice comment wiring is missing.");
assert(media.includes('"audio/webm"'),"Media uploader does not allow WebM voice notes.");
assert(server.includes('pathname === "/api/ai/chat"'),"AI chat route is missing.");
assert(server.includes('pathname === "/api/ai/transcribe"'),"AI transcription route is missing.");
assert(/recognize the signed-in creator/i.test(server),"AI signed-in creator context is missing.");
assert(server.includes("knownRizoraIdentityAnswer"),"Deterministic RIZORA identity answers are missing.");
assert(server.includes('username: "rizora"'),"Official RIZORA account bootstrap is missing.");
assert(server.includes('username: "romi"'),"Official RoMi account bootstrap is missing.");
assert(server.includes('verificationType: "official_creator"'),"RoMi verified-account type is missing.");
assert(server.includes('verificationType: "official_platform"'),"RIZORA verified-account type is missing.");
assert(server.includes('rz_official_tiktok'),"Official TikTok task is missing.");
assert(server.includes('rz_official_instagram'),"Official Instagram task is missing.");
assert(server.includes('rz_official_x'),"Official X task is missing.");
assert(server.includes('rz_romi_tiktok'),"Official RoMi TikTok task is missing.");
assert(server.includes("7 * 60 * 1000"),"7-minute social task cooldown is missing.");
assert(server.includes('require("./rizora-email")'),"Transactional email helper is not wired to backend.");
assert(server.includes("sendRizoraWelcomeEmail"),"Welcome email delivery is not wired.");
assert(email.includes("RESEND_API_KEY"),"Resend API key support is missing.");
assert(email.includes("RIZORA_EMAIL_FROM"),"RIZORA sender address configuration is missing.");
assert(sw.includes("rizora-v2-voice.js"),"Service worker does not cache voice module.");
assert(sw.includes("rizora-v2-ads-ui.js"),"Service worker does not cache RIZORA Ads UI.");
assert(sw.includes("rizora_verified_badge.svg"),"Service worker does not cache verified badge.");
assert(sw.includes("rizora_verified_mark.svg"),"Service worker does not cache verified mark.");
assert(sw.includes("rizora-v2-experience.css"),"Service worker does not cache experience CSS.");

const verifiedPath=/verifiedBadgeUrl/;
assert(verifiedPath.test(server),"Backend public profile does not expose verified badge metadata.");
assert(read("vercel.json").includes('"source": "/"'),"Vercel rewrite/config is missing.");
console.log("RIZORA predeploy audit: PASS");
