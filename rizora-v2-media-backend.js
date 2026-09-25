"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const SIMPLE_UPLOAD_MAX = 750 * 1024;
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
  "audio/ogg": "ogg"
};

function ensureState(db){
  db.rzV2 = db.rzV2 || {};
  db.rzV2.media = db.rzV2.media || [];
  db.rzV2.mediaUploads = db.rzV2.mediaUploads || [];
  db.rzV2.mediaUsage = db.rzV2.mediaUsage || {};
}

function mediaRoot(){
  return path.join(__dirname, "uploads", "rizora");
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

async function readBody(req){
  let raw = "";
  for await(const chunk of req){
    raw += chunk.toString();
    if(raw.length > 1100000) throw new Error("Request body too large.");
  }
  return raw ? JSON.parse(raw) : {};
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

  const user = getCurrentUser(db, req);
  if(!user){
    sendError(res,401,"Authentication required.");
    return true;
  }

  if(method === "GET" && pathName === "/api/v2/media/config"){
    const usage = usageFor(db, user.id);
    sendJSON(res,200,{
      success:true,
      provider:"rizora_uploads",
      maxFileBytes:MAX_FILE_BYTES,
      simpleUploadMax:SIMPLE_UPLOAD_MAX,
      chunkBytes:CHUNK_BYTES,
      dailyBytes:MAX_DAILY_BYTES,
      usedToday:Number(usage.bytes || 0)
    });
    return true;
  }

  if(method === "POST" && pathName === "/api/v2/media/upload"){
    let body;
    try { body = await readBody(req); } catch(e) { sendError(res,400,e.message); return true; }

    const filename = String(body.filename || "media").slice(0,100);
    const mimeType = String(body.mimeType || "").toLowerCase().trim();
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

  const fileMatch = pathName.match(/^\/api\/v2\/media\/([^/.]+)(?:\.([a-z0-9]+))?$/i);
  if(method === "GET" && fileMatch){
    const id = decodeURIComponent(fileMatch[1]);
    const record = db.rzV2.media.find(x => x.id === id);
    if(!record || !record.path || !fs.existsSync(record.path)){ sendError(res,404,"Media not found."); return true; }

    res.writeHead(200,{
      "Content-Type":record.mimeType,
      "Content-Length":String(record.bytes),
      "Cache-Control":"public, max-age=31536000, immutable"
    });
    fs.createReadStream(record.path).pipe(res);
    return true;
  }

  if(method === "DELETE" && fileMatch){
    const id = decodeURIComponent(fileMatch[1]);
    const index = db.rzV2.media.findIndex(x => x.id === id && x.ownerId === user.id);
    if(index < 0){ sendError(res,404,"Media not found."); return true; }
    const record = db.rzV2.media[index];
    try{if(record.path)fs.rmSync(record.path,{force:true});}catch(_){}
    db.rzV2.media.splice(index,1);
    saveDB(db);
    sendJSON(res,200,{success:true});
    return true;
  }

  return false;
}

module.exports = { handleRizoraMedia };
