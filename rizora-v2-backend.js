const { handleRizoraGrowth } = require("./rizora-v2-growth");
const { handleRizoraPlatform } = require("./rizora-v2-platform");
const { handleRizoraUpgrades } = require("./rizora-v2-upgrades");
"use strict";
const { handleRizoraModern } = require("./rizora-v2-modern");

function ensure(db){
  db.rzV2=db.rzV2||{};
  db.rzV2.posts=db.rzV2.posts||[];
  db.rzV2.comments=db.rzV2.comments||[];
  db.rzV2.likes=db.rzV2.likes||[];
  db.rzV2.saves=db.rzV2.saves||[];
  db.rzV2.reposts=db.rzV2.reposts||[];
  db.rzV2.pollVotes=db.rzV2.pollVotes||[];
  db.rzV2.follows=db.rzV2.follows||[];
  db.rzV2.hashtags=db.rzV2.hashtags||{};
  db.rzV2.policy=db.rzV2.policy||{};
  db.rzV2.policy.warnings=db.rzV2.policy.warnings||{};
  db.rzV2.policy.exemptions=db.rzV2.policy.exemptions||{};
  db.creatorProfiles=db.creatorProfiles||{};
  db.notifications=db.notifications||[];
}
function profileFor(db,user){
  db.creatorProfiles[user.id]=db.creatorProfiles[user.id]||{userId:user.id,bio:"",avatarUrl:"",category:"",location:"",links:[]};
  return db.creatorProfiles[user.id];
}
function publicProfile(db,user){
  var p=profileFor(db,user);
  return {id:user.id,username:user.username,publicUsername:user.publicUsername||user.username,displayName:user.displayName||user.username,bio:p.bio||"",avatarUrl:p.avatarUrl||user.avatarUrl||"",category:p.category||"",location:p.location||"",links:p.links||[],verified:user.verified===true||user.verificationStatus==="verified",verificationStatus:user.verificationStatus||"not_submitted",official:user.official===true,points:Number(user.points||0)};
}
var EXPLICIT=[/\bporn(?:ography)?\b/i,/\bxxx\b/i,/\bnudes?\b/i,/\bsex\s*tape\b/i,/\bsex(?:ual)?\s*(?:work|service|services)\b/i,/\berotic\b/i,/\bnsfw\b/i,/\bonlyfans\b/i,/\bpornhub\b/i,/\bxvideos?\b/i,/\bxnxx\b/i,/\bescort\b/i];
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
function decorate(db,post){
  var author=db.users.find(function(u){return u.id===post.userId;});
  if(!author)return null;
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
  if (await handleRizoraUpgrades(ctx)) return true;
  if (await handleRizoraModern(ctx)) return true;
  ensure(ctx.db);
  var db=ctx.db,req=ctx.req,res=ctx.res,user=ctx.getCurrentUser(db,req),url=new URL(req.url,"http://rizora.local"),path=url.pathname,method=String(req.method||"GET").toUpperCase();

  if(method==="GET"&&path==="/api/v2/me"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var s=warningState(db,user.id);
    ctx.sendJSON(res,200,{success:true,user:Object.assign(publicProfile(db,user),{email:user.email||"",role:user.role||"user",status:user.status||"active",warningCount:s.count,postingRestricted:user.postingRestricted===true,twoFactorEnabled:user.twoFactorEnabled===true}),profile:profileFor(db,user)});
    return true;
  }

  if((method==="GET"||method==="PATCH")&&path==="/api/v2/profile"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    if(method==="GET"){ctx.sendJSON(res,200,{success:true,profile:publicProfile(db,user)});return true;}
    if(!active(user)){ctx.sendError(res,403,"Your account cannot edit creator content right now.");return true;}
    var b=await body(req),p=profileFor(db,user),m=moderate(db,user,ctx,[b.bio,b.category,b.location],"profile:"+user.id);
    if(!m.allowed){ctx.sendJSON(res,422,Object.assign({success:false,code:"CONTENT_POLICY_VIOLATION"},m));return true;}
    p.bio=ctx.cleanString(b.bio,600);p.category=ctx.cleanString(b.category,80);p.location=ctx.cleanString(b.location,80);p.avatarUrl=ctx.cleanString(b.avatarUrl,1200);p.links=Array.isArray(b.links)?b.links.slice(0,8):p.links;user.avatarUrl=p.avatarUrl;user.bio=p.bio;delete p.bannerUrl;delete user.bannerUrl;ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,profile:publicProfile(db,user)});return true;
  }

  if(method==="GET"&&path==="/api/v2/feed"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var tab=String(url.searchParams.get("tab")||"for-you"),posts=db.rzV2.posts.slice();
    if(tab==="following"){var ids=new Set(db.rzV2.follows.filter(function(x){return x.followerId===user.id;}).map(function(x){return x.followingId;}));posts=posts.filter(function(p){return p.userId===user.id||ids.has(p.userId);});}
    else if(tab==="saved"){var saves=new Set(db.rzV2.saves.filter(function(x){return x.userId===user.id;}).map(function(x){return x.postId;}));posts=posts.filter(function(p){return saves.has(p.id);});}
    else if(tab==="trending"){posts.sort(function(a,b){var A=decorate(db,a).metrics,B=decorate(db,b).metrics;return B.likes+B.comments*2+B.reposts*3+B.saves*2-(A.likes+A.comments*2+A.reposts*3+A.saves*2);});}
    else posts.sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);});
    ctx.sendJSON(res,200,{success:true,tab:tab,posts:posts.slice(0,50).map(function(p){return decorate(db,p);}).filter(Boolean)});return true;
  }

  if(method==="POST"&&path==="/api/v2/posts"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    if(!active(user)){ctx.sendError(res,403,"Your account is restricted from posting.");return true;}
    var pb=await body(req),text=ctx.cleanString(pb.text||pb.caption,4000),media=ctx.cleanString(pb.mediaUrl,1200);
    if(!text&&!media){ctx.sendError(res,400,"Add text or media before publishing.");return true;}
    var mm=moderate(db,user,ctx,[text,media],null);
    if(!mm.allowed){ctx.sendJSON(res,422,Object.assign({success:false,code:"CONTENT_POLICY_VIOLATION"},mm));return true;}
    var hs=tags(text),ms=mentions(text),post={id:ctx.uid("post_"),userId:user.id,text:text,mediaUrl:media,hashtags:hs,mentions:ms,createdAt:new Date().toISOString()};
    db.rzV2.posts.push(post);hs.forEach(function(tag){db.rzV2.hashtags[tag]=Number(db.rzV2.hashtags[tag]||0)+1;});
    ms.forEach(function(handle){var target=db.users.find(function(u){return String(u.username||"").toLowerCase()===handle||String(u.publicUsername||"").toLowerCase()===handle;});if(target&&target.id!==user.id)notify(db,target.id,"You were mentioned","@"+user.username+" mentioned you.","mention");});
    ctx.saveDB(db);ctx.sendJSON(res,201,{success:true,post:decorate(db,post)});return true;
  }

  var match=path.match(/^\/api\/v2\/posts\/([^/]+)\/(like|save|repost|comment)$/);
  if(method==="POST"&&match){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    if(!active(user)){ctx.sendError(res,403,"Your account is restricted.");return true;}
    var postId=match[1],action=match[2],postTarget=db.rzV2.posts.find(function(p){return p.id===postId;});
    if(!postTarget){ctx.sendError(res,404,"Post not found.");return true;}
    if(action==="comment"){
      var cb=await body(req),ct=ctx.cleanString(cb.text,1000);
      var cm=moderate(db,user,ctx,ct,postId);
      if(!cm.allowed){ctx.sendJSON(res,422,Object.assign({success:false,code:"CONTENT_POLICY_VIOLATION"},cm));return true;}
      db.rzV2.comments.push({id:ctx.uid("comment_"),postId:postId,userId:user.id,text:ct,createdAt:new Date().toISOString()});
      if(postTarget.userId!==user.id)notify(db,postTarget.userId,"New comment","@"+user.username+" commented on your post.","comment");
      ctx.saveDB(db);ctx.sendJSON(res,201,{success:true});return true;
    }
    var key=action==="like"?"likes":action==="save"?"saves":"reposts",collection=db.rzV2[key],existing=collection.find(function(x){return x.userId===user.id&&x.postId===postId;});
    if(existing){collection.splice(collection.indexOf(existing),1);ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,active:false});return true;}
    collection.push({id:ctx.uid(action+"_"),userId:user.id,postId:postId,createdAt:new Date().toISOString()});
    if(action==="like"&&postTarget.userId!==user.id)notify(db,postTarget.userId,"New like","@"+user.username+" liked your post.","like");
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
    db.rzV2.follows.push({id:ctx.uid("follow_"),followerId:user.id,followingId:target.id,createdAt:new Date().toISOString()});notify(db,target.id,"New follower","@"+user.username+" followed you.","follow");ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,following:true});return true;
  }

  if(method==="GET"&&path==="/api/v2/search"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var q=String(url.searchParams.get("q")||"").toLowerCase().replace(/^[@#]/,"").trim();
    var users=db.users.filter(function(u){return String(u.username||"").toLowerCase().includes(q)||String(u.displayName||"").toLowerCase().includes(q);}).slice(0,20).map(function(u){return publicProfile(db,u);});
    var found=db.rzV2.posts.filter(function(p){return String(p.text||"").toLowerCase().includes(q)||(p.hashtags||[]).some(function(t){return t.includes(q);});}).slice(-30).reverse().map(function(p){return decorate(db,p);}).filter(Boolean);
    var hashtags=Object.entries(db.rzV2.hashtags).filter(function(x){return x[0].includes(q);}).slice(0,20).map(function(x){return {tag:x[0],count:x[1]};});
    ctx.sendJSON(res,200,{success:true,users:users,posts:found,hashtags:hashtags});return true;
  }

  var hash=path.match(/^\/api\/v2\/hashtags\/([^/]+)$/);
  if(method==="GET"&&hash){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var tag=decodeURIComponent(hash[1]).replace(/^#/,"").toLowerCase();
    var hp=db.rzV2.posts.filter(function(p){return (p.hashtags||[]).includes(tag);}).slice(-50).reverse().map(function(p){return decorate(db,p);}).filter(Boolean);
    ctx.sendJSON(res,200,{success:true,tag:tag,count:Number(db.rzV2.hashtags[tag]||hp.length),posts:hp});return true;
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
  if (await handleRizoraGrowth(ctx)) return true;
  if (await handleRizoraPlatform(ctx)) return true;
  if (await handleRizoraModern(ctx)) return true;
  if (await handleRizoraUpgrades(ctx)) return true;
  return false;
}
module.exports={handleRizoraV2};
