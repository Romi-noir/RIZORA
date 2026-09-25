"use strict";

const crypto = require("crypto");

function ensureModern(db) {
  db.rzV2 = db.rzV2 || {};
  db.rzV2.preferences = db.rzV2.preferences || {};
  db.rzV2.blocks = db.rzV2.blocks || [];
  db.rzV2.mutes = db.rzV2.mutes || [];
  db.rzV2.posts = db.rzV2.posts || [];
  db.rzV2.follows = db.rzV2.follows || [];
  db.rzV2.likes = db.rzV2.likes || [];
  db.rzV2.comments = db.rzV2.comments || [];
  db.rzV2.saves = db.rzV2.saves || [];
  db.rzV2.reposts = db.rzV2.reposts || [];
  db.rzV2.pollVotes = db.rzV2.pollVotes || [];
}

function bodyFor(req) {
  let raw="";
  return (async function(){
    for await (const chunk of req) {
      raw += chunk.toString();
      if (raw.length > 1100000) throw new Error("Request body too large.");
    }
    return raw ? JSON.parse(raw) : {};
  })();
}

function clean(ctx,v,max) { return ctx.cleanString(v,max); }

function currentToken(req) {
  const auth=String(req.headers.authorization||"");
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  const raw=String(req.headers.cookie||"");
  for (const part of raw.split(";")) {
    const i=part.indexOf("=");
    if(i<0) continue;
    if(part.slice(0,i).trim()==="rizora_session") {
      try { return decodeURIComponent(part.slice(i+1).trim()); } catch (_) { return part.slice(i+1).trim(); }
    }
  }
  return "";
}

function prefs(db,userId) {
  db.rzV2.preferences[userId] ||= {
    notifications: {
      all: true, likes: true, comments: true, follows: true, mentions: true,
      messages: true, collaboration: true, support: true, verification: true, moderation: true
    },
    discoverable: true,
    showActivityStatus: true,
    personalizedFeed: true
  };
  const p=db.rzV2.preferences[userId];
  p.notifications ||= {};
  for (const k of ["all","likes","comments","follows","mentions","messages","collaboration","support","verification","moderation"]) {
    if(typeof p.notifications[k]!=="boolean") p.notifications[k]=true;
  }
  if(typeof p.discoverable!=="boolean") p.discoverable=true;
  if(typeof p.showActivityStatus!=="boolean") p.showActivityStatus=true;
  if(typeof p.personalizedFeed!=="boolean") p.personalizedFeed=true;
  return p;
}

function findUser(db,key) {
  const q=String(key||"").trim().replace(/^@/,"").toLowerCase();
  return db.users.find(u =>
    String(u.username||"").toLowerCase()===q ||
    String(u.publicUsername||"").toLowerCase()===q
  );
}

function relationshipSet(db,userId,type) {
  return new Set((db.rzV2[type]||[]).filter(x=>x[type==="blocks"||type==="mutes" ? "userId" : "userId"]===userId).map(x=>x.targetUserId));
}

function targetSet(db,userId,collection) {
  return new Set((db.rzV2[collection]||[]).filter(x=>x.userId===userId).map(x=>x.targetUserId));
}

function isBlocked(db,a,b) {
  return (db.rzV2.blocks||[]).some(x=>x.userId===a&&x.targetUserId===b) ||
         (db.rzV2.blocks||[]).some(x=>x.userId===b&&x.targetUserId===a);
}

function isMuted(db,a,b) {
  return (db.rzV2.mutes||[]).some(x=>x.userId===a&&x.targetUserId===b);
}

function profile(db,user) {
  const p=(db.creatorProfiles&&db.creatorProfiles[user.id])||{};
  return {
    id:user.id, username:user.username, publicUsername:user.publicUsername||user.username,
    displayName:user.displayName||user.username, avatarUrl:p.avatarUrl||user.avatarUrl||"/rizora-cover.png",
    bio:p.bio||user.bio||"", category:p.category||user.category||"",
    location:p.location||user.location||"", verified:user.verified===true||user.verificationStatus==="verified",
    official:user.official===true
  };
}

function metrics(db,postId) {
  return {
    likes:(db.rzV2.likes||[]).filter(x=>x.postId===postId).length,
    comments:(db.rzV2.comments||[]).filter(x=>x.postId===postId).length,
    reposts:(db.rzV2.reposts||[]).filter(x=>x.postId===postId).length,
    saves:(db.rzV2.saves||[]).filter(x=>x.postId===postId).length,
    pollVotes:(db.rzV2.pollVotes||[]).filter(x=>x.postId===postId).length
  };
}

function decorate(db,post) {
  const author=db.users.find(u=>u.id===post.userId);
  if(!author) return null;
  const collaborators=(post.collaboratorIds||[]).map(id=>db.users.find(u=>u.id===id)).filter(Boolean).map(u=>profile(db,u));
  const poll=post.poll?{
    question:post.poll.question||"", expiresAt:post.poll.expiresAt||null,
    options:(post.poll.options||[]).map(o=>Object.assign({},o,{votes:(db.rzV2.pollVotes||[]).filter(v=>v.postId===post.id&&v.optionId===o.id).length}))
  }:null;
  return {
    id:post.id,userId:post.userId,text:post.text||"",mediaUrl:post.mediaUrl||"",
    hashtags:post.hashtags||[],mentions:post.mentions||[],collaborators,poll,
    createdAt:post.createdAt,author:profile(db,author),metrics:metrics(db,post.id)
  };
}

function scorePost(db,post,user,following) {
  const m=metrics(db,post.id);
  const age=Math.max(0.25,(Date.now()-new Date(post.createdAt).getTime())/3600000);
  const author=db.users.find(u=>u.id===post.userId);
  if(!author) return -999999;
  const ap=(db.creatorProfiles&&db.creatorProfiles[author.id])||{};
  const up=(db.creatorProfiles&&db.creatorProfiles[user.id])||{};
  const followed=following.has(author.id);
  const sameCategory=!!up.category && !!ap.category && String(up.category).toLowerCase()===String(ap.category).toLowerCase();
  const engagement=(m.likes + m.comments*2 + m.saves*2 + m.reposts*3 + m.pollVotes);
  const freshness=24/Math.pow(age+2,0.85);
  const social=followed?22:0;
  const category=sameCategory?8:0;
  const verified=(author.verified===true||author.verificationStatus==="verified")?4:0;
  const own=author.id===user.id?6:0;
  return engagement*1.7 + freshness + social + category + verified + own;
}

function safeSettingsExport(db,user) {
  const p=prefs(db,user.id);
  const creatorProfile=(db.creatorProfiles&&db.creatorProfiles[user.id])||{};
  const ownPosts=db.rzV2.posts.filter(x=>x.userId===user.id).map(x=>({
    id:x.id,text:x.text||"",mediaUrl:x.mediaUrl||"",hashtags:x.hashtags||[],mentions:x.mentions||[],
    createdAt:x.createdAt,metrics:metrics(db,x.id)
  }));
  return {
    exportedAt:new Date().toISOString(),
    account:{
      id:user.id,username:user.username,publicUsername:user.publicUsername||user.username,
      displayName:user.displayName||user.username,email:user.email||"",createdAt:user.createdAt||null,
      role:user.role||"user",status:user.status||"active",verified:user.verified===true||user.verificationStatus==="verified",
      points:Number(user.points||0)
    },
    profile:creatorProfile,
    preferences:p,
    posts:ownPosts,
    follows:(db.rzV2.follows||[]).filter(x=>x.followerId===user.id||x.followingId===user.id),
    savedPostIds:(db.rzV2.saves||[]).filter(x=>x.userId===user.id).map(x=>x.postId),
    draftCount:(db.rzV2.drafts||[]).filter(x=>x.userId===user.id).length,
    scheduleCount:(db.rzV2.schedules||[]).filter(x=>x.userId===user.id).length
  };
}


function base32Encode(buffer) {
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits=0,value=0,out="";
  for(const byte of buffer){
    value=(value<<8)|byte; bits+=8;
    while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5;}
  }
  if(bits>0) out+=alphabet[(value<<(5-bits))&31];
  return out;
}
function base32Decode(input) {
  const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean=String(input||"").replace(/=+$/,"").toUpperCase().replace(/[^A-Z2-7]/g,"");
  let bits=0,value=0,bytes=[];
  for(const ch of clean){
    const idx=alphabet.indexOf(ch); if(idx<0) continue;
    value=(value<<5)|idx; bits+=5;
    if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8;}
  }
  return Buffer.from(bytes);
}
function totpCode(secret, timestampMs) {
  const key=base32Decode(secret);
  const counter=Math.floor((Number(timestampMs||Date.now())/1000)/30);
  const buf=Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter/0x100000000),0);
  buf.writeUInt32BE(counter>>>0,4);
  const digest=crypto.createHmac("sha1",key).update(buf).digest();
  const offset=digest[digest.length-1]&15;
  const num=((digest[offset]&127)<<24)|(digest[offset+1]<<16)|(digest[offset+2]<<8)|digest[offset+3];
  return String(num%1000000).padStart(6,"0");
}
function verifyTotp(secret, code) {
  const normalized=String(code||"").replace(/\s/g,"");
  if(!/^\d{6}$/.test(normalized)) return false;
  for(const drift of [-1,0,1]) if(totpCode(secret,Date.now()+drift*30000)===normalized) return true;
  return false;
}

function passwordHash(password) {
  const salt=crypto.randomBytes(16).toString("hex");
  const derived=crypto.pbkdf2Sync(String(password),salt,120000,64,"sha512");
  return salt+":"+derived.toString("hex");
}

function passwordVerify(password,stored) {
  return new Promise((resolve,reject)=>{
    if(!stored||!stored.includes(":")) return resolve(false);
    const parts=stored.split(":"),salt=parts[0],original=Buffer.from(parts[1],"hex");
    crypto.pbkdf2(String(password),salt,120000,64,"sha512",(err,key)=>{
      if(err) return reject(err);
      const current=key;
      if(current.length!==original.length) return resolve(false);
      resolve(crypto.timingSafeEqual(current,original));
    });
  });
}

async function handleRizoraModern(ctx) {
  const db=ctx.db,res=ctx.res,req=ctx.req,user=ctx.getCurrentUser(db,req);
  const url=new URL(req.url,"http://rizora.local"),path=url.pathname,method=String(req.method||"GET").toUpperCase();
  ensureModern(db);

  if(path==="/api/v2/preferences" && method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    ctx.sendJSON(res,200,{success:true,preferences:prefs(db,user.id)}); return true;
  }

  if(path==="/api/v2/preferences" && method==="PATCH"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    let b={}; try{b=await bodyFor(req);}catch(e){ctx.sendError(res,400,e.message);return true;}
    const current=prefs(db,user.id);
    const next=Object.assign({},current);
    if(b.notifications && typeof b.notifications==="object"){
      next.notifications=Object.assign({},current.notifications);
      for(const k of Object.keys(next.notifications)) if(typeof b.notifications[k]==="boolean") next.notifications[k]=b.notifications[k];
    }
    for(const k of ["discoverable","showActivityStatus","personalizedFeed"]) if(typeof b[k]==="boolean") next[k]=b[k];
    db.rzV2.preferences[user.id]=next;ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,preferences:next});return true;
  }

  if(path==="/api/v2/notifications" && method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    const p=prefs(db,user.id), list=(db.notifications||[]).filter(n=>{
      if(n.userId!==user.id) return false;
      if(p.notifications.all===false) return false;
      const key=String(n.type||"").toLowerCase();
      return p.notifications[key]!==false;
    }).slice().reverse().slice(0,100);
    ctx.sendJSON(res,200,{success:true,notifications:list});return true;
  }

  if(path==="/api/v2/notifications/read" && method==="POST"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    (db.notifications||[]).forEach(n=>{if(n.userId===user.id)n.read=true;});
    ctx.saveDB(db);ctx.sendJSON(res,200,{success:true});return true;
  }

  const rel=path.match(/^\/api\/v2\/(blocks|mutes)\/([^/]+)$/);
  if(rel && ["POST","DELETE"].includes(method)){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    const kind=rel[1],target=findUser(db,decodeURIComponent(rel[2]));
    if(!target){ctx.sendError(res,404,"Creator not found.");return true;}
    if(target.id===user.id){ctx.sendError(res,400,"You cannot apply this to yourself.");return true;}
    const collection=db.rzV2[kind],existing=collection.find(x=>x.userId===user.id&&x.targetUserId===target.id);
    if(method==="POST" && !existing) collection.push({id:ctx.uid(kind.slice(0,-1)+"_"),userId:user.id,targetUserId:target.id,createdAt:new Date().toISOString()});
    if(method==="DELETE" && existing) collection.splice(collection.indexOf(existing),1);
    if(kind==="blocks" && method==="POST"){
      db.rzV2.mutes=db.rzV2.mutes.filter(x=>!(x.userId===user.id&&x.targetUserId===target.id));
    }
    ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,active:method==="POST",target:profile(db,target)});return true;
  }

  if(path==="/api/v2/blocks" && method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    const ids=targetSet(db,user.id,"blocks");
    ctx.sendJSON(res,200,{success:true,users:(db.users||[]).filter(u=>ids.has(u.id)).map(u=>profile(db,u))});return true;
  }

  if(path==="/api/v2/mutes" && method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    const ids=targetSet(db,user.id,"mutes");
    ctx.sendJSON(res,200,{success:true,users:(db.users||[]).filter(u=>ids.has(u.id)).map(u=>profile(db,u))});return true;
  }

  if(path==="/api/v2/feed" && method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    const tab=String(url.searchParams.get("tab")||"for-you"), blocked=targetSet(db,user.id,"blocks"), muted=targetSet(db,user.id,"mutes");
    let posts=(db.rzV2.posts||[]).filter(p=>p.removed!==true&&!blocked.has(p.userId)&&!muted.has(p.userId));
    const following=new Set((db.rzV2.follows||[]).filter(f=>f.followerId===user.id).map(f=>f.followingId));
    if(tab==="following") posts=posts.filter(p=>p.userId===user.id||following.has(p.userId)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    else if(tab==="saved"){
      const saved=new Set((db.rzV2.saves||[]).filter(s=>s.userId===user.id).map(s=>s.postId));
      posts=posts.filter(p=>saved.has(p.id)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    } else if(tab==="trending"){
      posts.sort((a,b)=>scorePost(db,b,user,following)-scorePost(db,a,user,following));
    } else {
      const personal=prefs(db,user.id).personalizedFeed;
      if(personal) posts.sort((a,b)=>scorePost(db,b,user,following)-scorePost(db,a,user,following));
      else posts.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    }
    ctx.sendJSON(res,200,{success:true,tab,personalized:tab==="for-you"&&prefs(db,user.id).personalizedFeed,posts:posts.slice(0,50).map(p=>decorate(db,p)).filter(Boolean)});return true;
  }


  if(path==="/api/v2/security/2fa/setup" && method==="POST"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    if(!user.passwordHash){ctx.sendError(res,400,"Set an RIZORA password before enabling two-factor authentication.");return true;}
    if(user.twoFactorEnabled){ctx.sendError(res,409,"Two-factor authentication is already enabled.");return true;}
    let b={};try{b=await bodyFor(req);}catch(e){ctx.sendError(res,400,e.message);return true;}
    if(!await passwordVerify(String(b.currentPassword||""),user.passwordHash)){ctx.sendError(res,401,"Current password is incorrect.");return true;}
    const secret=base32Encode(crypto.randomBytes(20));
    user.pendingTwoFactorSecret=secret;
    user.twoFactorSetupAt=new Date().toISOString();
    ctx.saveDB(db);
    const label=encodeURIComponent("RIZORA:"+String(user.username||user.email||"creator"));
    const issuer=encodeURIComponent("RIZORA");
    const uri="otpauth://totp/"+label+"?secret="+secret+"&issuer="+issuer+"&algorithm=SHA1&digits=6&period=30";
    ctx.sendJSON(res,200,{success:true,secret,otpauthUri:uri});return true;
  }

  if(path==="/api/v2/security/2fa/confirm" && method==="POST"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    const secret=String(user.pendingTwoFactorSecret||"");
    if(!secret){ctx.sendError(res,409,"Start two-factor setup first.");return true;}
    let b={};try{b=await bodyFor(req);}catch(e){ctx.sendError(res,400,e.message);return true;}
    if(!verifyTotp(secret,b.code)){ctx.sendError(res,401,"Invalid authenticator code.");return true;}
    user.twoFactorSecret=secret;user.twoFactorEnabled=true;delete user.pendingTwoFactorSecret;user.twoFactorEnabledAt=new Date().toISOString();
    if(ctx.audit)ctx.audit(db,"two_factor_enabled",user,{method:"totp"});
    ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,enabled:true});return true;
  }

  if(path==="/api/v2/security/2fa/disable" && method==="POST"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    if(!user.twoFactorEnabled){ctx.sendJSON(res,200,{success:true,enabled:false});return true;}
    let b={};try{b=await bodyFor(req);}catch(e){ctx.sendError(res,400,e.message);return true;}
    if(!await passwordVerify(String(b.currentPassword||""),user.passwordHash)){ctx.sendError(res,401,"Current password is incorrect.");return true;}
    if(!verifyTotp(user.twoFactorSecret,String(b.code||""))){ctx.sendError(res,401,"Invalid authenticator code.");return true;}
    delete user.twoFactorSecret;delete user.pendingTwoFactorSecret;user.twoFactorEnabled=false;user.twoFactorDisabledAt=new Date().toISOString();
    if(ctx.audit)ctx.audit(db,"two_factor_disabled",user,{method:"totp"});
    ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,enabled:false});return true;
  }

  if(path==="/api/v2/security/sessions" && method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    const token=currentToken(req), sessions=(db.sessions||[]).filter(s=>s.userId===user.id).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    ctx.sendJSON(res,200,{success:true,sessions:sessions.map(s=>({id:s.id,createdAt:s.createdAt,expiresAt:s.expiresAt,current:!!token&&s.token===token}))});return true;
  }

  if(path==="/api/v2/security/sessions/revoke" && method==="POST"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    let b={};try{b=await bodyFor(req);}catch(e){ctx.sendError(res,400,e.message);return true;}
    const token=currentToken(req);
    if(b.allOther===true){
      db.sessions=(db.sessions||[]).filter(s=>s.userId!==user.id || s.token===token);
    } else {
      const id=clean(ctx,b.sessionId,120);
      db.sessions=(db.sessions||[]).filter(s=>!(s.userId===user.id&&s.id===id&&s.token!==token));
    }
    ctx.saveDB(db);ctx.sendJSON(res,200,{success:true});return true;
  }

  if(path==="/api/v2/security/password" && method==="POST"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    let b={};try{b=await bodyFor(req);}catch(e){ctx.sendError(res,400,e.message);return true;}
    const current=String(b.currentPassword||""),next=String(b.newPassword||"");
    if(next.length<8||!/[a-z]/.test(next)||!/[A-Z]/.test(next)||!/[0-9]/.test(next)){ctx.sendError(res,400,"New password must be at least 8 characters and include uppercase, lowercase and a number.");return true;}
    if(!await passwordVerify(current,user.passwordHash)){ctx.sendError(res,401,"Current password is incorrect.");return true;}
    user.passwordHash=passwordHash(next);user.passwordChangedAt=new Date().toISOString();
    const token=currentToken(req);
    db.sessions=(db.sessions||[]).filter(s=>s.userId!==user.id||s.token===token);
    ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,sessionsRevoked:true});return true;
  }

  if(path==="/api/v2/data/export" && method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    const data=safeSettingsExport(db,user);
    ctx.sendJSON(res,200,{success:true,exportedAt:data.exportedAt,data});return true;
  }

  return false;
}

module.exports={handleRizoraModern};