"use strict";

function ensureEvents(db) {
  db.rzV2 = db.rzV2 || {};
  db.rzV2.events = db.rzV2.events || [];
  db.rzV2.eventRsvps = db.rzV2.eventRsvps || [];
}

function readBody(req) {
  return new Promise(function(resolve,reject){
    let raw="";
    req.on("data",function(chunk){raw+=chunk.toString();if(raw.length>500000)reject(new Error("Request body too large."));});
    req.on("end",function(){if(!raw)return resolve({});try{resolve(JSON.parse(raw));}catch(_){reject(new Error("Invalid JSON."));}});
    req.on("error",reject);
  });
}
function clean(ctx,v,max){return ctx.cleanString(v==null?"":v,max);}
function publicUser(db,id){
  const u=(db.users||[]).find(function(x){return x.id===id;});if(!u)return null;
  const p=(db.creatorProfiles&&db.creatorProfiles[u.id])||{};
  return {id:u.id,username:u.username,publicUsername:u.publicUsername||u.username,displayName:u.displayName||u.username,avatarUrl:p.avatarUrl||u.avatarUrl||"/rizora-cover.png",verified:u.verified===true||u.verificationStatus==="verified"};
}
function viewEvent(db,e,userId){
  const rsvps=db.rzV2.eventRsvps.filter(function(x){return x.eventId===e.id&&x.status==="going";});
  return Object.assign({},e,{creator:publicUser(db,e.creatorId),attendeeCount:rsvps.length,going:!!userId&&rsvps.some(function(x){return x.userId===userId;})});
}
async function handleRizoraEvents(ctx){
  const db=ctx.db,req=ctx.req,res=ctx.res,user=ctx.getCurrentUser(db,req),url=new URL(req.url,"http://rizora.local"),path=url.pathname,method=String(req.method||"GET").toUpperCase();
  ensureEvents(db);

  if(path==="/api/v2/events"&&method==="GET"){
    const creator=clean(ctx,url.searchParams.get("creator"),120).replace(/^@/,"").toLowerCase(),status=clean(ctx,url.searchParams.get("status"),30);
    let rows=db.rzV2.events.slice().filter(function(e){return !status||e.status===status;});
    if(creator){const owner=(db.users||[]).find(function(u){return String(u.username||"").toLowerCase()===creator||String(u.publicUsername||"").toLowerCase()===creator;});rows=owner?rows.filter(function(e){return e.creatorId===owner.id;}):[];}
    rows.sort(function(a,b){return new Date(a.startsAt)-new Date(b.startsAt);});
    ctx.sendJSON(res,200,{success:true,events:rows.slice(0,100).map(function(e){return viewEvent(db,e,user&&user.id);})});return true;
  }
  if(path==="/api/v2/events"&&method==="POST"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    if(user.status!=="active"||user.postingRestricted===true){ctx.sendError(res,403,"Your account cannot create events right now.");return true;}
    let b;try{b=await readBody(req);}catch(e){ctx.sendError(res,400,e.message);return true;}
    const title=clean(ctx,b.title,120),description=clean(ctx,b.description,1000),startsAt=clean(ctx,b.startsAt,60),duration=Number(b.durationMinutes||60),streamUrl=clean(ctx,b.streamUrl,1200),visibility=clean(ctx,b.visibility,20)||"public";
    const startMs=Date.parse(startsAt);
    if(!title||!Number.isFinite(startMs)){ctx.sendError(res,400,"Event title and valid start time are required.");return true;}
    if(startMs<Date.now()-60000){ctx.sendError(res,400,"Event start time must be in the future.");return true;}
    if(duration<10||duration>1440){ctx.sendError(res,400,"Event duration must be between 10 and 1,440 minutes.");return true;}
    if(streamUrl){try{const u=new URL(streamUrl);if(!["http:","https:"].includes(u.protocol))throw new Error();}catch(_){ctx.sendError(res,400,"Stream link must be a valid HTTP(S) URL.");return true;}}
    if(!["public","followers"].includes(visibility)){ctx.sendError(res,400,"Unsupported event visibility.");return true;}
    const ev={id:ctx.uid("event_"),creatorId:user.id,title,description,startsAt:new Date(startMs).toISOString(),durationMinutes:Math.round(duration),streamUrl,visibility,status:"scheduled",createdAt:new Date().toISOString()};
    db.rzV2.events.push(ev);if(db.rzV2.events.length>5000)db.rzV2.events=db.rzV2.events.slice(-5000);ctx.saveDB(db);ctx.sendJSON(res,201,{success:true,event:viewEvent(db,ev,user.id)});return true;
  }

  const one=path.match(/^\/api\/v2\/events\/([^/]+)$/);
  if(one&&method==="GET"){
    const ev=db.rzV2.events.find(function(e){return e.id===one[1];});if(!ev){ctx.sendError(res,404,"Event not found.");return true;}
    ctx.sendJSON(res,200,{success:true,event:viewEvent(db,ev,user&&user.id)});return true;
  }
  const rsvp=path.match(/^\/api\/v2\/events\/([^/]+)\/rsvp$/);
  if(rsvp&&method==="POST"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    const ev=db.rzV2.events.find(function(e){return e.id===rsvp[1];});if(!ev){ctx.sendError(res,404,"Event not found.");return true;}
    if(new Date(ev.startsAt).getTime()<Date.now()-ev.durationMinutes*60000){ctx.sendError(res,409,"This event has ended.");return true;}
    const existing=db.rzV2.eventRsvps.find(function(x){return x.eventId===ev.id&&x.userId===user.id;});
    if(existing){existing.status=existing.status==="going"?"cancelled":"going";existing.updatedAt=new Date().toISOString();}
    else db.rzV2.eventRsvps.push({id:ctx.uid("rsvp_"),eventId:ev.id,userId:user.id,status:"going",createdAt:new Date().toISOString()});
    if(existing&&existing.status==="going"&&ev.creatorId!==user.id)db.notifications=db.notifications||[],db.notifications.push({id:ctx.uid("notif_"),userId:ev.creatorId,title:"New event RSVP",message:"@"+user.username+" is going to your RIZORA event.","type":"event",read:false,createdAt:new Date().toISOString()});
    ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,event:viewEvent(db,ev,user.id)});return true;
  }
  const cancel=path.match(/^\/api\/v2\/events\/([^/]+)\/cancel$/);
  if(cancel&&method==="POST"){
    if(!user){ctx.sendError(res,401,"Authentication required.");return true;}
    const ev=db.rzV2.events.find(function(e){return e.id===cancel[1];});if(!ev){ctx.sendError(res,404,"Event not found.");return true;}
    if(ev.creatorId!==user.id){ctx.sendError(res,403,"Only the event creator can cancel it.");return true;}
    ev.status="cancelled";ev.updatedAt=new Date().toISOString();
    db.rzV2.eventRsvps.filter(function(x){return x.eventId===ev.id&&x.status==="going";}).forEach(function(x){if(x.userId!==user.id){db.notifications=db.notifications||[];db.notifications.push({id:ctx.uid("notif_"),userId:x.userId,title:"Event cancelled",message:"A RIZORA event you planned to attend was cancelled.","type":"event",read:false,createdAt:new Date().toISOString()});}});
    ctx.saveDB(db);ctx.sendJSON(res,200,{success:true,event:viewEvent(db,ev,user.id)});return true;
  }
  return false;
}
module.exports={handleRizoraEvents};
