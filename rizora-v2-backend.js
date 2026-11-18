const { handleRizoraMedia } = require("./rizora-v2-media-backend");
const { handleRizoraBusiness } = require("./rizora-v2-business");
const { handleRizoraGrowth } = require("./rizora-v2-growth");
const { handleRizoraPlatform } = require("./rizora-v2-platform");
const { handleRizoraUpgrades } = require("./rizora-v2-upgrades");
const { handleRizoraFans } = require("./rizora-v2-fans");
const { handleRizoraComments, controlsFor, commentBlockedByControl } = require("./rizora-v2-comments");
const { tagAllowed, mediaTypeFromUrl, normalizePeopleTags, decoratePeopleTags, notifyNewPeopleTags } = require("./rizora-v2-tagging");
"use strict";
const { handleRizoraModern } = require("./rizora-v2-modern");

function ensure(db){
  db.rzV2=db.rzV2||{};
  db.rzV2.posts=db.rzV2.posts||[];
  db.rzV2.updates=db.rzV2.updates||[];
  db.rzV2.comments=db.rzV2.comments||[];
  db.rzV2.commentLikes=Array.isArray(db.rzV2.commentLikes)?db.rzV2.commentLikes:[];
  db.rzV2.likes=db.rzV2.likes||[];
  db.rzV2.saves=db.rzV2.saves||[];
  db.rzV2.reposts=db.rzV2.reposts||[];
  db.rzV2.pollVotes=db.rzV2.pollVotes||[];
  db.rzV2.follows=db.rzV2.follows||[];
  db.rzV2.hashtags=db.rzV2.hashtags||{};
  db.rzV2.hashtagFollows=db.rzV2.hashtagFollows||[];
  db.rzV2.policy=db.rzV2.policy||{};
  db.rzV2.policy.warnings=db.rzV2.policy.warnings||{};
  db.rzV2.policy.exemptions=db.rzV2.policy.exemptions||{};
  db.creatorProfiles=db.creatorProfiles||{};
  db.notifications=db.notifications||[];
}
function profileFor(db,user){
  db.creatorProfiles[user.id]=db.creatorProfiles[user.id]||{userId:user.id,bio:"",avatarUrl:"",bannerUrl:"",category:"",location:"",links:[]};
  return db.creatorProfiles[user.id];
}
function profileStats(db,userId){
  var rz=db.rzV2||{},posts=(rz.posts||[]).filter(function(post){return post.userId===userId&&post.visibility!=="private"&&post.deleted!==true;}),postIds=new Set(posts.map(function(post){return post.id;})),follows=rz.follows||[];
  return {
    posts:posts.length,
    followers:follows.filter(function(row){return row.followingId===userId;}).length,
    following:follows.filter(function(row){return row.followerId===userId;}).length,
    likes:(rz.likes||[]).filter(function(row){return postIds.has(row.postId);}).length
  };
}
var earlyMemberCache=new WeakMap();
function isEarlyMember(db,user){
  var users=Array.isArray(db.users)?db.users:[],stamp=users.length+":"+(users[0]&&users[0].id||"")+":"+(users[users.length-1]&&users[users.length-1].id||"");
  var cached=earlyMemberCache.get(db);
  if(!cached||cached.stamp!==stamp){
    var eligible=users.filter(function(item){return item&&item.id&&item.status!=="deleted"&&item.official!==true&&!/^(super_admin|system|platform)$/i.test(String(item.role||""));});
    eligible.sort(function(a,b){var at=Date.parse(a.createdAt||"")||Number.MAX_SAFE_INTEGER,bt=Date.parse(b.createdAt||"")||Number.MAX_SAFE_INTEGER;return at-bt||String(a.id).localeCompare(String(b.id));});
    cached={stamp:stamp,ids:new Set(eligible.slice(0,120).map(function(item){return item.id;}))};earlyMemberCache.set(db,cached);
  }
  return cached.ids.has(user.id);
}
function safeProfileLinks(value){
  return (Array.isArray(value)?value:[]).slice(0,8).map(function(item){
    var url=String(typeof item==="string"?item:(item&&(item.url||item.href)||"")).trim().slice(0,600),label=String(typeof item==="string"?"":(item&&(item.label||item.title)||"")).trim().slice(0,60);
    try{var parsed=new URL(url);if(parsed.protocol!=="https:"&&parsed.protocol!=="http:")return null;if(parsed.username||parsed.password)return null;return {label:label||parsed.hostname.replace(/^www\./,""),url:parsed.href};}catch(_){return null;}
  }).filter(Boolean);
}
function publicProfile(db,user){
  var p=profileFor(db,user);
  var plan=String(user.plan||"").toLowerCase(),early=isEarlyMember(db,user),badgeType=String(user.verificationBadgeType||"");
  if(!/^(early|premium|premium_plus)$/.test(badgeType))badgeType=plan==="premium_plus"||user.premiumPlus===true||user.role==="super_admin"?"premium_plus":plan==="premium"?"premium":(early?"early":"");
  var badgePath={early:"/assets/rizora_verified_early.svg",premium:"/assets/rizora_verified_premium.svg",premium_plus:"/assets/rizora_verified_premium_plus.svg"}[badgeType]||"";
  var isVerified=user.verified===true||user.verificationStatus==="verified"||early||!!badgeType;
  return Object.assign({id:user.id,username:user.username,publicUsername:user.publicUsername||user.username,displayName:user.displayName||user.username,bio:p.bio||"",avatarUrl:p.avatarUrl||user.avatarUrl||"",bannerUrl:p.bannerUrl||"",category:p.category||"",location:p.location||"",links:safeProfileLinks(p.links),verified:isVerified,verificationBadgeType:badgeType,verifiedBadgeUrl:badgePath,verificationStatus:user.verificationStatus||"not_submitted",official:user.official===true,points:Number(user.points||0)},profileStats(db,user.id));
}
function mediaRecordForUrl(db,value,ownerId){
  var raw=String(value||""),id="";
  try{var parsed=new URL(raw,"https://rizora.local"),match=parsed.pathname.match(/^\/api\/v2\/media\/([^/.]+)(?:\.[a-z0-9]+)?$/i);if(match)id=decodeURIComponent(match[1]);}catch(_){}
  return (db.rzV2.media||[]).find(function(item){return (id?item.id===id:item.url===raw)&&(!ownerId||item.ownerId===ownerId);})||null;
}
function mediaMessageType(media){var mime=String(media&&media.mimeType||"").toLowerCase();return mime.indexOf("image/")===0?"image":mime.indexOf("video/")===0?"video":mime.indexOf("audio/")===0?"audio":media?"file":"text";}var EXPLICIT=[/\bporn(?:ography)?\b/i,/\bxxx\b/i,/\bnudes?\b/i,/\bsex\s*tape\b/i,/\bsex(?:ual)?\s*(?:work|service|services)\b/i,/\berotic\b/i,/\bnsfw\b/i,/\bonlyfans\b/i,/\bpornhub\b/i,/\bxvideos?\b/i,/\bxnxx\b/i,/\bescort\b/i];
function warningState(db,id){db.rzV2.policy.warnings[id]=db.rzV2.policy.warnings[id]||{count:0,history:[]};return db.rzV2.policy.warnings[id];}
function isExempt(db,id){return !!db.rzV2.policy.exemptions[id];}
function notify(db,id,title,message,type){db.notifications.push({id:"n_"+Date.now().toString(36),userId:id,title:title,message:message,type:type||"social",read:false,createdAt:new Date().toISOString()});}
function moderate(db,user,ctx,values,contentId){
  if(isExempt(db,user.id)) return {allowed:true,exempt:true};
  var list=Array.isArray(values)?values:[values];
  var bad=list.some(function(v){return EXPLICIT.some(function(p){return p.test(String(v||"").normalize("NFKC").toLowerCase());});});
  if(!bad) return {allowed:true};
  var s=warningState(db,user.id);
  s.count=Math.min(3,Number(s.count||0)+1);
  s.history.push({id:"w_"+Date.now().toString(36),number:s.count,reason:"Adult or sexually explicit content is not allowed on RIZORA.",contentId:contentId||null,createdAt:new Date().toISOString()});
  if(s.count===2){user.postingRestricted=true;user.postingRestrictionReason="Second content-policy warning.";}
  if(s.count>=3){user.status="suspended";user.postingRestricted=true;user.suspensionReason="Three content-policy warnings.";}
  ctx.audit(ctx.db,"content_policy_warning",user,{warningNumber:s.count,contentId:contentId||null});
  ctx.saveDB(ctx.db);
  return {allowed:false,warningNumber:s.count,message:s.count>=3?"Content blocked. Warning 3/3. Account suspended pending review.":"Content blocked. Warning "+s.count+"/3."};
}
function tags(text){var out={};String(text||"").split(/\s+/).forEach(function(x){if(/^#[a-zA-Z0-9_]{1,50}$/.test(x))out[x.slice(1).toLowerCase()]=1;});return Object.keys(out).slice(0,20);}
function mentions(text){var out={};String(text||"").split(/\s+/).forEach(function(x){if(/^@[a-zA-Z0-9_.-]{3,30}$/.test(x))out[x.slice(1).toLowerCase()]=1;});return Object.keys(out).slice(0,20);}
function normalizePostMediaStyle(value){var style=value&&typeof value==="object"?value:{},filters=["original","noir","lagos","vintage","warm","cool","bw","cinematic","soft","golden-hour","vivid"],effects=["none","blur","glow","vhs","grain","slow-zoom","shake","mirror","fisheye","sparkle"],crops=["original","square","portrait","story","landscape"],animations=["none","fade","pop","typewriter"],filter=String(style.filter||"original"),effect=String(style.effect||"none"),crop=String(style.crop||"original"),overlayColor=String(style.overlayColor||"white"),overlayAnimation=String(style.overlayAnimation||"none"),strength=Number(style.strength),rotation=Number(style.rotation),speed=Number(style.speed),trimStart=Number(style.trimStart),trimEnd=Number(style.trimEnd),overlayX=Number(style.overlayX),overlayY=Number(style.overlayY),range=function(key,min,max,fallback){var n=Number(style[key]);return Number.isFinite(n)?Math.max(min,Math.min(max,Math.round(n))):fallback;};if(filters.indexOf(filter)<0)filter="original";if(effects.indexOf(effect)<0)effect="none";if(crops.indexOf(crop)<0)crop="original";if(["white","black"].indexOf(overlayColor)<0)overlayColor="white";if(animations.indexOf(overlayAnimation)<0)overlayAnimation="none";if(!Number.isFinite(strength))strength=100;if([0,90,180,270].indexOf(rotation)<0)rotation=0;if([.5,1,1.5,2].indexOf(speed)<0)speed=1;if(!Number.isFinite(trimStart))trimStart=0;if(!Number.isFinite(trimEnd))trimEnd=0;if(!Number.isFinite(overlayX))overlayX=50;if(!Number.isFinite(overlayY))overlayY=82;return {filter:filter,effect:effect,strength:Math.max(0,Math.min(100,Math.round(strength))),crop:crop,rotation:rotation,flipX:style.flipX===true,speed:speed,brightness:range("brightness",50,150,100),contrast:range("contrast",50,150,100),saturation:range("saturation",0,200,100),warmth:range("warmth",-100,100,0),sharpness:range("sharpness",0,100,0),highlights:range("highlights",-100,100,0),shadows:range("shadows",-100,100,0),overlayText:String(style.overlayText||"").slice(0,160),overlayColor:overlayColor,overlayAnimation:overlayAnimation,overlayX:Math.max(0,Math.min(100,overlayX)),overlayY:Math.max(0,Math.min(100,overlayY)),trimStart:Math.round(Math.max(0,Math.min(3600,trimStart))*10)/10,trimEnd:Math.round(Math.max(0,Math.min(3600,trimEnd))*10)/10};}
function decorate(db,post){
  var author=db.users.find(function(u){return u.id===post.userId;});
  if(!author)return null;
  var attached=mediaRecordForUrl(db,post.mediaUrl,post.userId);
  var collaborators=(post.collaboratorIds||[]).map(function(id){
    return db.users.find(function(u){return u.id===id;});
  }).filter(Boolean).map(function(u){return publicProfile(db,u);});
  var poll=post.poll?{
    question:post.poll.question||"",
    expiresAt:post.poll.expiresAt||null,
    options:(post.poll.options||[]).map(function(option){
      var votes=db.rzV2.pollVotes.filter(function(v){return v.postId===post.id&&v.optionId===option.id;}).length;
      return {id:option.id,label:option.label,votes:votes};
    })
  }:null;
  return {
    id:post.id,
    userId:post.userId,
    text:post.text,
    mediaUrl:post.mediaUrl,
    mediaId:post.mediaId||attached&&attached.id||"",
    mimeType:post.mimeType||attached&&attached.mimeType||"",
    messageType:post.messageType||mediaMessageType(attached),
    mediaStyle:normalizePostMediaStyle(post.mediaStyle),
    peopleTags:decoratePeopleTags(db,post.userId,post.peopleTags),
    aiAssisted:post.aiAssisted===true,
    hashtags:post.hashtags||[],
    mentions:post.mentions||[],
    collaborators:collaborators,
    poll:poll,
    createdAt:post.createdAt,
    author:publicProfile(db,author),
    metrics:{
      likes:db.rzV2.likes.filter(function(x){return x.postId===post.id;}).length,
      comments:db.rzV2.comments.filter(function(x){return x.postId===post.id;}).length,
      reposts:db.rzV2.reposts.filter(function(x){return x.postId===post.id;}).length,
      saves:db.rzV2.saves.filter(function(x){return x.postId===post.id;}).length,
      pollVotes:db.rzV2.pollVotes.filter(function(x){return x.postId===post.id;}).length
    }
  };
}
async function body(req){var raw="";for await(var c of req){raw+=c.toString();if(raw.length>1100000)throw new Error("Request body too large.");}return raw?JSON.parse(raw):{};}
function active(user){return !!user&&user.status==="active"&&user.postingRestricted!==true;}

async function handleRizoraV2(ctx){
  ensure(ctx.db);
  var db=ctx.db,req=ctx.req,res=ctx.res,user=ctx.getCurrentUser(db,req),url=new URL(req.url,"http://rizora.local"),path=url.pathname,method=String(req.method||"GET").toUpperCase();

  if(method==="GET"&&path==="/api/v2/me"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var s=warningState(db,user.id);
    ctx.sendJSON(res,200,{success:true,user:Object.assign(publicProfile(db,user),{email:user.email||"",role:user.role||"user",status:user.status||"active",warningCount:s.count,postingRestricted:user.postingRestricted===true,twoFactorEnabled:user.twoFactorEnabled===true}),profile:profileFor(db,user)});
    return true;
  }

  if(method==="GET"&&path==="/api/v2/updates"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var updates=(db.rzV2.updates||[]).filter(function(item){return item.status==="published";}).slice().sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);}).slice(0,50);
    ctx.sendJSON(res,200,{success:true,updates:updates});return true;
  }

  if(method==="POST"&&path==="/api/v2/admin/updates"){
    if(!ctx.isSuperAdmin(user)){ctx.sendError(res,403,"Super admin access required.");return true;}
    var updateBody=await body(req),title=ctx.cleanString(updateBody.title,140),message=ctx.cleanString(updateBody.message,3000),mediaId=ctx.cleanString(updateBody.mediaId,160),media=mediaId?(db.rzV2.media||[]).find(function(item){return item.id===mediaId&&item.ownerId===user.id;}):null;
    if(mediaId&&!media){ctx.sendError(res,403,"This uploaded media does not belong to your account.");return true;}
    if(media&&!/^(image|video)\//i.test(String(media.mimeType||""))){ctx.sendError(res,415,"Updates support image and video attachments.");return true;}
    if(!title||(!message&&!media)){ctx.sendError(res,400,"Add a title and message or image/video before publishing.");return true;}
    var update={id:ctx.uid("update_"),title:title,message:message,mediaId:media&&media.id||"",mediaUrl:media&&media.url||"",mimeType:media&&media.mimeType||"",createdBy:user.id,createdAt:new Date().toISOString(),status:"published"};
    db.rzV2.updates.unshift(update);db.rzV2.updates=db.rzV2.updates.slice(0,200);
    (db.users||[]).filter(function(recipient){return recipient.status==="active"&&recipient.id!==user.id;}).slice(0,2000).forEach(function(recipient){notify(db,recipient.id,"RIZORA update: "+title,message||"A new image or video update is available on RIZORA.","platform_update");});
    ctx.saveDB(db);ctx.sendJSON(res,201,{success:true,update:update});return true;
  }

  if(method==="GET"&&path==="/api/v2/profile/posts"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var profileTab=String(url.searchParams.get("tab")||"posts").toLowerCase(),eligiblePosts=(db.rzV2.posts||[]).filter(function(post){return post.visibility!=="private"&&post.deleted!==true;});
    if(profileTab==="tagged"){
      eligiblePosts=eligiblePosts.filter(function(post){return (post.peopleTags||[]).some(function(tag){return tag.userId===user.id&&decoratePeopleTags(db,post.userId,[tag]).length>0;});});
    }else if(profileTab==="saved"){
      var savedIds=new Set((db.rzV2.saves||[]).filter(function(row){return row.userId===user.id;}).map(function(row){return row.postId;}));
      eligiblePosts=eligiblePosts.filter(function(post){return savedIds.has(post.id);});
    }else if(profileTab==="liked"){
      var likedIds=new Set((db.rzV2.likes||[]).filter(function(row){return row.userId===user.id;}).map(function(row){return row.postId;}));
      eligiblePosts=eligiblePosts.filter(function(post){return likedIds.has(post.id);});
    }else{
      eligiblePosts=eligiblePosts.filter(function(post){return post.userId===user.id;});
      if(profileTab==="media")eligiblePosts=eligiblePosts.filter(function(post){return Boolean(post.mediaUrl);});
    }
    var ownPosts=eligiblePosts.sort(function(a,b){return Date.parse(b.createdAt||"")-Date.parse(a.createdAt||"");}).slice(0,100).map(function(post){return decorate(db,post);}).filter(Boolean);
    ctx.sendJSON(res,200,{success:true,tab:profileTab,posts:ownPosts});return true;
  }

  var badgeRoute=path.match(/^\/api\/v2\/admin\/users\/([^/]+)\/badge$/);
  if(method==="POST"&&badgeRoute){
    if(!user||!ctx.isSuperAdmin(user)){ctx.sendError(res,403,"Super Admin access is required.");return true;}
    var targetId=decodeURIComponent(badgeRoute[1]),target=db.users.find(function(item){return item.id===targetId;});
    if(!target){ctx.sendError(res,404,"User not found.");return true;}
    var badgeBody=await body(req),badge=String(badgeBody.type||"").trim().toLowerCase();
    if(badge&&!/^(early|premium|premium_plus)$/.test(badge)){ctx.sendError(res,400,"Choose an available badge type.");return true;}
    if(badge)target.verificationBadgeType=badge;
    else delete target.verificationBadgeType;
    notify(db,target.id,badge?"Profile badge assigned":"Profile badge reset",badge?"An administrator updated your profile badge.":"Your profile badge now follows your membership status.","activity");
    ctx.audit(db,"admin_profile_badge_updated",user,{targetId:target.id,badgeType:badge||null});ctx.saveDB(db);
    ctx.sendJSON(res,200,{success:true,profile:publicProfile(db,target)});return true;
  }

  if((method==="GET"||method==="PATCH")&&path==="/api/v2/profile"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    if(method==="GET"){ctx.sendJSON(res,200,{success:true,profile:publicProfile(db,user)});return true;}
    if(!active(user)){ctx.sendError(res,403,"Your account cannot edit creator content right now.");return true;}
    var b=await body(req),p=profileFor(db,user),m=moderate(db,user,ctx,[b.bio,b.category,b.location],"profile:"+user.id);
    if(!m.allowed){ctx.sendJSON(res,422,Object.assign({success:false,code:"CONTENT_POLICY_VIOLATION"},m));return true;}
      p.bio=ctx.cleanString(b.bio,600);p.category=ctx.cleanString(b.category,80);p.location=ctx.cleanString(b.location,80);p.avatarUrl=ctx.cleanString(b.avatarUrl,1200);if(Object.prototype.hasOwnProperty.call(b,"bannerUrl"))p.bannerUrl=ctx.cleanString(b.bannerUrl,1200);if(Array.isArray(b.links))p.links=safeProfileLinks(b.links);user.avatarUrl=p.avatarUrl;user.bannerUrl=p.bannerUrl||"";user.bio=p.bio;notify(db,user.id,"Profile updated","Your profile changes are saved.","activity");ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,profile:publicProfile(db,user)});return true;
  }

  if(method==="GET"&&path==="/api/v2/feed"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var tab=String(url.searchParams.get("tab")||"for-you"),category=String(url.searchParams.get("category")||"all").toLowerCase();
    var offset=Math.max(0,Math.min(10000,Number(url.searchParams.get("offset")||0)||0));
    var limit=Math.max(1,Math.min(50,Number(url.searchParams.get("limit")||20)||20));
    var blockedUsers=new Set((db.rzV2.blocks||[]).filter(function(block){return block.userId===user.id||block.targetUserId===user.id;}).map(function(block){return block.userId===user.id?block.targetUserId:block.userId;}));
    var posts=db.rzV2.posts.filter(function(post){return post.deleted!==true&&(post.visibility!=="private"||post.userId===user.id)&&!blockedUsers.has(post.userId);});
    if(tab==="following"){var ids=new Set(db.rzV2.follows.filter(function(x){return x.followerId===user.id;}).map(function(x){return x.followingId;}));posts=posts.filter(function(p){return p.userId===user.id||ids.has(p.userId);});}
    else if(tab==="saved"){var saves=new Set(db.rzV2.saves.filter(function(x){return x.userId===user.id;}).map(function(x){return x.postId;}));posts=posts.filter(function(p){return saves.has(p.id);});}
    else if(tab==="trending"){posts.sort(function(a,b){var A=decorate(db,a).metrics,B=decorate(db,b).metrics;return B.likes+B.comments*2+B.reposts*3+B.saves*2-(A.likes+A.comments*2+A.reposts*3+A.saves*2);});}
    else posts.sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);});
    if(category==="music")posts=posts.filter(function(p){var type=String(p.messageType||"").toLowerCase(),mime=String(p.mimeType||mediaRecordForUrl(db,p.mediaUrl,p.userId)&&mediaRecordForUrl(db,p.mediaUrl,p.userId).mimeType||"").toLowerCase();return type==="audio"||mime.indexOf("audio/")===0;});
    else if(category==="videos")posts=posts.filter(function(p){var type=String(p.messageType||"").toLowerCase(),mime=String(p.mimeType||mediaRecordForUrl(db,p.mediaUrl,p.userId)&&mediaRecordForUrl(db,p.mediaUrl,p.userId).mimeType||"").toLowerCase();return type==="video"||mime.indexOf("video/")===0;});
    else if(category==="photos")posts=posts.filter(function(p){var type=String(p.messageType||"").toLowerCase(),mime=String(p.mimeType||mediaRecordForUrl(db,p.mediaUrl,p.userId)&&mediaRecordForUrl(db,p.mediaUrl,p.userId).mimeType||"").toLowerCase();return type==="image"||mime.indexOf("image/")===0;});
    var total=posts.length,page=posts.slice(offset,offset+limit).map(function(p){return decorate(db,p);}).filter(Boolean),nextOffset=offset+page.length;
    ctx.sendJSON(res,200,{success:true,tab:tab,category:category,total:total,offset:offset,limit:limit,nextOffset:nextOffset,hasMore:nextOffset<total,posts:page});return true;
  }

  if(method==="POST"&&path==="/api/v2/posts"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    if(!active(user)){ctx.sendError(res,403,"Your account is restricted from posting.");return true;}
    var pb=await body(req),text=ctx.cleanString(pb.text||pb.caption,4000),media=ctx.cleanString(pb.mediaUrl,1200);
    if(!text&&!media){ctx.sendError(res,400,"Add text or media before publishing.");return true;}
    var mm=moderate(db,user,ctx,[text,media],null);
    if(!mm.allowed){ctx.sendJSON(res,422,Object.assign({success:false,code:"CONTENT_POLICY_VIOLATION"},mm));return true;}
    var attachedMedia=mediaRecordForUrl(db,media,user.id),internalMedia=/\/api\/v2\/media\//i.test(media);
    if(internalMedia&&!attachedMedia){ctx.sendError(res,403,"This uploaded media does not belong to your account. Upload it again before publishing.");return true;}
    var hs=tags(text),ms=mentions(text),messageType=mediaTypeFromUrl(media,mediaMessageType(attachedMedia)),post={id:ctx.uid("post_"),userId:user.id,text:text,mediaUrl:media,mediaId:attachedMedia&&attachedMedia.id||"",mimeType:attachedMedia&&attachedMedia.mimeType||"",messageType:messageType,mediaStyle:normalizePostMediaStyle(pb.mediaStyle),peopleTags:(messageType==="image"||messageType==="video")?normalizePeopleTags(db,user.id,pb.peopleTags):[],aiAssisted:pb.aiAssisted===true,hashtags:hs,mentions:ms,createdAt:new Date().toISOString()};
    db.rzV2.posts.push(post);hs.forEach(function(tag){db.rzV2.hashtags[tag]=Number(db.rzV2.hashtags[tag]||0)+1;});
    notifyNewPeopleTags(db,user,post,[]);
    // Keep followers informed when a creator publishes. Cap the fan-out so a
    // large account cannot make a publish request slow or flood the database.
    var followers=(db.rzV2.follows||[]).filter(function(f){return f.followingId===user.id&&f.followerId!==user.id;}).slice(-100);
    followers.forEach(function(f){notify(db,f.followerId,"New post from @"+user.username,"@"+user.username+" just published on RIZORA.","publish");});
    ms.forEach(function(handle){var target=db.users.find(function(u){return String(u.username||"").toLowerCase()===handle||String(u.publicUsername||"").toLowerCase()===handle;});if(target&&target.id!==user.id)notify(db,target.id,"You were mentioned","@"+user.username+" mentioned you.","mention");});notify(db,user.id,"Post published","Your post is now live on RIZORA.","activity");
    ctx.saveDB(db);ctx.sendJSON(res,201,{success:true,post:decorate(db,post)});return true;
  }

  var editPostRoute=path.match(/^\/api\/v2\/posts\/([^/]+)$/);
  if(method==="PATCH"&&editPostRoute){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    if(!active(user)){ctx.sendError(res,403,"Your account is restricted from editing posts.");return true;}
    var editPostId=decodeURIComponent(editPostRoute[1]),editTarget=db.rzV2.posts.find(function(item){return item.id===editPostId&&item.deleted!==true;});
    if(!editTarget){ctx.sendError(res,404,"Post not found.");return true;}
    if(editTarget.userId!==user.id){ctx.sendError(res,403,"You can only edit your own posts.");return true;}
    var editCreatedAt=new Date(editTarget.createdAt||0).getTime();
    if(!Number.isFinite(editCreatedAt)||Date.now()-editCreatedAt>48*60*60*1000){ctx.sendError(res,403,"Posts can be edited for up to 48 hours after publishing.");return true;}
    var editBody=await body(req),nextText=Object.prototype.hasOwnProperty.call(editBody,"text")?ctx.cleanString(editBody.text,4000):String(editTarget.text||"");
    var nextMedia=Object.prototype.hasOwnProperty.call(editBody,"mediaUrl")?ctx.cleanString(editBody.mediaUrl,1200):String(editTarget.mediaUrl||"");
    if(!nextText&&!nextMedia){ctx.sendError(res,400,"A post needs a caption or media.");return true;}
    var editModeration=moderate(db,user,ctx,[nextText,nextMedia],"post:"+editTarget.id);
    if(!editModeration.allowed){ctx.sendJSON(res,422,Object.assign({success:false,code:"CONTENT_POLICY_VIOLATION"},editModeration));return true;}
    var priorMediaUrl=String(editTarget.mediaUrl||""),priorMessageType=String(editTarget.messageType||""),priorPeopleTags=Array.isArray(editTarget.peopleTags)?editTarget.peopleTags.slice():[];
    var nextMediaRecord=nextMedia?mediaRecordForUrl(db,nextMedia,user.id):null;
    if(nextMedia&&/\/api\/v2\/media\//i.test(nextMedia)&&!nextMediaRecord){ctx.sendError(res,403,"This uploaded media does not belong to your account. Upload it again before publishing.");return true;}
    var oldTags=Array.isArray(editTarget.hashtags)?editTarget.hashtags.slice():tags(editTarget.text||""),nextTags=tags(nextText);
    oldTags.forEach(function(tag){var normalized=String(tag).toLowerCase();if(nextTags.indexOf(normalized)<0){var count=Number(db.rzV2.hashtags[normalized]||0)-1;if(count>0)db.rzV2.hashtags[normalized]=count;else delete db.rzV2.hashtags[normalized];}});
    nextTags.forEach(function(tag){if(oldTags.map(function(value){return String(value).toLowerCase();}).indexOf(tag)<0)db.rzV2.hashtags[tag]=Number(db.rzV2.hashtags[tag]||0)+1;});
    var priorMentions=Array.isArray(editTarget.mentions)?editTarget.mentions:mentions(editTarget.text||"");
    editTarget.text=nextText;
    editTarget.mediaUrl=nextMedia;
    editTarget.mediaId=nextMediaRecord&&nextMediaRecord.id||"";
    editTarget.mimeType=nextMediaRecord&&nextMediaRecord.mimeType||"";
    if(Object.prototype.hasOwnProperty.call(editBody,"mediaStyle"))editTarget.mediaStyle=normalizePostMediaStyle(editBody.mediaStyle);
    var mediaPath=nextMedia.toLowerCase().split("?")[0],detectedType=/\.(jpg|jpeg|png|webp|gif)$/.test(mediaPath)?"image":/\.(mp4|webm|mov)$/.test(mediaPath)?"video":/\.(mp3|m4a|wav|ogg)$/.test(mediaPath)?"audio":"file";
    editTarget.messageType=nextMediaRecord?mediaMessageType(nextMediaRecord):nextMedia?(nextMedia===priorMediaUrl?priorMessageType:detectedType):"text";
    editTarget.peopleTags=(editTarget.messageType==="image"||editTarget.messageType==="video")?normalizePeopleTags(db,user.id,Object.prototype.hasOwnProperty.call(editBody,"peopleTags")?editBody.peopleTags:priorPeopleTags):[];
    notifyNewPeopleTags(db,user,editTarget,priorPeopleTags);
    editTarget.hashtags=nextTags;
    editTarget.mentions=mentions(nextText);
    editTarget.updatedAt=new Date().toISOString();
    editTarget.mentions.forEach(function(handle){if(priorMentions.indexOf(handle)>=0)return;var target=db.users.find(function(item){return String(item.username||"").toLowerCase()===handle||String(item.publicUsername||"").toLowerCase()===handle;});if(target&&target.id!==user.id)notify(db,target.id,"You were mentioned","@"+user.username+" mentioned you in an edited post.","mention");});
    notify(db,user.id,"Post updated","Your post changes are saved.","activity");
    ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,post:decorate(db,editTarget)});return true;
  }

  if(method==="DELETE"&&editPostRoute){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    if(!active(user)){ctx.sendError(res,403,"Your account is restricted from deleting posts.");return true;}
    var deletePostId=decodeURIComponent(editPostRoute[1]),deleteTarget=db.rzV2.posts.find(function(item){return item.id===deletePostId&&item.deleted!==true;});
    if(!deleteTarget){ctx.sendError(res,404,"Post not found.");return true;}
    if(deleteTarget.userId!==user.id&&!ctx.isSuperAdmin(user)){ctx.sendError(res,403,"You can only delete your own posts.");return true;}
    (deleteTarget.hashtags||tags(deleteTarget.text||"")).forEach(function(tag){var normalized=String(tag).toLowerCase(),count=Number(db.rzV2.hashtags[normalized]||0)-1;if(count>0)db.rzV2.hashtags[normalized]=count;else delete db.rzV2.hashtags[normalized];});
    deleteTarget.deleted=true;deleteTarget.deletedAt=new Date().toISOString();deleteTarget.deletedBy=user.id;
    ["likes","comments","reposts","saves","pollVotes"].forEach(function(key){if(Array.isArray(db.rzV2[key]))db.rzV2[key]=db.rzV2[key].filter(function(item){return item.postId!==deletePostId;});});
    ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,deleted:true});return true;
  }

  var commentsRoute=path.match(/^\/api\/v2\/posts\/([^/]+)\/comments$/);
  if(method==="GET"&&commentsRoute){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var commentsPost=db.rzV2.posts.find(function(p){return p.id===commentsRoute[1];});
    if(!commentsPost){ctx.sendError(res,404,"Post not found.");return true;}
    var commentSort=String(url.searchParams.get("sort")||"newest").toLowerCase()==="top"?"top":"newest";
    var rawComments=(db.rzV2.comments||[]).filter(function(c){return c.postId===commentsPost.id&&((c.hidden!==true)||commentsPost.userId===user.id);}).slice();
    var commentLikes=db.rzV2.commentLikes||[];
    var commentMap={};
    rawComments.forEach(function(c){
      var author=db.users.find(function(u){return u.id===c.userId;});
      if(!author)return;
      commentMap[c.id]={id:c.id,postId:c.postId,userId:c.userId,text:c.text||"",mediaUrl:c.mediaUrl||"",mimeType:c.mimeType||"",messageType:c.messageType||"text",parentId:c.parentId||null,createdAt:c.createdAt,author:publicProfile(db,author),likes:commentLikes.filter(function(row){return row.commentId===c.id;}).length,liked:commentLikes.some(function(row){return row.commentId===c.id&&row.userId===user.id;}),pinned:commentsPost.pinnedCommentId===c.id,canDelete:c.userId===user.id||commentsPost.userId===user.id,replies:[]};
    });
    function sortCommentRows(rows){rows.sort(function(a,b){if(a.pinned!==b.pinned)return a.pinned?-1:1;if(commentSort==="top"&&b.likes!==a.likes)return b.likes-a.likes;return commentSort==="newest"?new Date(b.createdAt)-new Date(a.createdAt):new Date(a.createdAt)-new Date(b.createdAt);});}
    rawComments.forEach(function(c){
      var row=commentMap[c.id];
      if(!row)return;
      if(c.parentId&&commentMap[c.parentId]) commentMap[c.parentId].replies.push(row);
    });
    var roots=rawComments.map(function(c){return commentMap[c.id];}).filter(function(c){return c&&!c.parentId;});
    roots.forEach(function(root){sortCommentRows(root.replies);});sortCommentRows(roots);
    ctx.sendJSON(res,200,{success:true,comments:roots,total:rawComments.length,viewerIsPostOwner:commentsPost.userId===user.id,sort:commentSort});
    return true;
  }

  var match=path.match(/^\/api\/v2\/posts\/([^/]+)\/(like|save|repost|comment)$/);
  if(method==="POST"&&match){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    if(!active(user)){ctx.sendError(res,403,"Your account is restricted.");return true;}
    var postId=match[1],action=match[2],postTarget=db.rzV2.posts.find(function(p){return p.id===postId;});
    if(!postTarget){ctx.sendError(res,404,"Post not found.");return true;}
    if(action==="comment"){
      var cb=await body(req),ct=ctx.cleanString(cb.text,1000),parentId=ctx.cleanString(cb.parentId,120)||null,mediaId=ctx.cleanString(cb.mediaId,160),voiceMedia=null;
      if(mediaId){
        voiceMedia=(db.rzV2.media||[]).find(function(m){return m.id===mediaId&&m.ownerId===user.id&&String(m.mimeType||"").indexOf("audio/")===0;})||null;
        if(!voiceMedia){ctx.sendError(res,404,"Voice media not found.");return true;}
      }
      if(!ct&&!voiceMedia){ctx.sendError(res,400,"Add text or a voice recording.");return true;}
      if(parentId){
        var parentComment=(db.rzV2.comments||[]).find(function(c){return c.id===parentId&&c.postId===postId;});
        if(!parentComment){ctx.sendError(res,400,"Reply target not found.");return true;}
      }
      var cm=ct?moderate(db,user,ctx,ct,postId):{allowed:true};
      if(!cm.allowed){ctx.sendJSON(res,422,Object.assign({success:false,code:"CONTENT_POLICY_VIOLATION"},cm));return true;}
      var held=false,holdReason="";
      if(postTarget.userId!==user.id&&ct){var creatorControls=controlsFor(db,postTarget.userId);var heldCheck=commentBlockedByControl(creatorControls,ct);held=heldCheck.blocked;holdReason=heldCheck.reason;}
      db.rzV2.comments.push({id:ctx.uid("comment_"),postId:postId,userId:user.id,text:ct,mediaUrl:voiceMedia?voiceMedia.url:"",mimeType:voiceMedia?voiceMedia.mimeType:"",messageType:voiceMedia?"voice":"text",parentId:parentId,hidden:held,moderationReason:holdReason,createdAt:new Date().toISOString()});notify(db,user.id,parentId?"Reply posted":"Comment posted",parentId?"Your reply was added on RIZORA.":"Your comment was added on RIZORA.","activity");
      if(postTarget.userId!==user.id)notify(db,postTarget.userId,held?"Comment held for review":(parentId?"New reply":"New comment"),"@"+user.username+(held?" left a comment that matched your creator filters and was held for review.":(parentId?" replied to a comment on your post.":" commented on your post.")),"comment");
      ctx.saveDB(db);ctx.sendJSON(res,201,{success:true,hidden:held});return true;
    }
    var key=action==="like"?"likes":action==="save"?"saves":"reposts",collection=db.rzV2[key],existing=collection.find(function(x){return x.userId===user.id&&x.postId===postId;});
    if(existing){collection.splice(collection.indexOf(existing),1);ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,active:false});return true;}
    collection.push({id:ctx.uid(action+"_"),userId:user.id,postId:postId,createdAt:new Date().toISOString()});
    if(action==="like"&&postTarget.userId!==user.id)notify(db,postTarget.userId,"New like","@"+user.username+" liked your post.","like");
    if(action==="repost"&&postTarget.userId!==user.id)notify(db,postTarget.userId,"Your post was remixed","@"+user.username+" remixed your RIZORA post.","remix");
    notify(db,user.id,action==="like"?"Like added":action==="save"?"Post saved":"Post shared",action==="like"?"Your like was added to a RIZORA post.":action==="save"?"A post was added to your saved list.":"You remixed a RIZORA post.","activity");
    ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,active:true});return true;
  }

  var follow=path.match(/^\/api\/v2\/users\/([^/]+)\/follow$/);
  if(method==="POST"&&follow){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var handle=decodeURIComponent(follow[1]).toLowerCase(),target=db.users.find(function(u){return String(u.username||"").toLowerCase()===handle||String(u.publicUsername||"").toLowerCase()===handle;});
    if(!target){ctx.sendError(res,404,"Creator not found.");return true;}
    if(target.id===user.id){ctx.sendError(res,400,"You cannot follow yourself.");return true;}
    var ef=db.rzV2.follows.find(function(x){return x.followerId===user.id&&x.followingId===target.id;});
    if(ef){db.rzV2.follows.splice(db.rzV2.follows.indexOf(ef),1);ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,following:false});return true;}
    db.rzV2.follows.push({id:ctx.uid("follow_"),followerId:user.id,followingId:target.id,createdAt:new Date().toISOString()});notify(db,target.id,"New follower","@"+user.username+" followed you.","follow");notify(db,user.id,"Following @"+(target.publicUsername||target.username),"You are now following this creator on RIZORA.","activity");ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,following:true});return true;
  }

  var publicProfileRoute=path.match(/^\/api\/v2\/profiles\/([^/]+)$/);
  if(method==="GET"&&publicProfileRoute){
    var handle=decodeURIComponent(publicProfileRoute[1]).replace(/^@/,"").toLowerCase();
    var target=db.users.find(function(candidate){return String(candidate.username||"").toLowerCase()===handle||String(candidate.publicUsername||"").toLowerCase()===handle;});
    if(!target){ctx.sendError(res,404,"Creator not found.");return true;}
    var profile=publicProfile(db,target),posts=db.rzV2.posts.filter(function(post){return post.userId===target.id&&post.visibility!=="private"&&post.deleted!==true;}).slice().sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);}).slice(0,60).map(function(post){return decorate(db,post);}).filter(Boolean);
    var releases=(db.musicCatalog||[]).filter(function(item){return item.userId===target.id&&item.visibility!=="private";}).slice().sort(function(a,b){return new Date(b.updatedAt||b.createdAt)-new Date(a.updatedAt||a.createdAt);}).slice(0,40).map(function(item){return {id:item.id,title:item.title||"Untitled release",artist:item.artist||profile.displayName,artwork:item.artwork||"",audioUrl:item.audioUrl||"",videoUrl:item.videoUrl||item.visualUrl||"",genre:item.genre||"",mood:item.mood||"",status:item.status||"RIZORA catalog",createdAt:item.createdAt||item.updatedAt||""};});
    var viewerFollowing=!!(user&&db.rzV2.follows.some(function(row){return row.followerId===user.id&&row.followingId===target.id;}));
    ctx.sendJSON(res,200,{success:true,profile:profile,posts:posts,releases:releases,viewerFollowing:viewerFollowing});return true;
  }

  if(method==="GET"&&path==="/api/v2/tagging/search"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var tagQuery=String(url.searchParams.get("q")||"").replace(/^@/,"").trim().toLowerCase();
    if(tagQuery.length<1){ctx.sendJSON(res,200,{success:true,users:[]});return true;}
    var tagCandidates=(db.users||[]).filter(function(target){return target.status==="active"&&tagAllowed(db,user.id,target.id)&&(String(target.username||"").toLowerCase().includes(tagQuery)||String(target.publicUsername||"").toLowerCase().includes(tagQuery)||String(target.displayName||"").toLowerCase().includes(tagQuery));}).slice(0,12).map(function(target){return publicProfile(db,target);});
    ctx.sendJSON(res,200,{success:true,users:tagCandidates});return true;
  }

  if(method==="GET"&&path==="/api/v2/search"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var q=String(url.searchParams.get("q")||"").toLowerCase().replace(/^[@#]/,"").trim();
    var blockedSearchUsers=new Set((db.rzV2.blocks||[]).filter(function(block){return block.userId===user.id||block.targetUserId===user.id;}).map(function(block){return block.userId===user.id?block.targetUserId:block.userId;}));
    var users=db.users.filter(function(u){
      return u.status==="active"&&!blockedSearchUsers.has(u.id)&&(String(u.username||"").toLowerCase().includes(q)||
        String(u.publicUsername||"").toLowerCase().includes(q)||
        String(u.displayName||"").toLowerCase().includes(q));
    }).slice(0,20).map(function(u){var profile=publicProfile(db,u);profile.viewerFollowing=!!(user&&db.rzV2.follows.some(function(row){return row.followerId===user.id&&row.followingId===u.id;}));return profile;});
    var found=db.rzV2.posts.filter(function(p){return String(p.text||"").toLowerCase().includes(q)||(p.hashtags||[]).some(function(t){return t.includes(q);});}).slice(-30).reverse().map(function(p){return decorate(db,p);}).filter(Boolean);
    var hashtags=Object.entries(db.rzV2.hashtags).filter(function(x){return x[0].includes(q);}).slice(0,20).map(function(x){return {tag:x[0],count:x[1]};});
    ctx.sendJSON(res,200,{success:true,users:users,posts:found,hashtags:hashtags});return true;
  }

  var hashtagFollow=path.match(/^\/api\/v2\/hashtags\/([^/]+)\/follow$/);
  if(method==="POST"&&hashtagFollow){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var followedTag=decodeURIComponent(hashtagFollow[1]).replace(/^#/,'').toLowerCase();
    if(!/^[a-z0-9_]{1,50}$/.test(followedTag)){ctx.sendError(res,400,"That hashtag is invalid.");return true;}
    var existingTagFollow=db.rzV2.hashtagFollows.find(function(row){return row.userId===user.id&&row.tag===followedTag;});
    if(existingTagFollow)db.rzV2.hashtagFollows=db.rzV2.hashtagFollows.filter(function(row){return row!==existingTagFollow;});
    else db.rzV2.hashtagFollows.push({id:ctx.uid("tag_follow_"),userId:user.id,tag:followedTag,createdAt:new Date().toISOString()});
    ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,tag:followedTag,following:!existingTagFollow});return true;
  }
  var hash=path.match(/^\/api\/v2\/hashtags\/([^/]+)$/);
  if(method==="GET"&&hash){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var tag=decodeURIComponent(hash[1]).replace(/^#/,"").toLowerCase();
    var hp=db.rzV2.posts.filter(function(p){return (p.hashtags||[]).includes(tag);}).slice(-50).reverse().map(function(p){return decorate(db,p);}).filter(Boolean);
    var viewerFollowing=db.rzV2.hashtagFollows.some(function(row){return row.userId===user.id&&row.tag===tag;});
    ctx.sendJSON(res,200,{success:true,tag:tag,count:Number(db.rzV2.hashtags[tag]||hp.length),viewerFollowing:viewerFollowing,posts:hp});return true;
  }

  if(method==="GET"&&path==="/api/v2/notifications"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    ctx.sendJSON(res,200,{success:true,notifications:db.notifications.filter(function(n){return n.userId===user.id;}).slice().reverse().slice(0,100)});return true;
  }
  if(method==="POST"&&path==="/api/v2/notifications/read"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    db.notifications.forEach(function(n){if(n.userId===user.id)n.read=true;});ctx.saveDB(db);ctx.sendJSON(res,200,{success:true});return true;
  }
  if(method==="GET"&&path==="/api/v2/safety/me"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var st=warningState(db,user.id);ctx.sendJSON(res,200,{success:true,warnings:st.history.slice().reverse(),warningCount:st.count,maximumWarnings:3,status:user.status||"active",postingRestricted:user.postingRestricted===true,policyExempt:isExempt(db,user.id)});return true;
  }
  var ex=path.match(/^\/api\/v2\/admin\/policy\/exemptions\/([^/]+)$/);
  if(method==="POST"&&ex){
    if(!ctx.isSuperAdmin(user)){ctx.sendError(res,403,"Super admin access required.");return true;}
    var t=db.users.find(function(u){return u.id===ex[1];});if(!t){ctx.sendError(res,404,"User not found.");return true;}
    var eb={};try{eb=await body(req);}catch(e){}
    db.rzV2.policy.exemptions[t.id]={createdAt:new Date().toISOString(),createdBy:user.id,reason:ctx.cleanString(eb.reason,500)};ctx.audit(db,"policy_exception_granted",user,{targetUserId:t.id,policy:"adult_content"});ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,exempt:true});return true;
  }
  if(method==="DELETE"&&ex){
    if(!ctx.isSuperAdmin(user)){ctx.sendError(res,403,"Super admin access required.");return true;}
    delete db.rzV2.policy.exemptions[ex[1]];ctx.audit(db,"policy_exception_revoked",user,{targetUserId:ex[1],policy:"adult_content"});ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,exempt:false});return true;
  }
  var recover=path.match(/^\/api\/v2\/admin\/users\/([^/]+)\/recover$/);
  if(method==="POST"&&recover){
    if(!ctx.isSuperAdmin(user)){ctx.sendError(res,403,"Super admin access required.");return true;}
    var rt=db.users.find(function(u){return u.id===recover[1];});if(!rt){ctx.sendError(res,404,"User not found.");return true;}
    var rb={};try{rb=await body(req);}catch(e){}
    rt.status="active";rt.postingRestricted=false;delete rt.suspensionReason;delete rt.postingRestrictionReason;
    if(rb.resetWarnings===true){var rs=warningState(db,rt.id);rs.count=0;rs.history=[];}
    ctx.audit(db,"account_restored",user,{targetUserId:rt.id,resetWarnings:rb.resetWarnings===true});ctx.saveDB(db);ctx.sendJSON(res,200,{success:true});return true;
  }
  if (await handleRizoraComments(ctx)) return true;
  if (await handleRizoraModern(ctx)) return true;
  if (await handleRizoraUpgrades(ctx)) return true;
  if (await handleRizoraBusiness(ctx)) return true;
  if (await handleRizoraMedia(ctx)) return true;
  if (await handleRizoraGrowth(ctx)) return true;
  if (await handleRizoraPlatform(ctx)) return true;
  if (await handleRizoraFans(ctx)) return true;
  return false;
}
module.exports={handleRizoraV2};


