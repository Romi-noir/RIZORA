"use strict";
function ensureCommentControls(db){db.rzV2=db.rzV2||{};db.rzV2.commentControls=db.rzV2.commentControls||{};}
function readBody(req){let raw="";return (async function(){for await(const chunk of req){raw+=chunk.toString();if(raw.length>500000)throw new Error("Request body too large.");}return raw?JSON.parse(raw):{};})();}
function controlsFor(db,userId){ensureCommentControls(db);if(!db.rzV2.commentControls[userId])db.rzV2.commentControls[userId]={blockedWords:[],guidelines:"",autoHideLinks:false};const c=db.rzV2.commentControls[userId];if(!Array.isArray(c.blockedWords))c.blockedWords=[];if(typeof c.guidelines!=="string")c.guidelines="";if(typeof c.autoHideLinks!=="boolean")c.autoHideLinks=false;return c;}
function normalizeWords(value,ctx){const raw=Array.isArray(value)?value:String(value||"").split(",");const seen=new Set();return raw.map(function(word){return ctx.cleanString(String(word||"").toLowerCase(),40).trim();}).filter(function(word){if(!word||seen.has(word))return false;seen.add(word);return true;}).slice(0,40);}
function containsWord(text,word){const value=String(text||"").toLowerCase(),q=String(word||"").trim().toLowerCase();if(!q)return false;if(q.indexOf(" ")>=0)return value.indexOf(q)>=0;const escaped=q.replace(/[.*+?^=!:()|[\]\\]/g,"\\$&");return new RegExp("(^|[^a-z0-9_])"+escaped+"([^a-z0-9_]|$)","i").test(value);}
function commentBlockedByControl(control,text){for(const word of control.blockedWords||[])if(containsWord(text,word))return{blocked:true,reason:"keyword_filter"};if(control.autoHideLinks&&/https?:\/\/|www\./i.test(String(text||"")))return{blocked:true,reason:"link_filter"};return{blocked:false,reason:""};}
function publicUser(db,user){if(!user)return null;const p=(db.creatorProfiles&&db.creatorProfiles[user.id])||{};return{id:user.id,username:user.username,publicUsername:user.publicUsername||user.username,displayName:user.displayName||user.username,avatarUrl:p.avatarUrl||user.avatarUrl||"/rizora-cover.png",verified:user.verified===true||user.verificationStatus==="verified",official:user.official===true};}
function commentRow(db,comment,post){const author=(db.users||[]).find(function(u){return u.id===comment.userId;}),owner=(db.users||[]).find(function(u){return u.id===post.userId;});if(!author||!owner)return null;return{id:comment.id,postId:post.id,postText:String(post.text||"").slice(0,160),postOwner:publicUser(db,owner),author:publicUser(db,author),text:comment.text||"",parentId:comment.parentId||null,hidden:comment.hidden===true,moderationReason:comment.moderationReason||"",hearted:comment.hearted===true,createdAt:comment.createdAt};}
async function handleRizoraComments(ctx){
  const db=ctx.db,req=ctx.req,res=ctx.res,user=ctx.getCurrentUser(db,req),url=new URL(req.url,"http://rizora.local"),path=url.pathname,method=String(req.method||"GET").toUpperCase();
  ensureCommentControls(db);
  if(path==="/api/v2/comment-controls"&&method==="GET"){if(!user){ctx.sendError(res,401,"Authentication required.");return true;}ctx.sendJSON(res,200,{success:true,controls:controlsFor(db,user.id)});return true;}
  if(path==="/api/v2/comment-controls"&&method==="PATCH"){if(!user){ctx.sendError(res,401,"Authentication required.");return true;}let body;try{body=await readBody(req);}catch(e){ctx.sendError(res,400,e.message);return true;}const current=controlsFor(db,user.id);if(body.blockedWords!==undefined)current.blockedWords=normalizeWords(body.blockedWords,ctx);if(body.guidelines!==undefined)current.guidelines=ctx.cleanString(body.guidelines,600);if(body.autoHideLinks!==undefined)current.autoHideLinks=Boolean(body.autoHideLinks);current.updatedAt=new Date().toISOString();ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,controls:current});return true;}
  if(path==="/api/v2/comment-moderation"&&method==="GET"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}const q=ctx.cleanString(url.searchParams.get("q")||"",120).toLowerCase(),status=ctx.cleanString(url.searchParams.get("status")||"all",20).toLowerCase();
    const ownPosts=new Set((db.rzV2.posts||[]).filter(function(p){return p.userId===user.id;}).map(function(p){return p.id;}));
    let comments=(db.rzV2.comments||[]).filter(function(c){return ownPosts.has(c.postId);});
    if(status==="hidden")comments=comments.filter(function(c){return c.hidden===true;});
    if(status==="visible")comments=comments.filter(function(c){return c.hidden!==true;});
    if(status==="hearted")comments=comments.filter(function(c){return c.hearted===true;});
    if(q)comments=comments.filter(function(c){const author=(db.users||[]).find(function(u){return u.id===c.userId;});return String(c.text||"").toLowerCase().includes(q)||String(author&&(author.username||author.displayName)||"").toLowerCase().includes(q);});
    comments=comments.slice().sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);}).slice(0,200);
    const rows=comments.map(function(c){const post=(db.rzV2.posts||[]).find(function(p){return p.id===c.postId;});return post?commentRow(db,c,post):null;}).filter(Boolean);
    ctx.sendJSON(res,200,{success:true,comments:rows});return true;
  }
  const actionMatch=path.match(/^\/api\/v2\/comment-moderation\/([^/]+)$/);
  if(actionMatch&&method==="POST"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}let body;try{body=await readBody(req);}catch(e){ctx.sendError(res,400,e.message);return true;}
    const comment=(db.rzV2.comments||[]).find(function(c){return c.id===actionMatch[1];});if(!comment){ctx.sendError(res,404,"Comment not found.");return true;}
    const post=(db.rzV2.posts||[]).find(function(p){return p.id===comment.postId;});if(!post||post.userId!==user.id){ctx.sendError(res,403,"Only the post owner can moderate this comment.");return true;}
    const action=ctx.cleanString(body.action,20).toLowerCase();
    if(action==="hide"){comment.hidden=true;comment.moderationReason="creator_review";}
    else if(action==="unhide"||action==="approve"){comment.hidden=false;comment.moderationReason="";}
    else if(action==="heart"){comment.hearted=!Boolean(comment.hearted);}
    else if(action==="delete"){
      const removed=new Set([comment.id]);let changed=true;while(changed){changed=false;(db.rzV2.comments||[]).forEach(function(row){if(row.parentId&&removed.has(row.parentId)&&!removed.has(row.id)){removed.add(row.id);changed=true;}});}
      db.rzV2.comments=(db.rzV2.comments||[]).filter(function(row){return !removed.has(row.id);});ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,deleted:removed.size});return true;
    }else{ctx.sendError(res,400,"Unsupported moderation action.");return true;}
    comment.moderatedAt=new Date().toISOString();comment.moderatedBy=user.id;ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,comment:commentRow(db,comment,post)});return true;
  }
  return false;
}
module.exports={handleRizoraComments,ensureCommentControls,controlsFor,commentBlockedByControl};