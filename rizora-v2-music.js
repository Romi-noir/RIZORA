"use strict";

const crypto = require("crypto");


function uid(prefix){
  return prefix + "_" + crypto.randomBytes(8).toString("hex");
}


async function readBody(req){
  let raw="";

  for await(const chunk of req){
    raw += chunk;
  }

  try{
    return JSON.parse(raw || "{}");
  }catch{
    return {};
  }
}


function ensureMusic(db){

  db.musicProjects = db.musicProjects || [];
  db.musicTracks = db.musicTracks || [];
  db.musicBeats = db.musicBeats || [];
  db.musicStems = db.musicStems || [];
  db.musicAIJobs = db.musicAIJobs || [];
  db.musicCredits = db.musicCredits || [];
  db.musicContributors = db.musicContributors || [];
  db.musicOutputs = db.musicOutputs || [];
  db.musicDistributions = db.musicDistributions || [];
  db.musicMarketplace = db.musicMarketplace || [];
  db.musicUsage = db.musicUsage || [];
  db.musicLicenses = db.musicLicenses || [];
  db.musicRights = db.musicRights || [];
  db.musicCatalog = db.musicCatalog || [];
  db.musicPlatformReleases = db.musicPlatformReleases || [];
  db.musicRoyalties = db.musicRoyalties || [];

}



function createCredits(user,body={}){

  if(
    user.username === "romi" ||
    user.username === "RoMi"
  ){

    return {

      distributor:
        body.distributorChoice || null,

      label:
        body.labelChoice || null,

      ownerChoice:true

    };

  }


  return {

    distributor:"RIZORA",

    label:"Royal Saents Records",

    ownerChoice:false

  };

}




function addContributor(db,data){

 db.musicContributors.push({

  id:uid("contributor"),

  trackId:
   data.trackId || null,

  userId:
   data.userId || null,

  name:
   data.name || "Unknown",

  role:
   data.role || "artist",

  percentage:
   Number(data.percentage || 0),

  createdAt:
   new Date().toISOString()

 });

}


function createLicense(db,data){

 const license={

  id:uid("license"),

  beatId:
   data.beatId || null,

  ownerId:
   data.ownerId || null,

  type:
   data.type || "free",

  commercial:
   Boolean(data.commercial),

  exclusive:
   Boolean(data.exclusive),

  allowedUses:
   Number(data.allowedUses || 0),

  createdAt:
   new Date().toISOString()

 };


 db.musicLicenses.push(license);

 return license;

}


function createReleaseMetadata(data,user,db){

 const release={

  id:uid("release_meta"),

  userId:user.id,

  title:
   String(data.title || "Untitled Release"),

  artist:
   data.artist || user.username,

  featuring:
   data.featuring || [],

  artwork:
   data.artwork || null,

  audioUrl:
   data.audioUrl || null,

  videoUrl:
   data.videoUrl || null,

  visualUrl:
   data.visualUrl || null,

  genre:
   data.genre || "Afrobeats",

  mood:
   data.mood || "modern",

  language:
   data.language || "English",

  releaseDate:
   data.releaseDate ||
   new Date().toISOString(),

  trackIds:
   data.trackIds || [],

  contributors:
   db.musicContributors.filter(
    c =>
    data.trackIds &&
    data.trackIds.includes(c.trackId)
   ),

  licenses:
   db.musicLicenses.filter(
    l =>
    data.trackIds &&
    data.trackIds.includes(l.beatId)
   ),

  credits:
   createCredits(
    user,
    data
   ),

  status:"ready",

  createdAt:
   new Date().toISOString()

 };


 return release;

}


function createDistributionPackage(data,user,db){

 const isRomi =
 user.username === "romi" ||
 user.username === "RoMi";


 const platforms = Array.from(
   new Set([
    "rizora",
    ...(data.platforms || [
      "spotify",
      "apple_music",
      "youtube_music",
      "tiktok_music"
    ])
   ])
 );


 const releaseTitle = String(data.title || data.releaseTitle || "Untitled Release").trim() || "Untitled Release";
 const releaseId = data.releaseId ? String(data.releaseId) : null;

 const existing =
 db.musicPlatformReleases.find(
  r =>
   r.userId === user.id &&
   ((releaseId && r.releaseId === releaseId) ||
    (!releaseId && !r.releaseId && String(r.title || "").trim() === releaseTitle))
 );


 if(existing){

   existing.platforms = platforms;

   
   if(data.title){
    existing.title = String(data.title);
   }

   if(data.artist){
    existing.artist = String(data.artist);
   }

   if(data.artwork !== undefined) existing.artwork = data.artwork || null;
   if(data.audioUrl !== undefined) existing.audioUrl = data.audioUrl || null;
   if(data.videoUrl !== undefined) existing.videoUrl = data.videoUrl || null;
   if(data.visualUrl !== undefined) existing.visualUrl = data.visualUrl || null;
   if(data.visibility !== undefined) existing.visibility = data.visibility === "private" ? "private" : "public";

   existing.status = "submitted";

   existing.updatedAt =
    new Date().toISOString();

   return existing;

 }


 return {

  id:uid("distribution"),

  userId:user.id,

  releaseId:
   releaseId || uid("release"),

  artist:
   data.artist || user.username,

  title:
   releaseTitle,

  distributor:
   isRomi && data.distributorChoice
    ? data.distributorChoice
    : "RIZORA",

  label:
   isRomi && data.labelChoice
    ? data.labelChoice
    : "Royal Saents Records",

  platforms,

  artwork:
   data.artwork || null,

  audioUrl:
   data.audioUrl || null,

  videoUrl:
   data.videoUrl || null,

  visualUrl:
   data.visualUrl || null,

  visibility:
   data.visibility === "private" ? "private" : "public",

  status:"submitted",

  createdAt:
   new Date().toISOString()

 };

}

function createAIJob(type,user,target,extra={}){

  return {

    id:uid("ai_job"),

    type,

    userId:user.id,

    targetId:target || null,

    status:"queued",

    instructions:extra.instructions || "",

    createdAt:new Date().toISOString()

  };

}




const REGISTERED_MUSIC_PATCHES = new Set();

async function handleRizoraMusic(ctx){

const {
 req,
 res,
 db,
 saveDB,
 getCurrentUser,
 sendJSON,
 sendError
}=ctx;



const url=new URL(req.url,"http://localhost");

const path=url.pathname;

const method=req.method;

if(!path.startsWith("/api/music/")){
 return false;
}

ensureMusic(db);

if(method==="GET" && path==="/api/music/public-catalog"){
 const publicCatalog=db.musicCatalog
  .filter(c=>c.visibility!=="private")
  .slice()
  .sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0))
  .slice(0,100)
  .map(c=>({
   id:c.id,
   releaseId:c.releaseId,
   title:c.title||"Untitled Release",
   artist:c.artist||"Unknown artist",
   artwork:c.artwork||null,
   audioUrl:c.audioUrl||null,
   videoUrl:c.videoUrl||null,
   visualUrl:c.visualUrl||null,
   platforms:Array.isArray(c.platforms)?c.platforms:[],
   distributor:c.distributor||"RIZORA",
   label:c.label||"Royal Saents Records",
   status:c.status||"submitted",
   createdAt:c.createdAt||null
  }));
 sendJSON(res,200,{success:true,catalog:publicCatalog});
 return true;
}



const user=getCurrentUser(db,req);

const sendJSONResponse=sendJSON;
const sendErrorResponse=sendError;
const writeJSON=(payload)=>{sendJSONResponse(res,200,payload);return true;};
const writeError=(status,message)=>{sendErrorResponse(res,status,message);return true;};



if(!user){

 return writeError(401,
  "Authentication required."
 );

}



ensureMusic(db);



/*
 AI MUSIC DIRECTOR

 User uploads vocal,
 chooses beat,
 writes instruction,
 AI controls arrangement,
 effects, mix direction.
*/


if(
 method==="POST" &&
 path==="/api/music/ai-direct"
){

 const body=await readBody(req);


 const project={

  id:uid("project"),

  userId:user.id,

  vocal:
   body.vocal || null,

  beat:
   body.beat || null,

  prompt:
   String(body.prompt || ""),

  genre:
   body.genre || "Afrobeats",

  mood:
   body.mood || "modern",

  status:"processing",

  createdAt:
   new Date().toISOString()

 };


 db.musicProjects.push(project);



 const job=createAIJob(
  "music_director",
  user,
  project.id,
  {
   instructions:
    project.prompt
  }
 );


 db.musicAIJobs.push(job);


 saveDB(db);



 return writeJSON({

  success:true,

  project,

  job

 });


}





/*
 AI BEAT CREATOR
*/


if(
 method==="POST" &&
 path==="/api/music/create-beat"
){

 const body=await readBody(req);


 const beat={

 id:uid("beat"),

 owner:user.id,

 type:"beat",

 source:"rizora_ai",

 genre:
  body.genre || "Afrobeats",

 style:
  body.style ||
  "modern afro fusion",

 bpm:
  body.bpm || 105,

 rhythm:
  body.rhythm ||
  "afrobeats groove",

 mood:
  body.mood ||
  "energetic",

 prompt:
  String(body.prompt || ""),

 status:"processing",

 createdAt:
  new Date().toISOString()

 };


 db.musicBeats.push(beat);


 db.musicAIJobs.push(
  createAIJob(
   "beat_generation",
   user,
   beat.id,
   {
    instructions:
     beat.prompt
   }
  )
 );


 saveDB(db);



 return writeJSON({

  success:true,

  beat

 });


}




/*
 UPLOAD BEAT FROM DEVICE
*/


if(
 method==="POST" &&
 path==="/api/music/upload-beat"
){

 const body=await readBody(req);


 const beat={

 id:uid("beat"),

 owner:user.id,

 type:"beat",

 source:"device_upload",

 title:
  String(body.title || "Untitled Beat"),

 url:
  body.url || null,

 genre:
  body.genre || null,

 bpm:
  body.bpm || null,

 license:
  body.license || "free",

publicUse:
 Boolean(body.publicUse),

 createdAt:
  new Date().toISOString()

 };


 db.musicBeats.push(beat);


 saveDB(db);



 return writeJSON({

 success:true,

 beat

 });


}




/*
 COMMUNITY BEAT MARKETPLACE
*/


if(
 method==="POST" &&
 path==="/api/music/publish-beat"
){

 const body=await readBody(req);


 const beat=db.musicBeats.find(
  b=>b.id===body.beatId
 );


 if(!beat){

  return writeError(404,
   "Beat not found."
  );

 }


 if(beat.owner !== user.id){

  return writeError(403,
   "You can only publish your own beats."
  );

 }


 const item={

 id:uid("market"),

 beatId:
  beat.id,

 owner:user.id,

 title:
  beat.title ||
  "Untitled Beat",

 price:
  Number(body.price || 0),

 license:
  body.license ||
  "free",

 uses:0,

 createdAt:
  new Date().toISOString()

 };


 db.musicMarketplace.push(item);


 saveDB(db);


 return writeJSON({

 success:true,

 item

 });


}

/*
 AI VOCAL ENHANCEMENT
*/
if(
 method==="POST" &&
 path==="/api/music/enhance-vocal"
){

 const body=await readBody(req);

 const job=createAIJob(
   "vocal_enhancement",
   user,
   body.projectId || null,
   {
     instructions:
       body.prompt ||
       "enhance vocal quality"
   }
 );


 job.features=[
   "noise removal",
   "pitch correction",
   "vocal clarity",
   "voice balance",
   "professional tone"
 ];


 db.musicAIJobs.push(job);

 saveDB(db);

 return writeJSON({
   success:true,
   job
 });

}


/*
 AI MASTERING
*/
if(
 method==="POST" &&
 path==="/api/music/master"
){

 const body=await readBody(req);

 const job=createAIJob(
   "ai_mastering",
   user,
   body.projectId || null,
   {
     instructions:
       body.prompt ||
       "professional studio mastering"
   }
 );


 job.features=[
   "loudness balancing",
   "EQ correction",
   "compression",
   "stereo enhancement",
   "streaming optimization"
 ];


 db.musicAIJobs.push(job);

 saveDB(db);


 return writeJSON({
   success:true,
   job
 });

}


/*
 STEM SPLITTER AI + NORMAL
*/
if(
 method==="POST" &&
 path==="/api/music/split"
){

 const body=await readBody(req);


 const stem={

 id:uid("stem"),

 owner:user.id,

 source:
   body.source || "upload",

 mode:
   body.mode || "ai",


 parts:[
   "vocals",
   "drums",
   "bass",
   "melody",
   "instrumental",
   "effects"
 ],


 status:"processing",

 createdAt:
   new Date().toISOString()

 };


 db.musicStems.push(stem);

 saveDB(db);


 return writeJSON({
   success:true,
   stem
 });

}


/*
 CREATE SONG ENTRY
*/
if(
 method==="POST" &&
 path==="/api/music/create-song"
){

 const body=await readBody(req);


 const song={

 id:uid("song"),

 owner:user.id,

 type:"song",

 title:
   body.title ||
   "Untitled Song",

 audio:
   body.audio || null,


 beatId:
   body.beatId || null,


 createdWith:
   body.beatId
    ?
    "rizora_or_user_beat"
    :
    "upload",


 createdAt:
   new Date().toISOString()

 };


 db.musicTracks.push(song);

 saveDB(db);


 return writeJSON({
   success:true,
   song
 });

}


/*
 LIBRARY PUBLIC VIEW
*/
if(
 method==="GET" &&
 path==="/api/music/library/public"
){

 return writeJSON({

 success:true,


 songs:
  db.musicTracks
  .filter(t=>t.type==="song"),


 beats:
  db.musicBeats
  .filter(b=>b.type==="beat")

 });

}


/*
 USE COMMUNITY BEAT
*/
if(
 method==="POST" &&
 path==="/api/music/use-beat"
){

 const body=await readBody(req);


 const beat=
 db.musicBeats.find(
  b=>b.id===body.beatId
 );


 if(!beat){

  return writeError(404,
   "Beat not found."
  );

 }


 db.musicUsage.push({

 id:uid("usage"),

 beatId:
   beat.id,

 usedBy:
   user.id,

 createdAt:
   new Date().toISOString()

 });


 beat.uses =
 (beat.uses || 0)+1;


 saveDB(db);


 return writeJSON({
   success:true,
   beat
 });

}


/*
 AI JOB RESULT UPDATE
*/

if(
 method==="POST" &&
 path==="/api/music/ai-result"
){

 const body=await readBody(req);


 const job=db.musicAIJobs.find(
  j=>j.id===body.jobId
 );


 if(!job){

  return writeError(404,
   "AI job not found."
  );

 }


 job.status =
  body.status || "completed";


 job.output =
  body.output || null;


 job.preview =
  body.preview || null;


 job.error =
  body.error || null;


 db.musicOutputs.push({

  id:uid("output"),

  jobId:job.id,

  userId:user.id,

  file:
   body.output || null,

  createdAt:
   new Date().toISOString()

 });


 saveDB(db);


 return writeJSON({
  success:true,
  job
 });

}


/*
 CONTRIBUTOR MANAGEMENT
*/

if(
 method==="POST" &&
 path==="/api/music/contributor"
){

 const body=await readBody(req);


 addContributor(db,{

  trackId:
   body.trackId,

  userId:
   body.userId,

  name:
   body.name,

  role:
   body.role,

  percentage:
   body.percentage

 });


 saveDB(db);


 return writeJSON({
  success:true,
  contributors:
   db.musicContributors
 });

}


/*
 LICENSE MANAGEMENT
*/

if(
 method==="POST" &&
 path==="/api/music/license"
){

 const body=await readBody(req);


 const beat=db.musicBeats.find(
  b=>b.id===body.beatId
 );


 if(!beat){

  return writeError(404,
   "Beat not found."
  );

 }


 if(beat.owner !== user.id){

  return writeError(403,
   "Only beat owner can create license."
  );

 }


 const license=createLicense(db,{

  beatId:
   beat.id,

  ownerId:
   user.id,

  type:
   body.type,

  commercial:
   body.commercial,

  exclusive:
   body.exclusive,

  allowedUses:
   body.allowedUses

 });


 saveDB(db);


 return writeJSON({
  success:true,
  license
 });

}


/*
 RELEASE METADATA
*/

if(
 method==="POST" &&
 path==="/api/music/release-metadata"
){

 const body=await readBody(req);


 const release=createReleaseMetadata(
  body,
  user,
  db
 );


 db.musicDistributions.push(
  release
 );


 saveDB(db);


 return writeJSON({
  success:true,
  release
 });

}


/*
 RIZORA DISTRIBUTION ENGINE
*/

if(
 method==="POST" &&
 path==="/api/music/distribute"
){

 const body=await readBody(req);


 const release=createDistributionPackage(
  body,
  user,
  db
 );


  const isNewRelease =
  !db.musicPlatformReleases.includes(release);


 if(isNewRelease){

  db.musicPlatformReleases.push(
   release
  );


  db.musicCatalog.push({
   id:uid("catalog"),

   userId:
    release.userId,

   releaseId:
    release.id,

   title:
    release.title || "Untitled Release",

   platforms:
    release.platforms || [],
   artwork:release.artwork||null,
   audioUrl:release.audioUrl||null,
   videoUrl:release.videoUrl||null,
   visualUrl:release.visualUrl||null,
   visibility:release.visibility||"public",
   artist:
    release.artist,

   distributor:
    release.distributor,

   label:
    release.label,

   status:
    "pending",

   createdAt:
    new Date().toISOString()
  });

 }




 if(!isNewRelease){
  const catalogEntry = db.musicCatalog.find(
   c=>c.releaseId===release.id &&
   c.userId===release.userId
  );

  if(catalogEntry){
   catalogEntry.title = release.title || "Untitled Release";
   catalogEntry.artist = release.artist;
   catalogEntry.platforms = release.platforms || [];
   catalogEntry.artwork = release.artwork || null;
   catalogEntry.audioUrl = release.audioUrl || null;
   catalogEntry.videoUrl = release.videoUrl || null;
   catalogEntry.visualUrl = release.visualUrl || null;
   catalogEntry.visibility = release.visibility || "public";
   catalogEntry.distributor = release.distributor;
   catalogEntry.label = release.label;
   catalogEntry.status = "pending";
  }
 }
 saveDB(db);


 return writeJSON({
  success:true,
  distribution:release
 });

}


if(
 method==="GET" &&
 path==="/api/music/catalog"
){

 return writeJSON({
  success:true,

  catalog:
   db.musicCatalog.filter(
    c =>
     c.userId === user.id ||
     (
      !c.userId &&
      db.musicPlatformReleases.some(
       r =>
        r.id === c.releaseId &&
        r.userId === user.id
      )
     )
   )

 });

}


if(
 method==="GET" &&
 path.startsWith("/api/music/distribution-status/")
){

 const id =
 path.split("/").pop();


 const release =
 db.musicPlatformReleases.find(
  r=>r.id===id && r.userId===user.id
 );


 if(!release){
  return writeError(404,
   "Distribution not found."
  );
 }


 return writeJSON({
  success:true,
  release
 });

}


return false;

}


module.exports={
  handleRizoraMusic
};























