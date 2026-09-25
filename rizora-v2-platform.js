"use strict";

function ensurePlatform(db) {
  db.rzV2 = db.rzV2 || {};
  db.rzV2.stories = db.rzV2.stories || [];
  db.rzV2.storyViews = db.rzV2.storyViews || [];
  db.rzV2.communities = db.rzV2.communities || [];
  db.rzV2.communityPosts = db.rzV2.communityPosts || [];
  db.rzV2.messages = db.rzV2.messages || [];
  db.rzV2.opportunities = db.rzV2.opportunities || [];
  db.rzV2.opportunityApplications = db.rzV2.opportunityApplications || [];
  if (!db.rzV2.seededOpportunities) {
    db.rzV2.opportunities.push(
      {id:"opp_creator_spotlight",title:"RIZORA Creator Spotlight",description:"Submit your strongest recent RIZORA post for a platform spotlight.",type:"platform",status:"open",createdAt:new Date().toISOString()},
      {id:"opp_profile_sprint",title:"Creator Profile Sprint",description:"Polish your PFP, bio, category and links for a stronger creator identity.",type:"growth",status:"open",createdAt:new Date().toISOString()},
      {id:"opp_community_host",title:"Community Host",description:"Propose a useful creator community and help keep it active.",type:"community",status:"open",createdAt:new Date().toISOString()}
    );
    db.rzV2.seededOpportunities = true;
  }
}
function explicitPlatformText(value) {
  var text=String(value||"").normalize("NFKC").toLowerCase();
  var patterns=[/\bporn(?:ography)?\b/i,/\bxxx\b/i,/\bnudes?\b/i,/\bsex\s*tape\b/i,/\bsex(?:ual)?\s*(?:work|service|services)\b/i,/\berotic\b/i,/\bnsfw\b/i,/\bonlyfans\b/i,/\bpornhub\b/i,/\bxvideos?\b/i,/\bxnxx\b/i,/\bblowjob\b/i,/\bescort\b/i];
  return patterns.some(function(pattern){return pattern.test(text);});
}
function activePlatformUser(user){return !!user&&user.status==="active"&&user.postingRestricted!==true;}
function currentProfile(db,user){
  var p=db.creatorProfiles[user.id]||{};
  return {id:user.id,username:user.username,displayName:user.displayName||user.username,publicUsername:user.publicUsername||user.username,avatarUrl:p.avatarUrl||user.avatarUrl||"",bio:p.bio||user.bio||"",verified:user.verified===true||user.verificationStatus==="verified"};
}
function notifyPlatform(db,userId,title,message){
  db.notifications=db.notifications||[];
  db.notifications.push({id:"notif_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),userId:userId,title:title,message:message,type:"platform",read:false,createdAt:new Date().toISOString()});
}
function cleanStories(db){
  var now=Date.now();
  db.rzV2.stories=db.rzV2.stories.filter(function(s){return new Date(s.expiresAt).getTime()>now;});
}
async function readBodyPlatform(req){
  var raw="";
  for await(var chunk of req){raw+=chunk.toString();if(raw.length>1100000)throw new Error("Request body too large.");}
  return raw?JSON.parse(raw):{};
}
async function handleRizoraPlatform(ctx){
  var db=ctx.db,res=ctx.res,req=ctx.req,user=ctx.getCurrentUser(db,req),path=new URL(req.url,"http://rizora.local").pathname,method=String(req.method||"GET").toUpperCase();
  ensurePlatform(db);cleanStories(db);

  if(path==="/api/v2/stories"&&method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var groups={};
    db.rzV2.stories.slice().sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);}).forEach(function(s){groups[s.userId]=groups[s.userId]||[];groups[s.userId].push(s);});
    var list=Object.keys(groups).map(function(id){var owner=db.users.find(function(u){return u.id===id;});return owner?{user:currentProfile(db,owner),stories:groups[id]}:null;}).filter(Boolean);
    ctx.sendJSON(res,200,{success:true,stories:list});return true;
  }

  if(path==="/api/v2/stories"&&method==="POST"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    if(!activePlatformUser(user)){ctx.sendError(res,403,"Your account cannot publish right now.");return true;}
    var sb=await readBodyPlatform(req),st=String(sb.text||"").trim().slice(0,1200),sm=String(sb.mediaUrl||"").trim().slice(0,1200);
    if(!st&&!sm){ctx.sendError(res,400,"Add text or media.");return true;}
    if(explicitPlatformText(st)||explicitPlatformText(sm)){ctx.sendError(res,422,"Adult or sexually explicit content is not allowed on RIZORA.");return true;}
    var story={id:"story_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),userId:user.id,text:st,mediaUrl:sm,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()};
    db.rzV2.stories.push(story);db.rzV2.stories=db.rzV2.stories.slice(-1000);ctx.saveDB(db);ctx.sendJSON(res,201,{success:true,story:story});return true;
  }

  var storyView=path.match(/^\/api\/v2\/stories\/([^/]+)\/view$/);
  if(storyView&&method==="POST"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var targetStory=db.rzV2.stories.find(function(s){return s.id===storyView[1];});
    if(!targetStory){ctx.sendError(res,404,"Story not found.");return true;}
    ctx.sendJSON(res,200,{success:true,viewed:true});return true;
  }

  if(path==="/api/v2/communities"&&method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    ctx.sendJSON(res,200,{success:true,communities:db.rzV2.communities.slice().reverse().map(function(c){return Object.assign({},c,{memberCount:c.members.length,joined:c.members.indexOf(user.id)>=0});}).slice(0,100)});return true;
  }

  if(path==="/api/v2/communities"&&method==="POST"){
    if(!user||!activePlatformUser(user)){ctx.sendError(res,403,"Your account cannot create a community right now.");return true;}
    var cb=await readBodyPlatform(req),cn=String(cb.name||"").trim().slice(0,80),cd=String(cb.description||"").trim().slice(0,500);
    if(!cn){ctx.sendError(res,400,"Community name is required.");return true;}
    if(explicitPlatformText(cn)||explicitPlatformText(cd)){ctx.sendError(res,422,"That community content is not allowed.");return true;}
    var community={id:"community_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),name:cn,description:cd,ownerId:user.id,members:[user.id],createdAt:new Date().toISOString()};
    db.rzV2.communities.push(community);ctx.saveDB(db);ctx.sendJSON(res,201,{success:true,community:community});return true;
  }

  var join=path.match(/^\/api\/v2\/communities\/([^/]+)\/join$/);
  if(join&&method==="POST"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var jc=db.rzV2.communities.find(function(c){return c.id===join[1];});if(!jc){ctx.sendError(res,404,"Community not found.");return true;}
    var ix=jc.members.indexOf(user.id);if(ix>=0)jc.members.splice(ix,1);else jc.members.push(user.id);
    ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,joined:jc.members.indexOf(user.id)>=0,memberCount:jc.members.length});return true;
  }

  var communityPost=path.match(/^\/api\/v2\/communities\/([^/]+)\/posts$/);
  if(communityPost&&method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var c1=db.rzV2.communities.find(function(c){return c.id===communityPost[1];});if(!c1){ctx.sendError(res,404,"Community not found.");return true;}
    ctx.sendJSON(res,200,{success:true,community:c1,posts:db.rzV2.communityPosts.filter(function(p){return p.communityId===c1.id;}).slice(-100).reverse()});return true;
  }
  if(communityPost&&method==="POST"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var c2=db.rzV2.communities.find(function(c){return c.id===communityPost[1];});if(!c2){ctx.sendError(res,404,"Community not found.");return true;}
    if(c2.members.indexOf(user.id)<0){ctx.sendError(res,403,"Join this community first.");return true;}
    var cp=await readBodyPlatform(req),ct=String(cp.text||"").trim().slice(0,1200);if(!ct){ctx.sendError(res,400,"Post text is required.");return true;}
    if(explicitPlatformText(ct)){ctx.sendError(res,422,"Adult or sexually explicit content is not allowed.");return true;}
    var communityPostObj={id:"cpost_"+Date.now().toString(36),communityId:c2.id,userId:user.id,text:ct,createdAt:new Date().toISOString()};
    db.rzV2.communityPosts.push(communityPostObj);ctx.saveDB(db);ctx.sendJSON(res,201,{success:true,post:communityPostObj});return true;
  }

  if(path==="/api/v2/messages"&&method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var map={};
    db.rzV2.messages.filter(function(m){return m.fromUserId===user.id||m.toUserId===user.id;}).forEach(function(m){
      var other=m.fromUserId===user.id?m.toUserId:m.fromUserId;
      if(!map[other]||new Date(m.createdAt)>new Date(map[other].lastAt))map[other]={otherUserId:other,lastText:m.text,lastAt:m.createdAt,unread:0};
      if(m.toUserId===user.id&&!m.read)map[other].unread++;
    });
    var conversations=Object.keys(map).map(function(id){var target=db.users.find(function(u){return u.id===id;});return target?Object.assign(map[id],{user:currentProfile(db,target)}):null;}).filter(Boolean).sort(function(a,b){return new Date(b.lastAt)-new Date(a.lastAt);});
    ctx.sendJSON(res,200,{success:true,conversations:conversations});return true;
  }

  var thread=path.match(/^\/api\/v2\/messages\/([^/]+)$/);
  if(thread&&method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var otherUser=db.users.find(function(u){return u.id===thread[1]||String(u.username||"").toLowerCase()===thread[1].toLowerCase();});
    if(!otherUser){ctx.sendError(res,404,"Creator not found.");return true;}
    db.rzV2.messages.forEach(function(m){if(m.fromUserId===otherUser.id&&m.toUserId===user.id)m.read=true;});ctx.saveDB(db);
    ctx.sendJSON(res,200,{success:true,user:currentProfile(db,otherUser),messages:db.rzV2.messages.filter(function(m){return (m.fromUserId===user.id&&m.toUserId===otherUser.id)||(m.fromUserId===otherUser.id&&m.toUserId===user.id);}).slice(-200)});return true;
  }
  if(thread&&method==="POST"){
    if(!user||!activePlatformUser(user)){ctx.sendError(res,403,"Your account cannot send messages right now.");return true;}
    var recipient=db.users.find(function(u){return u.id===thread[1]||String(u.username||"").toLowerCase()===thread[1].toLowerCase();});
    if(!recipient){ctx.sendError(res,404,"Creator not found.");return true;}
    var mb=await readBodyPlatform(req),mt=String(mb.text||"").trim().slice(0,2000);if(!mt){ctx.sendError(res,400,"Message required.");return true;}
    if(explicitPlatformText(mt)){ctx.sendError(res,422,"Adult or sexually explicit content is not allowed.");return true;}
    db.rzV2.messages.push({id:"msg_"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),fromUserId:user.id,toUserId:recipient.id,text:mt,read:false,createdAt:new Date().toISOString()});
    notifyPlatform(db,recipient.id,"New message","@"+user.username+" sent you a message.");ctx.saveDB(db);ctx.sendJSON(res,201,{success:true});return true;
  }

  if(path==="/api/v2/opportunities"&&method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var applied={};db.rzV2.opportunityApplications.filter(function(a){return a.userId===user.id;}).forEach(function(a){applied[a.opportunityId]=true;});
    ctx.sendJSON(res,200,{success:true,opportunities:db.rzV2.opportunities.filter(function(o){return o.status==="open";}).map(function(o){return Object.assign({},o,{applied:!!applied[o.id]});})});return true;
  }

  var apply=path.match(/^\/api\/v2\/opportunities\/([^/]+)\/apply$/);
  if(apply&&method==="POST"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var opp=db.rzV2.opportunities.find(function(o){return o.id===apply[1]&&o.status==="open";});if(!opp){ctx.sendError(res,404,"Opportunity not found.");return true;}
    if(db.rzV2.opportunityApplications.some(function(a){return a.opportunityId===opp.id&&a.userId===user.id;})){ctx.sendError(res,409,"You already applied.");return true;}
    var ab={};try{ab=await readBodyPlatform(req);}catch(e){}
    var note=String(ab.note||"").trim().slice(0,1200);if(explicitPlatformText(note)){ctx.sendError(res,422,"That application content is not allowed.");return true;}
    db.rzV2.opportunityApplications.push({id:"app_"+Date.now().toString(36),opportunityId:opp.id,userId:user.id,note:note,status:"submitted",createdAt:new Date().toISOString()});ctx.saveDB(db);ctx.sendJSON(res,201,{success:true,status:"submitted"});return true;
  }

  if(path==="/api/v2/analytics/overview"&&method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var own=db.rzV2.posts.filter(function(p){return p.userId===user.id;}),likes=0,comments=0,saves=0,reposts=0;
    own.forEach(function(p){likes+=db.rzV2.likes.filter(function(x){return x.postId===p.id;}).length;comments+=db.rzV2.comments.filter(function(x){return x.postId===p.id;}).length;saves+=db.rzV2.saves.filter(function(x){return x.postId===p.id;}).length;reposts+=db.rzV2.reposts.filter(function(x){return x.postId===p.id;}).length;});
    var warning=db.rzV2.policy.warnings[user.id]||{count:0};
    ctx.sendJSON(res,200,{success:true,posts:own.length,followers:db.rzV2.follows.filter(function(f){return f.followingId===user.id;}).length,following:db.rzV2.follows.filter(function(f){return f.followerId===user.id;}).length,likes:likes,comments:comments,saves:saves,reposts:reposts,stories:db.rzV2.stories.filter(function(s){return s.userId===user.id;}).length,points:Number(user.points||0),warningCount:Number(warning.count||0)});return true;
  }

  return false;
}
module.exports={handleRizoraPlatform};
