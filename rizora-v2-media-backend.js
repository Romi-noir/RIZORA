"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Readable } = require("stream");
const {
  createCloudinaryUploadIntent,
  verifyCloudinaryUpload,
  createPrivateUploadIntent,
  fetchPrivateObject,
  deletePrivateObject,
  deleteCloudinaryObject,
  integrationStatus
} = require("./rizora-integrations");

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const SIMPLE_UPLOAD_MAX = 600 * 1024;
const CHUNK_BYTES = 512 * 1024;
const MAX_DAILY_BYTES = 250 * 1024 * 1024;
const SESSION_TTL_MS = 30 * 60 * 1000;

const MIME_EXT = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/wav": "wav",
  "audio/ogg": "ogg",
  "audio/webm": "webm"
};

function ensureState(db){
  db.rzV2 = db.rzV2 || {};
  db.rzV2.media = db.rzV2.media || [];
  db.rzV2.mediaUploads = db.rzV2.mediaUploads || [];
  db.rzV2.mediaUsage = db.rzV2.mediaUsage || {};
}

function mediaRoot(){
  const configured = String(process.env.RIZORA_MEDIA_ROOT || "").trim();
  return path.resolve(configured || path.join(__dirname, "uploads", "rizora"));
}

function safeName(value){
  return String(value || "media")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 100) || "media";
}

function extFor(mime, filename){
  return MIME_EXT[mime] || path.extname(safeName(filename)).replace(/^\./, "").toLowerCase().slice(0, 8) || "bin";
}

function allowedMime(mime){
  return Object.prototype.hasOwnProperty.call(MIME_EXT, mime);
}

function decodePayload(data){
  const raw = String(data || "");
  const comma = raw.indexOf(",");
  const base64 = comma >= 0 ? raw.slice(comma + 1) : raw;
  if(!/^[A-Za-z0-9+/=\s]+$/.test(base64)) throw new Error("Invalid media encoding.");
  return Buffer.from(base64.replace(/\s+/g, ""), "base64");
}

function todayKey(){
  return new Date().toISOString().slice(0, 10);
}

function usageFor(db, userId){
  const key = todayKey();
  const row = db.rzV2.mediaUsage[userId];
  if(!row || row.date !== key){
    db.rzV2.mediaUsage[userId] = {date:key, bytes:0};
    return db.rzV2.mediaUsage[userId];
  }
  return row;
}

function canUse(db, userId, bytes){
  const row = usageFor(db, userId);
  return Number(row.bytes || 0) + Number(bytes || 0) <= MAX_DAILY_BYTES;
}

function addUsage(db, userId, bytes){
  usageFor(db, userId).bytes = Number(usageFor(db, userId).bytes || 0) + Number(bytes || 0);
}

function mediaUid(prefix){
  return String(prefix || "media_") + crypto.randomBytes(12).toString("hex");
}

function allowedMediaOrigin(origin){
  const allowedOrigins=new Set(["https://rizora.com.ng","https://www.rizora.com.ng","https://rizora.vercel.app","https://rizora-frontend-clean-drhvxsswx-royal-saents.vercel.app","http://localhost:3000","http://127.0.0.1:3000",...String(process.env.RIZORA_CORS_ORIGINS||"").split(",").map(function(value){return value.trim();}).filter(Boolean)]);
  return allowedOrigins.has(origin);
}

async function serveRemoteMedia(req,res,record,publicAccess,sendError,url){
  let remote;
  try{
    if(record.provider==="supabase") remote=await fetchPrivateObject(record.objectPath,req.headers.range||"");
    else if(record.provider==="cloudinary") remote=await fetch(record.remoteUrl,{headers:req.headers.range?{Range:req.headers.range}:{},signal:AbortSignal.timeout(30000)});
    else return false;
  }catch(_){sendError(res,502,"Media is temporarily unavailable. Try again shortly.");return true;}
  if(!remote.ok && remote.status!==206){
    try{await remote.body?.cancel();}catch(_){}
    sendError(res,remote.status===404?404:502,remote.status===404?"Media not found.":"Media is temporarily unavailable. Try again shortly.");
    return true;
  }
  const origin=String(req.headers.origin||"");
  const headers={
    "Content-Type":record.mimeType,
    "Cache-Control":publicAccess?"public, max-age=3600":"private, max-age=60",
    "Access-Control-Expose-Headers":"Content-Length,Content-Type,Content-Disposition,Content-Range,Accept-Ranges",
    "Vary":"Origin"
  };
  const contentLength=remote.headers.get("content-length");
  const contentRange=remote.headers.get("content-range");
  const acceptRanges=remote.headers.get("accept-ranges");
  if(contentLength)headers["Content-Length"]=contentLength;
  if(contentRange)headers["Content-Range"]=contentRange;
  if(acceptRanges)headers["Accept-Ranges"]=acceptRanges;
  if(origin&&allowedMediaOrigin(origin)){
    headers["Access-Control-Allow-Origin"]=origin;
    headers["Access-Control-Allow-Credentials"]="true";
  }
  if(url.searchParams.get("download")==="1")headers["Content-Disposition"]="attachment; filename=\""+safeName(record.filename)+"\"";
  res.writeHead(remote.status===206?206:200,headers);
  if(!remote.body){res.end();return true;}
  try{Readable.fromWeb(remote.body).on("error",function(){if(!res.destroyed)res.destroy();}).pipe(res);}
  catch(_){try{res.end(Buffer.from(await remote.arrayBuffer()));}catch(__){res.destroy();}}
  return true;
}

async function readBody(req){
  let raw = "";
  for await(const chunk of req){
    raw += chunk.toString();
    if(Buffer.byteLength(raw, "utf8") > 2 * 1024 * 1024) throw new Error("Request body too large.");
  }
  return raw ? JSON.parse(raw) : {};
}

function mediaIsAccessible(db, user, record){
  if(!user||!record)return false;
  if(record.ownerId===user.id)return true;
  if(user.role==="super_admin"&&(db.socialCompletions||[]).some(function(item){return item.status==="pending"&&item.proofMediaId===record.id&&item.userId===record.ownerId;}))return true;
  const url=String(record.url||"");
  const mediaKey=function(value){
    try{
      const parsed=new URL(String(value||""),"https://rizora.local");
      const match=parsed.pathname.match(/^\/api\/v2\/media\/([^/.]+)(?:\.[a-z0-9]+)?$/i);
      return match?decodeURIComponent(match[1]):"";
    }catch(_){return "";}
  };
  const sameMedia=function(value){return String(value||"")===url||mediaKey(value)===record.id;};
  const users=db.users||[];
  const activeUserId=function(id){const u=users.find(function(x){return x.id===id;});return !!u&&u.status==="active";};
  const messages=db.rzV2.messages||[];
  if(messages.some(function(m){
    if(!(sameMedia(m.mediaUrl)||String(m.mediaId||"")===record.id))return false;
    const from=m.fromUserId||m.fromUser||m.from||"",to=m.toUserId||m.toUser||m.to||"";
    if(from===user.id||to===user.id)return true;
    if(!m.groupId)return false;
    const group=(db.rzV2.conversations||[]).find(function(c){return c.id===m.groupId;});
    return !!group&&Array.isArray(group.members)&&group.members.includes(user.id);
  }))return true;
  const posts=db.rzV2.posts||[];
  if(posts.some(function(p){return sameMedia(p.mediaUrl)&&p.userId===record.ownerId&&p.deleted!==true&&(p.userId===user.id||p.visibility!=="private"&&activeUserId(p.userId));}))return true;
  const stories=db.rzV2.stories||[];
  if(stories.some(function(s){return sameMedia(s.mediaUrl)&&s.userId===record.ownerId&&activeUserId(s.userId)&&(!s.expiresAt||new Date(s.expiresAt).getTime()>Date.now());}))return true;
  const comments=db.rzV2.comments||[];
  if(comments.some(function(comment){
    if(!sameMedia(comment.mediaUrl)||comment.hidden===true)return false;
    const post=posts.find(function(p){return p.id===comment.postId;});
    return !!post&&comment.userId===record.ownerId&&post.deleted!==true&&(post.userId===user.id||post.visibility!=="private"&&activeUserId(post.userId));
  }))return true;
  if(users.some(function(target){
    const profile=(db.creatorProfiles&&db.creatorProfiles[target.id])||{};
    return target.id===record.ownerId&&activeUserId(target.id)&&(sameMedia(profile.avatarUrl)||sameMedia(target.avatarUrl));
  }))return true;
  const musicCatalog=db.musicCatalog||[];
  if(musicCatalog.some(function(item){
    if(item.visibility==="private")return false;
    return [item.artwork,item.audioUrl,item.videoUrl,item.visualUrl].filter(Boolean).some(sameMedia);
  }))return true;
  const series=(db.rzV2&&db.rzV2.series)||[];
  if(series.some(function(item){return sameMedia(item.coverUrl)&&activeUserId(item.creatorId);}))return true;
  return false;
}

function mediaIsPublic(db, record){
  if(!record)return false;
  const url=String(record.url||"");
  const mediaKey=function(value){
    try{
      const parsed=new URL(String(value||""),"https://rizora.local");
      const match=parsed.pathname.match(/^\/api\/v2\/media\/([^/.]+)(?:\.[a-z0-9]+)?$/i);
      return match?decodeURIComponent(match[1]):"";
    }catch(_){return "";}
  };
  const sameMedia=function(value){return String(value||"")===url||mediaKey(value)===record.id;};
  return (db.musicCatalog||[]).some(function(item){
    if(item.visibility === "private")return false;
    return [item.artwork,item.audioUrl,item.videoUrl,item.visualUrl].filter(Boolean).some(sameMedia);
  }) || (db.rzV2.posts||[]).some(function(post){
    const author=(db.users||[]).find(function(u){return u.id===post.userId;});
    return sameMedia(post.mediaUrl)&&post.userId===record.ownerId&&post.visibility!=="private"&&post.deleted!==true&&author&&author.status==="active";
  }) || (db.users||[]).some(function(user){
    const profile=(db.creatorProfiles&&db.creatorProfiles[user.id])||{};
    return user.id===record.ownerId&&user.status==="active"&&(sameMedia(profile.avatarUrl)||sameMedia(user.avatarUrl));
  }) || (db.rzV2.stories||[]).some(function(story){
    const author=(db.users||[]).find(function(u){return u.id===story.userId;});
    return sameMedia(story.mediaUrl)&&story.userId===record.ownerId&&author&&author.status==="active"&&(!story.expiresAt||new Date(story.expiresAt).getTime()>Date.now());
  }) || (db.rzV2.comments||[]).some(function(comment){
    if(!sameMedia(comment.mediaUrl)||comment.hidden===true)return false;
    const post=(db.rzV2.posts||[]).find(function(item){return item.id===comment.postId;});
    const author=post&&(db.users||[]).find(function(u){return u.id===post.userId;});
    return !!post&&comment.userId===record.ownerId&&post.visibility!=="private"&&post.deleted!==true&&author&&author.status==="active";
  });
}

function publicMedia(record){
  return {
    id: record.id,
    url: record.url,
    filename: record.filename,
    mimeType: record.mimeType,
    bytes: record.bytes,
    width: record.width || null,
    height: record.height || null,
    createdAt: record.createdAt
  };
}

async function storeGeneratedAudio(db, ownerId, buffer, filename){
  ensureState(db);
  if(!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_FILE_BYTES){
    const error = new Error("Generated audio is empty or exceeds the media size limit.");
    error.status = 413;
    throw error;
  }
  if(!canUse(db, ownerId, buffer.length)){
    const error = new Error("Your daily RIZORA media allowance has been reached.");
    error.status = 413;
    throw error;
  }

  const id = mediaUid("media_");
  const mimeType = "audio/mpeg";
  const safeFilename = safeName(filename || "rizora-generated-track.mp3");
  let record;
  if(integrationStatus().publicStorage){
    const intent=createCloudinaryUploadIntent({id,ownerId,mimeType});
    const form=new FormData();
    form.append("file",new Blob([buffer],{type:mimeType}),safeFilename);
    form.append("api_key",intent.apiKey);
    form.append("timestamp",String(intent.timestamp));
    form.append("public_id",intent.publicId);
    form.append("overwrite","false");
    form.append("signature",intent.signature);
    const response=await fetch(intent.uploadUrl,{method:"POST",body:form,signal:AbortSignal.timeout(30000)});
    let uploaded={};try{uploaded=await response.json();}catch(_){}
    if(!response.ok||!verifyCloudinaryUpload({intent,response:uploaded,expectedBytes:buffer.length})){
      const error=new Error("Generated audio could not be saved to media storage.");
      error.status=response.status===413?413:502;
      throw error;
    }
    record={
      id,ownerId,filename:safeFilename,mimeType,bytes:buffer.length,
      url:"/api/v2/media/"+encodeURIComponent(id)+".mp3",
      provider:"cloudinary",publicId:intent.publicId,resourceType:intent.resourceType,
      remoteUrl:uploaded.secure_url,createdAt:new Date().toISOString()
    };
  }else{
    if(process.env.NODE_ENV==="production"){
      const error=new Error("Cloudinary uploads are not configured on RIZORA yet.");
      error.status=503;
      throw error;
    }
    const paths=buildPaths(ownerId,id,extFor(mimeType,safeFilename));
    fs.writeFileSync(paths.file,buffer);
    record={id,ownerId,filename:safeFilename,mimeType,bytes:buffer.length,url:"/api/v2/media/"+encodeURIComponent(id)+".mp3",path:paths.file,createdAt:new Date().toISOString()};
  }
  db.rzV2.media.push(record);
  addUsage(db, ownerId, buffer.length);
  return publicMedia(record);
}

function buildPaths(userId, id, ext){
  const base = path.join(mediaRoot(), safeName(userId));
  fs.mkdirSync(base, {recursive:true});
  return {
    dir: base,
    file: path.join(base, id + "." + ext)
  };
}

function cleanupSessions(db){
  const cutoff = Date.now() - SESSION_TTL_MS;
  const stale = db.rzV2.mediaUploads.filter(x => new Date(x.createdAt).getTime() < cutoff);
  stale.forEach(x => {
    try { if(x.tempDir && fs.existsSync(x.tempDir)) fs.rmSync(x.tempDir,{recursive:true,force:true}); } catch(_){}
  });
  db.rzV2.mediaUploads = db.rzV2.mediaUploads.filter(x => new Date(x.createdAt).getTime() >= cutoff);
}

async function handleRizoraMedia(ctx){
  const {req,res,db,saveDB,getCurrentUser,sendJSON,sendError,uid} = ctx;
  ensureState(db);
  cleanupSessions(db);

  const url = new URL(req.url, "http://rizora.local");
  const pathName = url.pathname;
  const method = String(req.method || "GET").toUpperCase();

  if(!pathName.startsWith("/api/v2/media")) return false;

  const publicFileMatch = pathName.match(/^\/api\/v2\/media\/([^/.]+)(?:\.([a-z0-9]+))?$/i);
  const user = getCurrentUser(db, req);
  if(!user){
    if(method === "GET" && publicFileMatch){
      const id = decodeURIComponent(publicFileMatch[1]);
      const record = (db.rzV2.media||[]).find(x => x.id === id);
      if(record && record.provider && mediaIsPublic(db,record)){
        return serveRemoteMedia(req,res,record,true,sendError,url);
      }
      if(record && record.path && fs.existsSync(record.path) && mediaIsPublic(db,record)){
        res.writeHead(200,{
          "Content-Type":record.mimeType,
          "Content-Length":String(record.bytes),
          "Cache-Control":"public, max-age=3600",
          "Access-Control-Allow-Origin":"*",
          "Access-Control-Expose-Headers":"Content-Length,Content-Type,Content-Disposition"
        });
        fs.createReadStream(record.path).pipe(res);
        return true;
      }
    }
    sendError(res,401,"Authentication required.");
    return true;
  }

  if(method === "GET" && pathName === "/api/v2/media/config"){
    const usage = usageFor(db, user.id);
    sendJSON(res,200,{
      success:true,
      provider:"rizora_uploads",
      providers:integrationStatus(),
      maxFileBytes:MAX_FILE_BYTES,
      simpleUploadMax:SIMPLE_UPLOAD_MAX,
      chunkBytes:CHUNK_BYTES,
      dailyBytes:MAX_DAILY_BYTES,
      usedToday:Number(usage.bytes || 0)
    });
    return true;
  }

  if(method === "POST" && pathName === "/api/v2/media/uploads/sign"){
    let body;
    try{body=await readBody(req);}catch(e){sendError(res,400,e.message);return true;}
    const filename=String(body.filename||"media").slice(0,100);
    const mimeType=String(body.mimeType||"").toLowerCase().trim().split(";")[0];
    const size=Number(body.size||0);
    const purpose=body.purpose==="private"?"private":"public";
    if(!allowedMime(mimeType)){sendError(res,415,"That media type is not supported.");return true;}
    if(!Number.isSafeInteger(size)||size<=0||size>MAX_FILE_BYTES){sendError(res,413,"Media files must be between 1 byte and 25 MB.");return true;}
    if(!canUse(db,user.id,size)){sendError(res,413,"Your daily RIZORA media upload allowance has been reached.");return true;}
    const id=mediaUid("media_");
    const uploadId=mediaUid("upload_");
    let providerIntent,providerData;
    try{
      if(purpose==="private"){
        const objectPath=String(user.id).replace(/[^a-zA-Z0-9_-]/g,"")+"/"+id+"."+extFor(mimeType,filename);
        providerIntent=await createPrivateUploadIntent({objectPath});
        providerData={bucket:providerIntent.bucket,objectPath};
      }else{
        providerIntent=createCloudinaryUploadIntent({id,ownerId:user.id,mimeType});
        providerData={publicId:providerIntent.publicId,resourceType:providerIntent.resourceType};
      }
    }catch(error){sendError(res,error.status||503,error.message||"Media storage is not ready yet.");return true;}
    const intent={id:uploadId,mediaId:id,userId:user.id,filename:safeName(filename),mimeType,size,provider:providerIntent.provider,providerData,createdAt:new Date().toISOString()};
    db.rzV2.mediaUploads.push(intent);
    saveDB(db);
    sendJSON(res,201,{success:true,uploadId,mediaId:id,provider:intent.provider,upload:providerIntent});
    return true;
  }

  if(method === "POST" && pathName === "/api/v2/media/uploads/complete"){
    let body;
    try{body=await readBody(req);}catch(e){sendError(res,400,e.message);return true;}
    const intent=(db.rzV2.mediaUploads||[]).find(item=>item.id===String(body.uploadId||"")&&item.userId===user.id);
    if(!intent){sendError(res,404,"Upload session expired. Choose the file and try again.");return true;}
    if(Date.now()-new Date(intent.createdAt).getTime()>SESSION_TTL_MS){sendError(res,410,"Upload session expired. Choose the file and try again.");return true;}
    let remoteUrl="";
    if(intent.provider==="cloudinary"){
      const providerResponse=body.providerResponse||{};
      const valid=verifyCloudinaryUpload({intent:{publicId:intent.providerData.publicId,resourceType:intent.providerData.resourceType},response:providerResponse,expectedBytes:intent.size});
      if(!valid){sendError(res,400,"Cloudinary did not confirm this upload. Please try again.");return true;}
      remoteUrl=String(providerResponse.secure_url||"");
    }else if(intent.provider==="supabase"){
      if(Number(body.bytes)!==Number(intent.size)||String(body.mimeType||"").toLowerCase()!==intent.mimeType){sendError(res,400,"The uploaded file did not match its secure upload request.");return true;}
      try{
        const stored=await fetchPrivateObject(intent.providerData.objectPath);
        if(!stored.ok){try{await stored.body?.cancel();}catch(_){}sendError(res,400,"Supabase Storage did not confirm this upload. Please try again.");return true;}
        const storedBytes=Number(stored.headers.get("content-length"));
        const storedMime=String(stored.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
        const metadataMatches=Number.isSafeInteger(storedBytes)&&storedBytes===Number(intent.size)&&storedMime===intent.mimeType;
        try{await stored.body?.cancel();}catch(_){}
        if(!metadataMatches){try{await deletePrivateObject(intent.providerData.objectPath);}catch(_){}sendError(res,400,"The stored file did not match its signed upload request. Choose the file and try again.");return true;}
      }catch(_){sendError(res,503,"Supabase Storage could not confirm this upload. Try again shortly.");return true;}
    }else{sendError(res,400,"Upload provider is invalid.");return true;}
    const id=intent.mediaId;
    const ext=extFor(intent.mimeType,intent.filename);
    const record={
      id,ownerId:user.id,filename:intent.filename,mimeType:intent.mimeType,bytes:intent.size,
      url:"/api/v2/media/"+encodeURIComponent(id)+"."+ext,
      provider:intent.provider,
      publicId:intent.providerData.publicId||"",
      resourceType:intent.providerData.resourceType||"",
      bucket:intent.providerData.bucket||"",
      objectPath:intent.providerData.objectPath||"",
      remoteUrl,
      createdAt:new Date().toISOString()
    };
    db.rzV2.media.push(record);
    addUsage(db,user.id,intent.size);
    db.rzV2.mediaUploads.splice(db.rzV2.mediaUploads.indexOf(intent),1);
    saveDB(db);
    sendJSON(res,201,{success:true,media:publicMedia(record)});
    return true;
  }

  if(method === "POST" && pathName === "/api/v2/media/upload"){
    if(process.env.NODE_ENV==="production"){
      sendError(res,410,"This older upload route has been retired. Refresh RIZORA and choose the file again.");
      return true;
    }
    let body;
    try { body = await readBody(req); } catch(e) { sendError(res,400,e.message); return true; }

    const filename = String(body.filename || "media").slice(0,100);
    const mimeType = String(body.mimeType || "").toLowerCase().trim().split(";")[0];
    if(!allowedMime(mimeType)){ sendError(res,415,"That media type is not supported."); return true; }

    let buffer;
    try { buffer = decodePayload(body.data); } catch(e){ sendError(res,400,e.message); return true; }
    if(!buffer.length){ sendError(res,400,"Media file is empty."); return true; }
    if(buffer.length > SIMPLE_UPLOAD_MAX){ sendError(res,413,"This file is too large for a single upload. Use the built-in chunked upload."); return true; }
    if(!canUse(db,user.id,buffer.length)){ sendError(res,413,"Your daily RIZORA media upload allowance has been reached."); return true; }

    const id = uid("media_");
    const ext = extFor(mimeType, filename);
    const paths = buildPaths(user.id,id,ext);
    fs.writeFileSync(paths.file, buffer);

    const record = {
      id,
      ownerId:user.id,
      filename:safeName(filename),
      mimeType,
      bytes:buffer.length,
      url:"/api/v2/media/" + encodeURIComponent(id) + "." + ext,
      path:paths.file,
      createdAt:new Date().toISOString()
    };

    db.rzV2.media.push(record);
    addUsage(db,user.id,buffer.length);
    saveDB(db);
    sendJSON(res,201,{success:true,media:publicMedia(record)});
    return true;
  }

  if(method === "POST" && pathName === "/api/v2/media/sessions"){
    if(process.env.NODE_ENV==="production"){
      sendError(res,410,"This older upload route has been retired. Refresh RIZORA and choose the file again.");
      return true;
    }
    let body;
    try { body = await readBody(req); } catch(e) { sendError(res,400,e.message); return true; }

    const filename = String(body.filename || "media").slice(0,100);
    const mimeType = String(body.mimeType || "").toLowerCase().trim();
    const size = Number(body.size || 0);

    if(!allowedMime(mimeType)){ sendError(res,415,"That media type is not supported."); return true; }
    if(!Number.isFinite(size) || size <= 0 || size > MAX_FILE_BYTES){ sendError(res,413,"Media files must be between 1 byte and 25 MB."); return true; }
    if(size <= SIMPLE_UPLOAD_MAX){ sendError(res,400,"Use the simple upload endpoint for this file."); return true; }
    if(!canUse(db,user.id,size)){ sendError(res,413,"Your daily RIZORA media upload allowance has been reached."); return true; }

    const uploadId = uid("upload_");
    const tempDir = path.join(mediaRoot(), "_tmp", uploadId);
    fs.mkdirSync(tempDir,{recursive:true});

    const session = {
      id:uploadId,
      userId:user.id,
      filename:safeName(filename),
      mimeType,
      size,
      chunkBytes:CHUNK_BYTES,
      totalChunks:Math.ceil(size / CHUNK_BYTES),
      received:[],
      tempDir,
      createdAt:new Date().toISOString()
    };

    db.rzV2.mediaUploads.push(session);
    saveDB(db);
    sendJSON(res,201,{success:true,uploadId,chunkBytes:CHUNK_BYTES,totalChunks:session.totalChunks});
    return true;
  }

  const chunkMatch = pathName.match(/^\/api\/v2\/media\/sessions\/([^/]+)\/chunk$/);
  if(method === "POST" && chunkMatch){
    if(process.env.NODE_ENV==="production"){
      sendError(res,410,"This older upload route has been retired. Refresh RIZORA and choose the file again.");
      return true;
    }
    const uploadId = decodeURIComponent(chunkMatch[1]);
    const session = db.rzV2.mediaUploads.find(x => x.id === uploadId && x.userId === user.id);
    if(!session){ sendError(res,404,"Upload session not found."); return true; }

    let body;
    try { body = await readBody(req); } catch(e) { sendError(res,400,e.message); return true; }

    const index = Number(body.index);
    if(!Number.isInteger(index) || index < 0 || index >= session.totalChunks){ sendError(res,400,"Invalid upload chunk."); return true; }

    let buffer;
    try { buffer = decodePayload(body.data); } catch(e){ sendError(res,400,e.message); return true; }
    if(buffer.length > CHUNK_BYTES + 8192){ sendError(res,413,"Upload chunk is too large."); return true; }

    const expected = Math.min(CHUNK_BYTES, session.size - index * CHUNK_BYTES);
    if(buffer.length !== expected){ sendError(res,400,"Upload chunk size is invalid."); return true; }

    fs.writeFileSync(path.join(session.tempDir, String(index).padStart(6,"0") + ".part"), buffer);
    if(!session.received.includes(index)) session.received.push(index);
    session.received.sort((a,b)=>a-b);
    saveDB(db);

    sendJSON(res,200,{success:true,index,received:session.received.length,totalChunks:session.totalChunks});
    return true;
  }

  const completeMatch = pathName.match(/^\/api\/v2\/media\/sessions\/([^/]+)\/complete$/);
  if(method === "POST" && completeMatch){
    if(process.env.NODE_ENV==="production"){
      sendError(res,410,"This older upload route has been retired. Refresh RIZORA and choose the file again.");
      return true;
    }
    const uploadId = decodeURIComponent(completeMatch[1]);
    const sessionIndex = db.rzV2.mediaUploads.findIndex(x => x.id === uploadId && x.userId === user.id);
    if(sessionIndex < 0){ sendError(res,404,"Upload session not found."); return true; }

    const session = db.rzV2.mediaUploads[sessionIndex];
    if(session.received.length !== session.totalChunks){ sendError(res,409,"Upload is incomplete."); return true; }

    const id = uid("media_");
    const ext = extFor(session.mimeType, session.filename);
    const paths = buildPaths(user.id,id,ext);
    const out = fs.createWriteStream(paths.file);

    try {
      for(let i=0;i<session.totalChunks;i++){
        const part = path.join(session.tempDir, String(i).padStart(6,"0") + ".part");
        if(!fs.existsSync(part)) throw new Error("Missing upload chunk.");
        await new Promise((resolve,reject)=>{
          const input=fs.createReadStream(part);
          input.on("error",reject);
          input.on("end",resolve);
          input.pipe(out,{end:false});
        });
      }
      await new Promise((resolve,reject)=>{out.end(resolve);out.on("error",reject);});
    } catch(e){
      try{out.destroy();}catch(_){}
      try{fs.rmSync(paths.file,{force:true});}catch(_){}
      sendError(res,500,"Could not finalize the media upload.");
      return true;
    }

    const stat = fs.statSync(paths.file);
    if(stat.size !== session.size){
      try{fs.rmSync(paths.file,{force:true});}catch(_){}
      sendError(res,409,"Final media size did not match the upload.");
      return true;
    }

    const record = {
      id,
      ownerId:user.id,
      filename:session.filename,
      mimeType:session.mimeType,
      bytes:stat.size,
      url:"/api/v2/media/" + encodeURIComponent(id) + "." + ext,
      path:paths.file,
      createdAt:new Date().toISOString()
    };

    db.rzV2.media.push(record);
    addUsage(db,user.id,stat.size);
    db.rzV2.mediaUploads.splice(sessionIndex,1);
    try{fs.rmSync(session.tempDir,{recursive:true,force:true});}catch(_){}
    saveDB(db);

    sendJSON(res,201,{success:true,media:publicMedia(record)});
    return true;
  }

  if(method === "GET" && pathName === "/api/v2/media/mine"){
    const rows = (db.rzV2.media || [])
      .filter(x => x.ownerId === user.id)
      .slice()
      .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0,200)
      .map(publicMedia);
    sendJSON(res,200,{success:true,media:rows,usage:usageFor(db,user.id)});
    return true;
  }

  const fileMatch = pathName.match(/^\/api\/v2\/media\/([^/.]+)(?:\.([a-z0-9]+))?$/i);
  if(method === "GET" && fileMatch){
    const id = decodeURIComponent(fileMatch[1]);
    const record = db.rzV2.media.find(x => x.id === id);
    if(!record || (!record.provider && (!record.path || !fs.existsSync(record.path)))){ sendError(res,404,"Media not found."); return true; }
    if(!mediaIsAccessible(db,user,record)){ sendError(res,403,"You do not have access to this media."); return true; }
    if(record.provider) return serveRemoteMedia(req,res,record,mediaIsPublic(db,record),sendError,url);

    const origin=String(req.headers.origin||"");
    const allowedOrigins=new Set(["https://rizora.com.ng","https://www.rizora.com.ng","https://rizora.vercel.app","https://rizora-frontend-clean-drhvxsswx-royal-saents.vercel.app","http://localhost:3000","http://127.0.0.1:3000",...String(process.env.RIZORA_CORS_ORIGINS||"").split(",").map(function(value){return value.trim();}).filter(Boolean)]);
    const allowedOrigin=allowedOrigins.has(origin);
    const headers={
      "Content-Type":record.mimeType,
      "Content-Length":String(record.bytes),
      "Cache-Control":"private, max-age=3600",
      "Access-Control-Allow-Credentials":"true",
      "Access-Control-Expose-Headers":"Content-Length,Content-Type,Content-Disposition",
      "Vary":"Origin"
    };
    if(allowedOrigin)headers["Access-Control-Allow-Origin"]=origin;
    if(url.searchParams.get("download")==="1")headers["Content-Disposition"]="attachment; filename=\""+safeName(record.filename)+"\"";
    res.writeHead(200,headers);
    fs.createReadStream(record.path).pipe(res);
    return true;
  }

  if(method === "DELETE" && fileMatch){
    const id = decodeURIComponent(fileMatch[1]);
    const index = db.rzV2.media.findIndex(x => x.id === id && x.ownerId === user.id);
    if(index < 0){ sendError(res,404,"Media not found."); return true; }
    const record = db.rzV2.media[index];
    try{
      if(record.provider==="cloudinary") await deleteCloudinaryObject({publicId:record.publicId,resourceType:record.resourceType});
      else if(record.provider==="supabase") await deletePrivateObject(record.objectPath);
      else if(record.path)fs.rmSync(record.path,{force:true});
    }catch(error){sendError(res,error.status||502,"The media could not be removed from storage yet.");return true;}
    db.rzV2.media.splice(index,1);
    saveDB(db);
    sendJSON(res,200,{success:true});
    return true;
  }

  return false;
}

module.exports = { handleRizoraMedia, storeGeneratedAudio };

