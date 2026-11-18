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
  "rizora-v2-hub.js","rizora-v2-music-ui.js","rizora-v2-downloads.js"
];
const requiredStyles=[
  "rizora-v2.css","rizora-v2-enterprise.css","rizora-v2-suite.css","rizora-v2-next.css",
  "rizora-v2-growth.css","rizora-v2-modern.css","rizora-v2-upgrades.css","rizora-v2-global.css","rizora-v2-creator-os.css",
  "rizora-v2-media.css","rizora-v2-series.css","rizora-v2-events.css","rizora-v2-business.css",
  "rizora-v2-comments.css","rizora-v2-labs.css","rizora-v2-downloads.css","rizora-v2-experience.css",
  "rizora-v2-monochrome.css"
];
for(const p of requiredScripts) assert(scripts.includes(p),"index.html does not load "+p);
for(const p of requiredStyles) assert(styles.includes(p),"index.html does not load "+p);
for(const p of [...scripts,...styles,"manifest.json","service-worker.js","rizora-cover.png","rizora-icon-32.png","rizora-icon-128.png","rizora-brand-system.css","assets/logo-neon.png","assets/rizora-wallpaper-grain.svg","assets/rizora-play-logo.jpg","assets/ads/rizora-ad-1.mp3","assets/ads/rizora-ad-2.mp3","assets/ads/rizora-ad-3-orekelewa.mp3","assets/ads/rizora-video-ad.mp4","assets/rizora_verified_badge.svg","assets/rizora_verified_mark.svg","assets/rizora_verified_early.svg","assets/rizora_verified_premium.svg","assets/rizora_verified_premium_plus.svg"]){
  assert(fs.existsSync(path.join(root,p)),"Missing frontend asset: "+p);
}

const jsFiles=scripts.filter(p=>fs.existsSync(path.join(root,p)));
const source=jsFiles.map(p=>fs.readFileSync(path.join(root,p),"utf8")).join("\n");
const definedExports=new Set();
for(const m of source.matchAll(/window\.([A-Z][A-Z0-9_]+)\s*=/g)) definedExports.add(m[1]);
const refs=new Set();
for(const m of source.matchAll(/window\.([A-Z][A-Z0-9_]+)\b/g)) refs.add(m[1]);
const ignore=new Set(["RIZORA_API_BASE","RIZORA_CURRENT_USER","RIZORA_SUITE_PROMPT","RIZORA_ADS_OBSERVER","RIZORA_UPGRADES"]);
for(const x of [...refs].filter(x=>x.startsWith("RIZORA_")&&!ignore.has(x))) {
  assert(definedExports.has(x),"Undefined cross-module RIZORA export: window."+x);
}

const core=read("rizora-v2.js");
const voice=read("rizora-v2-voice.js");
const communityFixes=read("rizora-v2-community-fixes.js");
const media=read("rizora-v2-media.js");
const server=read("server.js");
const renderConfig=read("render.yaml");
const envExample=read(".env.example");
const integrations=read("rizora-integrations.js");
const mediaBackend=read("rizora-v2-media-backend.js");
const musicUi=read("rizora-v2-music-ui.js");
const studioPage=read("rizora-v2-studio-page.js");
const brand=read("rizora-brand-system.css");
const monochrome=read("rizora-v2-monochrome.css");
const music=read("rizora-v2-music.js");
const player=read("rizora-v2-player.js");
const businessUi=read("rizora-v2-business-ui.js");
const v2backend=read("rizora-v2-backend.js");
const growthBackend=read("rizora-v2-growth.js");

const email=read("rizora-email.js");
const sw=read("service-worker.js");

assert(!/remita/i.test(source),"Deferred Remita UI must not expose unfinished frontend routes.");
for (const key of ["GROQ_API_KEY","ELEVENLABS_API_KEY"]) {
  assert(new RegExp("- key: " + key + "\\s+sync: false").test(renderConfig),key+" must be declared as a private Render environment variable.");
  assert(envExample.includes(key+"="),key+" is missing from .env.example.");
}
for (const key of ["POLLINATIONS_API_KEY","NOVAI_API_KEY"]) {
  assert(new RegExp("- key: " + key + "\\s+sync: false").test(renderConfig),key+" must be declared as a private Render environment variable.");
  assert(envExample.includes(key+"="),key+" is missing from .env.example.");
}
for (const key of ["SUPABASE_URL","SUPABASE_ANON_KEY","SUPABASE_SERVICE_ROLE_KEY","CLOUDINARY_CLOUD_NAME","CLOUDINARY_API_KEY","CLOUDINARY_API_SECRET","TURNSTILE_SITE_KEY","TURNSTILE_SECRET_KEY"]) {
  assert(new RegExp("- key: " + key + "\\s+sync: false").test(renderConfig),key+" must be declared as a private Render environment variable.");
  assert(envExample.includes(key+"="),key+" is missing from .env.example.");
}
for (const key of ["GOOGLE_CLIENT_ID"]) {
  assert(new RegExp("- key: " + key + "\\s+sync: false").test(renderConfig),key+" must be declared as a private Render environment setting.");
  assert(envExample.includes(key+"="),key+" is missing from .env.example.");
}
assert(!/APPLE_CLIENT_ID|APPLE_REDIRECT_URI/.test(server+renderConfig+envExample) && !core.includes("AppleID") && !core.includes("appleButton") && !server.includes("/api/auth/apple"),"Apple sign-in remains available in the app or server.");
assert(!/Creator Earnings/i.test(businessUi) && !/CREATE\.\s*GROW\.\s*EARN\./i.test(index+email),"The old EARN branding remains visible in the active app.");
assert(core.includes('usernameOption.value="username"') && core.includes('contact.username||contact.phone||contact.email') && core.includes('channel:pending.channel'),"Login UI must offer username, email and phone with username OTP support.");
assert(server.includes('const loginUsername = intent === "signup" ? "" : normalizeUsername(body.username || (body.channel === "username" ? body.identifier : ""))') && (server.match(/authContactForUser\(localUser\)/g)||[]).length>=2,"Username login codes must resolve the account contact for both send and verify.");
assert(communityFixes.includes('||"dark"') && communityFixes.includes('data-rz-profile-theme="dark"') && communityFixes.includes('data-rz-profile-theme="light"') && !communityFixes.includes('>Custom</button>'),"App theme must default to black and offer only black and white.");
assert(core.includes('if(state.view==="create")c.innerHTML=postComposerView()') && core.includes('if(state.view==="discover")c.innerHTML=discoverView()') && !core.includes('if(state.view==="flow")c.innerHTML='),"The post composer must live in Create and post feeds must live in Discover.");
assert(core.includes('var openDiscover=$("openDiscoverFeed");if(openDiscover)openDiscover.onclick=') && core.includes('state.feedTab="for-you";state.feedOffset=0;state.feed=[]'),"The Create-to-Discover link must open a fresh For You feed.");
assert(core.includes("data-edit-post") && core.includes('method:"PATCH"') && v2backend.includes('if(method==="PATCH"&&editPostRoute)') && v2backend.includes("You can only edit your own posts."),"Authors need a working, owner-checked post edit flow.");
assert(core.includes("postMediaEditor") && core.includes("wirePostMediaEditor") && core.includes("data-media-adjust") && core.includes("data-media-crop") && core.includes("data-media-speed") && core.includes("data-media-trim") && core.includes("data-rz-editor-overlay") && core.includes("mediaStyle:JSON.parse") && v2backend.includes("normalizePostMediaStyle(pb.mediaStyle)") && v2backend.includes("mediaStyle:normalizePostMediaStyle(post.mediaStyle)") && v2backend.includes('range("brightness",50,150,100)') && v2backend.includes('range("shadows",-100,100,0)') && v2backend.includes("trimStart:Math.round") && v2backend.includes("overlayText:String(style.overlayText||\"\").slice(0,160)"),"Create/Edit filters, effects, adjustments, text overlay and video trim settings must persist.");
assert(growthBackend.includes("mediaStyle:normalizePostMediaStyle(data.mediaStyle)") && growthBackend.includes("normalizePostMediaStyle(sb.mediaStyle)") && growthBackend.includes("mediaStyle:normalizePostMediaStyle(post.mediaStyle)") && growthBackend.includes("mediaStyle:pollBody.mediaStyle") && growthBackend.includes("trimEnd:Math.round"),"Polls and scheduled posts must preserve validated post media edits.");
assert(core.includes('openDiscoverHashtag(button.getAttribute("data-hashtag"))') && v2backend.includes("editTarget.hashtags=nextTags"),"Post hashtags must remain tappable and update on edits.");
assert(core.includes('id="forgotPasswordBox"') && core.includes('Check your email for a secure password reset link') && core.includes('class="rz-auth-link" href="#login">Back to Login</a>'),"Auth must use the dedicated text-link password reset flow.");
assert(monochrome.includes('Auth pages scroll as one document') && monochrome.includes('overflow-y: auto !important') && monochrome.includes('.rz-auth > .rz-site-footer') && monochrome.includes('justify-content: flex-start !important'),"Auth footer and signup content must scroll without covering each other.");
assert(source.includes('data-rz-settings-theme="dark"') && source.includes('data-rz-settings-theme="light"') && source.includes('data-rz-settings-wallpaper="plain"') && source.includes('data-rz-settings-wallpaper="soft"'),"Settings must expose black and white themes plus the plain and soft wallpaper choices.");
assert(index.includes('name="color-scheme" content="dark light"'),"Browser theme metadata must support both black and white modes.");
assert(renderConfig.includes("SUPABASE_PRIVATE_MEDIA_BUCKET") && renderConfig.includes("value: rizora-private-media"),"Render must target the private RIZORA Supabase media bucket.");
assert(integrations.includes("turnstile/v0/siteverify") && integrations.includes("function verifyTurnstile"),"Server-side Cloudflare Turnstile verification is missing.");
assert(integrations.includes("function cloudinarySignature") && integrations.includes("overwrite: false"),"Signed Cloudinary uploads must prevent overwriting an existing asset.");
assert(mediaBackend.includes("createPrivateUploadIntent") && mediaBackend.includes("storedBytes===Number(intent.size)"),"Private Supabase uploads must be signed and checked against stored size.");
assert(!/- key:\s*RIZORA_MEDIA_ROOT\b/.test(renderConfig),"Production media must not rely on an unmounted Render filesystem.");
assert(envExample.includes("POLLINATIONS_IMAGE_MODEL=black-forest-labs/flux.1-schnell"),"Pollinations image model default is missing from .env.example.");
assert(envExample.includes("NOVAI_VIDEO_MODEL=cogvideox-flash"),"AIAPI-Pro video model default is missing from .env.example.");
assert(core.includes("var timeoutMs=Number(opt.timeoutMs)") && core.includes("Math.min(timeoutMs,119000)"),"API timeout overrides must be bounded below Vercel rewrite timeout limits.");
assert(musicUi.includes("timeoutMs:119000") && musicUi.includes("timeoutMs:100000"),"Music and voiceover generation timeouts are missing.");
assert(server.includes("AbortSignal.timeout(20000)") && server.includes("AbortSignal.timeout(45000)"),"Groq chat and transcription provider timeouts are missing.");
assert((core.match(/timeoutMs:50000/g)||[]).length>=2,"AI chat client timeout is missing.");
assert(voice.includes("timeoutMs:60000"),"AI voice transcription client timeout is missing.");
assert(musicUi.includes("timeoutMs:50000"),"Music AI client timeout is missing.");
assert(studioPage.includes("timeoutMs:119000"),"AI beat generation timeout is missing.");
assert(communityFixes.includes("waitLimit=isVideo?8*60*1000:3*60*1000") && communityFixes.includes("queued.jobId"),"AIAPI-Pro async video polling is missing.");
assert(communityFixes.includes("providerName=isVideo?\"AIAPI-Pro\":\"Pollinations\"") && communityFixes.includes("delayMs=isVideo?15000:2200"),"Media UI provider labels or AIAPI-Pro polling interval are missing.");
assert(studioPage.includes("var timeoutMs=130000"),"Studio cover-art generation deadline is missing.");
assert(server.includes("https://gen.pollinations.ai/image/") && server.includes('Authorization:"Bearer " + providerKey') && server.includes("POLLINATIONS_API_KEY"),"Pollinations image generation is missing or not using server-side bearer auth.");
assert(server.includes('https://aiapi-pro.com/v1/video/generations') && server.includes('provider:"aiapi-pro"') && server.includes("aiMediaGenerations"),"AIAPI-Pro async video generation is missing.");
assert(server.includes('imageConfigured:Boolean(String(process.env.POLLINATIONS_API_KEY||"").trim())') && server.includes('videoConfigured:Boolean(String(process.env.NOVAI_API_KEY||"").trim())') && server.includes('mediaProvider:"pollinations+aiapi-pro"'),"AI provider status does not report Pollinations and AIAPI-Pro configuration.");
assert(server.includes('voiceIsolationConfigured:Boolean(String(process.env.ELEVENLABS_API_KEY||"").trim())') && server.includes('voiceAndMusicConfigured:Boolean(String(process.env.ELEVENLABS_API_KEY||"").trim())'),"ElevenLabs voice and music status is missing.");
assert(!server.includes("InferenceClient") && !renderConfig.includes("RIZORA_HF_TOKEN") && !envExample.includes("RIZORA_HF_TOKEN"),"Hugging Face is still configured as an image/video provider.");
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
assert(!server.includes("configuredSuperAdminPassword("), "Stale configuredSuperAdminPassword() reference remains.");
assert(server.includes("function configuredPasswordForUser"), "configuredPasswordForUser helper is missing.");
assert(server.includes("function hasConfiguredSuperAdminPassword"), "hasConfiguredSuperAdminPassword helper is missing.");
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
assert(sw.includes("rizora-brand-system.css") && sw.includes("rizora-icon-32.png") && sw.includes("rizora-icon-128.png") && sw.includes("rizora-wallpaper-grain.svg") && sw.includes("rizora-v2-monochrome.css"),"Service worker does not cache current brand assets and monochrome theme styles.");
assert(sw.includes("rizora_verified_early.svg") && sw.includes("rizora_verified_premium.svg") && sw.includes("rizora_verified_premium_plus.svg"),"Service worker does not cache tier badges.");
assert(monochrome.includes("--rz-action-bg") && monochrome.includes("data-rizora-theme=\"light\"") && monochrome.includes(".rz-ai-workspace::before"),"Shared black-and-white styling for RIZORA and NOIR is missing.");
assert(monochrome.includes("--rz-purple: var(--text)") && monochrome.includes(".rz-ai-media-lab") && monochrome.includes(".rzs-feature-promo") && monochrome.includes(".rz-public-copy h1 em"),"Public, NOIR and Studio surfaces must follow the black and white theme.");
assert(index.includes("rizora-v2-monochrome.css") && index.includes("rz-boot-ring") && index.includes("src=\"/rizora-cover.png\""),"RIZORA monochrome styling or the main-logo loading animation is missing.");
assert(index.includes("data-rizora-wallpaper") && !index.includes("#c7a65a") && !index.includes("199,166,90"),"The page shell must honor saved black/white wallpapers without gold inline styling.");
assert(!core.includes('removeAttribute("data-rizora-theme")') && core.includes("RIZORA PLAY") && core.includes("Feel the vibe. Own the sound."),"Public routing must preserve the selected theme and use RIZORA PLAY branding.");
assert(communityFixes.includes("rizora_app_wallpaper") && communityFixes.includes("Soft texture"),"Global monochrome wallpaper controls are missing.");
assert(music.includes('path==="/api/music/audius/search"') && music.includes("https://api.audius.co/v1/tracks/search"),"Read-only Audius search is not wired through the backend.");
assert(player.includes("/api/music/audius/search") && !/spotify/i.test(source+music+player),"Music player must use Audius instead of Spotify.");
assert(sw.includes("v73-launch-fixes") && sw.includes("rizora-play-logo.jpg") && sw.includes("logo-neon.png"),"Service worker cache version or RIZORA logo assets are stale.");
for(const asset of ["rizora-ad-1.mp3","rizora-ad-2.mp3","rizora-ad-3-orekelewa.mp3"]){assert(player.includes("/assets/ads/"+asset),"Music player is missing audio ad asset "+asset+".");}
assert(player.includes("startsSinceAd>=2") && player.includes("userGetsAdFree") && player.includes("playAd()"),"Non-subscriber audio ad scheduling is missing.");
assert(player.includes("control.disabled=player.isAd") && core.includes("window.RIZORA_PLAYER.isAd"),"A listener can skip or close the player before a required audio ad finishes.");
assert(read("rizora-v2-ads-ui.js").includes("rizora-video-ad.mp4"),"RIZORA video media ad is not wired into the feed.");

const verifiedPath=/verifiedBadgeUrl/;
assert(verifiedPath.test(server),"Backend public profile does not expose verified badge metadata.");
const vercel=JSON.parse(read("vercel.json"));
assert(Array.isArray(vercel.rewrites) && vercel.rewrites.some(rule=>rule && rule.source==="/login" && rule.destination==="/"),"Vercel rewrite/config is missing.");
assert(vercel.rewrites.some(rule=>rule && rule.source==="/sitemap.xml" && rule.destination==="https://rizora-guse.onrender.com/sitemap.xml"),"Dynamic sitemap forwarding is missing.");
assert(vercel.rewrites.some(rule=>rule && rule.source==="/creator/:path*" && rule.destination==="https://rizora-guse.onrender.com/creator/:path*"),"Public creator profile forwarding is missing.");
const vercelIgnore=read(".vercelignore").split(/\r?\n/);
assert(vercelIgnore.includes("sitemap.xml"),"Static sitemap must be excluded so the dynamic sitemap rewrite can run.");
assert(vercelIgnore.includes("rizora-seo.js"),"Server-only SEO helper must not be deployed as a static frontend asset.");
const render=read("render.yaml");
assert(envExample.includes("DATABASE_URL="),"DATABASE_URL is missing from .env.example.");
assert(/- key:\s*DATABASE_URL\s+sync:\s*false/.test(render),"Render must receive the external PostgreSQL URL through a private environment variable.");
assert(!/^databases:/m.test(render),"Do not provision a second Render database while production uses the external PostgreSQL URL.");
console.log("RIZORA predeploy audit: PASS");
