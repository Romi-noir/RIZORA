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
  return {

    distributor:"RIZORA",
    catalog:"RIZORA",

    label:
      (user.username === "romi" || user.username === "RoMi") && body.labelChoice
        ? body.labelChoice
        : "Royal Saents Records",

    ownerChoice:user.username === "romi" || user.username === "RoMi"

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

  status:"draft",
  deliveryState:"not_sent",

  createdAt:
   new Date().toISOString()

 };


 return release;

}


function normalizeDistributionIdentity(value){
 return String(value||"").normalize("NFKC").trim().replace(/\s+/g," ").toLowerCase();
}

function sameDistributionRelease(candidate,release){
 if(!candidate||!release||candidate.userId!==release.userId)return false;
 if(candidate.releaseId&&release.releaseId&&String(candidate.releaseId)===String(release.releaseId))return true;
 return Boolean(normalizeDistributionIdentity(candidate.title)&&normalizeDistributionIdentity(candidate.artist)&&
  normalizeDistributionIdentity(candidate.title)===normalizeDistributionIdentity(release.title)&&
  normalizeDistributionIdentity(candidate.artist)===normalizeDistributionIdentity(release.artist));
}

function createDistributionPackage(data,user,db){
 const isRomi=normalizeDistributionIdentity(user.username)==="romi";
 const allowedPlatforms=new Set(["spotify","apple_music","youtube_music","tiktok","tiktok_music"]);
 const requestedPlatforms=Array.isArray(data.platforms)?data.platforms:["spotify","apple_music","youtube_music","tiktok_music"];
 const platforms=Array.from(new Set(["rizora",...requestedPlatforms.map(function(platform){return String(platform||"").trim().toLowerCase();}).filter(function(platform){return allowedPlatforms.has(platform);})]));
 const releaseTitle=musicText(data.title||data.releaseTitle,"Untitled Release",160)||"Untitled Release";
 const releaseArtist=musicText(data.artist,user.username||"Unknown artist",120)||"Unknown artist";
 const releaseId=musicText(data.releaseId,"",160)||null;
 const identity={userId:user.id,releaseId:releaseId,title:releaseTitle,artist:releaseArtist};
 const existing=db.musicPlatformReleases.find(function(release){return sameDistributionRelease(release,identity);});
 const label=isRomi&&data.labelChoice?musicText(data.labelChoice,"Royal Saents Records",120):"Royal Saents Records";

 if(existing){
  existing.releaseId=existing.releaseId||releaseId||uid("release");
  existing.title=releaseTitle;
  existing.artist=releaseArtist;
  existing.genre=musicText(data.genre,existing.genre||"Afrobeats",80);
  existing.mood=musicText(data.mood,existing.mood||"Modern",80);
  existing.distributor="RIZORA";
  existing.catalog="RIZORA";
  existing.label=isRomi&&data.labelChoice?label:(existing.label||"Royal Saents Records");
  existing.platforms=platforms;
  if(data.artwork!==undefined)existing.artwork=data.artwork||null;
  if(data.audioUrl!==undefined)existing.audioUrl=data.audioUrl||null;
  if(data.videoUrl!==undefined)existing.videoUrl=data.videoUrl||null;
  if(data.visualUrl!==undefined)existing.visualUrl=data.visualUrl||null;
  if(data.visibility!==undefined)existing.visibility=data.visibility==="public"?"public":"private";
  existing.status="draft";
  existing.deliveryState="not_sent";
  existing.deliveryProvider=null;
  existing.updatedAt=new Date().toISOString();
  return existing;
 }

 return {
  id:uid("distribution"),
  userId:user.id,
  releaseId:releaseId||uid("release"),
  artist:releaseArtist,
  title:releaseTitle,
  genre:musicText(data.genre,"Afrobeats",80),
  mood:musicText(data.mood,"Modern",80),
  distributor:"RIZORA",
  catalog:"RIZORA",
  label:label,
  platforms:platforms,
  artwork:data.artwork||null,
  audioUrl:data.audioUrl||null,
  videoUrl:data.videoUrl||null,
  visualUrl:data.visualUrl||null,
  visibility:data.visibility==="public"?"public":"private",
  status:"draft",
  deliveryState:"not_sent",
  deliveryProvider:null,
  createdAt:new Date().toISOString()
 };
}

function upsertDistributionCatalog(db,release){
 const duplicateReleases=db.musicPlatformReleases.filter(function(candidate){return sameDistributionRelease(candidate,release)&&candidate!==release;});
 const distributionIds=new Set([release.id,...duplicateReleases.map(function(candidate){return candidate.id;})].filter(Boolean));
 if(!db.musicPlatformReleases.includes(release))db.musicPlatformReleases.push(release);
 for(let index=db.musicPlatformReleases.length-1;index>=0;index--){
  const candidate=db.musicPlatformReleases[index];
  if(candidate!==release&&sameDistributionRelease(candidate,release))db.musicPlatformReleases.splice(index,1);
 }

 const catalogEntries=db.musicCatalog.filter(function(entry){
  const linked=distributionIds.has(entry.releaseId);
  const owned=entry.userId===release.userId||(!entry.userId&&linked);
  const releaseTitle=normalizeDistributionIdentity(release.title);
  const releaseArtist=normalizeDistributionIdentity(release.artist);
  const sameIdentity=Boolean(releaseTitle&&releaseArtist&&normalizeDistributionIdentity(entry.title)===releaseTitle&&normalizeDistributionIdentity(entry.artist)===releaseArtist);
  return owned&&(linked||sameIdentity);
 });
 let catalogEntry=catalogEntries[0];
 if(!catalogEntry){
  catalogEntry={id:uid("catalog"),createdAt:new Date().toISOString()};
  db.musicCatalog.push(catalogEntry);
 }
 catalogEntry.userId=release.userId;
 catalogEntry.releaseId=release.id;
 catalogEntry.title=release.title||"Untitled Release";
 catalogEntry.artist=release.artist;
 catalogEntry.genre=release.genre||"Afrobeats";
 catalogEntry.mood=release.mood||"Modern";
 catalogEntry.platforms=release.platforms||["rizora"];
 catalogEntry.artwork=release.artwork||null;
 catalogEntry.audioUrl=release.audioUrl||null;
 catalogEntry.videoUrl=release.videoUrl||null;
 catalogEntry.visualUrl=release.visualUrl||null;
 catalogEntry.visibility=release.visibility||"public";
 catalogEntry.distributor="RIZORA";
 catalogEntry.catalog="RIZORA";
 catalogEntry.label=release.label||"Royal Saents Records";
 catalogEntry.status="draft";
 catalogEntry.updatedAt=release.updatedAt||new Date().toISOString();
 for(let index=db.musicCatalog.length-1;index>=0;index--){
  const candidate=db.musicCatalog[index];
  if(candidate!==catalogEntry&&catalogEntries.includes(candidate))db.musicCatalog.splice(index,1);
 }
 return release;
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

function musicError(status,message){
  return Object.assign(new Error(message),{status});
}

function parseMusicResult(content){
  const text=String(content||"").trim().replace(/^```(?:json)?\s*/i,"").replace(/\s*```$/i,"");
  const start=text.indexOf("{");
  const end=text.lastIndexOf("}");
  if(start<0||end<=start)throw musicError(502,"Music AI returned an incomplete result. Try again.");
  try{return JSON.parse(text.slice(start,end+1));}
  catch(_){throw musicError(502,"Music AI returned an unreadable result. Try again.");}
}

function musicText(value,fallback,maxLength){
  return String(value||fallback||"").trim().slice(0,maxLength||300);
}

function musicList(value,fallback,maxItems){
  const items=Array.isArray(value)&&value.length?value:fallback;
  return items.slice(0,maxItems).map(item=>musicText(item,"",240)).filter(Boolean);
}

async function generateMusicResult(body,generateAI,type,userId){
  if(typeof generateAI!=="function")throw musicError(503,"RIZORA Music AI is not configured right now.");
  const genre=musicText(body.genre,"Afrobeats",80);
  const mood=musicText(body.mood,"Modern",80);
  const prompt=musicText(body.prompt,"",1200);
  const format=musicText(body.format,"Full track",80);
  const schema=type==="beat_concept"
    ? "Return JSON only with type, title, tempoBpm, key, groove, bass, palette, structure (array of strings), and producerNote."
    : "Return JSON only with type, title, tempoBpm, key, sections (array of objects with name, bars, focus), layers (array of strings), vocalDirection, and mixNotes (array of strings).";
  let response;
  try{
    response=await generateAI({userId,messages:[
      {role:"system",content:"You are RIZORA Music AI, a practical producer and vocal-arrangement partner. Turn the creator's idea into a specific, original production direction. Respect their genre and mood. For short social formats, start with the strongest hook and fit the chosen duration. Never claim you rendered audio, mastered a track, or delivered music to an external platform. " + schema},
      {role:"user",content:JSON.stringify({genre,mood,format,idea:prompt})}
    ]});
  }catch(error){if(error&&error.status)throw error;throw musicError(503,"RIZORA Music AI could not connect. Try again shortly.");}
  if(!response)throw musicError(503,"RIZORA Music AI is not configured right now.");
  const data=await response.json().catch(()=>({}));
  if(!response.ok){
    if(response.status===429)throw musicError(429,"Music AI is busy right now. Try again in a moment.");
    throw musicError(503,"Music AI is temporarily unavailable. Try again shortly.");
  }
  const generated=parseMusicResult(data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content);
  if(!generated||typeof generated!=="object"||Array.isArray(generated))throw musicError(502,"Music AI returned an incomplete result. Try again.");
  const title=musicText(generated.title,type==="beat_concept"?"Beat concept":"Arrangement direction",100);
  const result={
    type,
    title:format+" · "+title,
    prompt,
    format,
    genre,
    mood,
    tempoBpm:Math.max(40,Math.min(220,Math.round(Number(generated.tempoBpm)||100))),
    key:musicText(generated.key,"Key not specified",40)
  };
  if(type==="beat_concept"){
    result.groove=musicText(generated.groove,"Build a pocket that supports the hook.",240);
    result.bass=musicText(generated.bass,"Shape a bass line around the kick.",240);
    result.palette=musicText(generated.palette,"Keep the instrumental palette focused.",240);
    result.structure=musicList(generated.structure,["8-bar loop","Hook variation","Drop and vocal space"],6);
    result.producerNote=musicText(generated.producerNote,"Build an eight-bar loop, then shape its energy around the strongest phrase.",400);
  }else{
    const sections=Array.isArray(generated.sections)?generated.sections.slice(0,8):[];
    if(!sections.length)throw musicError(502,"Music AI returned an incomplete arrangement. Try again.");
    result.sections=sections.map(section=>({
      name:musicText(section&&section.name,"Section",50),
      bars:Math.max(1,Math.min(64,Math.round(Number(section&&section.bars)||8))),
      focus:musicText(section&&section.focus,"Develop the musical idea.",240)
    }));
    result.layers=musicList(generated.layers,["Drums","Bass","Lead texture"],6);
    result.vocalDirection=musicText(generated.vocalDirection,"Leave clear space for the lead vocal.",300);
    result.mixNotes=musicList(generated.mixNotes,["Keep headroom before mastering.","Make room for the lead vocal."],5);
  }
  return result;
}

function musicDirection(body={},generateAI,userId){
  return generateMusicResult(body,generateAI,"arrangement",userId);
}

function beatConcept(body={},generateAI,userId){
  return generateMusicResult(body,generateAI,"beat_concept",userId);
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
 sendError,
 generateMusicAI,
 generateMusicAudio,
 generateVoiceAudio,
 listMusicVoices,
 musicAudioConfigured,
 musicAudioRequirements,
 storeGeneratedAudio
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
  distributor:"RIZORA",
  catalog:"RIZORA",
   label:c.label||"Royal Saents Records",
  status:c.deliveryState==="delivered"?(c.status||"delivered"):"RIZORA catalog",
  deliveryState:c.deliveryState||"not_sent",
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


if(method==="GET" && path==="/api/music/audio-status"){
 const missingSettings=typeof musicAudioRequirements==="function"?musicAudioRequirements():[];
 return writeJSON({
  success:true,
  provider:"ElevenLabs",
  configured:typeof musicAudioConfigured==="function"&&musicAudioConfigured()&&missingSettings.length===0,
  missingSettings,
  durationOptionsSeconds:[15,30,60]
 });
}


if(method==="GET" && path==="/api/music/voice-options"){
 if(typeof musicAudioConfigured!=="function"||!musicAudioConfigured())return writeJSON({success:true,configured:false,voices:[]});
 if(typeof listMusicVoices!=="function")return writeError(503,"Voiceover generation is not available right now.");
 try{
  const voices=await listMusicVoices();
  return writeJSON({success:true,configured:true,voices:Array.isArray(voices)?voices:[]});
 }catch(error){
  return writeError(error.status||503,error.message||"Voice options could not be loaded.");
 }
}


if(method==="POST" && path==="/api/music/generate-voice"){
 const body=await readBody(req);
 const text=musicText(body.text,"",2400);
 const voiceId=musicText(body.voiceId,"",100);
 if(text.length<8)return writeError(400,"Write at least 8 characters for the voiceover.");
 if(!/^[A-Za-z0-9_-]{5,100}$/.test(voiceId))return writeError(400,"Choose a voice from the available voice list.");
 if(typeof musicAudioConfigured!=="function"||!musicAudioConfigured())return writeError(503,"Voiceover generation is not ready. Connect the voice provider and persistent media storage first.");
 if(typeof generateVoiceAudio!=="function"||typeof storeGeneratedAudio!=="function")return writeError(503,"Voiceover generation is not available right now.");
 let generated;
 try{generated=await generateVoiceAudio({userId:user.id,voiceId,text});}
 catch(error){return writeError(error.status||503,error.message||"Voiceover generation failed. Try again shortly.");}
 try{
  const media=storeGeneratedAudio(db,user.id,generated&&generated.buffer,"rizora-voiceover.mp3");
  const output={id:uid("voice_output"),userId:user.id,mediaId:media.id,audioUrl:media.url,provider:"ElevenLabs",modelId:generated&&generated.modelId||"eleven_multilingual_v2",voiceId,text,status:"ready",createdAt:new Date().toISOString()};
  db.musicOutputs.push(output);
  saveDB(db);
  return writeJSON({success:true,output,media});
 }catch(error){return writeError(error.status||500,error.status?error.message:"The generated voiceover could not be saved.");}
}


if(method==="POST" && path==="/api/music/generate-audio"){
 const body=await readBody(req);
 const prompt=musicText(body.prompt,"",1000);
 const durationMs=Math.round(Number(body.durationMs)||0);
 const genre=musicText(body.genre,"Afrobeats",80);
 const mood=musicText(body.mood,"Modern",80);
 const format=musicText(body.format,"Full track",80);
 const allowedDurations=new Set([15000,30000,60000]);
 if(prompt.length<8)return writeError(400,"Describe the music you want in at least 8 characters.");
 if(!allowedDurations.has(durationMs))return writeError(400,"Choose a 15, 30 or 60 second generation.");
 if(typeof musicAudioConfigured!=="function"||!musicAudioConfigured()){
  return writeError(503,"Audio generation is not ready. Configure the provider key and durable media storage before enabling it.");
 }
 if(typeof generateMusicAudio!=="function"||typeof storeGeneratedAudio!=="function"){
  return writeError(503,"RIZORA audio generation is not available right now.");
 }

 let generated;
 try{
  generated=await generateMusicAudio({
   userId:user.id,
   prompt:[genre,mood,format,prompt].filter(Boolean).join(". "),
   durationMs,
   forceInstrumental:body.forceInstrumental===true
  });
 }catch(error){
  return writeError(error.status||503,error.message||"Audio generation failed. Try again shortly.");
 }

 try{
  const media=storeGeneratedAudio(db,user.id,generated&&generated.buffer,"rizora-generated-track.mp3");
  const output={
   id:uid("music_output"),
   userId:user.id,
   mediaId:media.id,
   audioUrl:media.url,
   provider:"ElevenLabs",
   modelId:"music_v2_5",
   durationMs,
   forceInstrumental:body.forceInstrumental===true,
   prompt:[genre,mood,format,prompt].filter(Boolean).join(". "),
   status:"ready",
   createdAt:new Date().toISOString()
  };
  db.musicOutputs.push(output);
  saveDB(db);
  return writeJSON({success:true,output,media});
 }catch(error){
  return writeError(error.status||500,error.status?error.message:"Generated audio could not be saved.");
 }
}



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
   musicText(body.prompt,"",1200),

  genre:
   body.genre || "Afrobeats",

  mood:
   body.mood || "modern",

  format:
   musicText(body.format,"Full track",80),

  status:"processing",

  createdAt:
   new Date().toISOString()

 };


 const job=createAIJob(
  "music_director",
  user,
  project.id,
  {
   instructions:
    project.prompt
  }
 );

 let result;
 try{result=await musicDirection(body,generateMusicAI,user.id);}
 catch(error){return writeError(error.status||503,error.message||"Music AI is unavailable.");}
 db.musicProjects.push(project);
 project.status="ready";
 project.arrangement=result;
 job.status="ready";
 job.result=result;
 job.completedAt=new Date().toISOString();


 db.musicAIJobs.push(job);


 saveDB(db);



 return writeJSON({

  success:true,

  project,
  job,
  result

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

 format:
  musicText(body.format,"Full track",80),

 prompt:
  musicText(body.prompt,"",1200),

 status:"processing",

 createdAt:
  new Date().toISOString()

 };


 let result;
 try{result=await beatConcept(body,generateMusicAI,user.id);}
 catch(error){return writeError(error.status||503,error.message||"Music AI is unavailable.");}

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

 beat.status="ready";
 beat.concept=result;
 const beatJob=db.musicAIJobs[db.musicAIJobs.length-1];
 beatJob.status="ready";
 beatJob.result=result;
 beatJob.completedAt=new Date().toISOString();


 saveDB(db);



 return writeJSON({

  success:true,

  beat,
  result

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

 upsertDistributionCatalog(db,release);
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
   ).map(function(entry){
    const delivered=entry.deliveryState==="delivered";
    return Object.assign({},entry,{
     distributor:"RIZORA",
     catalog:"RIZORA",
     status:delivered?(entry.status||"delivered"):"draft",
     deliveryState:entry.deliveryState||"not_sent"
    });
   })

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
  release:Object.assign({},release,{
   distributor:"RIZORA",
   catalog:"RIZORA",
   status:release.deliveryState==="delivered"?(release.status||"delivered"):"draft",
   deliveryState:release.deliveryState||"not_sent"
  })
 });

}


return false;

}


module.exports={
  handleRizoraMusic
};























