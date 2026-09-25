"use strict";

function ensureGrowth(db) {
  db.rzV2 = db.rzV2 || {};
  db.rzV2.drafts = db.rzV2.drafts || [];
  db.rzV2.schedules = db.rzV2.schedules || [];
  db.rzV2.collaborationInvites = db.rzV2.collaborationInvites || [];
  db.rzV2.collaborations = db.rzV2.collaborations || [];
  db.rzV2.pollVotes = db.rzV2.pollVotes || [];
}

async function readBody(req) {
  var raw = "";
  for await (var chunk of req) {
    raw += chunk.toString();
    if (raw.length > 1100000) {
      throw new Error("Request body too large.");
    }
  }
  return raw ? JSON.parse(raw) : {};
}

function clean(ctx, value, max) {
  return ctx.cleanString(value, max);
}

function activeUser(user) {
  return !!user && user.status === "active" && user.postingRestricted !== true;
}

function publicUser(db, user) {
  if (!user) return null;
  var profile = (db.creatorProfiles && db.creatorProfiles[user.id]) || {};
  return {
    id: user.id,
    username: user.username,
    publicUsername: user.publicUsername || user.username,
    displayName: user.displayName || user.username,
    avatarUrl: profile.avatarUrl || user.avatarUrl || "/rizora-cover.png",
    bio: profile.bio || user.bio || "",
    category: profile.category || user.category || "",
    verified: user.verified === true || user.verificationStatus === "verified",
    official: user.official === true
  };
}

function findUser(db, key) {
  var raw = String(key || "").trim().replace(/^@/, "").toLowerCase();
  if (!raw) return null;
  return (db.users || []).find(function(user) {
    return String(user.id || "").toLowerCase() === raw ||
      String(user.username || "").toLowerCase() === raw ||
      String(user.publicUsername || "").toLowerCase() === raw;
  }) || null;
}

var EXPLICIT = [
  /\bporn(?:ography)?\b/i,/\bxxx\b/i,/\bnudes?\b/i,/\bsex\s*tape\b/i,
  /\bsex(?:ual)?\s*(?:work|service|services)\b/i,/\berotic\b/i,/\bnsfw\b/i,
  /\bonlyfans\b/i,/\bpornhub\b/i,/\bxvideos?\b/i,/\bxnxx\b/i,
  /\bblowjob\b/i,/\bescort\b/i
];

function blocked(values) {
  var list = Array.isArray(values) ? values : [values];
  return list.some(function(value) {
    var text = String(value || "").normalize("NFKC").toLowerCase();
    return EXPLICIT.some(function(pattern) { return pattern.test(text); });
  });
}

function tags(text) {
  var found = {};
  String(text || "").split(/\s+/).forEach(function(part) {
    if (/^#[a-zA-Z0-9_]{1,50}$/.test(part)) found[part.slice(1).toLowerCase()] = true;
  });
  return Object.keys(found).slice(0, 20);
}

function makePost(db, ctx, user, data) {
  var text = clean(ctx, data.text || data.caption, 4000);
  var mediaUrl = clean(ctx, data.mediaUrl, 1200);
  if (!text && !mediaUrl && !data.poll) throw new Error("Add text or media before publishing.");
  if (blocked([text, mediaUrl])) throw new Error("Adult or sexually explicit content is not allowed on RIZORA.");
  var hashtags = tags(text);
  var post = {
    id: ctx.uid("post_"),
    userId: user.id,
    text: text,
    mediaUrl: mediaUrl,
    aiAssisted: data.aiAssisted === true,
    hashtags: hashtags,
    mentions: [],
    collaboratorIds: Array.isArray(data.collaboratorIds) ? data.collaboratorIds.slice(0, 5) : [],
    poll: data.poll || null,
    createdAt: new Date().toISOString()
  };
  db.rzV2.posts.push(post);
  db.rzV2.hashtags = db.rzV2.hashtags || {};
  hashtags.forEach(function(tag) { db.rzV2.hashtags[tag] = Number(db.rzV2.hashtags[tag] || 0) + 1; });
  return post;
}

function postMetrics(db, post) {
  var likes = (db.rzV2.likes || []).filter(function(x) { return x.postId === post.id; }).length;
  var comments = (db.rzV2.comments || []).filter(function(x) { return x.postId === post.id; }).length;
  var saves = (db.rzV2.saves || []).filter(function(x) { return x.postId === post.id; }).length;
  var reposts = (db.rzV2.reposts || []).filter(function(x) { return x.postId === post.id; }).length;
  var pollVotes = (db.rzV2.pollVotes || []).filter(function(x) { return x.postId === post.id; }).length;
  return {likes:likes,comments:comments,saves:saves,reposts:reposts,pollVotes:pollVotes};
}

function decoratePost(db, post) {
  var author = (db.users || []).find(function(x) { return x.id === post.userId; });
  if (!author) return null;
  var collaborators = (post.collaboratorIds || []).map(function(id) {
    return (db.users || []).find(function(x) { return x.id === id; });
  }).filter(Boolean).map(function(user) { return publicUser(db, user); });
  var poll = post.poll ? {
    question: post.poll.question,
    expiresAt: post.poll.expiresAt || null,
    options: (post.poll.options || []).map(function(option) {
      var count = (db.rzV2.pollVotes || []).filter(function(v) { return v.postId === post.id && v.optionId === option.id; }).length;
      return {id:option.id,label:option.label,votes:count};
    })
  } : null;
  return {
    id:post.id,userId:post.userId,text:post.text,mediaUrl:post.mediaUrl,aiAssisted:post.aiAssisted===true,
    hashtags:post.hashtags||[],mentions:post.mentions||[],createdAt:post.createdAt,
    author:publicUser(db,author),collaborators:collaborators,poll:poll,metrics:postMetrics(db,post)
  };
}

function publishDueSchedules(db, ctx) {
  var changed = false, current = Date.now();
  (db.rzV2.schedules || []).forEach(function(schedule) {
    if (schedule.status !== "scheduled") return;
    var due = new Date(schedule.scheduledFor).getTime();
    if (!Number.isFinite(due) || due > current) return;
    var owner = (db.users || []).find(function(u) { return u.id === schedule.userId; });
    if (!owner || !activeUser(owner)) {
      schedule.status="cancelled";schedule.updatedAt=new Date().toISOString();changed=true;return;
    }
    try {
      var post=makePost(db,ctx,owner,schedule.content||{});
      schedule.status="published";schedule.publishedPostId=post.id;schedule.publishedAt=new Date().toISOString();schedule.updatedAt=new Date().toISOString();changed=true;
    } catch(error) {
      schedule.status="failed";schedule.error=error.message;schedule.updatedAt=new Date().toISOString();changed=true;
    }
  });
  if (changed) ctx.saveDB(db);
}

function csvCell(value) {
  return '"' + String(value == null ? "" : value).replace(/"/g,'""') + '"';
}

async function handleRizoraGrowth(ctx) {
  var db=ctx.db,req=ctx.req,res=ctx.res,user=ctx.getCurrentUser(db,req);
  var url=new URL(req.url,"http://rizora.local"),path=url.pathname,method=String(req.method||"GET").toUpperCase();
  ensureGrowth(db);publishDueSchedules(db,ctx);

  if(path==="/api/v2/drafts"&&method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var drafts=db.rzV2.drafts.filter(function(d){return d.userId===user.id;}).slice().sort(function(a,b){return new Date(b.updatedAt)-new Date(a.updatedAt);}).slice(0,100);
    ctx.sendJSON(res,200,{success:true,drafts:drafts});return true;
  }
  if(path==="/api/v2/drafts"&&method==="POST"){
    if(!user||!activeUser(user)){ctx.sendError(res,403,"Your account cannot save creator content right now.");return true;}
    var b=await readBody(req),title=clean(ctx,b.title,160),text=clean(ctx,b.text||b.caption,4000),mediaUrl=clean(ctx,b.mediaUrl,1200);
    if(blocked([title,text,mediaUrl])){ctx.sendError(res,422,"That draft content is not allowed.");return true;}
    var draft={id:ctx.uid("draft_"),userId:user.id,title:title||"Untitled draft",text:text,mediaUrl:mediaUrl,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    db.rzV2.drafts.push(draft);ctx.saveDB(db);ctx.sendJSON(res,201,{success:true,draft:draft});return true;
  }
  var draftMatch=path.match(/^\/api\/v2\/drafts\/([^/]+)$/);
  if(draftMatch&&(method==="PATCH"||method==="DELETE")){
    if(!user||!activeUser(user)){ctx.sendError(res,403,"Your account cannot edit creator content right now.");return true;}
    var draft=db.rzV2.drafts.find(function(d){return d.id===draftMatch[1]&&d.userId===user.id;});
    if(!draft){ctx.sendError(res,404,"Draft not found.");return true;}
    if(method==="DELETE"){db.rzV2.drafts.splice(db.rzV2.drafts.indexOf(draft),1);ctx.saveDB(db);ctx.sendJSON(res,200,{success:true});return true;}
    var dbb=await readBody(req);
    if(dbb.title!=null)draft.title=clean(ctx,dbb.title,160);
    if(dbb.text!=null)draft.text=clean(ctx,dbb.text,4000);
    if(dbb.mediaUrl!=null)draft.mediaUrl=clean(ctx,dbb.mediaUrl,1200);
    if(blocked([draft.title,draft.text,draft.mediaUrl])){ctx.sendError(res,422,"That draft content is not allowed.");return true;}
    draft.updatedAt=new Date().toISOString();ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,draft:draft});return true;
  }
  var draftPublish=path.match(/^\/api\/v2\/drafts\/([^/]+)\/publish$/);
  if(draftPublish&&method==="POST"){
    if(!user||!activeUser(user)){ctx.sendError(res,403,"Your account cannot publish creator content right now.");return true;}
    var draftToPublish=db.rzV2.drafts.find(function(d){return d.id===draftPublish[1]&&d.userId===user.id;});
    if(!draftToPublish){ctx.sendError(res,404,"Draft not found.");return true;}
    try{var published=makePost(db,ctx,user,draftToPublish);db.rzV2.drafts.splice(db.rzV2.drafts.indexOf(draftToPublish),1);ctx.saveDB(db);ctx.sendJSON(res,201,{success:true,post:decoratePost(db,published)});}
    catch(error){ctx.sendError(res,422,error.message);}
    return true;
  }

  if(path==="/api/v2/schedules"&&method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var schedules=db.rzV2.schedules.filter(function(s){return s.userId===user.id;}).slice().sort(function(a,b){return new Date(a.scheduledFor)-new Date(b.scheduledFor);}).slice(0,100);
    ctx.sendJSON(res,200,{success:true,schedules:schedules});return true;
  }
  if(path==="/api/v2/schedules"&&method==="POST"){
    if(!user||!activeUser(user)){ctx.sendError(res,403,"Your account cannot schedule creator content right now.");return true;}
    var sb=await readBody(req),scheduledFor=clean(ctx,sb.scheduledFor,80),when=new Date(scheduledFor);
    if(!Number.isFinite(when.getTime())){ctx.sendError(res,400,"Choose a valid publish time.");return true;}
    if(when.getTime()<=Date.now()+30000){ctx.sendError(res,400,"Choose a future publish time.");return true;}
    if(when.getTime()>Date.now()+90*24*60*60*1000){ctx.sendError(res,400,"Schedules can be up to 90 days ahead.");return true;}
    var content={text:clean(ctx,sb.text||sb.caption,4000),mediaUrl:clean(ctx,sb.mediaUrl,1200)};
    if(!content.text&&!content.mediaUrl){ctx.sendError(res,400,"Add text or media before scheduling.");return true;}
    if(blocked([content.text,content.mediaUrl])){ctx.sendError(res,422,"That scheduled content is not allowed.");return true;}
    var schedule={id:ctx.uid("schedule_"),userId:user.id,scheduledFor:new Date(when).toISOString(),status:"scheduled",content:content,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    db.rzV2.schedules.push(schedule);ctx.saveDB(db);ctx.sendJSON(res,201,{success:true,schedule:schedule});return true;
  }
  var schedulePublish=path.match(/^\/api\/v2\/schedules\/([^/]+)\/publish$/);
  if(schedulePublish&&method==="POST"){
    if(!user||!activeUser(user)){ctx.sendError(res,403,"Your account cannot publish creator content right now.");return true;}
    var scheduleToPublish=db.rzV2.schedules.find(function(s){return s.id===schedulePublish[1]&&s.userId===user.id;});
    if(!scheduleToPublish){ctx.sendError(res,404,"Schedule not found.");return true;}
    if(scheduleToPublish.status!=="scheduled"){ctx.sendError(res,409,"This schedule is no longer pending.");return true;}
    try{var manualPost=makePost(db,ctx,user,scheduleToPublish.content||{});scheduleToPublish.status="published";scheduleToPublish.publishedPostId=manualPost.id;scheduleToPublish.publishedAt=new Date().toISOString();scheduleToPublish.updatedAt=new Date().toISOString();ctx.saveDB(db);ctx.sendJSON(res,201,{success:true,post:decoratePost(db,manualPost),schedule:scheduleToPublish});}
    catch(error){ctx.sendError(res,422,error.message);}
    return true;
  }

  if(path==="/api/v2/polls"&&method==="POST"){
    if(!user||!activeUser(user)){ctx.sendError(res,403,"Your account cannot publish polls right now.");return true;}
    var pollBody=await readBody(req),question=clean(ctx,pollBody.question,240),optionsInput=Array.isArray(pollBody.options)?pollBody.options:[];
    var options=optionsInput.map(function(label,index){return{id:"option_"+(index+1),label:clean(ctx,label,120)};}).filter(function(option){return option.label;}).slice(0,4);
    if(!question||options.length<2){ctx.sendError(res,400,"A poll needs a question and at least two options.");return true;}
    if(blocked([question].concat(options.map(function(o){return o.label;})))){ctx.sendError(res,422,"That poll content is not allowed.");return true;}
    var pollPost=makePost(db,ctx,user,{text:clean(ctx,pollBody.text||"",4000),mediaUrl:clean(ctx,pollBody.mediaUrl||"",1200),poll:{question:question,options:options,expiresAt:pollBody.expiresAt?new Date(pollBody.expiresAt).toISOString():null}});
    ctx.saveDB(db);ctx.sendJSON(res,201,{success:true,post:decoratePost(db,pollPost)});return true;
  }
  var pollVote=path.match(/^\/api\/v2\/polls\/([^/]+)\/vote$/);
  if(pollVote&&method==="POST"){
    if(!user||!activeUser(user)){ctx.sendError(res,403,"Your account cannot vote right now.");return true;}
    var targetPost=db.rzV2.posts.find(function(p){return p.id===pollVote[1]&&p.poll;});
    if(!targetPost){ctx.sendError(res,404,"Poll not found.");return true;}
    if(targetPost.poll.expiresAt&&new Date(targetPost.poll.expiresAt).getTime()<=Date.now()){ctx.sendError(res,409,"This poll has ended.");return true;}
    var voteBody=await readBody(req),optionId=clean(ctx,voteBody.optionId,80);
    if(!targetPost.poll.options.some(function(option){return option.id===optionId;})){ctx.sendError(res,400,"That poll option is invalid.");return true;}
    var existingVote=db.rzV2.pollVotes.find(function(v){return v.postId===targetPost.id&&v.userId===user.id;});
    if(existingVote){existingVote.optionId=optionId;existingVote.updatedAt=new Date().toISOString();}else{db.rzV2.pollVotes.push({id:ctx.uid("vote_"),postId:targetPost.id,userId:user.id,optionId:optionId,createdAt:new Date().toISOString()});}
    ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,post:decoratePost(db,targetPost)});return true;
  }

  if(path==="/api/v2/discover"&&method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var allPosts=(db.rzV2.posts||[]).slice(),now=Date.now();
    function postScore(post){var m=postMetrics(db,post),ageHours=Math.max(.5,(now-new Date(post.createdAt).getTime())/3600000);return (m.likes+m.comments*2+m.saves*2+m.reposts*3+m.pollVotes)/Math.pow(ageHours+2,.65);}
    var trendingPosts=allPosts.sort(function(a,b){return postScore(b)-postScore(a);}).slice(0,12).map(function(p){return decoratePost(db,p);}).filter(Boolean);
    var hashtagCounts={};
    allPosts.slice(-500).forEach(function(post){(post.hashtags||[]).forEach(function(tag){hashtagCounts[tag]=Number(hashtagCounts[tag]||0)+1;});});
    var trendingHashtags=Object.keys(hashtagCounts).sort(function(a,b){return hashtagCounts[b]-hashtagCounts[a];}).slice(0,15).map(function(tag){return{tag:tag,posts:hashtagCounts[tag]};});
    var creatorMap={};
    (db.users||[]).forEach(function(target){
      if(target.id===user.id||target.status!=="active")return;
      var followers=(db.rzV2.follows||[]).filter(function(f){return f.followingId===target.id;}).length;
      var targetPosts=allPosts.filter(function(p){return p.userId===target.id;}).length;
      if(!followers&&!targetPosts)return;
      var verified=target.verified===true||target.verificationStatus==="verified";
      var followed=(db.rzV2.follows||[]).some(function(f){return f.followerId===user.id&&f.followingId===target.id;});
      creatorMap[target.id]={user:publicUser(db,target),followers:followers,posts:targetPosts,followed:followed,score:followers*2+targetPosts+(verified?50:0)};
    });
    var creators=Object.keys(creatorMap).map(function(key){return creatorMap[key];}).sort(function(a,b){return b.score-a.score;}).slice(0,12);
    ctx.sendJSON(res,200,{success:true,trendingHashtags:trendingHashtags,creators:creators,posts:trendingPosts});return true;
  }

  var collabInvite=path.match(/^\/api\/v2\/posts\/([^/]+)\/collaborators\/invite$/);
  if(collabInvite&&method==="POST"){
    if(!user||!activeUser(user)){ctx.sendError(res,403,"Your account cannot manage collaborations right now.");return true;}
    var collabPost=db.rzV2.posts.find(function(p){return p.id===collabInvite[1]&&p.userId===user.id;});
    if(!collabPost){ctx.sendError(res,404,"Post not found or not owned by you.");return true;}
    var inviteBody=await readBody(req),invitee=findUser(db,inviteBody.username||inviteBody.userId);
    if(!invitee){ctx.sendError(res,404,"Creator not found.");return true;}
    if(invitee.id===user.id){ctx.sendError(res,400,"You cannot invite yourself.");return true;}
    if((collabPost.collaboratorIds||[]).includes(invitee.id)){ctx.sendError(res,409,"That creator is already a collaborator.");return true;}
    if(db.rzV2.collaborationInvites.some(function(i){return i.postId===collabPost.id&&i.inviteeId===invitee.id&&i.status==="pending";})){ctx.sendError(res,409,"An invite is already pending.");return true;}
    var invite={id:ctx.uid("collab_"),postId:collabPost.id,inviterId:user.id,inviteeId:invitee.id,status:"pending",createdAt:new Date().toISOString()};
    db.rzV2.collaborationInvites.push(invite);db.notifications=db.notifications||[];db.notifications.push({id:ctx.uid("notif_"),userId:invitee.id,title:"Collaboration invite",message:"@"+user.username+" invited you to collaborate on a post.",type:"collaboration",read:false,createdAt:new Date().toISOString()});ctx.saveDB(db);ctx.sendJSON(res,201,{success:true,invite:invite});return true;
  }

  if(path==="/api/v2/collaborations/inbox"&&method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var inbox=db.rzV2.collaborationInvites.filter(function(i){return i.inviteeId===user.id;}).slice().reverse().slice(0,100).map(function(invite){
      var post=db.rzV2.posts.find(function(p){return p.id===invite.postId;}),inviter=(db.users||[]).find(function(u){return u.id===invite.inviterId;});
      return{id:invite.id,status:invite.status,createdAt:invite.createdAt,post:post?decoratePost(db,post):null,inviter:publicUser(db,inviter)};
    });
    ctx.sendJSON(res,200,{success:true,invites:inbox});return true;
  }

  if(path==="/api/v2/collaborations"&&method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var collaborations=db.rzV2.collaborations.filter(function(c){return c.ownerId===user.id||(c.collaboratorIds||[]).indexOf(user.id)>=0;}).slice().reverse().slice(0,100).map(function(c){
      var post=db.rzV2.posts.find(function(p){return p.id===c.postId;});
      return{collaboration:c,post:post?decoratePost(db,post):null};
    });
    ctx.sendJSON(res,200,{success:true,collaborations:collaborations});return true;
  }

  var collabRespond=path.match(/^\/api\/v2\/collaborations\/([^/]+)\/respond$/);
  if(collabRespond&&method==="POST"){
    if(!user||!activeUser(user)){ctx.sendError(res,403,"Your account cannot respond to collaborations right now.");return true;}
    var responseBody=await readBody(req),inviteRecord=db.rzV2.collaborationInvites.find(function(i){return i.id===collabRespond[1]&&i.inviteeId===user.id;});
    if(!inviteRecord){ctx.sendError(res,404,"Collaboration invite not found.");return true;}
    if(inviteRecord.status!=="pending"){ctx.sendError(res,409,"This invitation is already resolved.");return true;}
    var action=String(responseBody.action||"").toLowerCase(),invitePost=db.rzV2.posts.find(function(p){return p.id===inviteRecord.postId;});
    if(!invitePost){ctx.sendError(res,404,"The invited post no longer exists.");return true;}
    if(action==="accept"){
      inviteRecord.status="accepted";inviteRecord.respondedAt=new Date().toISOString();invitePost.collaboratorIds=invitePost.collaboratorIds||[];if(!invitePost.collaboratorIds.includes(user.id))invitePost.collaboratorIds.push(user.id);
      db.rzV2.collaborations.push({id:ctx.uid("collab_"),postId:invitePost.id,ownerId:inviteRecord.inviterId,collaboratorIds:invitePost.collaboratorIds.slice(),createdAt:new Date().toISOString()});
      db.notifications=db.notifications||[];db.notifications.push({id:ctx.uid("notif_"),userId:inviteRecord.inviterId,title:"Collaboration accepted",message:"@"+user.username+" accepted your RIZORA collaboration invite.",type:"collaboration",read:false,createdAt:new Date().toISOString()});
    }else if(action==="decline"){inviteRecord.status="declined";inviteRecord.respondedAt=new Date().toISOString();}else{ctx.sendError(res,400,"Use accept or decline.");return true;}
    ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,invite:inviteRecord});return true;
  }

  if(path==="/api/v2/messages/share"&&method==="POST"){
    if(!user||!activeUser(user)){ctx.sendError(res,403,"Your account cannot share messages right now.");return true;}
    var shareBody=await readBody(req),recipient=findUser(db,shareBody.recipientUsername||shareBody.recipientUserId),sharedPost=db.rzV2.posts.find(function(p){return p.id===clean(ctx,shareBody.postId,100);});
    if(!recipient){ctx.sendError(res,404,"Recipient not found.");return true;}
    if(!sharedPost){ctx.sendError(res,404,"Post not found.");return true;}
    var optionalText=clean(ctx,shareBody.text,500);if(blocked(optionalText)){ctx.sendError(res,422,"That message is not allowed.");return true;}
    var msg={id:ctx.uid("msg_"),fromUserId:user.id,toUserId:recipient.id,text:optionalText||"Shared a RIZORA post with you.",sharedPostId:sharedPost.id,read:false,createdAt:new Date().toISOString()};
    db.rzV2.messages.push(msg);db.notifications=db.notifications||[];db.notifications.push({id:ctx.uid("notif_"),userId:recipient.id,title:"A creator shared a post with you",message:"@"+user.username+" shared a RIZORA post in messages.",type:"message",read:false,createdAt:new Date().toISOString()});ctx.saveDB(db);ctx.sendJSON(res,201,{success:true,message:msg});return true;
  }

  if(path==="/api/v2/analytics/content"&&method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var ownPosts=(db.rzV2.posts||[]).filter(function(p){return p.userId===user.id;}).map(function(post){
      var metrics=postMetrics(db,post);
      return{id:post.id,createdAt:post.createdAt,text:post.text,mediaUrl:post.mediaUrl,poll:!!post.poll,metrics:metrics,engagementScore:metrics.likes+metrics.comments*2+metrics.saves*2+metrics.reposts*3+metrics.pollVotes};
    }).sort(function(a,b){return b.engagementScore-a.engagementScore;}).slice(0,100);
    ctx.sendJSON(res,200,{success:true,posts:ownPosts});return true;
  }

  if(path==="/api/v2/analytics/export"&&method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    var exportPosts=(db.rzV2.posts||[]).filter(function(p){return p.userId===user.id;}),rows=[["post_id","created_at","text","likes","comments","saves","reposts","poll_votes"]];
    exportPosts.forEach(function(post){var metrics=postMetrics(db,post);rows.push([post.id,post.createdAt,post.text,metrics.likes,metrics.comments,metrics.saves,metrics.reposts,metrics.pollVotes]);});
    var csv=rows.map(function(row){return row.map(csvCell).join(",");}).join("\n");
    res.writeHead(200,{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":'attachment; filename="rizora-content-analytics.csv"',"Cache-Control":"no-store"});res.end(csv);return true;
  }

  return false;
}

module.exports = { handleRizoraGrowth, publishDueSchedules };
