(function(){
"use strict";
var API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");
function normalizeMediaUrl(value){var raw=String(value||"").trim();try{var parsed=new URL(raw,API);if(parsed.hostname==="rizora-guse.onrender.com"&&!/^(localhost|127\.0\.0\.1)$/i.test(location.hostname)&&/^\/api\/v2\/media\//i.test(parsed.pathname))return location.origin+parsed.pathname+parsed.search;}catch(_){}return raw;}
window.RIZORA_CURRENT_USER=null;
var state={user:null,profile:null,view:(/^\/studio(?:\/|$)/.test(location.pathname))?"studio":"home",authMode:"login",feedTab:"for-you",feed:[],feedOffset:0,feedHasMore:false,discoverCategory:"for-you",discover:{posts:[],creators:[],trendingHashtags:[]},focusedPostId:"",focusedPost:null,activeHashtag:"",hashtagDetail:null,searchSequence:0,discoverBannerIndex:0,discoverSearchTimer:null,discoverBannerTimer:null,tasks:[],socialTasks:[],notifications:[],unreadNotificationCount:0,verification:null,safety:null,points:0,query:"",search:null,aiMessages:[],aiBusy:false,aiRequestId:0,stories:[],communities:[],conversations:[],opportunities:[],analytics:null,boosts:[],official:[],admin:null,adminVerification:[],adminSocialReviews:[],onboarding:[],live:[],liveError:"",composerPeopleTags:[],pendingPeopleTag:null};
state.updates=[];state.referralLink="";
window.state=state;

function $(id){return document.getElementById(id);}

window.RIZORA_LIVE_USERS=[];

function loadRizoraLivePresence(){
  fetch(API+"/api/v2/live/status")
    .then(function(r){return r.json();})
    .then(function(d){
      if(d && d.liveUsers){
        window.RIZORA_LIVE_USERS=d.liveUsers.map(function(x){
          return x.userId;
        });
      }else{
        window.RIZORA_LIVE_USERS=[];
      }
    })
    .catch(function(){});
}

loadRizoraLivePresence();
setInterval(loadRizoraLivePresence,30000);

function esc(v){return String(v==null?"":v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function avatar(u){
  var live="";
  if(window.RIZORA_LIVE_USERS && u && window.RIZORA_LIVE_USERS.indexOf(u.id)!==-1){
    live="<span class=\"rz-live-badge\">LIVE</span>";
  }

  var image="<img class=\"rz-avatar\" src=\""+esc(normalizeMediaUrl(u&&u.avatarUrl||"/assets/rizora-default-avatar.jpg"))+"\" alt=\""+esc((u&&(u.displayName||u.username)||"Creator")+" profile")+"\" loading=\"lazy\">";

  return "<span class=\"rz-avatar-wrap"+(live?" rz-avatar-live":"")+"\" data-rz-avatar-user=\""+esc(u&&u.id||"")+"\">"+image+live+"</span>";
}
var POST_FILTERS=["original","noir","lagos","vintage","warm","cool","bw","cinematic","soft","golden-hour","vivid"];
var POST_EFFECTS=["none","blur","glow","vhs","grain","slow-zoom","shake","mirror","fisheye","sparkle"];
function normalizePostMediaStyle(value){
  var style=value&&typeof value==="object"?value:{};
  var filter=String(style.filter||"original"),effect=String(style.effect||"none"),strength=Number(style.strength);
  if(POST_FILTERS.indexOf(filter)<0)filter="original";
  if(POST_EFFECTS.indexOf(effect)<0)effect="none";
  if(!Number.isFinite(strength))strength=100;
  var crop=String(style.crop||"original"),rotation=Number(style.rotation),speed=Number(style.speed),overlayColor=String(style.overlayColor||"white"),overlayAnimation=String(style.overlayAnimation||"none"),trimStart=Number(style.trimStart),trimEnd=Number(style.trimEnd),overlayX=Number(style.overlayX),overlayY=Number(style.overlayY);
  if(["original","square","portrait","story","landscape"].indexOf(crop)<0)crop="original";
  if([0,90,180,270].indexOf(rotation)<0)rotation=0;
  if([.5,1,1.5,2].indexOf(speed)<0)speed=1;
  if(["white","black"].indexOf(overlayColor)<0)overlayColor="white";
  if(["none","fade","pop","typewriter"].indexOf(overlayAnimation)<0)overlayAnimation="none";
  if(!Number.isFinite(trimStart))trimStart=0;if(!Number.isFinite(trimEnd))trimEnd=0;if(!Number.isFinite(overlayX))overlayX=50;if(!Number.isFinite(overlayY))overlayY=82;
  var range=function(key,min,max,fallback){var value=Number(style[key]);return Number.isFinite(value)?Math.max(min,Math.min(max,Math.round(value))):fallback;};
  return {filter:filter,effect:effect,strength:Math.max(0,Math.min(100,Math.round(strength))),crop:crop,rotation:rotation,flipX:style.flipX===true,speed:speed,brightness:range("brightness",50,150,100),contrast:range("contrast",50,150,100),saturation:range("saturation",0,200,100),warmth:range("warmth",-100,100,0),sharpness:range("sharpness",0,100,0),highlights:range("highlights",-100,100,0),shadows:range("shadows",-100,100,0),overlayText:String(style.overlayText||"").slice(0,160),overlayColor:overlayColor,overlayAnimation:overlayAnimation,overlayX:Math.max(0,Math.min(100,overlayX)),overlayY:Math.max(0,Math.min(100,overlayY)),trimStart:Math.round(Math.max(0,Math.min(3600,trimStart))*10)/10,trimEnd:Math.round(Math.max(0,Math.min(3600,trimEnd))*10)/10};
}
function mediaFilterCss(style){
  var normalized=normalizePostMediaStyle(style),strength=normalized.strength/100;
  var n=function(value){return Number(value.toFixed(3));};
  var filter="";
  switch(normalized.filter){
    case "noir":filter="grayscale("+strength+") contrast("+n(1+.28*strength)+")";break;
    case "lagos":filter="saturate("+n(1+.35*strength)+") contrast("+n(1+.08*strength)+")";break;
    case "vintage":filter="sepia("+n(.36*strength)+") contrast("+n(1-.08*strength)+")";break;
    case "warm":case "golden-hour":filter="sepia("+n(.28*strength)+") saturate("+n(1+.12*strength)+")";break;
    case "cool":filter="hue-rotate("+n(-16*strength)+"deg) saturate("+n(1+.08*strength)+")";break;
    case "bw":filter="grayscale("+strength+")";break;
    case "cinematic":filter="saturate("+n(1-.15*strength)+") contrast("+n(1+.18*strength)+")";break;
    case "soft":filter="saturate("+n(1-.18*strength)+") contrast("+n(1-.08*strength)+")";break;
    case "vivid":filter="saturate("+n(1+.48*strength)+") contrast("+n(1+.06*strength)+")";break;
  }
  var bright=normalized.brightness/100*(1+normalized.highlights/650+normalized.shadows/420),contrast=normalized.contrast/100*(1+normalized.sharpness/420+normalized.highlights/700-normalized.shadows/600),saturation=normalized.saturation/100;
  filter+=" brightness("+n(Math.max(.2,bright))+") contrast("+n(Math.max(.2,contrast))+") saturate("+n(saturation)+")";
  if(normalized.warmth>0)filter+=" sepia("+n(normalized.warmth/360)+")";
  else if(normalized.warmth<0)filter+=" hue-rotate("+n(normalized.warmth*.16)+"deg)";
  if(normalized.effect==="blur")filter+=" blur("+n(8*strength)+"px)";
  return filter;
}
function mediaOverlayMarkup(style,editorPreview){
  if(!style.overlayText)return "";
  return '<span class="rz-post-overlay-text rz-overlay-text-'+style.overlayColor+' rz-overlay-animation-'+style.overlayAnimation+'" '+(editorPreview?'data-rz-editor-overlay="true"':'')+' style="left:'+style.overlayX+'%;top:'+style.overlayY+'%">'+esc(style.overlayText)+'</span>';
}
function peopleTagPillsMarkup(tags){return (Array.isArray(tags)?tags:[]).map(function(tag){var username=String(tag.username||"").replace(/^@/,"");if(!username)return "";return '<a class="rz-people-tag-pill" href="/creator/'+encodeURIComponent(username)+'/" style="left:'+Math.max(0,Math.min(100,Number(tag.x)||0))+'%;top:'+Math.max(0,Math.min(100,Number(tag.y)||0))+'%">@'+esc(username)+'</a>';}).join("");}
function syncComposerPeopleTags(editorRoot){
  var preview=editorRoot&&(editorRoot.querySelector?editorRoot.querySelector("[data-media-preview]"):null),media=preview&&preview.querySelector(".rz-post-media");
  if(!media)return;
  media.querySelectorAll(".rz-people-tag-marker").forEach(function(marker){marker.remove();});
  if(editorRoot.id!=="postMediaEditor")return;
  (state.composerPeopleTags||[]).forEach(function(tag,index){var marker=document.createElement("button");marker.type="button";marker.className="rz-people-tag-marker";marker.setAttribute("data-composer-tag-index",String(index));marker.setAttribute("aria-label","Move or remove tag for @"+String(tag.username||"creator"));marker.style.left=String(tag.x)+"%";marker.style.top=String(tag.y)+"%";marker.innerHTML='<span>@'+esc(tag.username||"creator")+'</span>';media.appendChild(marker);});
}
function renderMedia(url,mediaStyle,editorPreview,peopleTags){
  var raw=normalizeMediaUrl(url); if(!raw)return "";
  var safe=esc(raw), clean=raw.split("?")[0].toLowerCase(),style=normalizePostMediaStyle(mediaStyle),visual=/\.(jpg|jpeg|png|webp|gif|mp4|webm|mov)$/.test(clean);
  var cropClass={square:"rz-media-crop-square",portrait:"rz-media-crop-portrait",story:"rz-media-crop-story",landscape:"rz-media-crop-landscape"}[style.crop]||"",transform="rotate("+style.rotation+"deg) scaleX("+(style.flipX||style.effect==="mirror"?-1:1)+") scale("+(style.effect==="fisheye"?1+.06*(style.strength/100):1)+")";
  var styleVars=visual?';--rz-media-strength:'+String(style.strength/100)+';--rz-media-effect-opacity:'+String(style.strength/100)+';--rz-media-effect-blur:'+String((style.strength*.08).toFixed(2))+'px;--rz-media-effect-shadow:'+String((style.strength*.18).toFixed(2))+'px;--rz-media-rotation:'+style.rotation+'deg;--rz-media-flip-x:'+(style.flipX?-1:1)+';--rz-media-effect-scale:'+String(style.effect==="slow-zoom"?1+.055*(style.strength/100):style.effect==="fisheye"?1+.06*(style.strength/100):1):'',wrapperClass='rz-post-media'+(visual?' rz-media-filter-'+style.filter+' rz-media-effect-'+style.effect+(cropClass?' '+cropClass:''):'');
  if(/\.(jpg|jpeg|png|webp|gif)$/.test(clean)) return '<div class="'+wrapperClass+'" style="'+styleVars.slice(1)+'"><img style="filter:'+esc(mediaFilterCss(style))+';transform:'+transform+'" src="'+safe+'" alt="Creator media" loading="lazy">'+mediaOverlayMarkup(style,editorPreview)+peopleTagPillsMarkup(peopleTags)+'</div>';
  if(/\.(mp4|webm|mov)$/.test(clean)) return '<div class="'+wrapperClass+'" data-rz-playback-rate="'+style.speed+'" data-rz-trim-start="'+style.trimStart+'" data-rz-trim-end="'+style.trimEnd+'" style="'+styleVars.slice(1)+'"><video style="filter:'+esc(mediaFilterCss(style))+';transform:'+transform+'" controls preload="metadata" playsinline src="'+safe+'"></video>'+mediaOverlayMarkup(style,editorPreview)+peopleTagPillsMarkup(peopleTags)+'</div>';
  if(/\.(mp3|m4a|wav|ogg)$/.test(clean)) return '<div class="rz-post-media"><audio controls preload="metadata" src="'+safe+'"></audio></div>';
  return '<div class="rz-post-media"><a class="rz-btn" href="'+safe+'" target="_blank" rel="noopener noreferrer">Open media</a></div>';
}
function postMediaEditor(mediaUrl,mediaStyle,prefix){
  var style=normalizePostMediaStyle(mediaStyle),filters=["original","noir","lagos","vintage","warm","cool","bw","cinematic","soft","golden-hour","vivid"],effects=["none","blur","glow","vhs","grain","slow-zoom","shake","mirror","fisheye","sparkle"];
  var labels={original:"Original",noir:"Noir",lagos:"Lagos",vintage:"Vintage",warm:"Warm",cool:"Cool",bw:"B&W",cinematic:"Cinematic",soft:"Soft","golden-hour":"Golden Hour",vivid:"Vivid",none:"None","slow-zoom":"Slow Zoom"};
  var adjustments=[{id:"brightness",label:"Brightness",min:50,max:150,step:1},{id:"contrast",label:"Contrast",min:50,max:150,step:1},{id:"saturation",label:"Saturation",min:0,max:200,step:1},{id:"warmth",label:"Warmth",min:-100,max:100,step:1},{id:"sharpness",label:"Sharpness",min:0,max:100,step:1},{id:"highlights",label:"Highlights",min:-100,max:100,step:1},{id:"shadows",label:"Shadows",min:-100,max:100,step:1}];
  var adjustmentMarkup=adjustments.map(function(item){return '<label class="rz-media-adjust-row"><span>'+item.label+'</span><input type="range" min="'+item.min+'" max="'+item.max+'" step="'+item.step+'" value="'+style[item.id]+'" data-media-adjust="'+item.id+'"><output data-media-adjust-output="'+item.id+'">'+style[item.id]+'</output></label>';}).join('');
  var crops=[{id:"original",label:"Original"},{id:"square",label:"1:1"},{id:"portrait",label:"4:5"},{id:"story",label:"9:16"},{id:"landscape",label:"16:9"}];
  return '<section class="rz-post-media-editor" id="'+esc(prefix)+'" aria-label="Media filters and effects"><div class="rz-post-media-preview" data-media-preview>'+(mediaUrl?renderMedia(mediaUrl,style,true):'<p class="rz-muted">Choose a photo or video to preview edits.</p>')+'</div><div class="rz-media-style-controls"><label class="rz-label">Filters</label><div class="rz-media-style-rail" role="group" aria-label="Choose a filter">'+filters.map(function(name){return '<button type="button" class="rz-media-style-tool" data-media-filter="'+name+'" aria-pressed="'+(style.filter===name?'true':'false')+'">'+labels[name]+'</button>';}).join('')+'</div><label class="rz-label">Effects</label><div class="rz-media-style-rail" role="group" aria-label="Choose an effect">'+effects.map(function(name){return '<button type="button" class="rz-media-style-tool" data-media-effect="'+name+'" aria-pressed="'+(style.effect===name?'true':'false')+'">'+labels[name]+'</button>';}).join('')+'</div><label class="rz-media-strength-label" for="'+esc(prefix)+'Strength"><span>Strength</span><output data-media-strength-output>'+style.strength+'%</output></label><input id="'+esc(prefix)+'Strength" type="range" min="0" max="100" step="1" value="'+style.strength+'" data-media-strength><details class="rz-media-adjustments"><summary>Adjust · Crop · Rotate · Speed · Trim · Text</summary><div class="rz-media-adjustment-grid">'+adjustmentMarkup+'</div><label class="rz-media-adjust-row"><span>Crop</span><select class="rz-input" data-media-crop>'+crops.map(function(item){return '<option value="'+item.id+'" '+(style.crop===item.id?'selected':'')+'>'+item.label+'</option>';}).join('')+'</select></label><div class="rz-actions"><button type="button" class="rz-text-action" data-media-rotate>Rotate 90°</button><button type="button" class="rz-text-action" data-media-flip aria-pressed="'+(style.flipX?'true':'false')+'">'+(style.flipX?'Flip horizontal: on':'Flip horizontal')+'</button><label class="rz-media-speed-label">Video speed<select class="rz-input" data-media-speed><option value="0.5" '+(style.speed===.5?'selected':'')+'>0.5×</option><option value="1" '+(style.speed===1?'selected':'')+'>1×</option><option value="1.5" '+(style.speed===1.5?'selected':'')+'>1.5×</option><option value="2" '+(style.speed===2?'selected':'')+'>2×</option></select></label></div><div class="rz-media-trim-controls"><label>Trim start <output data-trim-start-output>'+style.trimStart.toFixed(1)+'s</output><input type="range" min="0" max="60" step="0.1" value="'+style.trimStart+'" data-media-trim="start" disabled></label><label>Trim end <output data-trim-end-output>'+(style.trimEnd?style.trimEnd.toFixed(1)+'s':'Full clip')+'</output><input type="range" min="0" max="60" step="0.1" value="'+style.trimEnd+'" data-media-trim="end" disabled></label></div><div class="rz-media-overlay-tools"><label class="rz-media-overlay-label">Text on media<input class="rz-input" maxlength="160" value="'+esc(style.overlayText)+'" placeholder="Add a short text overlay" data-media-overlay-text></label><label>Text color<select class="rz-input" data-media-overlay-color><option value="white" '+(style.overlayColor==='white'?'selected':'')+'>White</option><option value="black" '+(style.overlayColor==='black'?'selected':'')+'>Black</option></select></label><label>Text motion<select class="rz-input" data-media-overlay-animation><option value="none" '+(style.overlayAnimation==='none'?'selected':'')+'>None</option><option value="fade" '+(style.overlayAnimation==='fade'?'selected':'')+'>Fade in</option><option value="pop" '+(style.overlayAnimation==='pop'?'selected':'')+'>Pop</option><option value="typewriter" '+(style.overlayAnimation==='typewriter'?'selected':'')+'>Typewriter</option></select></label><small class="rz-muted">Drag the text over the preview to place it.</small></div></details></div><input type="hidden" value="'+esc(JSON.stringify(style))+'" data-media-style-value></section>';
}
function wirePostMediaEditor(editorId,mediaInputId){
  var root=$(editorId),mediaInput=$(mediaInputId);if(!root)return;
  var value=root.querySelector("[data-media-style-value]"),preview=root.querySelector("[data-media-preview]"),strength=root.querySelector("[data-media-strength]"),output=root.querySelector("[data-media-strength-output]"),style=normalizePostMediaStyle({});
  try{style=normalizePostMediaStyle(JSON.parse(value&&value.value||"{}"));}catch(_){style=normalizePostMediaStyle(style);}
  function update(preserveVideo){
    var priorVideo=preserveVideo&&preview&&preview.querySelector("video"),priorTime=priorVideo&&Number(priorVideo.currentTime||0),wasPlaying=priorVideo&&!priorVideo.paused;
    style=normalizePostMediaStyle(style);if(value)value.value=JSON.stringify(style);
    root.querySelectorAll("[data-media-filter]").forEach(function(button){button.setAttribute("aria-pressed",button.getAttribute("data-media-filter")===style.filter?"true":"false");});
    root.querySelectorAll("[data-media-effect]").forEach(function(button){button.setAttribute("aria-pressed",button.getAttribute("data-media-effect")===style.effect?"true":"false");});
    if(strength)strength.value=String(style.strength);if(output)output.textContent=style.strength+"%";
    root.querySelectorAll("[data-media-adjust]").forEach(function(input){var key=input.getAttribute("data-media-adjust");input.value=String(style[key]);var result=root.querySelector('[data-media-adjust-output="'+key+'"]');if(result)result.textContent=String(style[key]);});
    var crop=root.querySelector("[data-media-crop]"),speed=root.querySelector("[data-media-speed]"),flip=root.querySelector("[data-media-flip]"),overlayText=root.querySelector("[data-media-overlay-text]"),overlayColor=root.querySelector("[data-media-overlay-color]"),overlayAnimation=root.querySelector("[data-media-overlay-animation]");if(crop)crop.value=style.crop;if(speed)speed.value=String(style.speed);if(flip){flip.setAttribute("aria-pressed",style.flipX?"true":"false");flip.textContent=style.flipX?"Flip horizontal: on":"Flip horizontal";}if(overlayText&&overlayText.value!==style.overlayText)overlayText.value=style.overlayText;if(overlayColor)overlayColor.value=style.overlayColor;if(overlayAnimation)overlayAnimation.value=style.overlayAnimation;
    if(preview){preview.innerHTML=mediaInput&&mediaInput.value?renderMedia(mediaInput.value,style,true):'<p class="rz-muted">Choose a photo or video to preview edits.</p>';syncComposerPeopleTags(root);var nextVideo=preview.querySelector("video"),trimInputs=root.querySelectorAll("[data-media-trim]");if(nextVideo){nextVideo.playbackRate=style.speed;var syncTrim=function(){var duration=Number(nextVideo.duration),max=Number.isFinite(duration)?Math.max(.1,Math.floor(duration*10)/10):60;trimInputs.forEach(function(input){input.disabled=false;input.max=String(max);});var startInput=root.querySelector('[data-media-trim="start"]'),endInput=root.querySelector('[data-media-trim="end"]');if(startInput)startInput.value=String(Math.min(style.trimStart,max));if(endInput)endInput.value=String(Math.min(style.trimEnd,max));var startOutput=root.querySelector("[data-trim-start-output]"),endOutput=root.querySelector("[data-trim-end-output]");if(startOutput)startOutput.textContent=style.trimStart.toFixed(1)+"s";if(endOutput)endOutput.textContent=style.trimEnd?style.trimEnd.toFixed(1)+"s":"Full clip";};if(nextVideo.readyState>=1)syncTrim();else nextVideo.addEventListener("loadedmetadata",syncTrim,{once:true});if(priorVideo){var restore=function(){if(Number.isFinite(priorTime)&&priorTime<nextVideo.duration)nextVideo.currentTime=priorTime;if(wasPlaying)nextVideo.play().catch(function(){});};if(nextVideo.readyState>=1)restore();else nextVideo.addEventListener("loadedmetadata",restore,{once:true});}}else trimInputs.forEach(function(input){input.disabled=true;});}
  }
  root.onclick=function(event){var filter=event.target.closest("[data-media-filter]"),effect=event.target.closest("[data-media-effect]"),rotate=event.target.closest("[data-media-rotate]"),flip=event.target.closest("[data-media-flip]");if(filter)style.filter=filter.getAttribute("data-media-filter");if(effect)style.effect=effect.getAttribute("data-media-effect");if(rotate)style.rotation=(style.rotation+90)%360;if(flip)style.flipX=!style.flipX;if(filter||effect||rotate||flip)update(true);};
  root.oninput=function(event){var target=event.target;if(target.matches("[data-media-strength]")){style.strength=Number(target.value);update(true);return;}var adjustment=target.closest("[data-media-adjust]");if(adjustment){style[adjustment.getAttribute("data-media-adjust")]=Number(adjustment.value);update(true);return;}if(target.matches("[data-media-overlay-text]")){style.overlayText=target.value;update(true);return;}var trim=target.closest("[data-media-trim]");if(trim){var duration=Number(trim.max)||60;if(trim.getAttribute("data-media-trim")==="start"){style.trimStart=Number(trim.value);if(style.trimEnd>0&&style.trimStart>=style.trimEnd)style.trimEnd=Math.min(duration,style.trimStart+.1);}else{style.trimEnd=Number(trim.value);if(style.trimEnd>0&&style.trimEnd<=style.trimStart)style.trimStart=Math.max(0,style.trimEnd-.1);}update(true);}};
  root.onchange=function(event){var target=event.target;if(target.matches("[data-media-crop]"))style.crop=target.value;if(target.matches("[data-media-speed]"))style.speed=Number(target.value);if(target.matches("[data-media-overlay-color]"))style.overlayColor=target.value;if(target.matches("[data-media-overlay-animation]"))style.overlayAnimation=target.value;if(target.matches("[data-media-crop],[data-media-speed],[data-media-overlay-color],[data-media-overlay-animation]"))update(true);};
  root.onpointerdown=function(event){var overlay=event.target.closest("[data-rz-editor-overlay]");if(!overlay)return;var media=overlay.closest(".rz-post-media");if(!media)return;event.preventDefault();root._rzOverlayDrag={overlay:overlay,media:media,pointerId:event.pointerId};if(overlay.setPointerCapture)overlay.setPointerCapture(event.pointerId);};
  root.onpointermove=function(event){var drag=root._rzOverlayDrag;if(!drag)return;var rect=drag.media.getBoundingClientRect();if(!rect.width||!rect.height)return;style.overlayX=Math.max(0,Math.min(100,Math.round((event.clientX-rect.left)/rect.width*100)));style.overlayY=Math.max(0,Math.min(100,Math.round((event.clientY-rect.top)/rect.height*100)));drag.overlay.style.left=style.overlayX+"%";drag.overlay.style.top=style.overlayY+"%";if(value)value.value=JSON.stringify(normalizePostMediaStyle(style));};
  root.onpointerup=root.onpointercancel=function(){root._rzOverlayDrag=null;};
  if(mediaInput)mediaInput.addEventListener("change",function(){update(false);});
  update(false);
}
document.addEventListener("play",function(event){var video=event.target&&event.target.closest&&event.target.closest("video[data-rz-playback-rate]");if(video){var rate=Number(video.parentElement&&video.parentElement.getAttribute("data-rz-playback-rate"));if([.5,1,1.5,2].indexOf(rate)>=0)video.playbackRate=rate;}},true);
document.addEventListener("loadedmetadata",function(event){var video=event.target,wrap=video&&video.closest&&video.closest("[data-rz-trim-start]");if(!wrap)return;var start=Number(wrap.getAttribute("data-rz-trim-start"))||0,end=Number(wrap.getAttribute("data-rz-trim-end"))||0;if(start>0&&start<video.duration)video.currentTime=start;if(end>start&&end<video.duration&&video.currentTime>=end)video.currentTime=start;},true);
document.addEventListener("timeupdate",function(event){var video=event.target,wrap=video&&video.closest&&video.closest("[data-rz-trim-start]");if(!wrap)return;var start=Number(wrap.getAttribute("data-rz-trim-start"))||0,end=Number(wrap.getAttribute("data-rz-trim-end"))||0;if(end>start&&video.currentTime>=end)video.currentTime=start;},true);
function bindMediaPicker(fileId,statusId,urlId){
  if(window.RIZORA_MEDIA_BIND) window.RIZORA_MEDIA_BIND(fileId,statusId,urlId);
}
function verified(u){var type=String(u&&u.verificationBadgeType||"");var path={early:"/assets/rizora_verified_early.svg",premium:"/assets/rizora_verified_premium.svg",premium_plus:"/assets/rizora_verified_premium_plus.svg"}[type];var label={early:"Early member",premium:"Premium",premium_plus:"Premium+"}[type];return path?'<img class="rz-verified" src="'+path+'" alt="'+label+' verified badge" title="'+label+' verified badge">':"";}
function toast(s){var t=$("toast");if(!t)return;t.textContent=s;t.classList.add("show");clearTimeout(window.__rt);window.__rt=setTimeout(function(){t.classList.remove("show");},2400);}function popup(title,message,kind){
  var old=document.getElementById("rzGlobalPopup");if(old)old.remove();
  var overlay=document.createElement("div");
  overlay.id="rzGlobalPopup";
  overlay.className="rz-overlay";
  var tone=kind==="error"?"#ff8d9d":kind==="success"?"#bda7ff":"#d9ccff";
  overlay.innerHTML='<div class="rz-modal" role="dialog" aria-modal="true" aria-labelledby="rzPopupTitle" style="max-width:520px;position:relative">'+
    '<button type="button" id="rzPopupClose" class="rz-btn" style="position:absolute;right:14px;top:14px" aria-label="Close popup">&times;</button>'+
    '<div class="rz-kicker" style="color:'+tone+'">RIZORA</div>'+
    '<h2 id="rzPopupTitle" style="margin:8px 42px 8px 0">'+esc(title||"RIZORA")+'</h2>'+
    '<p class="rz-muted" style="line-height:1.7;margin:0 0 18px">'+esc(message||"")+'</p>'+
    '<button type="button" id="rzPopupOkay" class="rz-btn primary">Continue</button>'+
  '</div>';
  document.body.appendChild(overlay);
  var close=function(){overlay.remove();};
  overlay.addEventListener("click",function(e){if(e.target===overlay)close();});
  document.getElementById("rzPopupClose").onclick=close;
  document.getElementById("rzPopupOkay").onclick=close;
  return overlay;
}
window.RIZORA_POPUP=popup;
window.RIZORA_TOAST=toast;
function textPreview(v){var s=String(v||"").trim().replace(/\s+/g," ");return s.slice(0,70)||"Untitled draft";}
function bindPasswordToggles(root){(root||document).querySelectorAll("[data-rz-password-toggle]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-rz-password-toggle"),i=document.getElementById(id);if(!i)return;var show=i.type==="password",label=b.getAttribute("data-rz-password-label")||"password";i.type=show?"text":"password";b.textContent=show?"Hide "+label:"Show "+label;b.setAttribute("aria-label",show?"Hide "+label:"Show "+label);};});}
function getRizoraAuthToken(){return String(window.RIZORA_AUTH_TOKEN||"").trim();}
function setRizoraAuthToken(token){var t=String(token||"").trim();window.RIZORA_AUTH_TOKEN=t;try{localStorage.removeItem("rizora_auth_token");}catch(e){}}
async function api(path,opt){
  opt=opt||{};
  var headers=Object.assign({"Accept":"application/json","Content-Type":"application/json"},opt.headers||{});
  var token=getRizoraAuthToken();
  if(token&&!headers.Authorization)headers.Authorization="Bearer "+token;
  var timeoutMs=Number(opt.timeoutMs);
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)timeoutMs=25000;
  timeoutMs=Math.min(timeoutMs,119000);
  var request=function(h){var controller=typeof AbortController!=="undefined"?new AbortController():null;var timer=controller?setTimeout(function(){controller.abort();},timeoutMs):null;return fetch(API+path,{credentials:"include",mode:"cors",method:opt.method||"GET",headers:h,body:opt.body,signal:opt.signal||controller&&controller.signal}).finally(function(){if(timer)clearTimeout(timer);});};
  var r;
  try{r=await request(headers);}catch(fetchError){
    var networkMessage=fetchError&&fetchError.name==="AbortError"
      ?"RIZORA took too long to respond. Check your connection and try again."
      :"RIZORA could not connect to its service. Check your connection and try again.";
    var networkError=new Error(networkMessage);networkError.code=fetchError&&fetchError.name==="AbortError"?"RIZORA_REQUEST_TIMEOUT":"RIZORA_NETWORK_ERROR";networkError.cause=fetchError;throw networkError;
  }
  // A stale local bearer token must never override a valid HttpOnly session cookie.
  // Retry once without it before surfacing an auth error, so opening a feature cannot
  // log the creator out just because an older token is still in local storage.
  if(r.status===401&&token&&!opt._withoutBearer){
    var cookieHeaders=Object.assign({},headers);
    delete cookieHeaders.Authorization;
    try{r=await request(cookieHeaders);}catch(fetchError){var retryError=new Error(fetchError&&fetchError.name==="AbortError"?"RIZORA took too long to respond. Check your connection and try again.":"RIZORA could not connect to its service. Check your connection and try again.");retryError.code=fetchError&&fetchError.name==="AbortError"?"RIZORA_REQUEST_TIMEOUT":"RIZORA_NETWORK_ERROR";retryError.cause=fetchError;throw retryError;}
  }
  var x=await r.text(),d={};
  try{d=x?JSON.parse(x):{};}catch(e){d={error:x};}
  if(!r.ok){
    // Only the session bootstrap endpoints are allowed to clear local auth state.
    // Feature and permission errors stay in the current workspace and are shown in
    // context instead of forcing a full logout.
    var sessionCheck=path==="/api/auth/me"||path==="/api/v2/me";
    if(r.status===401&&sessionCheck){try{setRizoraAuthToken("");}catch(_){}}
    var err=new Error(d.message||d.error||"Request failed.");err.code=d.code||"";err.status=r.status;throw err;
  }
  return d;
}

window.RIZORA_API_CALL=api;
window.RIZORA_GET_AUTH_TOKEN=getRizoraAuthToken;
window.RIZORA_SET_AUTH_TOKEN=setRizoraAuthToken;
window.RIZORA_CLEAR_AUTH_TOKEN=function(){setRizoraAuthToken("");};
window.RIZORA_AUTH_HEADERS=function(extra){var h=Object.assign({},extra||{}),token=getRizoraAuthToken();if(token&&!h.Authorization)h.Authorization="Bearer "+token;return h;};
window.RIZORA_GOTO=function(view){state.view=String(view||"home");if(state.view==="flow")state.view="discover";shell();load();};

function landing(){
  if(document.body){document.body.classList.remove("rz-public-music-open","rz-auth-page");}
  document.body.innerHTML='<div class="rz-public-shell" id="rzPublicLanding"><header class="rz-public-nav rz-shell"><button class="rz-public-brand" id="publicBrand" type="button"><img src="/rizora-cover.png" alt="RIZORA"><span><strong>RIZORA</strong><small>CREATOR OS</small></span></button><div class="rz-public-nav-actions"><span class="rz-public-status"><i></i> Built for creators</span><button id="landingLogin" class="rz-btn">Log in</button><button id="landingSignup" class="rz-btn primary">Start creating</button></div></header><main><section class="rz-public-hero rz-shell"><div class="rz-public-copy"><div class="rz-kicker">RIZORA / CREATOR OS</div><h1>Build your <em>creative world</em> in one place.</h1><p>Publish, grow, think, share and connect from one calm workspace designed around your momentum.</p><div id="rzPublicCarousel" class="rz-public-carousel" role="region" aria-roledescription="carousel" aria-label="Explore RIZORA features"><div class="rz-public-slide-card"><span id="rzPublicSlideIcon" class="rz-public-slide-icon" aria-hidden="true">✦</span><span id="rzPublicSlideEyebrow" class="rz-public-slide-eyebrow">NOIR ®</span><h2 id="rzPublicSlideTitle">Ideas into action</h2><p id="rzPublicSlideCopy">An AI creative partner for your next idea, image, voice or video.</p></div><div class="rz-public-slide-footer"><div id="rzPublicSlideDots" class="rz-public-slide-dots" role="tablist" aria-label="Feature slides"></div><div class="rz-public-slide-controls"><button type="button" id="rzPublicSlideBack" aria-label="Previous feature">Back</button><button type="button" id="rzPublicSlideSkip">Skip</button><button type="button" id="rzPublicSlideNext" aria-label="Next feature">Next</button></div></div><span id="rzPublicSlideLive" class="rz-sr-only" aria-live="polite"></span></div><div class="rz-actions rz-public-actions"><button id="landingSignupHero" class="rz-btn primary">Start creating <span aria-hidden="true">&rarr;</span></button><button id="landingMusicHero" class="rz-btn">Listen to music</button></div><div class="rz-public-proof"><span><b>AI</b><small>ideas & strategy</small></span><span><b>MUSIC</b><small>make & release</small></span><span><b>GROWTH</b><small>missions & analytics</small></span><span><b>COMMUNITY</b><small>people & live</small></span></div></div><div class="rz-public-stage"><div class="rz-stage-glow"></div><div class="rz-stage-orbit rz-stage-orbit-a"></div><div class="rz-stage-orbit rz-stage-orbit-b"></div><div class="rz-stage-window"><div class="rz-stage-window-top"><span class="rz-stage-dot"></span><span class="rz-stage-dot"></span><span class="rz-stage-dot"></span><span class="rz-stage-window-label">RIZORA COMMAND CENTER</span></div><div class="rz-stage-window-body"><div class="rz-stage-greeting"><div><span class="rz-kicker">TODAY</span><strong>Move one idea forward.</strong></div><span class="rz-stage-live">LIVE</span></div><div class="rz-stage-focus"><div class="rz-stage-focus-icon">✦</div><div><strong>Creator focus</strong><span>Turn your next thought into a release, post or plan.</span></div><button class="rz-stage-mini-button" id="landingInstall" type="button">Install</button></div><div class="rz-stage-cards"><div><span>NOIR ®</span><strong>Ready when you are.</strong><small>Ideas · hooks · strategy</small></div><div><span>MUSIC STUDIO</span><strong>Make it move.</strong><small>Tracks · voice · audio</small></div><div><span>GROWTH</span><strong>+250 points</strong><small>Momentum waiting</small></div></div></div></div></div></section><section class="rz-public-feature-section rz-shell"><div class="rz-public-section-heading"><div><div class="rz-kicker">ONE WORKSPACE</div><h2>Everything your next chapter needs.</h2></div><p>Every feature has a place, every place has a purpose, and the whole system keeps your creative energy moving.</p></div><div class="rz-public-feature-grid"><button class="rz-public-feature rz-public-feature-ai" data-public-action="ai"><span class="rz-public-feature-number">01</span><strong>Think with NOIR ®</strong><small>Get creator-aware ideas, hooks, content direction, analysis and voice playback without losing your own point of view.</small><b>Open intelligence <span aria-hidden="true">&rarr;</span></b></button><button class="rz-public-feature rz-public-feature-music" data-public-action="music"><span class="rz-public-feature-number">02</span><strong>Make and release music</strong><small>Create music and voiceovers, polish audio, and prepare release drafts in one workspace.</small><b>Enter Music Studio <span aria-hidden="true">&rarr;</span></b></button><button class="rz-public-feature rz-public-feature-grow" data-public-action="grow"><span class="rz-public-feature-number">03</span><strong>Turn consistency into growth</strong><small>Use missions, Boosts, referrals, analytics, collaborations and experiments to build real momentum.</small><b>Build momentum <span aria-hidden="true">&rarr;</span></b></button><button class="rz-public-feature rz-public-feature-community" data-public-action="community"><span class="rz-public-feature-number">04</span><strong>Find your people</strong><small>Post, message, go live, join communities, discover opportunities and keep your audience close.</small><b>Find your circle <span aria-hidden="true">&rarr;</span></b></button></div></section><section class="rz-public-trust rz-shell"><div><div class="rz-kicker">OFFICIAL SIGNAL</div><h2>Built by a creator, for creators.</h2><p>RIZORA is the Creator OS from RoMi Noir: a social, intelligence, music and growth platform built to help you make the work and move it forward.</p></div><div class="rz-public-trust-card"><img src="/assets/rizora_verified_badge.svg" alt="RIZORA Verified"><div><strong>RIZORA · @rizora</strong><span>Official verified platform account</span></div></div><div class="rz-public-trust-card"><img src="/assets/rizora_verified_badge.svg" alt="RIZORA Verified Creator"><div><strong>RoMi · @romi.noir</strong><span>Founder · artist · developer · creator</span></div></div></section><section class="rz-public-cta rz-shell"><div><div class="rz-kicker">YOUR NEXT MOVE</div><h2>Make something worth coming back to.</h2><p>Open your Creator OS and keep the whole journey in one place.</p></div><div class="rz-actions"><button id="landingSignupCta" class="rz-btn primary">Create your account</button><button id="landingAdvertise" class="rz-btn">Work with RIZORA</button></div></section></main><footer class="rz-public-footer rz-shell"><span class="rz-public-footer-copy"><strong>New features are coming</strong>© 2026 RIZORA. All rights reserved. Owned by RoMi Noir.</span><button id="landingLegacyInstall" class="rz-btn" type="button">Install RIZORA</button></footer></div>';
  var guestMarkup='<div id="rzPublicMusic" class="rz-public-music" hidden><div class="rz-public-music-backdrop" data-rz-guest-close></div><section class="rz-public-music-dialog" role="dialog" aria-modal="true" aria-labelledby="rzPublicMusicTitle" tabindex="-1"><header class="rz-public-music-heading"><div><span class="rz-kicker">RIZORA / LISTEN</span><h2 id="rzPublicMusicTitle">RIZORA PLAY</h2><p>Search RIZORA releases and Audius tracks here. Create an account to download RIZORA releases.</p></div><button type="button" class="rz-btn" data-rz-guest-close aria-label="Close music player">Close</button></header><div id="rzsMusicPlayer" class="rzp-shell" data-rzp-guest-mode="1"><header class="rzp-top"><div><span class="rzp-brand">RIZORA PLAY ®</span><h3>Feel the vibe. Own the sound.</h3></div><label class="rzp-search">⌕ <input id="rzpSearch" type="search" placeholder="Search songs, artists or albums" aria-label="Search songs, artists or albums"></label></header><p class="rzp-search-caption">Search RIZORA releases and Audius tracks from the same bar.</p><div class="rzp-layout"><aside class="rzp-library"><div class="rzp-side-title"><strong>Your Library</strong></div><button type="button" class="rzp-library-item active" data-rzp-view="all"><span>♫</span><span><b>RIZORA Catalog</b><small>Public releases</small></span></button><button type="button" class="rzp-library-item" data-rzp-view="liked"><span>♥</span><span><b>Liked Songs</b><small>Saved on this device</small></span></button><button type="button" class="rzp-library-item" data-rzp-view="albums"><span>▦</span><span><b>Albums</b><small>Browse artwork</small></span></button></aside><main class="rzp-center"><div class="rzp-playlist-hero"><div class="rzp-playlist-art" aria-hidden="true">♫</div><div><span>RIZORA PLAY</span><h4>Listen before you join</h4><p>Full RIZORA release downloads are available after you create an account.</p></div></div><div class="rzp-center-heading"><div><span>YOUR LISTENING ROOM</span><h4>Track list</h4></div><button type="button" id="rzpRetry" class="rzp-refresh">Refresh</button></div><div id="rzpStatus" class="rzp-status" role="status" aria-live="polite"></div><div id="rzpTrackList" class="rzp-track-list"><div class="rzp-empty">Loading RIZORA music…</div></div></main><aside class="rzp-queue"><div class="rzp-side-title"><div><span>UP NEXT</span><strong>Queue</strong></div></div><div class="rzp-now"><div id="rzpNowArt" class="rzp-now-art"><span>♫</span></div><div><small>NOW PLAYING</small><strong id="rzpNowTitle">Choose a track</strong><span id="rzpNowArtist">RIZORA player</span></div><button type="button" id="rzpNowLike" class="rzp-heart" aria-label="Like current track" disabled>♡</button></div><div id="rzpQueueList" class="rzp-queue-list"><p class="rzp-empty">Your queue is clear. Add a track with ＋.</p></div></aside></div><footer class="rzp-dock"><div class="rzp-dock-track"><div id="rzpDockArt" class="rzp-dock-art"><span>♫</span></div><div><strong id="rzpDockTitle">Choose a track</strong><small id="rzpDockArtist">RIZORA PLAY</small></div></div><div class="rzp-transport"><div class="rzp-transport-buttons"><button type="button" id="rzpShuffle" aria-label="Shuffle">⤨</button><button type="button" id="rzpPrevious" aria-label="Previous track">|◀</button><button type="button" id="rzpPlayPause" class="rzp-play" aria-label="Play">▶</button><button type="button" id="rzpNext" aria-label="Next track">▶|</button><button type="button" id="rzpRepeat" aria-label="Repeat" aria-pressed="false">↻</button></div><div class="rzp-progress-row"><span id="rzpElapsed">0:00</span><input type="range" id="rzpProgress" min="0" max="100" value="0" aria-label="Track position"><span id="rzpDuration">0:00</span></div></div><label class="rzp-volume">◖ <input type="range" id="rzpVolume" min="0" max="1" step="0.01" value="0.75" aria-label="Volume"></label></footer></div></section></div>';
  document.getElementById("rzPublicLanding").insertAdjacentHTML("beforeend",guestMarkup);
  var guestMusic=$("rzPublicMusic"),musicButton=$("landingMusicHero"),guestSearch=$("rzpSearch");
  function closeGuestMusic(){if(!guestMusic)return;if(window.RIZORA_PLAYER&&window.RIZORA_PLAYER.isAd)return;if(window.RIZORA_PLAYER&&window.RIZORA_PLAYER.audio)window.RIZORA_PLAYER.audio.pause();guestMusic.hidden=true;document.body.classList.remove("rz-public-music-open");if(musicButton)musicButton.focus();}
  function openGuestMusic(){if(!guestMusic)return;guestMusic.hidden=false;document.body.classList.add("rz-public-music-open");if(window.RIZORA_PLAYER&&window.RIZORA_PLAYER.wire)window.RIZORA_PLAYER.wire(document);setTimeout(function(){if(guestSearch)guestSearch.focus();},30);}
  if(musicButton)musicButton.onclick=openGuestMusic;
  if(guestMusic){guestMusic.querySelectorAll("[data-rz-guest-close]").forEach(function(button){button.onclick=closeGuestMusic;});guestMusic.addEventListener("keydown",function(event){if(event.key==="Escape"){event.preventDefault();closeGuestMusic();}});}
  window.RIZORA_GUEST_DOWNLOAD=function(){closeGuestMusic();openAuth("signup");};
  function openAuth(mode){state.authMode=mode;auth();}
  ['landingSignup','landingSignupHero','landingSignupCta'].forEach(function(id){var el=$(id);if(el)el.onclick=function(){openAuth('signup');};});
  ['landingLogin'].forEach(function(id){var el=$(id);if(el)el.onclick=function(){openAuth('login');};});
  ['landingInstall','landingLegacyInstall'].forEach(function(id){var el=$(id);if(el)el.onclick=function(){if(window.RIZORA_SUITE&&window.RIZORA_SUITE.install){window.RIZORA_SUITE.install();}else if(window.RIZORA_SUITE_PROMPT){window.RIZORA_SUITE_PROMPT.prompt();window.RIZORA_SUITE_PROMPT=null;}else{toast('Use your browser menu to install RIZORA.');}};});
  var brand=$('publicBrand');if(brand)brand.onclick=function(){window.scrollTo({top:0,behavior:'smooth'});};
  (function(){var carousel=$('rzPublicCarousel');if(!carousel)return;var slides=[
    {icon:"✦",eyebrow:"NOIR ®",title:"Ideas into action",copy:"Create images, shape ideas, and build a voice or video concept with NOIR ®."},
    {icon:"♫",eyebrow:"MUSIC STUDIO",title:"Make your sound yours",copy:"Create, record, mix, master, and find music from one listening room."},
    {icon:"◎",eyebrow:"CREATOR COMMUNITY",title:"Find your people",copy:"Share your work, message creators, follow, and build a real audience."},
    {icon:"↗",eyebrow:"CREATOR GROWTH",title:"Turn momentum into progress",copy:"Plan your next move with missions, analytics, collaborations, and creator tools."}
  ];var index=0,timer=null,live=$('rzPublicSlideLive'),icon=$('rzPublicSlideIcon'),eyebrow=$('rzPublicSlideEyebrow'),title=$('rzPublicSlideTitle'),copy=$('rzPublicSlideCopy'),dots=$('rzPublicSlideDots'),next=$('rzPublicSlideNext'),back=$('rzPublicSlideBack'),skip=$('rzPublicSlideSkip');
    if(dots)dots.innerHTML=slides.map(function(_,i){return '<button type="button" data-rz-slide-index="'+i+'" aria-label="Show feature '+(i+1)+'" role="tab"></button>';}).join('');
    function show(nextIndex,announce){index=(nextIndex+slides.length)%slides.length;var item=slides[index];if(icon)icon.textContent=item.icon;if(eyebrow)eyebrow.textContent=item.eyebrow;if(title)title.textContent=item.title;if(copy)copy.textContent=item.copy;if(live&&announce)live.textContent=item.eyebrow+": "+item.title+". "+item.copy;if(dots)dots.querySelectorAll('button').forEach(function(dot,i){dot.classList.toggle('active',i===index);dot.setAttribute('aria-selected',i===index?'true':'false');});}
    function schedule(){if(timer)clearInterval(timer);if(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;timer=setInterval(function(){if(document.visibilityState==='visible'&&!carousel.matches(':focus-within'))show(index+1,false);},5200);}
    function move(by){show(index+by,true);schedule();}
    if(next)next.onclick=function(){move(1);};if(back)back.onclick=function(){move(-1);};if(skip)skip.onclick=function(){openAuth('signup');};if(dots)dots.addEventListener('click',function(e){var dot=e.target.closest('[data-rz-slide-index]');if(dot){show(Number(dot.getAttribute('data-rz-slide-index')),true);schedule();}});
    carousel.addEventListener('keydown',function(e){if(e.key==='ArrowRight'){e.preventDefault();move(1);}else if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}});
    var touchX=null;carousel.addEventListener('touchstart',function(e){touchX=e.changedTouches[0].clientX;},{passive:true});carousel.addEventListener('touchend',function(e){if(touchX===null)return;var delta=e.changedTouches[0].clientX-touchX;touchX=null;if(Math.abs(delta)>44)move(delta<0?1:-1);},{passive:true});
    carousel.addEventListener('mouseenter',function(){if(timer)clearInterval(timer);});carousel.addEventListener('mouseleave',schedule);document.addEventListener('visibilitychange',schedule);show(0,false);schedule();
  })();
  document.querySelectorAll('[data-public-action]').forEach(function(button){button.onclick=function(){var action=button.getAttribute('data-public-action');if(action==='music'){openGuestMusic();return;}if(action==='ai'){openAuth('login');return;}if(action==='grow'||action==='community'){openAuth('signup');}};});
}
function auth(){
  var mode=state.authMode==="signup"?"signup":"login",otpMode=false,pending=null,countdown=0,countdownTimer=null,turnstileToken="",turnstileWidget=null;
  document.body.classList.add("rz-auth-page");
  window.RIZORA_TURNSTILE_TOKEN="";
  var recoveryParams=new URLSearchParams(String(location.hash||"").replace(/^#/,"")),recoveryToken=recoveryParams.get("access_token"),isRecovery=recoveryParams.get("type")==="recovery"&&!!recoveryToken;
  document.body.innerHTML='<div class="rz-auth"><div class="rz-auth-card"><a id="backLanding" class="rz-auth-link" href="/">Back to RIZORA</a><div class="rz-brand"><img src="/rizora-cover.png" alt="RIZORA"><div>RIZORA<small>CREATOR OS</small></div></div><h1 id="authHeading">'+(isRecovery?'Choose a new password':'Everything for creators.')+'</h1><p id="authIntro" class="rz-muted">'+(isRecovery?'Secure your RIZORA account.':'Social. Growth. AI. Community.')+'</p><div id="authTabs" class="rz-auth-switch">'+(mode==="login"?'Don’t have an account? <a id="tabSignup" class="rz-auth-link" href="#signup">Sign up</a>':'Already have an account? <a id="tabLogin" class="rz-auth-link" href="#login">Log in</a>')+'</div><form id="authForm"><div id="loginBox"><div class="rz-field"><label class="rz-label" for="loginChannel">Continue with</label><select id="loginChannel" class="rz-input"><option value="email">Email</option><option value="sms">Phone number</option></select></div><div class="rz-field"><label id="loginIdentifierLabel" class="rz-label" for="identifier">Email address</label><input id="identifier" class="rz-input" type="text" autocomplete="username" placeholder="Your username, email or phone number" required></div><div id="passwordGroup" class="rz-field"><label class="rz-label" for="password">Password</label><div style="display:flex;gap:8px;align-items:center"><input id="password" class="rz-input" type="password" autocomplete="current-password" required style="flex:1"><button type="button" class="rz-btn" data-rz-password-toggle="password" data-rz-password-label="password" aria-label="Show password">Show password</button></div></div><div id="loginLinks" class="rz-auth-links"><a id="loginCode" class="rz-auth-link" href="#code">Use a sign-in code</a><a id="forgotPassword" class="rz-auth-link" href="#forgot-password">Forgot password?</a></div></div><div id="signupBox" hidden></div><section id="forgotPasswordBox" class="rz-forgot-box" hidden><h2>Forgot password?</h2><p class="rz-muted">Enter the email address on your RIZORA account and we’ll send a reset link.</p><div class="rz-field"><label class="rz-label" for="resetEmail">Email address</label><input id="resetEmail" class="rz-input" type="email" autocomplete="email" placeholder="name@example.com" required></div><button id="sendResetLink" type="button" class="rz-btn primary" style="width:100%">Send Reset Link</button><a id="backToLogin" class="rz-auth-link" href="#login">Back to Login</a></section><section id="otpBox" class="rz-otp-box" hidden><p id="otpDestination" class="rz-muted" role="status" aria-live="polite"></p><div class="rz-otp-grid" aria-label="Enter the verification code">'+[0,1,2,3,4,5].map(function(i){return '<input class="rz-input" data-otp-index="'+i+'" inputmode="numeric" maxlength="1" autocomplete="'+(i===0?'one-time-code':'off')+'" aria-label="Verification digit '+(i+1)+'">';}).join("")+'</div><div id="resetPasswordFields" hidden><div class="rz-field"><label class="rz-label" for="resetPassword">New password</label><input id="resetPassword" class="rz-input" type="password" autocomplete="new-password"></div><div class="rz-field"><label class="rz-label" for="resetPasswordConfirm">Confirm new password</label><input id="resetPasswordConfirm" class="rz-input" type="password" autocomplete="new-password"></div></div><button id="verifyOtp" type="button" class="rz-btn primary" style="width:100%">Verify code</button><div class="rz-auth-links"><span class="rz-muted">Didn’t get code?</span> <a id="resendOtp" class="rz-auth-link is-disabled" href="#resend" aria-disabled="true" tabindex="-1">Resend code in 00:30</a> · <a id="changeContact" class="rz-auth-link" href="#change-details">Change details</a></div></section><div id="turnstileWidget" class="rz-turnstile" aria-label="Cloudflare security check"></div><button id="authSubmit" class="rz-btn primary" style="width:100%">Log in</button><div id="authDivider" class="rz-divider">OR</div><div id="socialAuthButtons"><div id="googleButton"></div></div><div id="authStatus" class="rz-mini" role="status" aria-live="polite"></div><div id="authError" class="rz-error" role="alert"></div></form></div><footer class="rz-site-footer rz-auth-footer"><strong class="rz-auth-footer-heading">New features are coming</strong><span class="rz-auth-footer-copy">© 2026 RIZORA. All rights reserved. Owned by RoMi Noir.</span><nav class="rz-auth-footer-links" aria-label="Legal information"><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/copyright">Copyright</a></nav></footer></div>';
  bindPasswordToggles(document.getElementById("authForm"));
  $("backLanding").onclick=function(event){event.preventDefault();landing();};
  if($("tabLogin"))$("tabLogin").onclick=function(event){event.preventDefault();state.authMode="login";auth();};
  if($("tabSignup"))$("tabSignup").onclick=function(event){event.preventDefault();state.authMode="signup";auth();};

  if(isRecovery){
    $("authTabs").hidden=true;$("loginBox").innerHTML='<div class="rz-field"><label class="rz-label" for="recoveryPassword">New password</label><input id="recoveryPassword" class="rz-input" type="password" autocomplete="new-password" required></div><div class="rz-field"><label class="rz-label" for="recoveryPasswordConfirm">Confirm new password</label><input id="recoveryPasswordConfirm" class="rz-input" type="password" autocomplete="new-password" required></div>';$("loginBox").hidden=false;$("authDivider").hidden=true;$("socialAuthButtons").hidden=true;$("turnstileWidget").hidden=true;
    $("authSubmit").textContent="Update password";$("authForm").onsubmit=async function(event){event.preventDefault();var password=$("recoveryPassword").value;if(password!==$("recoveryPasswordConfirm").value){$("authError").textContent="Passwords do not match.";return;}if(password.length<8||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)){$("authError").textContent="Use at least 8 characters with uppercase, lowercase and a number.";return;}try{await api("/api/auth/reset-password",{method:"POST",body:JSON.stringify({accessToken:recoveryToken,password:password})});history.replaceState(null,"",location.pathname);toast("Password updated. Sign in with your new password.");state.authMode="login";auth();}catch(error){$("authError").textContent=error.message||"The reset link has expired. Request a new one.";}};return;
  }
  if(mode==="signup"){
    $("loginBox").hidden=true;$("authDivider").hidden=false;$("socialAuthButtons").hidden=false;
    $("signupBox").hidden=false;
    $("signupBox").innerHTML='<div class="rz-field"><label class="rz-label" for="username">Username</label><input id="username" class="rz-input" autocomplete="username" maxlength="30" required></div><div class="rz-field"><label class="rz-label" for="displayName">Display name</label><input id="displayName" class="rz-input" maxlength="80" autocomplete="name"></div><div class="rz-field"><label class="rz-label" for="signupChannel">Sign up with</label><select id="signupChannel" class="rz-input"><option value="email">Email</option><option value="sms">Phone number</option></select></div><div id="signupEmailWrap" class="rz-field"><label class="rz-label" for="email">Email address</label><input id="email" class="rz-input" type="email" autocomplete="email" placeholder="name@example.com"></div><div id="signupPhoneWrap" class="rz-field" hidden><label class="rz-label" for="phone">Phone number</label><input id="phone" class="rz-input" type="tel" autocomplete="tel" placeholder="+2348012345678"><small class="rz-mini">Include your country calling code. Your number stays private.</small></div><div class="rz-field"><label class="rz-label" for="signupPassword">Password</label><div style="display:flex;gap:8px;align-items:center"><input id="signupPassword" class="rz-input" type="password" autocomplete="new-password" required style="flex:1"><button type="button" class="rz-btn" data-rz-password-toggle="signupPassword" data-rz-password-label="password" aria-label="Show password">Show password</button></div></div><div class="rz-field"><label class="rz-label" for="confirmPassword">Confirm password</label><input id="confirmPassword" class="rz-input" type="password" autocomplete="new-password" required></div><p class="rz-auth-legal">By continuing, you agree to <a class="rz-auth-link" href="/terms">Terms</a> and <a class="rz-auth-link" href="/privacy">Privacy</a>.</p>';
    bindPasswordToggles(document.getElementById("signupBox"));
    $("signupChannel").onchange=function(){var phone=this.value==="sms";$("signupEmailWrap").hidden=phone;$("signupPhoneWrap").hidden=!phone;$("email").required=!phone;$("phone").required=phone;};
    $("signupChannel").onchange();$("authSubmit").textContent="Send verification code";
  }else{
    $("signupBox").hidden=true;
    var usernameOption=document.createElement("option");usernameOption.value="username";usernameOption.textContent="Username";$("loginChannel").insertBefore(usernameOption,$("loginChannel").firstChild);$("loginChannel").value="username";$("loginChannel").onchange=function(){var phone=this.value==="sms",username=this.value==="username";$("identifier").type=phone?"tel":username?"text":"email";$("identifier").inputMode=phone?"tel":username?"text":"email";$("identifier").placeholder=phone?"+2348012345678":username?"Your RIZORA username":"name@example.com";$("loginIdentifierLabel").textContent=phone?"Phone number (include country code)":username?"Username":"Email address";};
    $("loginChannel").onchange();
  }
  function resetChallenge(){turnstileToken="";window.RIZORA_TURNSTILE_TOKEN="";if(turnstileWidget!==null&&window.turnstile&&window.turnstile.reset){try{window.turnstile.reset(turnstileWidget);}catch(_){}}}
  function loadChallenge(){api("/api/auth/provider-config").then(function(response){var providers=response.providers||{};if(!providers.challenge||!providers.turnstileSiteKey)return;var script=document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/"]');function renderWidget(){if(!window.turnstile||turnstileWidget!==null)return;try{turnstileWidget=window.turnstile.render($("turnstileWidget"),{sitekey:providers.turnstileSiteKey,theme:"auto",callback:function(token){turnstileToken=token;window.RIZORA_TURNSTILE_TOKEN=token;},"expired-callback":function(){turnstileToken="";window.RIZORA_TURNSTILE_TOKEN="";},"error-callback":function(){turnstileToken="";window.RIZORA_TURNSTILE_TOKEN="";}});}catch(_){}}if(window.turnstile){renderWidget();return;}if(!script){script=document.createElement("script");script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";script.async=true;script.defer=true;document.head.appendChild(script);}script.addEventListener("load",renderWidget,{once:true});}).catch(function(){});}
  loadChallenge();
  function currentContact(){var channel=mode==="signup"?$("signupChannel").value:$("loginChannel").value;var value=mode==="signup"?($("signupChannel").value==="sms"?$("phone").value:$("email").value):$("identifier").value;return{channel:channel,username:mode!=="signup"&&channel==="username"?String(value||"").trim().replace(/^@/,"").toLowerCase():"",phone:channel==="sms"?String(value||"").trim():"",email:channel==="email"?String(value||"").trim().toLowerCase():""};}
  async function requestCode(intent){
    $("authError").textContent="";$("authStatus").textContent="";var contact=currentContact();
    if(!contact.phone&&!contact.email&&!contact.username){$("authError").textContent=contact.channel==="username"?"Enter your username.":contact.channel==="sms"?"Enter your phone number.":"Enter your email address.";return;}
    var payload=Object.assign({intent:intent,channel:contact.channel,turnstileToken:turnstileToken},contact);
    if(intent==="signup"){payload.username=$("username").value;payload.displayName=$("displayName").value;payload.password=$("signupPassword").value;payload.confirmPassword=$("confirmPassword").value;}
    try{var result=await api("/api/auth/otp/send",{method:"POST",body:JSON.stringify(payload)});pending={intent:intent,channel:contact.channel,email:contact.email,phone:contact.phone,username:mode==="signup"?$("username").value:contact.username,displayName:mode==="signup"?$("displayName").value:"",password:intent==="signup"?$("signupPassword").value:"",confirmPassword:intent==="signup"?$("confirmPassword").value:""};$("loginBox").hidden=true;$("signupBox").hidden=true;$("authSubmit").hidden=true;$("authDivider").hidden=true;$("socialAuthButtons").hidden=true;$("otpBox").hidden=false;if(intent==="password_reset")$("resetPasswordFields").hidden=false;$("otpDestination").textContent=result.message||"Enter the verification code we sent.";$("authStatus").textContent="Codes expire after a short time. If you do not see it, check your spam folder.";resetChallenge();startCountdown();var first=$("otpBox").querySelector('[data-otp-index="0"]');if(first)first.focus();}catch(error){$("authError").textContent=error.message||"The code could not be sent. Try again.";resetChallenge();}
  }
  function startCountdown(){if(countdownTimer)clearInterval(countdownTimer);countdown=30;var button=$("resendOtp");function update(){var waiting=countdown>0;button.textContent=waiting?"Resend code in 00:"+String(countdown).padStart(2,"0"):"Resend code";button.classList.toggle("is-disabled",waiting);button.setAttribute("aria-disabled",waiting?"true":"false");button.tabIndex=waiting?-1:0;}update();countdownTimer=setInterval(function(){countdown=Math.max(0,countdown-1);update();if(!countdown){clearInterval(countdownTimer);countdownTimer=null;}},1000);}
  var otpInputs=Array.prototype.slice.call(document.querySelectorAll("[data-otp-index]"));
  otpInputs.forEach(function(input,index){input.addEventListener("input",function(){var digits=String(input.value||"").replace(/\D/g,"");if(digits.length>1){digits.slice(0,6-index).split("").forEach(function(digit,offset){if(otpInputs[index+offset])otpInputs[index+offset].value=digit;});var next=otpInputs[Math.min(5,index+digits.length)];if(next)next.focus();}else{input.value=digits.slice(-1);if(input.value&&otpInputs[index+1])otpInputs[index+1].focus();}});input.addEventListener("keydown",function(event){if(event.key==="Backspace"&&!input.value&&otpInputs[index-1])otpInputs[index-1].focus();});input.addEventListener("paste",function(event){var text=(event.clipboardData||window.clipboardData).getData("text").replace(/\D/g,"").slice(0,6);if(!text)return;event.preventDefault();text.split("").forEach(function(digit,i){if(otpInputs[i])otpInputs[i].value=digit;});otpInputs[Math.min(5,text.length-1)].focus();});});
  async function verifyCode(){if(!pending)return;$("authError").textContent="";var code=otpInputs.map(function(input){return input.value;}).join("");if(!/^\d{6}$/.test(code)){$("authError").textContent="Enter all six digits from your message.";return;}var payload={intent:pending.intent,channel:pending.channel,email:pending.email,phone:pending.phone,code:code,username:pending.username,displayName:pending.displayName,password:pending.password,confirmPassword:pending.confirmPassword};if(pending.intent==="password_reset"){payload.password=$("resetPassword").value;payload.confirmPassword=$("resetPasswordConfirm").value;}
    try{var result=await api("/api/auth/otp/verify",{method:"POST",body:JSON.stringify(payload)});if(result.token){await finishAuth(result,pending.intent);return;}$("authStatus").textContent=result.message||"Code verified.";}catch(error){$("authError").textContent=error.message||"That code did not work. Try again.";}}
  async function finishAuth(result,intent){if(result.token)setRizoraAuthToken(result.token);state.user=result.user;window.RIZORA_CURRENT_USER=state.user;try{sessionStorage.removeItem("rz_premium_suggestion_dismissed");}catch(_){}var loaded=await load();if(loaded!==true)throw new Error("Your sign-in succeeded, but RIZORA could not restore the session. Refresh and try again.");if(intent==="signup"){if(window.RIZORA_POPUP)window.RIZORA_POPUP("Welcome to RIZORA","@"+(state.user.publicUsername||state.user.username)+" is now live.","success");else toast("Welcome to RIZORA.");}else if(intent==="password_reset")toast("Password updated. You are signed in.");else toast("Welcome back to RIZORA.");}
  $("verifyOtp").onclick=verifyCode;$("resendOtp").onclick=function(event){event.preventDefault();if(countdown===0&&pending)requestCode(pending.intent);};$("changeContact").onclick=function(event){event.preventDefault();if(countdownTimer)clearInterval(countdownTimer);pending=null;$("otpBox").hidden=true;$("loginBox").hidden=mode==="signup";$("signupBox").hidden=mode!=="signup";$("authSubmit").hidden=false;$("authDivider").hidden=false;$("socialAuthButtons").hidden=false;otpInputs.forEach(function(input){input.value="";});$("authStatus").textContent="";};
  if(mode==="signup")$("authForm").onsubmit=function(event){event.preventDefault();requestCode("signup");};
  else{
    $("loginCode").onclick=function(event){event.preventDefault();otpMode=!otpMode;$("passwordGroup").hidden=otpMode;$("forgotPassword").hidden=otpMode;$("loginCode").textContent=otpMode?"Use password instead":"Use a sign-in code";$("authSubmit").textContent=otpMode?"Send sign-in code":"Log in";};
    $("forgotPassword").onclick=function(event){event.preventDefault();$("authHeading").textContent="Reset your password";$("authIntro").textContent="We’ll send a secure password reset link to your email.";$("authTabs").hidden=true;$("loginBox").hidden=true;$("signupBox").hidden=true;$("forgotPasswordBox").hidden=false;$("authSubmit").hidden=true;$("authDivider").hidden=true;$("socialAuthButtons").hidden=true;$("authError").textContent="";$("authStatus").textContent="";$("resetEmail").value=currentContact().email||"";$("resetEmail").focus();$("resetEmail").onkeydown=function(key){if(key.key==="Enter"){key.preventDefault();$("sendResetLink").click();}};};$("backToLogin").onclick=function(event){event.preventDefault();$("forgotPasswordBox").hidden=true;$("authTabs").hidden=false;$("loginBox").hidden=false;$("authSubmit").hidden=false;$("authDivider").hidden=false;$("socialAuthButtons").hidden=false;$("authHeading").textContent="Everything for creators.";$("authIntro").textContent="Social. Growth. AI.";$("authError").textContent="";$("authStatus").textContent="";};$("sendResetLink").onclick=async function(){var email=String($("resetEmail").value||"").trim().toLowerCase();$("authError").textContent="";$("authStatus").textContent="";if(!email){$("authError").textContent="Enter the email address on your account.";$("resetEmail").focus();return;}try{await api("/api/auth/forgot-password",{method:"POST",body:JSON.stringify({email:email,turnstileToken:turnstileToken})});$("authStatus").textContent="Check your email for a secure password reset link. If the address matches an account, the message is on its way.";resetChallenge();}catch(error){$("authError").textContent=error.message||"The reset link could not be sent.";resetChallenge();}};
    $("authForm").onsubmit=async function(event){event.preventDefault();if(otpMode){requestCode("login");return;}$("authError").textContent="";try{var contact=currentContact(),payload={identifier:contact.username||contact.phone||contact.email,password:$("password").value,turnstileToken:turnstileToken};var twoFactor=$("twoFactorCode");if(twoFactor)payload.twoFactorCode=twoFactor.value;var result=await api("/api/auth/login",{method:"POST",body:JSON.stringify(payload)});await finishAuth(result,"login");}catch(error){if(error.code==="TWO_FACTOR_REQUIRED"||error.code==="TWO_FACTOR_INVALID"){if(!$("twoFactorCode")){var wrap=document.createElement("div");wrap.className="rz-field";wrap.id="twoFactorWrap";wrap.innerHTML='<label class="rz-label">Authenticator code</label><input id="twoFactorCode" class="rz-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit code" required>';$("password").parentElement.after(wrap);}$("authError").textContent=error.code==="TWO_FACTOR_INVALID"?"That authenticator code is invalid. Try again.":"Enter the 6-digit authenticator code to continue.";$("twoFactorCode").focus();}else $("authError").textContent=error.message||"Sign-in failed. Try again.";resetChallenge();}};
  }
  googleButton();
}
function googleButton(){
  var mount=$("googleButton");
  if(!mount)return;
  mount.innerHTML='<div class="rz-google-status" role="status">Checking Google sign-in…</div>';
  var loadGoogleScript=function(){return new Promise(function(resolve,reject){if(window.google&&google.accounts&&google.accounts.id){resolve();return;}var script=document.querySelector('script[src^="https://accounts.google.com/gsi/client"]');if(!script){script=document.createElement("script");script.src="https://accounts.google.com/gsi/client";script.async=true;script.defer=true;document.head.appendChild(script);}var done=false,finish=function(error){if(done)return;done=true;error?reject(error):resolve();};script.addEventListener("load",function(){finish();},{once:true});script.addEventListener("error",function(){finish(new Error("Google sign-in could not load."));},{once:true});setTimeout(function(){finish(new Error("Google sign-in timed out."));},10000);});};
  api("/api/auth/google/config").then(function(c){
    if(!c.enabled||!c.clientId){mount.innerHTML='<div class="rz-google-status">Google sign-in is not configured on RIZORA yet. Use your password login.</div>';return null;}
    return loadGoogleScript().then(function(){
      if(!(window.google&&google.accounts&&google.accounts.id))throw new Error("Google sign-in is unavailable in this browser.");
      mount.innerHTML="";
      google.accounts.id.initialize({client_id:c.clientId,callback:function(r){
          if(!r||!r.credential){$("authError").textContent="Google did not return a sign-in credential. Try again.";return;}
          api("/api/auth/google",{method:"POST",body:JSON.stringify({credential:r.credential,turnstileToken:window.RIZORA_TURNSTILE_TOKEN||""})}).then(function(d){
            if(d.token)setRizoraAuthToken(d.token);
            state.user=d.user;
            window.RIZORA_CURRENT_USER=state.user;
            return load().then(function(){
              if(d.created){
                var emailInfo=d.emailDelivery||{};
                var emailText=emailInfo.configured
                  ? "Your welcome email has been queued for "+(state.user.email||"your registered email address")+"."
                  : "Your account is live. Email delivery is still waiting for the RIZORA email provider.";
                if(window.RIZORA_POPUP)window.RIZORA_POPUP("Welcome to RIZORA","@"+(state.user.publicUsername||state.user.username)+" is now live with Google. "+emailText,"success");
                else toast("Welcome to RIZORA.");
              }else{
                toast("Welcome back to RIZORA.");
              }
            });
          }).catch(function(e){$("authError").textContent=e.message||"Google sign-in failed. Try your password instead.";});
        }});
        google.accounts.id.renderButton(mount,{theme:"outline",size:"large",width:320,text:"continue_with",shape:"rectangular"});
    });
  }).catch(function(e){mount.innerHTML='<div class="rz-google-status">Google sign-in is temporarily unavailable. Use your password login.</div>';});
}
function shell(){
  document.body.classList.remove("rz-auth-page");
  function navIcon(name){var icons={home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',studio:'<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',flow:'<rect x="3" y="3" width="18" height="18" rx="6"/><path d="M12 7v10M7 12h10"/>',discover:'<circle cx="12" cy="12" r="9"/><path d="m15.8 8.2-2.6 5-5 2.6 2.6-5z"/>',live:'<circle cx="12" cy="12" r="3"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8m12.8-12.8a9 9 0 0 1 0 12.8M2.8 2.8a13 13 0 0 0 0 18.4m18.4-18.4a13 13 0 0 1 0 18.4"/>',notifications:'<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',messages:'<path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 9 9 0 0 1-4-.9L4 20l1.1-3.7A7.3 7.3 0 0 1 4 12c0-4.1 3.6-7.5 8-7.5s8 3.1 8 7z"/>',grow:'<path d="M4 19V5m0 14h17M7 15l4-4 3 2 6-7"/>',ai:'<path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'};return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.home)+'</svg>';}
  var desktopItems=[
    {id:"home",label:"Home",icon:"home",group:"WORKSPACE"},
    {id:"studio",label:"Music Studio",icon:"studio",group:"WORKSPACE"},

    {id:"discover",label:"Discover",icon:"discover",group:"WORKSPACE"},
    {id:"live",label:"Live",icon:"live",group:"COMMUNITY"},
    {id:"notifications",label:"Notifications",icon:"notifications",group:"COMMUNITY"},
    {id:"messages",label:"Messages",icon:"messages",group:"COMMUNITY"},
    {id:"grow",label:"Grow",icon:"grow",group:"CREATOR TOOLS"},
    {id:"ai",label:"NOIR ®",icon:"ai",group:"CREATOR TOOLS"},
    {id:"profile",label:"Profile",icon:"profile",group:"ACCOUNT"}
  ];
  var side="",activeGroup="";
  desktopItems.forEach(function(item){
    if(item.group!==activeGroup){activeGroup=item.group;side+='<div class="rz-xnav-heading">'+activeGroup+'</div>';}
    side+='<button class="rz-xnav-item '+(state.view===item.id?"active":"")+'" data-nav="'+item.id+'"><span class="rz-xnav-icon">'+navIcon(item.icon)+'</span><span>'+item.label+'</span></button>';
  });
  var mobile=[
    {id:"home",label:"Home",icon:"home"},
    {id:"discover",label:"Discover",icon:"discover"},
    {id:"create",label:"Create",icon:"flow"},
    {id:"messages",label:"Inbox",icon:"messages"},
    {id:"profile",label:"Profile",icon:"profile"}
  ];
  var unreadCount=Number(state.unreadNotificationCount||0);
  var unreadBadge=unreadCount>0?'<span class="rz-notification-count" aria-label="'+unreadCount+' unread notifications">'+(unreadCount>99?'99+':unreadCount)+'</span>':'';
  document.body.innerHTML=
    '<div class="rz-top"><div class="rz-shell rz-top-inner">'+
      '<button class="rz-btn rz-brand rz-top-brand" id="brand"><img src="/rizora-cover.png" alt="RIZORA"><span>RIZORA</span><small>CREATOR OS</small></button>'+
      '<div class="rz-top-search"><input id="rzGlobalSearch" class="rz-input" placeholder="Search creators, posts, hashtags" aria-label="Search RIZORA"><button id="rzGlobalSearchBtn" class="rz-btn">Search</button></div>'+
      '<div class="rz-actions"><button class="rz-btn rz-top-ai" id="rzTopAi">NOIR ®</button><button class="rz-notification-trigger" id="rzTopNotifications" type="button" aria-label="Notifications'+(unreadCount?' ('+unreadCount+' unread)':'')+'">'+navIcon('notifications')+unreadBadge+'</button><button class="rz-btn" id="refresh">Refresh</button><button class="rz-top-avatar" id="rzTopProfile">'+avatar(state.user)+'</button></div>'+
    '</div></div>'+
    '<main class="rz-shell rz-social-main">'+
      '<aside class="rz-sidebar rz-x-sidebar">'+
        '<div class="rz-xnav">'+side+'</div>'+
        '<button class="rz-btn primary rz-create-post" id="rzCreatePost">Create</button>'+
        '<div class="rz-x-profile-mini"><button class="rz-x-profile-button" id="rzMiniProfile">'+avatar(state.user)+'<span><strong>'+esc((state.user&&state.user.displayName)||"Creator")+'</strong><small>@'+esc((state.user&&(state.user.publicUsername||state.user.username))||"creator")+'</small></span><b>...</b></button></div>'+
        '<button class="rz-btn" id="rzDesktopSuite" style="width:100%">Creator Suite</button>'+
      '</aside>'+
      '<section class="rz-content rz-social-content" id="content"></section>'+
      '<aside class="rz-right-rail">'+
        '<div class="rz-card rz-search-card"><div class="rz-kicker">RIZORA SEARCH</div><h3>Find creators</h3><p class="rz-muted">Discover profiles, posts and hashtags.</p><button class="rz-btn primary" id="rzRailExplore">Explore RIZORA</button></div>'+
        '<div class="rz-card rz-account-card"><div class="rz-kicker">YOUR ACCOUNT</div><div class="rz-right-account">'+avatar(state.user)+'<div><strong>'+esc((state.user&&state.user.displayName)||"Creator")+'</strong><div class="rz-mini">@'+esc((state.user&&(state.user.publicUsername||state.user.username))||"creator")+'</div></div></div><div class="rz-right-stats"><span><b>'+Number(state.points||0)+'</b><small>points</small></span><span><b>'+Number((state.user&&state.user.followers)||0)+'</b><small>followers</small></span><span><b>'+Number((state.user&&state.user.posts)||0)+'</b><small>posts</small></span></div><div class="rz-actions"><button class="rz-btn" id="rzRailProfile">Profile</button><button class="rz-btn" id="rzRailSettings">Settings</button></div></div>'+
        '<div class="rz-card rz-right-growth"><div class="rz-kicker">BUILD MOMENTUM</div><h3>Grow your presence</h3><p class="rz-muted">Use missions, Boosts, AI and analytics to move your creator account.</p><div class="rz-actions"><button class="rz-btn" id="rzRailGrow">Grow</button><button class="rz-btn" id="rzRailAi">Ask AI</button></div></div>'+
        '<div class="rz-mini rz-right-footer">RIZORA · CREATE. GROW ONLY.</div>'+
      '</aside>'+
    '</main>'+
      '<nav class="rz-mobile-nav" aria-label="Main navigation">'+mobile.map(function(item){var badge=item.id==="notifications"&&unreadCount?'<span class="rz-notification-count" aria-label="'+unreadCount+' unread notifications">'+(unreadCount>99?'99+':unreadCount)+'</span>':'';return '<button class="'+(state.view===item.id?"active":"")+'" data-nav="'+item.id+'"><span>'+navIcon(item.icon)+badge+'</span><small>'+item.label+'</small></button>';}).join("")+'</nav><footer class="rz-site-footer"><strong>New features are coming</strong>© 2026 RIZORA. All rights reserved. Owned by RoMi Noir.</footer>';

  document.querySelectorAll("[data-nav]").forEach(function(b){b.onclick=function(){var destination=b.getAttribute("data-nav");if(destination==="create"){state.composerPeopleTags=[];state.pendingPeopleTag=null;}state.view=destination;shell();load();};});
  $("refresh").onclick=load;
  $("brand").onclick=function(){state.view="home";shell();load();};
  $("rzTopAi").onclick=function(){state.view="ai";shell();load();};
  $("rzTopNotifications").onclick=function(){state.view="notifications";shell();load();};
  $("rzCreatePost").onclick=function(){state.composerPeopleTags=[];state.pendingPeopleTag=null;state.view="create";shell();load();};
  $("rzTopProfile").onclick=function(){state.view="profile";shell();load();};
  $("rzMiniProfile").onclick=function(){state.view="profile";shell();load();};
  $("rzRailProfile").onclick=function(){state.view="profile";shell();load();};
  $("rzRailExplore").onclick=function(){state.view="discover";shell();load();};
  $("rzRailGrow").onclick=function(){state.view="grow";shell();load();};
  $("rzRailAi").onclick=function(){state.view="ai";shell();load();};
  $("rzRailSettings").onclick=function(){if(window.RIZORA_CONTROL_CENTER&&window.RIZORA_CONTROL_CENTER.preferences){window.RIZORA_CONTROL_CENTER.preferences();}else{toast("Profile settings are loading.");}};
  var searchInput=$("rzGlobalSearch"),searchBtn=$("rzGlobalSearchBtn");
  function runGlobalSearch(){
    var q=String(searchInput&&searchInput.value||"").trim();
    state.query=q;
    if(q){try{var recent=JSON.parse(localStorage.getItem("rizora_recent_searches")||"[]");if(!Array.isArray(recent))recent=[];recent=[q].concat(recent.filter(function(item){return String(item).toLowerCase()!==q.toLowerCase();})).slice(0,8);localStorage.setItem("rizora_recent_searches",JSON.stringify(recent));}catch(_){}}
    state.search=null;
    state.view="discover";
    shell();
    if($("q"))$("q").value=q;
    wire();
    if(q){
      api("/api/v2/search?q="+encodeURIComponent(q)).then(function(d){state.search=d;view();wire();}).catch(function(e){toast(e.message);});
    } else {
      view();wire();
    }
  }
  if(searchBtn)searchBtn.onclick=runGlobalSearch;
  if(searchInput)searchInput.onkeydown=function(e){if(e.key==="Enter")runGlobalSearch();};
  var ds=$("rzDesktopSuite");if(ds)ds.onclick=function(){if(window.RIZORA_SUITE&&window.RIZORA_SUITE.open)window.RIZORA_SUITE.open();};
  view();
}
function card(title,body){return '<section class="rz-card"><div class="rz-kicker">'+title+'</div>'+body+'</section>';}

function creatorCommandCenter(){
  var openTasks=(state.onboarding||[]).filter(function(t){return !t.completed;});
  var next=openTasks[0];
  var firstName=String((state.user&&state.user.displayName)||state.user&&state.user.username||'Creator').split(/\s+/)[0];
  var feedCount=Number((state.feed||[]).length);
  var owner=!!(state.user&&(state.user.ownerAccount===true||state.user.role==='super_admin'));
  var ownerCard=owner?'<article class="rz-command-card rz-command-owner"><div class="rz-command-icon">◆</div><div class="rz-kicker">OWNER WORKSPACE</div><h3>Platform command</h3><p>Premium+ creator tools, moderation, support and live platform controls.</p><div class="rz-command-actions"><button class="rz-btn primary" data-go="admin">Open command center</button></div></article>':'';
  return '<div class="rz-command-center">'+
    '<section class="rz-command-hero"><div><div class="rz-kicker">RIZORA MUSIC CREATOR OS '+(owner?'<span class="rz-owner-chip">PREMIUM+ · OWNER</span>':'')+'</div><h2>Good to see you, '+esc(firstName)+'.</h2><p>Make the track, shape the content, release through RIZORA, then grow the audience around your work.</p><div class="rz-command-actions"><button class="rz-btn primary" data-open-music="1">Open Music Studio</button><button class="rz-btn" data-go="ai">Ask NOIR ®</button><button class="rz-btn" data-go="create">Create a post</button></div></div><div class="rz-command-score"><b>'+Number(state.points||0)+'</b><span>creator points</span><div class="rz-command-progress"><i style="width:'+Math.min(100,Math.max(8,Number(state.points||0)%101))+'%"></i></div></div></section>'+
    '<section class="rz-command-grid">'+
      '<article class="rz-command-card"><div class="rz-command-icon">↗</div><div class="rz-kicker">GROW</div><h3>Build momentum</h3><p>'+Number(state.tasks.length||0)+' growth tasks are ready. Track progress and find your next move in one place.</p><div class="rz-command-actions"><button class="rz-btn" data-go="grow">Open Grow</button></div></article>'+
      '<article class="rz-command-card"><div class="rz-command-icon">◎</div><div class="rz-kicker">COMMUNITY</div><h3>Stay close to your people</h3><p>'+feedCount+' posts in your feed, with messages and live rooms close by.</p><div class="rz-command-actions"><button class="rz-btn" data-go="discover">Open Discover</button><button class="rz-btn" data-go="messages">Inbox</button><button class="rz-btn" data-go="live">Live</button></div></article>'+
       '<article class="rz-command-card wide"><div class="rz-kicker">START HERE</div><h3>'+(next?esc(next.title):'Your Creator OS is ready')+'</h3><p>'+(next?esc(next.description||'Complete this step to build your RIZORA foundation.'): 'Publish something, shape your profile, or open Music Studio when you are ready.')+'</p><div class="rz-command-actions">'+(next?'<button class="rz-btn primary" data-onboarding-follow="'+esc(next.username)+'">Follow creator</button>':'<button class="rz-btn primary" data-go="profile">Open profile</button>')+'<button class="rz-btn" data-go="discover">Explore RIZORA</button></div></article>'+ownerCard+
     '</section>'+platformUpdatesMarkup()+featureShowcase()+'</div>';
}
function platformUpdatesMarkup(){
  var updates=(state.updates||[]).map(function(item){var media="";if(item.mediaUrl&&/^image\//i.test(item.mimeType||""))media='<img src="'+esc(normalizeMediaUrl(item.mediaUrl))+'" alt="RIZORA update" loading="lazy">';else if(item.mediaUrl&&/^video\//i.test(item.mimeType||""))media='<video src="'+esc(normalizeMediaUrl(item.mediaUrl))+'" controls playsinline preload="metadata"></video>';return '<article class="rz-card rz-platform-update">'+(media?'<div class="rz-platform-update-media">'+media+'</div>':'')+'<div class="rz-kicker">RIZORA UPDATE · '+esc(postTime(item.createdAt))+'</div><h3>'+esc(item.title)+'</h3>'+(item.message?'<p>'+esc(item.message)+'</p>':'')+'</article>';}).join("");
  return '<section class="rz-platform-updates"><div class="rz-section-title"><div><div class="rz-kicker">FROM THE RIZORA TEAM</div><h3>Updates</h3></div></div>'+(updates||'<div class="rz-empty">No updates yet. Check back here for news from the RIZORA team.</div>')+'</section>';
}
function featureShowcase(){
  var items=[
    ["✦","NOIR ®","Your creative co-pilot","Turn a prompt or voice note into ideas, visuals and video drafts.","ai","Open AI"],
    ["♫","MUSIC STUDIO","Make the sound yours","Create beats, record vocals, shape a mix and prepare a release.","beats","Open Studio","studio"],
    ["◎","CREATOR SOCIAL","Find your people","Post, follow, message and build a public creator profile.","discover","Explore creators"],
    ["↗","GROW","Move your work forward","See growth tools, analytics and opportunities in one workspace.","grow","Open Grow"],
    ["▣","MESSAGES","Stay in the conversation","Share media and keep creator collaborations moving.","messages","Open messages"]
  ];
  return '<section class="rz-feature-showcase" aria-labelledby="rzFeatureShowcaseTitle"><div class="rz-feature-showcase-head"><div><div class="rz-kicker">RIZORA IN ONE PLACE</div><h3 id="rzFeatureShowcaseTitle">Explore what you can make here.</h3><p>Swipe sideways through the rooms, then scroll down the page for your next move.</p></div><div class="rz-feature-showcase-controls"><button type="button" data-feature-slide="previous" aria-label="Previous feature">←</button><button type="button" data-feature-slide="next" aria-label="Next feature">→</button></div></div><div class="rz-feature-showcase-rail" tabindex="0" aria-label="RIZORA feature slides">'+items.map(function(item){var open=item[6]?'<button type="button" class="rz-btn primary" data-open-music="1" data-studio-feature="'+item[6]+'">'+item[5]+' →</button>':'<button type="button" class="rz-btn primary" data-go="'+item[4]+'">'+item[5]+' →</button>';return '<article class="rz-feature-showcase-slide"><span class="rz-feature-showcase-icon" aria-hidden="true">'+item[0]+'</span><div class="rz-kicker">'+item[1]+'</div><h4>'+item[2]+'</h4><p>'+item[3]+'</p><div>'+open+'</div></article>';}).join('')+'</div></section>';
}
function creatorStudioView(){
  if(window.RIZORA_STUDIO_PAGE&&typeof window.RIZORA_STUDIO_PAGE.html==="function")return window.RIZORA_STUDIO_PAGE.html();
  return '<div class="rz-creator-studio">'+
    '<section class="rz-studio-hero"><div><div class="rz-kicker">RIZORA CREATOR STUDIO</div><h2>Make something real.</h2><p>Start with a thought, shape the sound, then turn it into work you can share.</p><div class="rz-studio-hero-actions"><button class="rz-btn primary" data-open-music="1">Open Music Studio</button><button class="rz-btn" data-go="ai">Talk to NOIR ®</button></div></div><div class="rz-studio-orb" aria-hidden="true"><img src="/rizora-cover.png" alt=""></div></section>'+
    '<section class="rz-studio-tools" aria-label="Creator tools">'+
      '<article class="rz-studio-tool rz-studio-tool-music"><div class="rz-studio-tool-mark">♫</div><div class="rz-kicker">MUSIC & AUDIO</div><h3>Make the sound yours</h3><p>Direct a track, sketch a beat, create a voiceover, polish a vocal and prepare your release.</p><button class="rz-btn primary" data-open-music="1">Enter Music Studio <span aria-hidden="true">→</span></button><small>Generation and export status are shown in the studio.</small></article>'+
      '<article class="rz-studio-tool"><div class="rz-studio-tool-mark">✳</div><div class="rz-kicker">IDEAS & CONTENT</div><h3>Get from blank page to first draft</h3><p>Bring your idea to NOIR ® for hooks, concepts, captions, scripts or a plan for what to make next.</p><button class="rz-btn" data-go="ai">Open AI workspace <span aria-hidden="true">→</span></button></article>'+
      '<article class="rz-studio-tool"><div class="rz-studio-tool-mark">◉</div><div class="rz-kicker">VOICE & PERFORMANCE</div><h3>Speak it, then shape it</h3><p>Use voice input with NOIR ®, hear responses aloud, or create a downloadable voiceover in Music Studio.</p><button class="rz-btn" data-go="ai">Start with your voice <span aria-hidden="true">→</span></button></article>'+
    '</section>'+
    '<section class="rz-studio-idea"><div><div class="rz-kicker">YOUR IDEA, WITH NOIR ®</div><h3>What are you trying to make?</h3><p>Share the rough version. RIZORA will help you find a clear next step.</p><label class="rz-studio-sr" for="rzStudioIdeaInput">Describe your idea</label><textarea id="rzStudioIdeaInput" class="rz-textarea" maxlength="1200" placeholder="A song, a video, a brand idea, a message you want to get right…"></textarea><div class="rz-studio-idea-actions"><select id="rzStudioIdeaType" class="rz-input" aria-label="Choose what RIZORA should help with"><option value="creative direction">Creative direction</option><option value="song concept and lyrics direction">Song concept</option><option value="short-form video script">Short video script</option><option value="social caption">Social caption</option><option value="creator growth plan">Growth plan</option></select><button id="rzStudioIdeaSubmit" class="rz-btn primary" type="button">Shape this idea</button></div><div id="rzStudioIdeaStatus" class="rz-mini" role="status" aria-live="polite"></div></div><div class="rz-studio-idea-result"><div class="rz-kicker">YOUR DRAFT</div><div id="rzStudioIdeaResult" class="rz-studio-result-empty">Your response will appear here. You can edit and make it your own.</div></div></section>'+
    '<section class="rz-studio-next"><div><div class="rz-kicker">KEEP MOVING</div><h3>Make it, share it, grow it.</h3><p>Publish your work, find your people, and keep track of your momentum.</p></div><div class="rz-studio-next-actions"><button class="rz-btn" data-go="create">Create a post</button><button class="rz-btn" data-go="discover">Explore creators</button><button class="rz-btn" data-go="grow">Open Grow</button></div></section>'+
  '</div>';
}
function liveView(){
  var rows=(state.live||[]).map(function(live){
    var thumb=live.thumbnail?'<img class="rz-live-thumb" src="'+esc(live.thumbnail)+'" alt="">':'<div class="rz-live-thumb rz-live-thumb-empty">LIVE</div>';
    return '<article class="rz-card rz-live-card">'+thumb+'<div class="rz-live-card-copy"><div class="rz-live-card-top"><span class="rz-badge ok">LIVE NOW</span><span class="rz-mini">'+Number(live.viewers||0)+' watching</span></div><h3>'+esc(live.title||"RIZORA Live")+'</h3><p class="rz-muted">@'+esc(live.username||"creator")+' · '+esc(live.category||"general")+'</p><button type="button" class="rz-btn primary" data-live-join="'+esc(live.id)+'">Join live</button></div></article>';
  }).join("");
  var empty=state.liveError
    ? '<div class="rz-empty"><strong>Live is taking a moment.</strong><p>'+esc(state.liveError)+'</p><button type="button" class="rz-btn" id="rzLiveRetry">Try again</button></div>'
    : '<div class="rz-empty"><strong>No one is live right now.</strong><p>Start a room when you are ready, or check back soon for creators going live.</p><div class="rz-actions" style="justify-content:center"><button type="button" class="rz-btn primary" id="rzLiveStart">Start a live room</button><button type="button" class="rz-btn" id="rzLiveRefresh">Refresh</button></div></div>';
  return card("LIVE","<div class='rz-section-title'><div><h2>Live rooms</h2><p class='rz-muted'>Join the RIZORA community in real time.</p></div><div class='rz-actions'><button type='button' class='rz-btn' id='rzLiveRefreshTop'>Refresh</button><button type='button' class='rz-btn primary' id='rzLiveStartTop'>Start live</button></div></div><div class='rz-live-list'>"+(rows||empty)+"</div>");
}
function aiInline(value){return esc(value).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,"<code>$1</code>");}
function aiFormattedText(value){
  var lines=String(value||"").replace(/\r/g,"").split("\n"),html="",inList=false;
  lines.forEach(function(line){
    var item=line.match(/^\s*[-*]\s+(.+)$/);
    if(item){if(!inList){html+="<ul>";inList=true;}html+="<li>"+aiInline(item[1])+"</li>";return;}
    if(inList){html+="</ul>";inList=false;}
    if(!line.trim()){html+="<br>";return;}
    html+="<p>"+aiInline(line)+"</p>";
  });
  if(inList)html+="</ul>";
  return html;
}
function aiMessageMarkup(message,index){
  var role=message.role==="you"?"user":(message.role==="error"?"error":"assistant"),label=role==="user"?"You":(role==="error"?"Connection":"NOIR ®"),mark=role==="user"?"You":(role==="error"?"!":'<img src="/rizora-icon-32.png" alt="">'),listen=message.role==="ai"?'<button type="button" class="rz-ai-listen" data-ai-speak="'+index+'">Listen</button>':"";
  return '<article class="rz-ai-message rz-ai-message-'+role+'"><div class="rz-ai-mark" aria-hidden="true">'+mark+'</div><div class="rz-ai-message-content"><div class="rz-ai-message-head"><strong>'+label+'</strong>'+listen+'</div><div class="rz-ai-message-text">'+aiFormattedText(message.text)+'</div></div></article>';
}
function noirRecentKey(){return state.user&&state.user.id?"rizora_noir_recent_"+String(state.user.id):"";}
function noirRecentChats(){try{var key=noirRecentKey(),rows=key?JSON.parse(localStorage.getItem(key)||"[]"):[];return Array.isArray(rows)?rows:[];}catch(_){return[];}}
function saveNoirRecent(){if(!state.user||!state.aiMessages.some(function(message){return message.role==="you"||message.role==="ai";}))return;var key=noirRecentKey();if(!key)return;var rows=noirRecentChats(),id=state.aiCurrentId||(state.aiCurrentId="noir_"+Date.now().toString(36)),first=state.aiMessages.find(function(message){return message.role==="you";});rows=rows.filter(function(row){return row.id!==id;});rows.unshift({id:id,title:String(first&&first.text||"New chat").replace(/\s+/g," ").slice(0,64),messages:state.aiMessages.slice(-40),updatedAt:Date.now()});try{localStorage.setItem(key,JSON.stringify(rows.slice(0,12)));}catch(_){}}
function aiWorkspaceView(){
  var empty=state.aiMessages.length?"":'<div class="rz-ai-empty"><div class="rz-ai-orb" aria-hidden="true"><img src="/rizora-cover.png" alt=""></div><div class="rz-kicker">NOIR ®</div><h3>What would you like to make?</h3><p>Ask for a clear answer, a creator idea, a caption or a music direction. RIZORA will say when a tool needs to create a file.</p><div class="rz-ai-suggestions"><button type="button" data-ai-starter="Help me shape a clear idea for my next post.">Shape a post idea <span>↗</span></button><button type="button" data-ai-starter="Give me three original hooks for an Amapiano track about a late night drive.">Write music hooks <span>↗</span></button><button type="button" data-ai-starter="Help me plan one small step to grow my creator profile this week.">Plan a growth step <span>↗</span></button></div></div>',recents=noirRecentChats();
  var recentMarkup=recents.length?'<nav class="rz-ai-recents" aria-label="Recent NOIR chats"><strong>Recent chats</strong>'+recents.slice(0,6).map(function(chat){return '<button type="button" data-ai-recent="'+esc(chat.id)+'">'+esc(chat.title||"New chat")+'</button>';}).join("")+'</nav>':'<p class="rz-ai-recents-empty">Your recent chats will appear here.</p>';
  return '<section class="rz-ai-workspace"><header class="rz-ai-header"><div class="rz-ai-header-brand"><img src="/rizora-cover.png" alt="" class="rz-ai-logo"><div><div class="rz-kicker">YOUR CREATOR COPILOT</div><h2>NOIR ®</h2><p>Direct answers, creator ideas and thoughtful next steps.</p></div></div><button type="button" class="rz-btn" id="rzAiNewChat">New chat</button></header>'+recentMarkup+'<div class="rz-ai-thread" id="rzAiThread" aria-live="polite" aria-relevant="additions text">'+empty+state.aiMessages.map(aiMessageMarkup).join("")+(state.aiBusy?'<div class="rz-ai-typing"><span></span><span></span><span></span> RIZORA is thinking</div>':"")+'</div><div id="rzAiMediaMount" class="rz-ai-media-mount"></div><form id="aiForm" class="rz-ai-composer"><label class="rz-sr-only" for="aiInput">Message NOIR ®</label><textarea id="aiInput" rows="1" maxlength="4000" placeholder="Message NOIR ®…" autocomplete="off"></textarea><div class="rz-ai-composer-footer"><span>Enter to send · Shift + Enter for a new line</span><div><button type="button" class="rz-btn" id="rzAiVisualOpen">Visual tools</button><button class="rz-btn primary" type="submit" id="rzAiSend">Send <span aria-hidden="true">↑</span></button></div></div></form><p class="rz-ai-footnote">AI can make mistakes. For music, tracks and visuals, use the dedicated RIZORA Studio tools.</p></section>';
}
function creatorWorkflowMarkup(){
  var groups=[
    ["FORMAT TOOLS",[["▤","Series & Episodes","series"]]],
    ["BUSINESS TOOLS",[["▣","Ads Manager","ads"],["♡","Free Membership","membership"],["↗","Gift Access","gift"]]],
    ["AUDIENCE TOOLS",[["◉","Events & Live","events"]]],
    ["CREATOR LAB",[["⌘","Custom Feeds","feeds"]]]
  ];
  return '<details class="rz-card rz-profile-workflow"><summary><span>Creator workflow</span><span class="rz-profile-workflow-toggle" aria-hidden="true">+</span></summary><div class="rz-workflow-groups">'+groups.map(function(group){return '<section class="rz-workflow-group"><h3>'+group[0]+'</h3><div class="rz-workflow-tools">'+group[1].map(function(tool){return '<button type="button" class="rz-workflow-tool" data-profile-workflow="'+tool[2]+'"><span class="rz-workflow-tool-icon" aria-hidden="true">'+tool[0]+'</span><span>'+tool[1]+'</span><span class="rz-workflow-tool-arrow" aria-hidden="true">→</span></button>';}).join("")+'</div></section>';}).join("")+'</div></details>';
}
function profileLinkMarkup(items){return (Array.isArray(items)?items:[]).map(function(item){var value=String(typeof item==="string"?item:(item&&(item.url||item.href)||"")).trim(),label=String(typeof item==="string"?"":(item&&(item.label||item.title)||"")).trim(),href="",host="";try{var parsed=new URL(value,location.origin);if(parsed.protocol==="https:"||parsed.protocol==="http:"){href=parsed.href;host=parsed.hostname;}}catch(_){}if(!href)return "";return '<a href="'+esc(href)+'" target="_blank" rel="noopener noreferrer">'+esc(label||host.replace(/^www\./,""))+' <span aria-hidden="true">↗</span></a>';}).filter(Boolean).join("");}
function profileView(){
 var u=state.user||{},p=state.profile||{},posts=Array.isArray(state.profilePosts)?state.profilePosts:[],tab=state.profileTab||"posts",followers=Number(u.followers||0),following=Number(u.following||0),totalPosts=Number(u.posts||0),likes=Number(u.likes||0),showPremium=true;
 if(["posts","media","saved","tagged","liked","bio"].indexOf(tab)<0)tab="posts";
 try{showPremium=sessionStorage.getItem("rz_premium_suggestion_dismissed")!=="1";}catch(_){showPremium=true;}
 var selected=tab==="media"?posts.filter(function(item){return !!item.mediaUrl;}):posts,links=profileLinkMarkup(u.links||[]),panel="";
 if(tab==="bio")panel='<div class="rz-profile-bio-panel">'+(p.category?'<div><span class="rz-kicker">CATEGORY</span><strong>'+esc(p.category)+'</strong></div>':"")+(p.location?'<div><span class="rz-kicker">LOCATION</span><strong>'+esc(p.location)+'</strong></div>':"")+'<p>'+esc(p.bio||"Add a short introduction to your creator profile.")+'</p>'+(links?'<nav class="rz-profile-link-list" aria-label="Profile links">'+links+'</nav>':'<div class="rz-empty">Add social and portfolio links from Edit profile.</div>')+'</div>';
 else panel=selected.length?selected.map(post).join(""):'<div class="rz-empty">'+(tab==="media"?"No media posts yet.":tab==="saved"?"No saved posts yet.":tab==="tagged"?"No posts you are tagged in yet.":tab==="liked"?"No liked posts yet.":"No posts yet. Share something with your community.")+'</div>';
 var linkLines=(u.links||[]).map(function(item){var label=String(item.label||"").trim(),url=String(item.url||"").trim();return label?label+" | "+url:url;}).join("\n");
 return '<section class="rz-card rz-profile-card"><div class="rz-profile-cover"><img class="rz-profile-cover-image" src="'+esc(p.bannerUrl||"/assets/rizora-creator-banner.svg")+'" alt="Creator banner"></div><div class="rz-profile-inner"><div class="rz-profile-top"><div class="rz-avatar-wrap">'+avatar(u).replace('class="rz-avatar"','class="rz-avatar rz-profile-avatar"')+'</div><div class="rz-profile-actions"><button id="verify" class="rz-btn">'+(u.verified?"Verified":"Get verified")+'</button><button id="editProfile" class="rz-btn">Edit profile</button><button id="profileSettings" class="rz-btn">Settings</button></div></div><div class="rz-profile-name"><h2>'+esc(u.displayName||u.username||"Creator")+'</h2></div><div class="rz-mini rz-profile-handle">@'+esc(u.publicUsername||u.username||"")+verified(u)+'</div><p class="rz-profile-bio">'+esc(p.bio||"Creator on RIZORA. Build. Post. Grow.")+'</p><div class="rz-profile-stats"><span><strong>'+totalPosts+'</strong> posts</span><span><strong>'+followers+'</strong> followers</span><span><strong>'+following+'</strong> following</span><span><strong>'+likes+'</strong> likes</span></div><nav class="rz-profile-tabs" aria-label="Profile sections"><button type="button" data-profile-tab="posts" class="'+(tab==="posts"?"active":"")+'" aria-pressed="'+(tab==="posts")+'">Posts</button><button type="button" data-profile-tab="media" class="'+(tab==="media"?"active":"")+'" aria-pressed="'+(tab==="media")+'">Media</button><button type="button" data-profile-tab="saved" class="'+(tab==="saved"?"active":"")+'" aria-pressed="'+(tab==="saved")+'">Saved</button><button type="button" data-profile-tab="tagged" class="'+(tab==="tagged"?"active":"")+'" aria-pressed="'+(tab==="tagged")+'">Tagged</button><button type="button" data-profile-tab="liked" class="'+(tab==="liked"?"active":"")+'" aria-pressed="'+(tab==="liked")+'">Liked</button><button type="button" data-profile-tab="bio" class="'+(tab==="bio"?"active":"")+'" aria-pressed="'+(tab==="bio")+'">Bio</button></nav><section class="rz-profile-panel" aria-live="polite">'+panel+'</section></div></section>'+creatorWorkflowMarkup()+(showPremium?'<section class="rz-card rz-premium-hint" id="rzPremiumVerificationHint"><div class="rz-section-title"><div><div class="rz-kicker">CREATOR UPGRADE</div><h3>Strengthen your creator setup</h3></div><button id="rzDismissPremiumSuggestion" class="rz-btn" type="button" aria-label="Hide Premium suggestion">Hide</button></div><p class="rz-muted">Premium adds advanced creator tools and deeper insights. Verification is reviewed separately and Premium does not guarantee verification.</p><button id="rzOpenPremiumFromProfile" class="rz-btn primary">Explore Premium</button></section>':'')+'<section class="rz-card rz-profile-editor" id="rzProfileEditor" style="display:none"><div class="rz-section-title"><div><div class="rz-kicker">EDIT PROFILE</div><h3>Creator identity</h3></div><button id="closeProfileEditor" class="rz-btn" type="button">Close</button></div><form id="profileForm"><input id="pfAvatar" type="hidden" value="'+esc(p.avatarUrl||u.avatarUrl||"")+'"><input id="pfBanner" type="hidden" value="'+esc(p.bannerUrl||"")+'"><div class="rz-profile-edit-media"><div class="rz-profile-photo-edit"><img id="pfAvatarPreview" src="'+esc(p.avatarUrl||u.avatarUrl||"/assets/rizora-default-avatar.jpg")+'" alt="Current profile photo"><div><strong>Profile photo</strong><span class="rz-mini">Choose a new photo to replace it.</span><label class="rz-profile-upload-button">Change photo<input id="pfAvatarFile" class="rz-media-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label><button id="pfAvatarReset" class="rz-btn" type="button">Remove photo</button><div id="pfAvatarStatus" class="rz-media-status" role="status" aria-live="polite"></div></div></div><div class="rz-profile-banner-edit"><div class="rz-profile-banner-preview"><img id="pfBannerPreview" src="'+esc(p.bannerUrl||"/assets/rizora-creator-banner.svg")+'" alt="Profile banner preview"></div><div class="rz-profile-banner-tools"><div><strong>Profile banner</strong><span class="rz-mini">A creator cover for your profile.</span></div><label class="rz-profile-upload-button">Change banner<input id="pfBannerFile" class="rz-media-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label><button id="pfBannerReset" class="rz-btn" type="button">Remove banner</button><div id="pfBannerStatus" class="rz-media-status" role="status" aria-live="polite"></div></div></div></div><textarea id="pfBio" class="rz-textarea" maxlength="600" placeholder="Bio">'+esc(p.bio||"")+'</textarea><input id="pfCategory" class="rz-input" maxlength="80" placeholder="Category" value="'+esc(p.category||"")+'"><input id="pfLocation" class="rz-input" maxlength="80" placeholder="Location" value="'+esc(p.location||"")+'"><label class="rz-field">Links <span class="rz-mini">One link per line. Use “Label | https://example.com”.</span><textarea id="pfLinks" class="rz-textarea" maxlength="5200" placeholder="LinkedIn | https://...&#10;Website | https://...">'+esc(linkLines)+'</textarea></label><button class="rz-btn primary" type="submit">Save profile</button></form></section>';
}
function peopleTagComposerMarkup(){
  return "<details id='postTagPeople' class='rz-compose-options'><summary>Tag People</summary><div class='rz-compose-option'><p class='rz-mini'>Choose a person, then tap the photo or video to place their tag. Drag a tag to move it; tap a label to remove it.</p><label class='rz-label' for='postTagSearch'>Find a creator</label><input id='postTagSearch' class='rz-input' type='search' autocomplete='off' placeholder='Search by name or @username'><div id='postTagStatus' class='rz-mini' role='status' aria-live='polite'></div><div id='postTagResults' class='rz-tag-search-results'></div><div id='postTagQueue' class='rz-tag-queue' aria-live='polite'></div></div></details>";
}
function postComposerView(){
  return card("CREATE","<h2>Create a post</h2><p class='rz-muted'>Create is for composing and publishing. All published posts and community browsing live in Discover.</p><button id='openDiscoverFeed' class='rz-text-action' type='button'>Browse posts in Discover →</button><form id='postForm' class='rz-compose' style='margin-top:14px'><textarea id='postText' class='rz-textarea' placeholder='Write a caption. Use #hashtags and @mentions.'></textarea><input id='postMedia' type='hidden'><label class='rz-ai-toggle'><input id='postAiAssisted' type='checkbox'><span>AI-assisted</span></label><div class='rz-media-picker'><input id='postMediaFile' class='rz-media-file' type='file' accept='image/*,video/*,audio/*'><div id='postMediaStatus' class='rz-media-status'></div></div>"+postMediaEditor("","","postMediaEditor")+peopleTagComposerMarkup()+"<details class='rz-compose-options'><summary>More post options</summary><div class='rz-compose-option-grid'><div class='rz-compose-option'><div class='rz-kicker'>POLL</div><input id='postPollQuestion' class='rz-input' placeholder='Ask your audience a question'><input id='postPollOption1' class='rz-input' placeholder='Option 1'><input id='postPollOption2' class='rz-input' placeholder='Option 2'><input id='postPollOption3' class='rz-input' placeholder='Option 3 (optional)'><input id='postPollOption4' class='rz-input' placeholder='Option 4 (optional)'></div><div class='rz-compose-option'><div class='rz-kicker'>SCHEDULE</div><input id='postSchedule' class='rz-input' type='datetime-local'><div class='rz-mini'>Choose a future time to publish automatically.</div><div class='rz-kicker' style='margin-top:12px'>COLLABORATOR</div><input id='postCollab' class='rz-input' placeholder='Invite @username after publishing'><div class='rz-mini'>The creator receives a collaboration invite.</div></div></div><div class='rz-actions' style='margin-top:10px'><button id='saveDraft' type='button' class='rz-btn'>Save draft</button><button id='clearPostOptions' type='button' class='rz-btn'>Clear options</button></div></details><div class='rz-actions'><button class='rz-btn primary' type='submit'>Publish</button></div><div id='postStatus' class='rz-mini' role='status' aria-live='polite'></div><div id='postError' class='rz-error' role='alert'></div></form>");
}
function discoverView(){
  var search=state.search||{},query=String(state.query||"").trim(),resultParts=[],data=state.discover||{};
  var users=Array.isArray(search.users)?search.users:[],hashtags=Array.isArray(search.hashtags)?search.hashtags:[],searchedPosts=Array.isArray(search.posts)?search.posts:[];
  var trendingTags=Array.isArray(data.trendingHashtags)?data.trendingHashtags:[],creators=Array.isArray(data.creators)?data.creators:[],trendingPosts=Array.isArray(data.posts)?data.posts:[];
  if(query){
    if(users.length)resultParts.push('<section class="rz-discover-result-group"><h3>Creators</h3><div class="rz-discover-creator-list">'+users.map(function(u){var handle=u.publicUsername||u.username||"",url="/creator/"+encodeURIComponent(handle)+"/";return '<article class="rz-card rz-discover-profile">'+avatar(u)+'<a class="rz-discover-profile-open" href="'+url+'"><span class="rz-discover-identity"><strong>'+esc(u.displayName||handle||"Creator")+'</strong><small class="rz-profile-handle">@'+esc(handle)+verified(u)+'</small></span><span class="rz-discover-stats"><span>'+Number(u.posts||0)+' posts</span><span>'+Number(u.followers||0)+' followers</span></span></a><button class="rz-discover-follow" type="button" data-follow-user="'+esc(handle)+'" aria-pressed="'+(u.viewerFollowing===true?'true':'false')+'">'+(u.viewerFollowing===true?'Following':'Follow')+'</button></article>';}).join('')+'</div></section>');
    if(hashtags.length)resultParts.push('<section class="rz-discover-result-group"><h3>Hashtags</h3><div class="rz-discover-chip-rail">'+hashtags.map(function(h){return '<button class="rz-discover-chip" type="button" data-hashtag="'+esc(h.tag)+'">#'+esc(h.tag)+' <span>'+Number(h.count||0)+'</span></button>';}).join('')+'</div></section>');
    if(searchedPosts.length)resultParts.push('<section class="rz-discover-result-group"><h3>Posts</h3><div class="rz-feed">'+searchedPosts.map(post).join('')+'</div></section>');
    if(!resultParts.length)resultParts.push("<div class='rz-empty'>No results for “"+esc(query)+"”. Try a creator, post or hashtag.</div>");
  }
  var recent=[];try{recent=JSON.parse(localStorage.getItem("rizora_recent_searches")||"[]");if(!Array.isArray(recent))recent=[];}catch(_){recent=[];}
  var recentMarkup=!query&&recent.length?'<section class="rz-discover-recent"><div class="rz-discover-section-head"><h3>Recent searches</h3><button type="button" class="rz-text-action" id="clearRecentSearches">Clear</button></div><div class="rz-discover-chip-rail">'+recent.slice(0,8).map(function(item){return '<button class="rz-discover-chip" type="button" data-recent-search="'+esc(item)+'">'+esc(item)+'</button>';}).join('')+'</div></section>':'';
  var bannerItems=[
    {title:"Trending conversations",copy:trendingTags.length?"Join #"+trendingTags[0].tag+" and the conversations creators are building today.":"Find the conversations creators are building today.",action:"hashtags",label:"Explore hashtags"},
    {title:"Creators to know",copy:creators.length?"Meet "+(creators[0].user.displayName||creators[0].user.username)+" and discover new voices.":"Meet creators building something worth following.",action:"creators",label:"Meet creators"},
    {title:"Fresh work, every day",copy:"Browse music, videos and photos from the RIZORA community.",action:"for-you",label:"Explore posts"}
  ];
  var bannerMarkup='<div class="rz-discover-banner" aria-label="Discover highlights">'+bannerItems.map(function(item,index){return '<article class="rz-discover-banner-slide" data-discover-slide="'+index+'" '+(index===state.discoverBannerIndex?'':'hidden')+'><span class="rz-kicker">RIZORA / DISCOVER</span><h3>'+esc(item.title)+'</h3><p>'+esc(item.copy)+'</p><button class="rz-text-action" type="button" data-discover-category="'+item.action+'">'+esc(item.label)+' →</button></article>';}).join('')+'<div class="rz-discover-banner-dots">'+bannerItems.map(function(_,index){return '<button type="button" data-discover-banner="'+index+'" aria-label="Show highlight '+(index+1)+'" aria-pressed="'+(index===state.discoverBannerIndex?'true':'false')+'"></button>';}).join('')+'</div></div>';
  var tagRail='<section class="rz-discover-trending-tags"><div class="rz-discover-section-head"><h3>Trending hashtags</h3><button class="rz-text-action" type="button" data-discover-category="hashtags">See all</button></div><div class="rz-discover-chip-rail">'+(trendingTags.length?trendingTags.slice(0,10).map(function(h){return '<button class="rz-discover-chip" type="button" data-hashtag="'+esc(h.tag)+'">#'+esc(h.tag)+' <span>'+Number(h.posts||0)+'</span></button>';}).join(''):'<p class="rz-muted">Hashtags from new posts will appear here.</p>')+'</div></section>';
  var categories=[{id:"for-you",label:"For You"},{id:"music",label:"Music"},{id:"videos",label:"Videos"},{id:"photos",label:"Photos"},{id:"creators",label:"Creators"},{id:"hashtags",label:"Hashtags"}];
  var categoryTabs='<nav class="rz-discover-categories" aria-label="Discover categories">'+categories.map(function(item){return '<button type="button" data-discover-category="'+item.id+'" class="'+(state.discoverCategory===item.id?'active':'')+'" aria-pressed="'+(state.discoverCategory===item.id?'true':'false')+'">'+item.label+'</button>';}).join('')+'</nav>';
  var postPools=[state.feed,data.posts,state.hashtagDetail&&state.hashtagDetail.posts,search.posts],focusedPost=state.focusedPost||null;(postPools||[]).forEach(function(pool){(Array.isArray(pool)?pool:[]).forEach(function(item){if(String(item.id)===String(state.focusedPostId))focusedPost=item;});});
  var categoryContent='',feedMarkup=state.feed.length?state.feed.map(post).join(''):'<div class="rz-empty">'+(state.discoverCategory==="music"?'No music posts yet.':state.discoverCategory==="videos"?'No video posts yet.':state.discoverCategory==="photos"?'No photo posts yet.':'No posts yet. Be the first to post.')+'</div>';
  if(state.discoverCategory==="photos"||state.discoverCategory==="videos")feedMarkup=state.feed.length?'<div class="rz-discover-explore-grid">'+state.feed.map(function(item){var type=String(item.messageType||"").toLowerCase(),media=type==="image"?'<img src="'+esc(normalizeMediaUrl(item.mediaUrl))+'" alt="" loading="lazy">':'<video src="'+esc(normalizeMediaUrl(item.mediaUrl))+'" muted playsinline preload="metadata" aria-hidden="true"></video>';return '<button type="button" class="rz-discover-grid-card" data-open-post="'+esc(item.id)+'" aria-label="Open post by @'+esc(item.author&&(item.author.publicUsername||item.author.username)||"creator")+'">'+media+'<span class="rz-discover-grid-meta"><strong>@'+esc(item.author&&(item.author.publicUsername||item.author.username)||"creator")+'</strong><small>'+Number(item.metrics&&item.metrics.likes||0)+' likes</small></span></button>';}).join('')+'</div>':'<div class="rz-empty">'+(state.discoverCategory==="videos"?'No video posts yet.':'No photo posts yet.')+'</div>';
  if(state.activeHashtag&&state.hashtagDetail){categoryContent='<section class="rz-discover-hashtag-page"><div class="rz-discover-section-head"><div><button class="rz-text-action" type="button" id="backFromHashtag">← Discover</button><h3>#'+esc(state.hashtagDetail.tag||state.activeHashtag)+'</h3><p class="rz-muted">'+Number(state.hashtagDetail.count||0)+' posts</p></div><button type="button" class="rz-text-action" data-hashtag-follow="'+esc(state.activeHashtag)+'" aria-pressed="'+(state.hashtagDetail.viewerFollowing?'true':'false')+'">'+(state.hashtagDetail.viewerFollowing?'Following hashtag':'Follow hashtag')+'</button></div><div class="rz-feed">'+((state.hashtagDetail.posts||[]).length?state.hashtagDetail.posts.map(post).join(''):'<div class="rz-empty">No posts with this hashtag yet.</div>')+'</div></section>';}
  else if(state.focusedPostId)categoryContent='<section class="rz-discover-post-detail"><button class="rz-text-action" type="button" id="backFromDiscoverPost">← Back to Discover</button>'+(focusedPost?post(focusedPost):'<div class="rz-empty">This post is no longer available.</div>')+'</section>';
  else if(state.discoverCategory==="creators")categoryContent='<section><div class="rz-discover-section-head"><h3>Creators to discover</h3></div><div class="rz-discover-creator-list">'+(creators.length?creators.map(function(item){var u=item.user||{},handle=u.publicUsername||u.username||"",url="/creator/"+encodeURIComponent(handle)+"/";return '<article class="rz-card rz-discover-profile">'+avatar(u)+'<a class="rz-discover-profile-open" href="'+url+'"><span class="rz-discover-identity"><strong>'+esc(u.displayName||handle||"Creator")+'</strong><small class="rz-profile-handle">@'+esc(handle)+verified(u)+'</small></span><span class="rz-discover-stats"><span>'+Number(item.posts||0)+' posts</span><span>'+Number(item.followers||0)+' followers</span></span></a><button class="rz-discover-follow" type="button" data-follow-user="'+esc(handle)+'" aria-pressed="'+(item.followed?'true':'false')+'">'+(item.followed?'Following':'Follow')+'</button></article>';}).join(''):'<div class="rz-empty">No creator suggestions yet.</div>')+'</div></section>';
  else if(state.discoverCategory==="hashtags")categoryContent='<section><div class="rz-discover-section-head"><h3>Popular hashtags</h3></div><div class="rz-discover-hashtag-grid">'+(trendingTags.length?trendingTags.map(function(h){return '<button class="rz-card rz-discover-hashtag" type="button" data-hashtag="'+esc(h.tag)+'"><strong>#'+esc(h.tag)+'</strong><span>'+Number(h.posts||0)+' posts</span></button>';}).join(''):'<div class="rz-empty">No trending hashtags yet. Publish with a hashtag to start a conversation.</div>')+'</div></section>';
  else categoryContent='<section class="rz-discover-feed-section"><div class="rz-discover-section-head"><div><span class="rz-kicker">EXPLORE</span><h3>'+(state.discoverCategory==="music"?'Music posts':state.discoverCategory==="videos"?'Videos':state.discoverCategory==="photos"?'Photos':'Posts from RIZORA')+'</h3></div><button class="rz-btn" type="button" id="createFromDiscover">Create post</button></div>'+(state.discoverCategory==="for-you"?'<div class="rz-actions rz-feed-tabs">'+[{id:"for-you",label:"For You"},{id:"following",label:"Following"},{id:"trending",label:"Trending"}].map(function(tab){return '<button type="button" class="rz-btn '+(state.feedTab===tab.id?'primary':'')+'" data-tab="'+tab.id+'" aria-pressed="'+(state.feedTab===tab.id?'true':'false')+'">'+tab.label+'</button>';}).join('')+'</div>':'')+feedMarkup+(state.feedHasMore?'<button type="button" id="loadMoreDiscover" class="rz-btn rz-discover-load-more">Load more posts</button>':'')+'</section>';
  var trendCards=trendingPosts.slice(0,8).map(function(item){var type=String(item.messageType||"").toLowerCase(),media="";if(type==="image"&&item.mediaUrl)media='<img src="'+esc(normalizeMediaUrl(item.mediaUrl))+'" alt="" loading="lazy">';else media='<div class="rz-discover-trend-art">'+(type==="video"?"Video":type==="audio"?"Audio":"R")+'</div>';return '<button type="button" class="rz-discover-trend-card" data-open-post="'+esc(item.id)+'">'+media+'<span><strong>'+esc((item.author&&item.author.displayName)||'Creator')+'</strong><small>'+esc(textPreview(item.text||'A post from the community'))+'</small></span></button>';}).join('');
  var trendingMarkup=trendingPosts.length?'<section class="rz-discover-trending"><div class="rz-discover-section-head"><h3>Trending now</h3></div><div class="rz-discover-trend-rail">'+trendCards+'</div></section>':'';
  return card("DISCOVER","<h2>Discover</h2><div class='rz-discover-search-row'><input id='q' class='rz-input' value='"+esc(state.query||"") +"' placeholder='Search songs, users, posts or hashtags' aria-label='Search RIZORA'><button id='doSearch' class='rz-btn primary' type='button'>Search</button><button id='clearDiscoverSearch' class='rz-text-action' type='button' "+(query?'':'hidden')+">Clear</button></div>"+
    (query?"<div class='rz-discover-search-results'>"+resultParts.join("")+"</div>":recentMarkup+bannerMarkup+tagRail+trendingMarkup)+categoryTabs+categoryContent);
}

function showDiscoverBanner(index){
  state.discoverBannerIndex=Math.max(0,Math.min(2,Number(index)||0));
  document.querySelectorAll("[data-discover-slide]").forEach(function(slide){slide.hidden=Number(slide.getAttribute("data-discover-slide"))!==state.discoverBannerIndex;});
  document.querySelectorAll("[data-discover-banner]").forEach(function(dot){var active=Number(dot.getAttribute("data-discover-banner"))===state.discoverBannerIndex;dot.setAttribute("aria-pressed",active?"true":"false");});
}

async function runDiscoverSearch(remember){
  var input=$("q");if(!input)return;
  var query=String(input.value||"").trim(),hadFocus=document.activeElement===input,caret=input.selectionStart,sequence=++state.searchSequence;
  state.query=query;state.activeHashtag="";state.hashtagDetail=null;
  if(remember&&query){try{var recent=JSON.parse(localStorage.getItem("rizora_recent_searches")||"[]");if(!Array.isArray(recent))recent=[];recent=[query].concat(recent.filter(function(item){return String(item).toLowerCase()!==query.toLowerCase();})).slice(0,8);localStorage.setItem("rizora_recent_searches",JSON.stringify(recent));}catch(_){}}
  if(!query){state.search=null;view();wire();if(hadFocus){var emptyInput=$("q");if(emptyInput){emptyInput.focus();try{emptyInput.setSelectionRange(caret,caret);}catch(_){}}}return;}
  try{var result=await api("/api/v2/search?q="+encodeURIComponent(query));if(sequence!==state.searchSequence)return;state.search=result;view();wire();if(hadFocus){var next=$("q");if(next){next.focus();try{next.setSelectionRange(caret,caret);}catch(_){}}}}
  catch(error){if(sequence===state.searchSequence)toast(error.message||"Search could not be completed.");}
}

async function openDiscoverHashtag(value){
  var tag=String(value||"").replace(/^#/,'').trim().toLowerCase();if(!tag)return;
  var needsShell=state.view!=="discover";state.view="discover";if(needsShell)shell();
  state.activeHashtag=tag;state.focusedPostId="";state.focusedPost=null;state.hashtagDetail=null;state.query="";state.search=null;state.searchSequence+=1;
  try{state.hashtagDetail=await api("/api/v2/hashtags/"+encodeURIComponent(tag));view();wire();}
  catch(error){state.activeHashtag="";toast(error.message||"Hashtag posts could not be loaded.");view();wire();}
}

async function loadMoreDiscover(){
  var button=$("loadMoreDiscover");if(!button||button.disabled||!state.feedHasMore)return;
  button.disabled=true;button.textContent="Loading…";
  try{var category=state.discoverCategory==="for-you"?"all":state.discoverCategory;var page=await api("/api/v2/feed?tab="+encodeURIComponent(state.feedTab)+"&category="+encodeURIComponent(category)+"&offset="+Number(state.feedOffset||0)+"&limit=20");state.feed=state.feed.concat(page.posts||[]);state.feedOffset=Number(page.nextOffset||state.feed.length);state.feedHasMore=page.hasMore===true;view();wire();}
  catch(error){toast(error.message||"More posts could not be loaded.");button.disabled=false;button.textContent="Load more posts";}
}

function view(){
  var c=$("content");
  if(!c)return;
  c.setAttribute("data-rizora-view",state.view);
  if(state.view==="home")c.innerHTML=creatorCommandCenter();
  if(state.view==="create")c.innerHTML=postComposerView();
  if(state.view==="grow")c.innerHTML=card("GROW","<h2>Build momentum</h2><p class='rz-muted'>7-minute cooldown.</p><div class='rz-feed'>"+state.tasks.map(task).join("")+state.socialTasks.map(socialTask).join("")+"</div>");
  if(state.view==="studio")c.innerHTML=creatorStudioView();
  if(state.view==="ai")c.innerHTML=aiWorkspaceView();

  if(state.view==="discover")c.innerHTML=discoverView();
  if(state.view==="live")c.innerHTML=liveView();
  if(state.view==="notifications"){var notificationItems=state.notifications.map(function(n){var label=n.type==="activity"?"YOUR ACTIVITY":"RIZORA UPDATE";return '<article class="rz-card rz-notification-item"><span class="rz-kicker">'+label+'</span><strong>'+esc(n.title)+"</strong><div>"+esc(n.message)+"</div></article>";}).join("");c.innerHTML=card("ALERTS","<h2>Notifications</h2><p class='rz-muted'>Social updates and your recent activity appear here.</p><button id='readAll' class='rz-btn'>Mark read</button><div class='rz-feed'>"+(notificationItems||"<div class='rz-empty'>You are all caught up. New activity will appear here.</div>")+"</div>");}
  if(state.view==="profile")c.innerHTML=profileView();
  if(state.view==="safety")c.innerHTML=card("SAFETY","<h2>"+Number(state.user.warningCount||0)+"/3 warnings</h2><p class='rz-muted'>No 18+ / sexually explicit content. Three warnings are enforced on the backend.</p>"+((state.safety&&state.safety.warnings)||[]).map(function(w){return '<div class="rz-card"><strong>Warning '+w.number+"</strong><div>"+esc(w.reason)+"</div></div>";}).join(""));
  if(state.view==="boosts")c.innerHTML=boostsView();
  if(state.view==="official")c.innerHTML=officialView();
  if(state.view==="admin")c.innerHTML=adminView();
  if(state.view==="stories")c.innerHTML=storiesView();
  if(state.view==="communities")c.innerHTML=communitiesView();
  if(state.view==="messages")c.innerHTML=messagesView();
  if(state.view==="opportunities")c.innerHTML=opportunitiesView();
  if(state.view==="analytics")c.innerHTML=analyticsView();
  wire();
}

function storiesView(){
  var groups=(state.stories||[]).map(function(g){return '<div class="rz-card"><div class="rz-post-head">'+avatar(g.user)+'<div><strong>'+esc(g.user.displayName)+'</strong><div class="rz-mini rz-profile-handle">@'+esc(g.user.publicUsername||g.user.username)+verified(g.user)+'</div></div></div>'+g.stories.map(function(s){return '<div class="rz-card"><div class="rz-post-body">'+esc(s.text||"")+'</div>'+renderMedia(s.mediaUrl)+'</div>';}).join("")+'</div>';}).join("");
  return card("STORIES","<h2>Creator stories</h2><p class='rz-muted'>Stories expire after 24 hours.</p><form id='storyForm'><textarea id='storyText' class='rz-textarea' placeholder='Add a story'></textarea><input id='storyMedia' type='hidden'><div class='rz-media-picker'><input id='storyMediaFile' class='rz-media-file' type='file' accept='image/*,video/*,audio/*'><div id='storyMediaStatus' class='rz-media-status'></div></div><button class='rz-btn primary'>Publish story</button><div id='storyError' class='rz-error'></div></form><div class='rz-feed'>"+(groups||"<div class='rz-empty'>No active stories yet.</div>")+"</div>");
}
function communitiesView(){
  var body="<h2>Creator communities</h2><p class='rz-muted'>Focused spaces for creators.</p><form id='communityForm'><input id='communityName' class='rz-input' placeholder='Community name' required><textarea id='communityDescription' class='rz-textarea' placeholder='What is it for?'></textarea><button class='rz-btn primary'>Create community</button></form><div class='rz-feed'>";
  body+=(state.communities||[]).map(function(c){return '<div class="rz-card"><h3>'+esc(c.name)+'</h3><p class="rz-muted">'+esc(c.description)+'</p><span class="rz-badge">'+c.memberCount+' members</span> <button class="rz-btn" data-community="'+esc(c.id)+'">'+(c.joined?"Leave":"Join")+"</button></div>";}).join("")||"<div class='rz-empty'>No communities yet.</div>";
  return card("COMMUNITIES",body+"</div>");
}
function messagesView(){
  var body="<h2>Messages</h2><p class='rz-muted'>Private conversations with creators. Unread messages stay marked until you open the chat.</p><div class='rz-chat-start'><input id='messageUser' class='rz-input' autocomplete='off' placeholder='Find a creator by username' aria-label='Creator username'><button id='openMessage' class='rz-btn primary'>Start chat</button></div><div class='rz-feed rz-conversation-list' aria-label='Your conversations'>";
  body+=(state.conversations||[]).map(function(c){var unread=Number(c.unread||0);return '<button class="rz-conversation-row" data-chat="'+esc(c.otherUserId)+'" aria-label="'+esc(c.user.displayName)+', '+(unread?unread+' unread messages':'open conversation')+'">'+avatar(c.user)+'<span class="rz-conversation-copy"><strong>'+esc(c.user.displayName)+'</strong><span class="rz-mini">@'+esc(c.user.publicUsername||c.user.username)+'</span><span class="rz-conversation-preview">'+esc(c.lastText||"Start a conversation")+'</span></span><span class="rz-conversation-meta"><time>'+esc(chatTime(c.lastAt,true))+'</time>'+(unread?'<b class="rz-conversation-unread">'+(unread>99?'99+':unread)+'</b>':'')+'</span></button>';}).join("")||"<div class='rz-empty'>No messages yet. Start a chat with a creator by username.</div>";
  return card("MESSAGES",body+"</div><div id='chatBox'></div>");
}
function chatTime(value,dateOnly){var date=new Date(value);if(!value||!Number.isFinite(date.getTime()))return "";var today=new Date();var sameDay=date.getFullYear()===today.getFullYear()&&date.getMonth()===today.getMonth()&&date.getDate()===today.getDate();try{return sameDay&&!dateOnly?new Intl.DateTimeFormat([],{hour:"numeric",minute:"2-digit"}).format(date):sameDay?"Today":new Intl.DateTimeFormat([],{month:"short",day:"numeric"}).format(date);}catch(_){return date.toLocaleDateString();}}
function opportunitiesView(){
  var body="<h2>Creator opportunities</h2><p class='rz-muted'>Platform, growth and community opportunities.</p><div class='rz-feed'>";
  body+=(state.opportunities||[]).map(function(o){return '<div class="rz-card"><div class="rz-kicker">'+esc(o.type)+'</div><h3>'+esc(o.title)+'</h3><p class="rz-muted">'+esc(o.description)+'</p><button class="rz-btn" '+(o.applied?"disabled":"")+' data-opportunity="'+esc(o.id)+'">'+(o.applied?"Applied":"Apply")+"</button></div>";}).join("")||"<div class='rz-empty'>No opportunities yet.</div>";
  return card("OPPORTUNITIES",body+"</div>");
}
function analyticsView(){
  var a=state.analytics||{};
  return '<div class="rz-grid"><div class="rz-card rz-span-12"><div class="rz-kicker">ANALYTICS</div><h2>Creator dashboard</h2><p class="rz-muted">Live activity from your RIZORA account.</p></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">POSTS</div><div class="rz-stat">'+Number(a.posts||0)+'</div></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">FOLLOWERS</div><div class="rz-stat">'+Number(a.followers||0)+'</div></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">LIKES</div><div class="rz-stat">'+Number(a.likes||0)+'</div></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">COMMENTS</div><div class="rz-stat">'+Number(a.comments||0)+'</div></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">SAVES</div><div class="rz-stat">'+Number(a.saves||0)+'</div></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">REPOSTS</div><div class="rz-stat">'+Number(a.reposts||0)+'</div></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">STORIES</div><div class="rz-stat">'+Number(a.stories||0)+'</div></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">POINTS</div><div class="rz-stat">'+Number(a.points||0)+'</div></div>'+
  '<div class="rz-card rz-span-4"><div class="rz-kicker">WARNINGS</div><div class="rz-stat">'+Number(a.warningCount||0)+'/3</div></div></div>';
}
function wireStories(){
  $("storyForm").onsubmit=async function(e){e.preventDefault();try{await api("/api/v2/stories",{method:"POST",body:JSON.stringify({text:$("storyText").value,mediaUrl:$("storyMedia").value})});toast("Story published.");load();}catch(err){$("storyError").textContent=err.message;}};bindMediaPicker("storyMediaFile","storyMediaStatus","storyMedia");
}
function wireCommunities(){
  $("communityForm").onsubmit=async function(e){e.preventDefault();try{await api("/api/v2/communities",{method:"POST",body:JSON.stringify({name:$("communityName").value,description:$("communityDescription").value})});toast("Community created.");load();}catch(err){toast(err.message);}};
  document.querySelectorAll("[data-community]").forEach(function(b){b.onclick=function(){api("/api/v2/communities/"+b.getAttribute("data-community")+"/join",{method:"POST"}).then(load).catch(function(e){toast(e.message);});};});
}
function wireMessages(){
  $("openMessage").onclick=function(){var target=$("messageUser").value.trim();if(target)openChat(target);};
  document.querySelectorAll("[data-chat]").forEach(function(b){b.onclick=function(){openChat(b.getAttribute("data-chat"));};});
}
async function openChat(target){
  try{
    var d=await api("/api/v2/messages/"+encodeURIComponent(target));
    var messageHtml=d.messages.map(function(m){
      var audio="";
      if(m.mediaUrl){
        audio='<audio controls preload="metadata" style="width:100%;margin-top:8px" data-rz-media-src="'+esc(m.mediaUrl)+'"></audio>';
      }
      var own=m.fromUserId===state.user.id,when=chatTime(m.createdAt,false),receipt=own?'<span class="rz-message-receipt" aria-label="'+(m.read?'Read':'Sent')+'">'+(m.read?'✓✓ Read':'✓ Sent')+'</span>':'';
      return '<article class="rz-message-bubble '+(own?'rz-message-own':'rz-message-theirs')+'" aria-label="'+(own?'You':esc(d.user&&d.user.displayName||d.user&&d.user.username||"Creator"))+' at '+esc(when)+'">'+(m.messageType==="voice"?'<span class="rz-message-kind">Voice message</span>':"")+(m.text?'<div class="rz-message-text">'+esc(m.text)+'</div>':"")+audio+'<div class="rz-message-meta"><time>'+esc(when)+'</time>'+receipt+'</div></article>';
    }).join("");
    var streakCount=Number(d.streak&&d.streak.count||0),streakMarkup=streakCount?'<span class="rz-chat-streak" title="Both of you exchanged messages on '+streakCount+' consecutive days">🔥 '+streakCount+' day'+(streakCount===1?'':'s')+'</span>':'';
    $("chatBox").innerHTML='<section class="rz-card rz-chat-thread" aria-label="Chat with '+esc(d.user.displayName)+'"><header class="rz-chat-title">'+avatar(d.user)+'<div class="rz-chat-person"><h3>'+esc(d.user.displayName)+'</h3><div class="rz-mini">@'+esc(d.user.publicUsername||d.user.username)+'</div></div>'+streakMarkup+'</header><div class="rz-chat-history" role="log" aria-live="polite" aria-relevant="additions text">'+(messageHtml||'<div class="rz-chat-empty">Say hello and start your conversation.</div>')+'</div><form id="messageForm" data-chat-target="'+esc(target)+'" class="rz-chat-composer"><textarea id="messageText" class="rz-input" rows="1" maxlength="2000" placeholder="Write a message" aria-label="Write a message"></textarea><button type="submit" class="rz-btn primary">Send</button></form></section>';
    var history=$("chatBox").querySelector(".rz-chat-history");if(history)history.scrollTop=history.scrollHeight;
    $("messageForm").onsubmit=async function(e){e.preventDefault();var text=$("messageText").value.trim();if(!text)return;try{await api("/api/v2/messages/"+encodeURIComponent(target),{method:"POST",body:JSON.stringify({text:text})});openChat(target);}catch(err){toast(err.message);}};if(window.RIZORA_VOICE_WIRE)window.RIZORA_VOICE_WIRE();
  }catch(err){toast(err.message);}
}
window.RIZORA_OPEN_CHAT=openChat;

function boostsView(){
  var rows=(state.boosts||[]).map(function(b){
    return '<div class="rz-card rz-task"><strong>'+esc(b.username)+' · '+esc(b.platform)+' · '+esc(b.action)+'</strong><div class="rz-mini">'+Number(b.remaining||0)+' completions left</div><span class="rz-points">+'+Number(b.reward||0)+' pts</span><div class="rz-actions"><button class="rz-btn primary" data-boost="'+esc(b.id)+'">Complete boost</button><a class="rz-btn" href="'+esc(b.url)+'" target="_blank" rel="noopener">Open</a></div></div>';
  }).join("");
  if(!rows)rows="<div class='rz-empty'>No active boosts yet.</div>";
  return card("BOOSTS","<h2>Creator Boost Network</h2><p class='rz-muted'>Fund creator actions with RIZORA points.</p>"+
    "<form id='boostForm'><input id='boostUsername' class='rz-input' placeholder='Creator username' required><select id='boostPlatform' class='rz-input'><option>tiktok</option><option>instagram</option><option>x</option><option>youtube</option><option>facebook</option></select><select id='boostAction' class='rz-input'><option>follow</option><option>like</option><option>subscribe</option><option>view</option></select><input id='boostUrl' class='rz-input' placeholder='https://...' required><input id='boostReward' class='rz-input' type='number' min='1' max='100' value='5'><input id='boostQuantity' class='rz-input' type='number' min='1' max='500' value='10'><button class='rz-btn primary'>Create boost</button><div id='boostError' class='rz-error'></div></form>"+
    "<div class='rz-feed'>"+rows+"</div>");
}
function officialView(){
  var rows=(state.official||[]).map(function(p){
    var linksData=p.links||p||{},links="";
    if(linksData.website)links+='<a class="rz-btn" href="'+esc(linksData.website)+'" target="_blank" rel="noopener noreferrer">Website</a>';
    if(linksData.tiktok)links+='<a class="rz-btn" href="'+esc(linksData.tiktok)+'" target="_blank" rel="noopener noreferrer">TikTok</a>';
    if(linksData.instagram)links+='<a class="rz-btn" href="'+esc(linksData.instagram)+'" target="_blank" rel="noopener noreferrer">Instagram</a>';
    if(linksData.x)links+='<a class="rz-btn" href="'+esc(linksData.x)+'" target="_blank" rel="noopener noreferrer">X</a>';
    return '<div class="rz-card"><div class="rz-post-head">'+avatar(p)+'<div><strong>'+esc(p.displayName||p.username)+'</strong><div class="rz-mini rz-profile-handle">@'+esc(p.publicUsername||p.username)+verified(p)+'</div></div></div><div class="rz-actions">'+links+"</div></div>";
  }).join("");
  if(!rows)rows="<div class='rz-empty'>Official identities are loading.</div>";
  return card("OFFICIAL","<h2>Verified RIZORA identities</h2><p class='rz-muted'>Official platform and verified creator profiles.</p><div class='rz-feed'>"+rows+"</div>");
}
function adminView(){
  if(!state.user||state.user.role!=="super_admin")return card("ACCESS","<h2>Super Admin</h2><p class='rz-muted'>This area is only available to super admins.</p>");
  var a=state.admin&&state.admin.stats||{};
  var users=(state.admin&&state.admin.users)||[];
  var rows=users.slice().reverse().slice(0,20).map(function(u){
    var action=u.status==="active"?"":"<button class='rz-btn' data-recover='"+esc(u.id)+"'>Recover</button>",badgeOptions=[["","Automatic"],["early","Purple · early member"],["premium","Blue · Premium"],["premium_plus","Black · Premium+"]].map(function(option){return '<option value="'+option[0]+'" '+(String(u.verificationBadgeType||"")===option[0]?"selected":"")+'>'+option[1]+'</option>';}).join("");
    return '<div class="rz-card rz-admin-user"><strong>'+esc(u.displayName||u.username)+'</strong><div class="rz-mini">@'+esc(u.username)+' · '+esc(u.status||"active")+' · '+esc(u.role||"user")+'</div><div class="rz-admin-badge-controls"><label>Profile badge<select class="rz-input" data-badge-select aria-label="Profile badge for '+esc(u.username)+'">'+badgeOptions+'</select></label><button type="button" class="rz-btn" data-badge-user="'+esc(u.id)+'">Assign badge</button>'+action+'</div></div>';
  }).join("");
  if(!rows)rows="<div class='rz-empty'>No users returned.</div>";
  var pending=(state.adminVerification||[]).filter(function(r){return r.status==="pending";}).map(function(r){
    var requestId=r.id||"";
    return '<div class="rz-card"><strong>'+esc((r.user&&r.user.displayName)||"Creator")+'</strong><div class="rz-mini">@'+esc((r.user&&r.user.username)||"unknown")+'</div><button class="rz-btn primary" data-grant="'+esc(requestId)+'">Grant verification</button></div>';
  }).join("");
  if(!pending)pending="<div class='rz-empty'>No pending verification requests.</div>";
  var socialReviews=(state.adminSocialReviews||[]).map(function(r){var proof=r.proofMedia&&r.proofMedia.url?'<a class="rz-btn" href="'+esc(r.proofMedia.url)+'" target="_blank" rel="noopener noreferrer">Open screenshot</a><img class="rz-review-proof" src="'+esc(r.proofMedia.url)+'" alt="Submitted task proof">':'<p class="rz-error">Screenshot file is unavailable.</p>';return '<article class="rz-card"><strong>'+esc(r.taskTitle||"Social mission")+'</strong><div class="rz-mini">'+esc(r.user&&r.user.displayName||r.user&&r.user.username||"Creator")+' · +'+Number(r.reward||0)+' points · '+new Date(r.createdAt).toLocaleString()+'</div>'+proof+'<div class="rz-actions"><button type="button" class="rz-btn primary" data-social-review="'+esc(r.id)+'" data-decision="approve">Approve reward</button><button type="button" class="rz-btn" data-social-review="'+esc(r.id)+'" data-decision="reject">Request clearer proof</button></div></article>';}).join("");
  if(!socialReviews)socialReviews="<div class='rz-empty'>No task proofs are waiting for review.</div>";
  var recentUpdates=(state.updates||[]).slice(0,8).map(function(item){var media=item.mediaUrl?'<a class="rz-btn" href="'+esc(normalizeMediaUrl(item.mediaUrl))+'" target="_blank" rel="noopener noreferrer">Open attachment</a>':'';return '<div class="rz-suite-history-row"><strong>'+esc(item.title)+'</strong><span>'+esc(item.message||"")+'</span><time>'+esc(postTime(item.createdAt))+'</time>'+media+'</div>';}).join("")||'<div class="rz-empty">No updates published yet.</div>';
  return '<div class="rz-grid"><div class="rz-card rz-span-12"><div class="rz-kicker">SUPER ADMIN COMMAND CENTER</div><h2>RIZORA control surface</h2><p class="rz-muted">Live platform data, verification, profile badges and account recovery. Profile badges do not change plan access.</p></div>'+
    '<div class="rz-card rz-span-4"><div class="rz-kicker">TOTAL USERS</div><div class="rz-stat">'+Number(a.totalUsers||users.length||0)+'</div></div>'+
    '<div class="rz-card rz-span-4"><div class="rz-kicker">REFERRALS</div><div class="rz-stat">'+Number(a.totalReferrals||((state.admin&&state.admin.referrals)||[]).length||0)+'</div></div>'+
    '<div class="rz-card rz-span-4"><div class="rz-kicker">AUDIT LOGS</div><div class="rz-stat">'+Number(((state.admin&&state.admin.audit)||[]).length||0)+'</div></div>'+
    '<div class="rz-card rz-span-12"><div class="rz-section-title"><h3>Task proof review</h3><span class="rz-mini">Rewards stay on hold until a reviewer approves the screenshot.</span></div><div class="rz-feed">'+socialReviews+'</div></div>'+
    '<div class="rz-card rz-span-6"><div class="rz-section-title"><h3>Verification queue</h3><button id="adminRefresh" class="rz-btn">Refresh</button></div><div class="rz-feed">'+pending+'</div></div>'+
    '<div class="rz-card rz-span-6"><div class="rz-section-title"><h3>Recent users</h3></div><div class="rz-feed">'+rows+'</div></div>'+
    '<div class="rz-card rz-span-12"><div class="rz-kicker">PUBLISH TO EVERY HOME</div><h3>RIZORA updates</h3><p class="rz-muted">Share platform news with text, an image, or a video. Published updates appear on Home and in users’ notification inboxes.</p><form id="rzPlatformUpdateForm" class="rz-platform-update-form"><label>Title<input class="rz-input" name="title" maxlength="140" required></label><label>Message<textarea class="rz-textarea" name="message" maxlength="3000" placeholder="Write an update"></textarea></label><label>Image or video<input id="rzPlatformUpdateFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"></label><small id="rzPlatformUpdateStatus" class="rz-mini" role="status" aria-live="polite"></small><button class="rz-btn primary" type="submit">Publish update</button></form><h4>Recent updates</h4><div class="rz-feed">'+recentUpdates+'</div></div></div>';
}


function wireBoosts(){
  $("boostForm").onsubmit=async function(e){
    e.preventDefault();
    try{
      await api("/api/boosts/create",{method:"POST",body:JSON.stringify({username:$("boostUsername").value,platform:$("boostPlatform").value,action:$("boostAction").value,url:$("boostUrl").value,reward:Number($("boostReward").value),maxCompletions:Number($("boostQuantity").value)})});
      toast("Boost created.");load();
    }catch(err){$("boostError").textContent=err.message;}
  };
  document.querySelectorAll("[data-boost]").forEach(function(b){
    b.onclick=function(){
      api("/api/boosts/complete",{method:"POST",body:JSON.stringify({boostId:b.getAttribute("data-boost")})}).then(load).catch(function(e){toast(e.message);});
    };
  });
}
function wireAdmin(){
  if($("adminRefresh"))$("adminRefresh").onclick=load;
  var updateForm=$("rzPlatformUpdateForm");if(updateForm)updateForm.onsubmit=async function(event){event.preventDefault();var status=$("rzPlatformUpdateStatus"),file=$("rzPlatformUpdateFile")&&$("rzPlatformUpdateFile").files[0],button=updateForm.querySelector('button[type="submit"]'),media=null;if(button)button.disabled=true;try{if(file){if(typeof window.RIZORA_UPLOAD_FILE!=="function")throw new Error("Secure media upload is still loading. Try again.");media=await window.RIZORA_UPLOAD_FILE(file,status);}var result=await api("/api/v2/admin/updates",{method:"POST",body:JSON.stringify({title:updateForm.elements.title.value,message:updateForm.elements.message.value,mediaId:media&&media.id||""})});if(status)status.textContent="Update published and added to user notifications.";toast("RIZORA update published.");load();}catch(error){if(status)status.textContent=error.message||"Update could not be published.";if(button)button.disabled=false;}};
  document.querySelectorAll("[data-social-review]").forEach(function(button){button.onclick=async function(){var id=button.getAttribute("data-social-review"),decision=button.getAttribute("data-decision");button.disabled=true;try{await api("/api/social/tasks/review",{method:"POST",body:JSON.stringify({completionId:id,decision:decision})});toast(decision==="approve"?"Mission proof approved and points credited.":"Proof declined. Creator can submit clearer evidence.");load();}catch(error){button.disabled=false;toast(error.message||"Review could not be saved.");}};});
  document.querySelectorAll("[data-recover]").forEach(function(b){
    b.onclick=async function(){
      try{
        await api("/api/v2/admin/users/"+encodeURIComponent(b.getAttribute("data-recover"))+"/recover",{method:"POST",body:JSON.stringify({resetWarnings:false})});
        toast("Account restored.");load();
      }catch(e){toast(e.message);}
    };
  });
  document.querySelectorAll("[data-badge-user]").forEach(function(button){button.onclick=async function(){var row=button.closest(".rz-admin-user"),select=row&&row.querySelector("[data-badge-select]");button.disabled=true;try{await api("/api/v2/admin/users/"+encodeURIComponent(button.getAttribute("data-badge-user"))+"/badge",{method:"POST",body:JSON.stringify({type:select?select.value:""})});toast("Profile badge updated.");load();}catch(error){toast(error.message||"Badge could not be assigned.");button.disabled=false;}};});
  document.querySelectorAll("[data-grant]").forEach(function(b){
    b.onclick=async function(){
      try{
        await api("/api/superadmin/verification/action",{method:"POST",body:JSON.stringify({requestId:b.getAttribute("data-grant"),action:"approve"})});
        toast("Verification granted.");load();
      }catch(e){toast(e.message);}
    };
  });
}


function wireOpportunities(){
  document.querySelectorAll("[data-opportunity]").forEach(function(b){b.onclick=function(){api("/api/v2/opportunities/"+b.getAttribute("data-opportunity")+"/apply",{method:"POST",body:"{}"}).then(function(){toast("Application submitted.");load();}).catch(function(e){toast(e.message);});};});
}
function wirePeopleTagComposer(){
  var editor=$("postMediaEditor"),preview=editor&&editor.querySelector("[data-media-preview]"),search=$("postTagSearch"),results=$("postTagResults"),status=$("postTagStatus"),queue=$("postTagQueue");
  if(!editor||!preview||!search||!results||!status||!queue)return;
  if(!Array.isArray(state.composerPeopleTags))state.composerPeopleTags=[];
  var timer=null,sequence=0,drag=null;
  function setStatus(message){status.textContent=message||"";}
  function renderQueue(){
    queue.innerHTML=(state.composerPeopleTags||[]).map(function(tag,index){return '<div class="rz-tag-queue-item"><span>@'+esc(tag.username||"creator")+'</span><button type="button" class="rz-text-action" data-remove-composer-tag="'+index+'">Remove</button></div>';}).join("")||'<p class="rz-mini">No people tagged yet.</p>';
    syncComposerPeopleTags(editor);
    queue.querySelectorAll("[data-remove-composer-tag]").forEach(function(button){button.onclick=function(){state.composerPeopleTags.splice(Number(button.getAttribute("data-remove-composer-tag")),1);renderQueue();};});
  }
  function positionFor(event,media){var rect=media.getBoundingClientRect();return{x:Math.round(Math.max(0,Math.min(100,(event.clientX-rect.left)/rect.width*100))*10)/10,y:Math.round(Math.max(0,Math.min(100,(event.clientY-rect.top)/rect.height*100))*10)/10};}
  search.oninput=function(){var q=String(search.value||"").trim().replace(/^@/,"");if(timer)clearTimeout(timer);if(q.length<1){results.innerHTML="";return;}var request=++sequence;timer=setTimeout(async function(){try{var data=await api("/api/v2/tagging/search?q="+encodeURIComponent(q));if(request!==sequence)return;results.innerHTML=(data.users||[]).map(function(person){var username=person.publicUsername||person.username;return '<button type="button" class="rz-tag-search-result" data-tag-user="'+esc(person.id)+'" data-tag-username="'+esc(username)+'" data-tag-name="'+esc(person.displayName||username)+'"><span>'+avatar(person)+'</span><span><strong>'+esc(person.displayName||username)+'</strong><small>@'+esc(username)+'</small></span></button>';}).join("")||'<p class="rz-mini">No creators you can tag matched that search.</p>';results.querySelectorAll("[data-tag-user]").forEach(function(button){button.onclick=function(){state.pendingPeopleTag={userId:button.getAttribute("data-tag-user"),username:button.getAttribute("data-tag-username"),displayName:button.getAttribute("data-tag-name")};setStatus("Tap the photo or video to place @"+state.pendingPeopleTag.username+".");search.value="";results.innerHTML="";var details=$("postTagPeople");if(details)details.open=true;};});}catch(error){results.innerHTML='<p class="rz-error">'+esc(error.message||"Creator search is unavailable.")+'</p>';}} ,180);};
  preview.addEventListener("pointerdown",function(event){var marker=event.target.closest("[data-composer-tag-index]");if(!marker)return;event.preventDefault();event.stopPropagation();var index=Number(marker.getAttribute("data-composer-tag-index")),media=marker.closest(".rz-post-media");if(!media)return;drag={index:index,marker:marker,media:media,moved:false,pointerId:event.pointerId};if(marker.setPointerCapture)marker.setPointerCapture(event.pointerId);});
  preview.addEventListener("pointermove",function(event){if(!drag||drag.pointerId!==event.pointerId)return;var point=positionFor(event,drag.media),tag=state.composerPeopleTags[drag.index];if(!tag)return;if(Math.abs(point.x-Number(tag.x))>1||Math.abs(point.y-Number(tag.y))>1)drag.moved=true;tag.x=point.x;tag.y=point.y;drag.marker.style.left=point.x+"%";drag.marker.style.top=point.y+"%";});
  preview.addEventListener("pointerup",function(event){if(!drag||drag.pointerId!==event.pointerId)return;var finished=drag;drag=null;if(!finished.moved)state.composerPeopleTags.splice(finished.index,1);renderQueue();});
  preview.addEventListener("pointercancel",function(){drag=null;});
  preview.addEventListener("click",function(event){if(event.target.closest("[data-composer-tag-index]"))return;if(!state.pendingPeopleTag)return;var visual=event.target.closest(".rz-post-media img, .rz-post-media video");if(!visual)return;var media=visual.closest(".rz-post-media"),point=positionFor(event,media),pending=state.pendingPeopleTag,existing=(state.composerPeopleTags||[]).find(function(tag){return tag.userId===pending.userId;});if(existing){existing.x=point.x;existing.y=point.y;}else{state.composerPeopleTags.push({userId:pending.userId,username:pending.username,x:point.x,y:point.y});}state.pendingPeopleTag=null;event.preventDefault();event.stopPropagation();setStatus("Tag placed. You can drag it to move it.");renderQueue();});
  renderQueue();
}
function postTime(value){var date=new Date(value);if(!value||!Number.isFinite(date.getTime()))return "";var minutes=Math.max(0,Math.floor((Date.now()-date.getTime())/60000));if(minutes<1)return "now";if(minutes<60)return minutes+"m ago";var hours=Math.floor(minutes/60);if(hours<24)return hours+"h ago";var days=Math.floor(hours/24);if(days<7)return days+"d ago";return chatTime(value,true);}
function post(p){
  var pollHtml="";
  if(p.poll){
    var total=(p.poll.options||[]).reduce(function(sum,o){return sum+Number(o.votes||0);},0);
    pollHtml='<div class="rz-card" style="margin:12px 0"><strong>'+esc(p.poll.question||"Poll")+'</strong>'+
      (p.poll.options||[]).map(function(o){
        var pct=total?Math.round(Number(o.votes||0)*100/total):0;
        return '<button class="rz-poll-option" data-poll-vote="'+esc(p.id)+'" data-poll-option="'+esc(o.id)+'" style="display:block;width:100%;text-align:left;margin-top:7px;padding:10px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.03);color:inherit">'+
          '<strong>'+esc(o.label)+'</strong><span class="rz-mini"> · '+pct+'% · '+Number(o.votes||0)+' vote(s)</span></button>';
      }).join("")+'</div>';
  }
  var authorHandle=String(p.author&& (p.author.publicUsername||p.author.username)||"creator"),authorUrl="/creator/"+encodeURIComponent(authorHandle)+"/";
  var collabHtml=(p.collaborators||[]).length
    ? '<div class="rz-mini" style="margin-top:7px">With '+(p.collaborators||[]).map(function(x){return '@'+esc(x.publicUsername||x.username);}).join(", ")+'</div>'
    : "";
  return '<article class="rz-card"><div class="rz-post-head">'+avatar(p.author)+'<div><a class="rz-post-author" href="'+authorUrl+'"><strong>'+esc(p.author.displayName||p.author.username||"Creator")+'</strong></a><div class="rz-mini rz-profile-handle"><a class="rz-post-author-handle" href="'+authorUrl+'">@'+esc(authorHandle)+"</a>"+verified(p.author)+"</div>"+'<time class="rz-mini" datetime="'+esc(p.createdAt||"")+'">'+esc(postTime(p.createdAt))+'</time>'+collabHtml+"</div></div><div class='rz-post-body'>"+esc(p.text||"")+"</div>"+(p.aiAssisted?'<span class="rz-badge">AI-assisted</span>':"")+renderMedia(p.mediaUrl,p.mediaStyle,false,p.peopleTags)+pollHtml+"<div class='rz-tags'>"+(p.hashtags||[]).map(function(t){return '<button type="button" class="rz-tag" data-hashtag="'+esc(t)+'">#'+esc(t)+"</button>";}).join("")+"</div><div class='rz-post-actions'><button type='button' class='rz-post-action' data-like='"+p.id+"' aria-label='Like post' title='Like'><svg viewBox='0 0 24 24' aria-hidden='true'><path d='M20.8 8.8c0 5.3-8.8 10.1-8.8 10.1S3.2 14.1 3.2 8.8A4.7 4.7 0 0 1 12 6.5a4.7 4.7 0 0 1 8.8 2.3Z'/></svg><span>"+Number((p.metrics||{}).likes||0)+"</span></button><button type='button' class='rz-post-action' data-comment='"+p.id+"' aria-label='Comment on post' title='Comment'><svg viewBox='0 0 24 24' aria-hidden='true'><path d='M20 11.5a7.7 7.7 0 0 1-8 7.5 8.6 8.6 0 0 1-3.6-.8L4 19l1.1-3.3A7.2 7.2 0 0 1 4 11.5 7.7 7.7 0 0 1 12 4a7.7 7.7 0 0 1 8 7.5Z'/></svg><span>"+Number((p.metrics||{}).comments||0)+"</span></button><button type='button' class='rz-post-action' data-save='"+p.id+"' aria-label='Save post' title='Save'><svg viewBox='0 0 24 24' aria-hidden='true'><path d='M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-4-6 4V4.8Z'/></svg><span>"+Number((p.metrics||{}).saves||0)+"</span></button><button type='button' class='rz-post-action' data-share-post='"+p.id+"' aria-label='Share post' title='Share'><svg viewBox='0 0 24 24' aria-hidden='true'><path d='M15 7 20 12l-5 5'/><path d='M20 12H9a5 5 0 0 0-5 5v2'/><path d='M9 4h3'/></svg><span>Share</span></button>"+(state.user&&String(state.user.id)===String(p.userId)?'<button type="button" class="rz-post-action rz-post-edit" data-edit-post="'+esc(p.id)+'">Edit</button>':"")+"</div></article>";
}
async function openEditPost(postId){
  var old=document.getElementById("rzEditPostModal");if(old)old.remove();
  var pools=[state.feed,state.profilePosts,state.discover&&state.discover.posts,state.hashtagDetail&&state.hashtagDetail.posts,state.search&&state.search.posts];
  var item=null;pools.forEach(function(pool){(Array.isArray(pool)?pool:[]).forEach(function(postItem){if(String(postItem.id)===String(postId))item=postItem;});});
  if(!item||!state.user||String(item.userId)!==String(state.user.id)){toast("Only the author can edit this post.");return;}
  var wrap=document.createElement("div");wrap.id="rzEditPostModal";wrap.className="rz-overlay";
  wrap.innerHTML='<section class="rz-modal rz-edit-post-dialog" role="dialog" aria-modal="true" aria-labelledby="rzEditPostHeading" tabindex="-1"><div class="rz-section-title"><div><div class="rz-kicker">EDIT POST</div><h2 id="rzEditPostHeading">Update your post</h2></div><button type="button" class="rz-btn" id="rzEditPostClose" aria-label="Close edit post">Close</button></div><form id="rzEditPostForm"><label class="rz-label" for="rzEditPostText">Caption</label><textarea id="rzEditPostText" class="rz-textarea" maxlength="4000">'+esc(item.text||"")+'</textarea><input id="rzEditPostMedia" type="hidden" value="'+esc(item.mediaUrl||"")+'">'+(item.mediaUrl?'<div class="rz-edit-current-media">'+renderMedia(item.mediaUrl)+'</div>':"")+'<div class="rz-media-picker"><label class="rz-label" for="rzEditPostMediaFile">Replace media</label><input id="rzEditPostMediaFile" class="rz-media-file" type="file" accept="image/*,video/*,audio/*"><div id="rzEditPostMediaStatus" class="rz-media-status" role="status" aria-live="polite"></div></div>'+postMediaEditor(item.mediaUrl,item.mediaStyle,"rzEditPostMediaEditor")+'<div class="rz-actions"><button type="button" class="rz-btn" id="rzEditPostRemoveMedia">Remove media</button><button type="button" class="rz-btn" id="rzEditPostCancel">Cancel</button><button type="submit" class="rz-btn primary">Save changes</button></div><div id="rzEditPostError" class="rz-error" role="alert"></div></form></section>';
  document.body.appendChild(wrap);
  var close=function(){wrap.remove();};
  wrap.querySelector("#rzEditPostClose").onclick=close;
  wrap.querySelector("#rzEditPostCancel").onclick=close;
  wrap.onclick=function(event){if(event.target===wrap)close();};
  wrap.querySelector("#rzEditPostRemoveMedia").onclick=function(){var media=wrap.querySelector("#rzEditPostMedia");if(media){media.value="";media.dispatchEvent(new Event("change"));}var status=wrap.querySelector("#rzEditPostMediaStatus");if(status)status.textContent="Attached media will be removed when you save.";};
  bindMediaPicker("rzEditPostMediaFile","rzEditPostMediaStatus","rzEditPostMedia");
  wirePostMediaEditor("rzEditPostMediaEditor","rzEditPostMedia");
  var dialog=wrap.querySelector(".rz-edit-post-dialog");if(dialog)dialog.focus();
  wrap.querySelector("#rzEditPostForm").onsubmit=async function(event){
    event.preventDefault();var error=wrap.querySelector("#rzEditPostError");error.textContent="";
    try{await api("/api/v2/posts/"+encodeURIComponent(postId),{method:"PATCH",body:JSON.stringify({text:wrap.querySelector("#rzEditPostText").value,mediaUrl:wrap.querySelector("#rzEditPostMedia").value,mediaStyle:JSON.parse(wrap.querySelector("[data-media-style-value]").value||"{}")})});close();toast("Post updated.");await load();}
    catch(saveError){error.textContent=saveError.message||"Post could not be updated.";}
  };
}
window.RIZORA_EDIT_POST=openEditPost;

async function openComments(postId,sortMode){
  var old=$("rzCommentsModal");if(old)old.remove();
  try{
    var activeSort=sortMode==="top"?"top":"newest",d=await api("/api/v2/posts/"+encodeURIComponent(postId)+"/comments?sort="+activeSort),comments=d.comments||[];
    var wrap=document.createElement("div");wrap.id="rzCommentsModal";wrap.className="rz-comments-overlay";
    function commentHtml(c,depth){
      var pad=Math.min(Number(depth||0),3)*18;
      var audio="";
      if(c.mediaUrl){
        audio='<audio controls preload="metadata" style="width:100%;margin-top:8px" data-rz-media-src="'+esc(c.mediaUrl)+'"></audio>';
      }
      var commentActions='<div class="rz-comment-actions"><button type="button" class="rz-comment-link" data-comment-action="like" data-comment-id="'+esc(c.id)+'" aria-pressed="'+(c.liked?"true":"false")+'">'+(c.liked?"Liked":"Like")+' · '+Number(c.likes||0)+'</button><button type="button" class="rz-comment-link" data-comment-reply="'+esc(c.id)+'" data-comment-user="'+esc(c.author&&(c.author.publicUsername||c.author.username)||"creator")+'">Reply</button>'+(d.viewerIsPostOwner&&depth===0?'<button type="button" class="rz-comment-link" data-comment-action="'+(c.pinned?"unpin":"pin")+'" data-comment-id="'+esc(c.id)+'">'+(c.pinned?"Unpin":"Pin")+'</button>':"")+(c.canDelete?'<button type="button" class="rz-comment-link" data-comment-action="delete" data-comment-id="'+esc(c.id)+'">Delete</button>':"")+'</div>';
      return '<article class="rz-comment-row'+(c.pinned?" is-pinned":"")+'" style="--rz-comment-depth:'+pad+'px">'+(c.pinned?'<div class="rz-comment-pinned">Pinned</div>':"")+'<div class="rz-comment-byline"><strong>'+esc(c.author&&c.author.displayName||c.author&&c.author.username||"Creator")+'</strong> <span class="rz-mini">@'+esc(c.author&&(c.author.publicUsername||c.author.username)||"")+'</span> <time class="rz-mini">'+esc(postTime(c.createdAt))+'</time></div>'+(c.text?'<div class="rz-comment-text">'+esc(c.text)+'</div>':"")+(c.messageType==="voice"?'<div class="rz-mini">Voice comment</div>':"")+audio+commentActions+(c.replies||[]).map(function(r){return commentHtml(r,Number(depth||0)+1);}).join("")+'</article>';
    }
    wrap.innerHTML='<section class="rz-comments-sheet" role="dialog" aria-modal="true" aria-labelledby="rzCommentsHeading"><header class="rz-comments-header"><div><div class="rz-kicker">COMMENTS</div><h2 id="rzCommentsHeading">'+Number(d.total||0)+' comments</h2></div><div class="rz-comments-tools"><label class="rz-mini" for="rzCommentSort">Sort</label><select id="rzCommentSort" class="rz-comment-sort"><option value="top"'+(activeSort==="top"?" selected":"")+'>Top</option><option value="newest"'+(activeSort==="newest"?" selected":"")+'>Newest</option></select><button type="button" id="rzCommentsClose" class="rz-comment-link">Close</button></div></header><div class="rz-comments-list">'+(comments.length?comments.map(function(c){return commentHtml(c,0);}).join(""):'<div class="rz-comments-empty">No comments yet. Be the first to comment.</div>')+'</div><form id="rzCommentForm" class="rz-comment-form" data-post-id="'+esc(postId)+'"><textarea id="rzCommentText" class="rz-textarea" maxlength="1000" placeholder="Write a comment..."></textarea><div class="rz-comment-submit-row"><div id="rzCommentStatus" class="rz-error" role="alert"></div><button type="submit" class="rz-btn primary">Comment</button></div></form></section>';
    document.body.appendChild(wrap);
    wrap.querySelector("#rzCommentsClose").onclick=function(){wrap.remove();};
    wrap.onclick=function(e){if(e.target===wrap)wrap.remove();};
    wrap.querySelector("#rzCommentSort").onchange=function(event){openComments(postId,event.target.value);};
    wrap.querySelector("#rzCommentForm").onsubmit=async function(e){
      e.preventDefault();var text=wrap.querySelector("#rzCommentText").value.trim();if(!text)return;
      try{var parentId=wrap.querySelector("#rzCommentForm").getAttribute("data-comment-parent")||null;await api("/api/v2/posts/"+encodeURIComponent(postId)+"/comment",{method:"POST",body:JSON.stringify({text:text,parentId:parentId})});await openComments(postId,activeSort);}catch(err){wrap.querySelector("#rzCommentStatus").textContent=err.message;}
    };
    wrap.querySelectorAll("[data-comment-action]").forEach(function(button){button.onclick=async function(){var action=button.getAttribute("data-comment-action"),commentId=button.getAttribute("data-comment-id");if(action==="delete"&&!window.confirm("Delete this comment and its replies?"))return;button.disabled=true;try{await api("/api/v2/posts/"+encodeURIComponent(postId)+"/comments/"+encodeURIComponent(commentId)+"/action",{method:"POST",body:JSON.stringify({action:action})});await openComments(postId,activeSort);load();}catch(error){button.disabled=false;wrap.querySelector("#rzCommentStatus").textContent=error.message||"Comment action could not be completed.";}};});
     if(window.RIZORA_VOICE_WIRE)window.RIZORA_VOICE_WIRE();
    wrap.querySelectorAll("[data-comment-reply]").forEach(function(btn){btn.onclick=function(){
      var form=wrap.querySelector("#rzCommentForm"),parentId=btn.getAttribute("data-comment-reply"),username=btn.getAttribute("data-comment-user")||"creator";
      if(!form)return;
      if(form.getAttribute("data-comment-parent")===parentId){
        form.removeAttribute("data-comment-parent");
        wrap.querySelector("#rzCommentText").placeholder="Write a comment...";
        btn.classList.remove("primary");
        return;
      }
      form.setAttribute("data-comment-parent",parentId);
      wrap.querySelector("#rzCommentText").placeholder="Reply to @"+username+"...";
      wrap.querySelector("#rzCommentText").focus();
      wrap.querySelectorAll("[data-comment-reply]").forEach(function(x){x.classList.remove("primary");});
      btn.classList.add("primary");
    };});
  }catch(err){toast(err.message);}
}
window.RIZORA_REOPEN_COMMENTS=openComments;

function task(t){
  var locked=t.locked===true;
  var destination={rizora_create:["create","Create a post"],rizora_profile:["profile","Complete profile"],rizora_explore:["discover","Explore Discover"],rizora_invite:["referrals","Open referrals"]}[t.id],actions=destination?'<button type="button" class="rz-btn" data-task-open="'+destination[0]+'">'+destination[1]+'</button>':'';
  if(t.id==="rizora_share")actions+='<button type="button" class="rz-btn" data-task-share="'+esc(t.id)+'">Share RIZORA</button>';
  else if(/^https:\/\//i.test(String(t.url||"")))actions+='<a class="rz-btn" href="'+esc(t.url)+'" target="_blank" rel="noopener noreferrer">Open mission ↗</a>';
  return '<div class="rz-card rz-task"><strong>'+esc(t.title)+"</strong><div>"+esc(t.description||"")+"</div><span class='rz-points'>+"+Number(t.points||t.reward||0)+" pts</span>"+(locked?"<div class='rz-mini'>Locked until your 7-minute task cooldown ends.</div>":"")+"<div class='rz-actions'>"+actions+"<button class='rz-btn primary' data-task='"+esc(t.id)+"'"+(locked?" disabled":"")+">"+(locked?"Locked":"Start task")+"</button></div></div>";
}
function socialTask(t){
  var locked=Number(t.cooldownMs||0)>0||t.completed===true;
  var pending=t.completionStatus==="pending",approved=t.completionStatus==="approved",rejected=t.completionStatus==="rejected";
  var status=pending?"Your screenshot is in the review queue.":approved?"Approved · points added.":rejected?"Proof declined. Upload a clearer screenshot to try again.":Number(t.cooldownMs||0)>0?"Available again when the cooldown ends.":"Open the mission, complete it, then upload a screenshot for review.";
  var url=/^https?:\/\//i.test(String(t.url||""))?esc(t.url):"";
  var proofControls=locked?"":'<label class="rz-proof-upload">Screenshot proof<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-social-proof-file="'+esc(t.id)+'"><span>PNG, JPG or WebP</span></label><input type="hidden" data-social-proof-id><small class="rz-media-status" data-social-proof-status role="status" aria-live="polite"></small>';
  return '<article class="rz-card rz-task rz-social-task"><div class="rz-social-task-heading"><strong>'+esc(t.title)+'</strong><span class="rz-points">+'+Number(t.reward||0)+' pts</span></div><div>'+esc(t.description||"")+'</div>'+(url?'<a class="rz-btn rz-mission-link" href="'+url+'" target="_blank" rel="noopener noreferrer">Open mission ↗</a>':"")+'<div class="rz-social-task-status">'+esc(status)+'</div>'+proofControls+'<button class="rz-btn primary" data-social="'+esc(t.id)+'"'+(locked?" disabled":" disabled")+'>'+(pending?"Under review":approved?"Approved":Number(t.cooldownMs||0)>0?"On cooldown":"Submit proof")+'</button></article>';
}
function wire(){
  document.querySelectorAll("[data-edit-post]").forEach(function(button){var actions=button.parentElement;if(!actions)return;var id=button.getAttribute("data-edit-post"),item=null;[state.feed,state.profilePosts,state.discover&&state.discover.posts,state.hashtagDetail&&state.hashtagDetail.posts,state.search&&state.search.posts].forEach(function(pool){(Array.isArray(pool)?pool:[]).forEach(function(postItem){if(String(postItem.id)===String(id))item=postItem;});});var createdAt=item&&new Date(item.createdAt||0).getTime(),editable=Number.isFinite(createdAt)&&Date.now()-createdAt<=48*60*60*1000;if(!editable){button.remove();}else{button.setAttribute("aria-label","Edit post (available for 48 hours after publishing)");button.onclick=function(){openEditPost(id);};}if(!actions.querySelector("[data-delete-post]")){var remove=document.createElement("button");remove.type="button";remove.className="rz-post-action rz-post-delete";remove.setAttribute("data-delete-post",id);remove.textContent="Delete";actions.appendChild(remove);}});
  document.querySelectorAll("[data-delete-post]").forEach(function(button){button.onclick=async function(){var id=button.getAttribute("data-delete-post");if(!window.confirm("Delete this post? You can do this at any time."))return;button.disabled=true;try{await api("/api/v2/posts/"+encodeURIComponent(id),{method:"DELETE"});toast("Post deleted.");load();}catch(error){button.disabled=false;toast(error.message||"Post could not be deleted.");}};});
  document.querySelectorAll(".rz-tags [data-hashtag]").forEach(function(button){button.onclick=function(){openDiscoverHashtag(button.getAttribute("data-hashtag"));};});
  document.querySelectorAll("[data-profile-workflow]").forEach(function(button){button.onclick=function(){var action=button.getAttribute("data-profile-workflow"),opened=false;try{if(action==="series"&&window.RIZORA_SERIES&&window.RIZORA_SERIES.open){window.RIZORA_SERIES.open();opened=true;}else if(action==="ads"&&window.RIZORA_BUSINESS&&window.RIZORA_BUSINESS.ads){window.RIZORA_BUSINESS.ads();opened=true;}else if(action==="membership"&&window.RIZORA_BUSINESS&&window.RIZORA_BUSINESS.freeMembership){window.RIZORA_BUSINESS.freeMembership();opened=true;}else if(action==="gift"&&window.RIZORA_BUSINESS&&window.RIZORA_BUSINESS.membershipGift){window.RIZORA_BUSINESS.membershipGift();opened=true;}else if(action==="events"&&window.RIZORA_EVENTS&&window.RIZORA_EVENTS.open){window.RIZORA_EVENTS.open();opened=true;}else if(action==="feeds"&&window.RIZORA_LABS&&window.RIZORA_LABS.feeds){window.RIZORA_LABS.feeds();opened=true;}}catch(error){toast(error.message||"Creator tool could not open.");return;}if(!opened)toast("This creator tool is loading. Try again in a moment.");};});
  document.querySelectorAll("[data-onboarding-follow]").forEach(function(b){b.onclick=function(){var username=b.getAttribute("data-onboarding-follow");api("/api/v2/onboarding/follow",{method:"POST",body:JSON.stringify({username:username})}).then(function(d){toast("Followed @"+d.username+" · +"+d.awarded+" pts");load();}).catch(function(e){toast(e.message);});};});
  document.querySelectorAll("[data-go]").forEach(function(b){b.onclick=function(){var destination=b.getAttribute("data-go");if(destination==="create"){state.composerPeopleTags=[];state.pendingPeopleTag=null;}state.view=destination==="flow"?"discover":destination;shell();load();};});
  document.querySelectorAll("[data-open-music]").forEach(function(b){b.onclick=function(){if(window.RIZORA_STUDIO_PAGE&&window.RIZORA_STUDIO_PAGE.open){window.RIZORA_STUDIO_PAGE.open(b.getAttribute("data-studio-feature")||"beats");return;}if(window.RIZORA_MUSIC&&window.RIZORA_MUSIC.open){window.RIZORA_MUSIC.open();}else{toast("Music Studio is loading.");}};});
  document.querySelectorAll("[data-feature-slide]").forEach(function(button){button.onclick=function(){var rail=document.querySelector(".rz-feature-showcase-rail");if(!rail)return;var direction=button.getAttribute("data-feature-slide")==="next"?1:-1;rail.scrollBy({left:direction*Math.max(rail.clientWidth*.82,260),behavior:"smooth"});};});
  document.querySelectorAll(".rz-template-card").forEach(function(card){card.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();card.click();}});});
  if(state.view==="studio"&&window.RIZORA_STUDIO_PAGE&&typeof window.RIZORA_STUDIO_PAGE.wire==="function")window.RIZORA_STUDIO_PAGE.wire($("content"));
  if(state.view==="create"){
    var openDiscover=$("openDiscoverFeed");if(openDiscover)openDiscover.onclick=function(){state.view="discover";state.discoverCategory="for-you";state.feedTab="for-you";state.feedOffset=0;state.feed=[];state.activeHashtag="";state.hashtagDetail=null;state.focusedPostId="";state.focusedPost=null;state.query="";state.search=null;shell();load();};
    $("postForm").onsubmit=async function(e){e.preventDefault();var text=$("postText").value.trim(),mediaUrl=$("postMedia").value.trim(),peopleTags=(state.composerPeopleTags||[]).map(function(tag){return {userId:tag.userId,x:tag.x,y:tag.y};}),aiAssisted=$("postAiAssisted")&&$("postAiAssisted").checked,mediaStyle=JSON.parse($("postMediaEditor").querySelector("[data-media-style-value]").value||"{}"),schedule=$("postSchedule").value.trim(),pollQuestion=$("postPollQuestion").value.trim(),pollOptions=[$("postPollOption1").value.trim(),$("postPollOption2").value.trim(),$("postPollOption3").value.trim(),$("postPollOption4").value.trim()].filter(Boolean),collab=$("postCollab").value.trim().replace(/^@/,"");$("postError").textContent="";$("postStatus").textContent="";try{var created;if(schedule){if(pollQuestion)throw new Error("Publish the poll now or schedule it as a normal post.");var d=await api("/api/v2/schedules",{method:"POST",body:JSON.stringify({text:text,mediaUrl:mediaUrl,mediaStyle:mediaStyle,peopleTags:peopleTags,scheduledFor:new Date(schedule).toISOString()})});$("postStatus").textContent="Scheduled for "+new Date(d.schedule.scheduledFor).toLocaleString();}else if(pollQuestion){if(pollOptions.length<2)throw new Error("Add at least two poll options.");var p=await api("/api/v2/polls",{method:"POST",body:JSON.stringify({text:text,mediaUrl:mediaUrl,mediaStyle:mediaStyle,peopleTags:peopleTags,question:pollQuestion,options:pollOptions.map(function(label){return{label:label};})})});created=p.post;$("postStatus").textContent="Poll published.";if(collab&&created)await api("/api/v2/posts/"+encodeURIComponent(created.id)+"/collaborators/invite",{method:"POST",body:JSON.stringify({username:collab})});}else{var n=await api("/api/v2/posts",{method:"POST",body:JSON.stringify({text:text,mediaUrl:mediaUrl,mediaStyle:mediaStyle,peopleTags:peopleTags,aiAssisted:aiAssisted})});created=n.post||n;if(collab&&created)await api("/api/v2/posts/"+encodeURIComponent(created.id)+"/collaborators/invite",{method:"POST",body:JSON.stringify({username:collab})});$("postStatus").textContent=collab?"Published · collaboration invite sent.":"Published.";}$("postText").value="";$("postMedia").value="";$("postPollQuestion").value="";["1","2","3","4"].forEach(function(n){$("postPollOption"+n).value="";});$("postSchedule").value="";$("postCollab").value="";if(created){state.composerPeopleTags=[];state.pendingPeopleTag=null;state.view="discover";state.query="";state.search=null;state.discoverCategory="for-you";state.feedTab="for-you";state.activeHashtag="";state.focusedPostId="";state.focusedPost=null;}load();}catch(err){$("postError").textContent=err.message;}};bindMediaPicker("postMediaFile","postMediaStatus","postMedia");wirePostMediaEditor("postMediaEditor","postMedia");wirePeopleTagComposer();$("saveDraft").onclick=async function(){try{await api("/api/v2/drafts",{method:"POST",body:JSON.stringify({title:textPreview($("postText").value),text:$("postText").value,mediaUrl:$("postMedia").value})});toast("Draft saved.");}catch(err){$("postError").textContent=err.message;}};$("clearPostOptions").onclick=function(){$("postPollQuestion").value="";["1","2","3","4"].forEach(function(n){$("postPollOption"+n).value="";});$("postSchedule").value="";$("postCollab").value="";};
  }
  if(state.view==="discover"){
    document.querySelectorAll("[data-discover-category]").forEach(function(b){b.onclick=function(){state.discoverCategory=b.getAttribute("data-discover-category");state.focusedPostId="";state.focusedPost=null;state.activeHashtag="";state.hashtagDetail=null;state.feedTab="for-you";state.feedOffset=0;state.feed=[];load();};});
    document.querySelectorAll("[data-tab]").forEach(function(b){b.onclick=function(){state.feedTab=b.getAttribute("data-tab");state.feedOffset=0;state.feed=[];load();};});
    document.querySelectorAll("[data-discover-banner]").forEach(function(b){b.onclick=function(){showDiscoverBanner(Number(b.getAttribute("data-discover-banner")));};});
    var banner=document.querySelector(".rz-discover-banner"),bannerStartX=null;if(banner){banner.onpointerdown=function(event){bannerStartX=event.clientX;};banner.onpointerup=function(event){if(bannerStartX===null)return;var delta=event.clientX-bannerStartX;bannerStartX=null;if(Math.abs(delta)>42)showDiscoverBanner((state.discoverBannerIndex+(delta<0?1:2))%3);};banner.onpointercancel=function(){bannerStartX=null;};}
    if(state.discoverBannerTimer)clearInterval(state.discoverBannerTimer);
    state.discoverBannerTimer=setInterval(function(){if(state.view==="discover"&&!state.activeHashtag)showDiscoverBanner((state.discoverBannerIndex+1)%3);},3000);
    document.querySelectorAll("[data-hashtag]").forEach(function(b){b.onclick=function(){openDiscoverHashtag(b.getAttribute("data-hashtag"));};});
    document.querySelectorAll("[data-recent-search]").forEach(function(b){b.onclick=function(){var input=$("q");if(input){input.value=b.getAttribute("data-recent-search");runDiscoverSearch(true);}};});
    document.querySelectorAll("[data-follow-user]").forEach(function(b){b.onclick=async function(){b.disabled=true;try{await api("/api/v2/users/"+encodeURIComponent(b.getAttribute("data-follow-user"))+"/follow",{method:"POST",body:"{}"});await load();}catch(error){toast(error.message||"Follow could not be updated.");b.disabled=false;}};});
    document.querySelectorAll("[data-hashtag-follow]").forEach(function(b){b.onclick=async function(){b.disabled=true;try{var result=await api("/api/v2/hashtags/"+encodeURIComponent(b.getAttribute("data-hashtag-follow"))+"/follow",{method:"POST",body:"{}"});if(state.hashtagDetail)state.hashtagDetail.viewerFollowing=result.following;b.textContent=result.following?"Following hashtag":"Follow hashtag";b.setAttribute("aria-pressed",result.following?"true":"false");}catch(error){toast(error.message||"Hashtag follow could not be updated.");}finally{b.disabled=false;}};});
    var searchInput=$("q");
    if(searchInput){searchInput.oninput=function(){if(state.discoverSearchTimer)clearTimeout(state.discoverSearchTimer);state.discoverSearchTimer=setTimeout(function(){runDiscoverSearch(false);},240);};searchInput.onkeydown=function(event){if(event.key==="Enter"){event.preventDefault();if(state.discoverSearchTimer)clearTimeout(state.discoverSearchTimer);runDiscoverSearch(true);}};}
    var clearSearch=$("clearDiscoverSearch");if(clearSearch)clearSearch.onclick=function(){state.query="";state.search=null;state.focusedPostId="";state.focusedPost=null;state.activeHashtag="";state.hashtagDetail=null;state.searchSequence+=1;view();wire();var input=$("q");if(input)input.focus();};
    var clearRecent=$("clearRecentSearches");if(clearRecent)clearRecent.onclick=function(){try{localStorage.removeItem("rizora_recent_searches");}catch(_){}view();wire();};
    var searchButton=$("doSearch");if(searchButton)searchButton.onclick=function(){runDiscoverSearch(true);};
    var createButton=$("createFromDiscover");if(createButton)createButton.onclick=function(){state.composerPeopleTags=[];state.pendingPeopleTag=null;state.view="create";state.focusedPostId="";state.focusedPost=null;shell();load();};
    var backHashtag=$("backFromHashtag");if(backHashtag)backHashtag.onclick=function(){state.activeHashtag="";state.hashtagDetail=null;view();wire();};
    var backFromPost=$("backFromDiscoverPost");if(backFromPost)backFromPost.onclick=function(){state.focusedPostId="";state.focusedPost=null;view();wire();};
    document.querySelectorAll("[data-open-post]").forEach(function(b){b.onclick=function(){var id=b.getAttribute("data-open-post"),pools=[state.feed,state.discover&&state.discover.posts,state.hashtagDetail&&state.hashtagDetail.posts,state.search&&state.search.posts];state.focusedPostId=id;state.focusedPost=null;pools.forEach(function(pool){(Array.isArray(pool)?pool:[]).forEach(function(item){if(String(item.id)===String(id))state.focusedPost=item;});});state.discoverCategory="for-you";state.feedTab="trending";state.activeHashtag="";state.hashtagDetail=null;state.query="";state.search=null;load();};});
    var loadMore=$("loadMoreDiscover");if(loadMore)loadMore.onclick=loadMoreDiscover;
    document.querySelectorAll("[data-like]").forEach(function(b){b.onclick=function(){api("/api/v2/posts/"+b.getAttribute("data-like")+"/like",{method:"POST"}).then(load).catch(function(e){toast(e.message);});}});
    document.querySelectorAll("[data-comment]").forEach(function(b){b.onclick=function(){openComments(b.getAttribute("data-comment"));};});
    document.querySelectorAll("[data-save]").forEach(function(b){b.onclick=function(){api("/api/v2/posts/"+b.getAttribute("data-save")+"/save",{method:"POST"}).then(load).catch(function(e){toast(e.message);});}});
    document.querySelectorAll("[data-poll-vote]").forEach(function(b){b.onclick=function(){api("/api/v2/polls/"+encodeURIComponent(b.getAttribute("data-poll-vote"))+"/vote",{method:"POST",body:JSON.stringify({optionId:b.getAttribute("data-poll-option")})}).then(load).catch(function(e){toast(e.message);});}});
    document.querySelectorAll("[data-share-post]").forEach(function(b){b.onclick=async function(){var target=window.prompt("Send this post to which RIZORA username?");if(!target)return;try{await api("/api/v2/messages/share",{method:"POST",body:JSON.stringify({recipientUsername:target,postId:b.getAttribute("data-share-post")})});toast("Post shared in DMs.");}catch(e){toast(e.message);}};});
  }
  if(state.view==="grow"){
  document.querySelectorAll("[data-task]").forEach(function(b){
    b.onclick=async function(){
      var id=b.getAttribute("data-task");
      if(b.disabled)return;
      b.disabled=true;
      try{
        await api("/api/tasks/start",{method:"POST",body:JSON.stringify({taskId:id})});
        var remaining=20;
        b.textContent="Started · 0:20";
        var timer=setInterval(function(){
          remaining-=1;
          if(remaining>0){b.textContent="Started · 0:"+String(remaining).padStart(2,"0");return;}
          clearInterval(timer);
          b.textContent="Claiming...";
          api("/api/tasks/complete",{method:"POST",body:JSON.stringify({taskId:id})})
            .then(function(d){
              var reward=Number(d.reward||d.points||0);
              if(window.RIZORA_POPUP)window.RIZORA_POPUP("Task complete",reward>0?"You received +"+reward+" points.":"Task completed successfully.","success");
              return load();
            })
            .catch(function(e){b.disabled=false;b.textContent="Start task";toast(e.message);});
        },1000);
      }catch(e){
        b.disabled=false;
        b.textContent="Start task";
        toast(e.message);
      }
    };
  });
  document.querySelectorAll("[data-task-open]").forEach(function(button){button.onclick=function(){var destination=button.getAttribute("data-task-open");if(destination==="referrals"){if(window.RIZORA_SUITE&&window.RIZORA_SUITE.open)window.RIZORA_SUITE.open();else toast("Referrals are loading.");return;}state.view=destination;shell();load();};});
  document.querySelectorAll("[data-task-share]").forEach(function(button){button.onclick=async function(){if(!navigator.share||!state.referralLink){toast("Open Creator Suite → Referrals to copy or share your personal invite link.");return;}button.disabled=true;try{var link=state.referralLink;await navigator.share({title:"Join me on RIZORA",text:"Create and grow with me on RIZORA.",url:link});await api("/api/tasks/start",{method:"POST",body:JSON.stringify({taskId:button.getAttribute("data-task-share")})});await api("/api/tasks/share",{method:"POST",body:JSON.stringify({taskId:button.getAttribute("data-task-share")})});button.textContent="Shared · verifying…";window.setTimeout(async function(){try{var result=await api("/api/tasks/complete",{method:"POST",body:JSON.stringify({taskId:button.getAttribute("data-task-share")})});toast("RIZORA shared · +"+Number(result.reward||result.points||0)+" points.");load();}catch(error){button.disabled=false;button.textContent="Share RIZORA";toast(error.message||"The reward could not be verified.");}},20000);}catch(error){button.disabled=false;if(error&&error.name!=="AbortError")toast(error.message||"RIZORA could not be shared.");}};});
  document.querySelectorAll("[data-social-proof-file]").forEach(function(input){
    input.onchange=async function(){
      var file=input.files&&input.files[0],cardEl=input.closest(".rz-social-task"),status=cardEl&&cardEl.querySelector("[data-social-proof-status]"),proof=cardEl&&cardEl.querySelector("[data-social-proof-id]"),submit=cardEl&&cardEl.querySelector("[data-social]");
      if(!file||!cardEl||!proof||!submit)return;
      submit.disabled=true;
      try{
        if(typeof window.RIZORA_UPLOAD_FILE!=="function")throw new Error("Secure media upload is still loading. Try again.");
        if(status){status.hidden=false;status.textContent="Uploading screenshot…";}
        var media=await window.RIZORA_UPLOAD_FILE(file,status);
        proof.value=media.id;
        submit.disabled=false;
        if(status)status.textContent="Screenshot uploaded. Submit it when you are ready.";
      }catch(error){proof.value="";if(status){status.hidden=false;status.textContent=error.message||"Screenshot upload failed.";}}
    };
  });
  document.querySelectorAll("[data-social]").forEach(function(b){
    b.onclick=function(){
      if(b.disabled)return;
      var cardEl=b.closest(".rz-social-task"),proof=cardEl&&cardEl.querySelector("[data-social-proof-id]"),status=cardEl&&cardEl.querySelector("[data-social-proof-status]");
      if(!proof||!proof.value){if(status){status.hidden=false;status.textContent="Upload a screenshot first.";}return;}
      b.disabled=true;b.textContent="Submitting…";
      api("/api/social/tasks/complete",{method:"POST",body:JSON.stringify({taskId:b.getAttribute("data-social"),proofMediaId:proof.value})})
        .then(function(){toast("Proof submitted. Points will be added after review.");return load();})
        .catch(function(e){b.disabled=false;b.textContent="Complete";toast(e.message);});
    };
  });
}
  if(state.view==="studio"){
    var ideaButton=$("rzStudioIdeaSubmit"),ideaInput=$("rzStudioIdeaInput"),ideaType=$("rzStudioIdeaType"),ideaStatus=$("rzStudioIdeaStatus"),ideaResult=$("rzStudioIdeaResult");
    if(ideaButton)ideaButton.onclick=async function(){var prompt=String(ideaInput&&ideaInput.value||"").trim();if(prompt.length<8){ideaStatus.textContent="Give RIZORA a little more to work with.";ideaInput.focus();return;}ideaButton.disabled=true;ideaButton.textContent="Thinking…";ideaStatus.textContent="RIZORA is shaping a first draft…";ideaResult.className="rz-studio-result-empty";ideaResult.textContent="Working on your idea…";try{var result=await api("/api/ai/chat",{method:"POST",timeoutMs:50000,body:JSON.stringify({message:"Help me create a "+ideaType.value+" from this idea. Keep my own point of view. Give me one useful, specific first draft and a short next step. Idea: "+prompt,history:[]})});ideaResult.className="rz-studio-result";ideaResult.textContent=result.reply||"No draft came back. Try again.";ideaStatus.textContent="Draft ready. Edit it, or ask NOIR ® to take it further.";}catch(error){ideaResult.className="rz-studio-result-empty";ideaResult.textContent=error.message||"RIZORA could not reach the AI service. Try again.";ideaStatus.textContent="";}finally{ideaButton.disabled=false;ideaButton.textContent="Shape this idea";}};
  }
  if(state.view==="ai"){
    document.querySelectorAll("[data-ai-speak]").forEach(function(b){b.onclick=function(){var i=Number(b.getAttribute("data-ai-speak")),m=state.aiMessages[i];if(!m||m.role!=="ai")return;if(window.RIZORA_AI_SPEAK)window.RIZORA_AI_SPEAK(m.text,b);else toast("AI voice playback is still loading.");};});
    var aiForm=$("aiForm"),aiInput=$("aiInput"),newChat=$("rzAiNewChat"),visualOpen=$("rzAiVisualOpen");
    if(newChat)newChat.onclick=function(){saveNoirRecent();state.aiRequestId++;state.aiBusy=false;state.aiMessages=[];state.aiCurrentId="";renderView();var next=$("aiInput");if(next)next.focus();};
    document.querySelectorAll("[data-ai-recent]").forEach(function(button){button.onclick=function(){var chat=noirRecentChats().find(function(item){return item.id===button.getAttribute("data-ai-recent");});if(!chat)return;state.aiCurrentId=chat.id;state.aiMessages=Array.isArray(chat.messages)?chat.messages.slice(-40):[];state.aiBusy=false;renderView();};});
    if(visualOpen)visualOpen.onclick=function(){var details=document.querySelector(".rz-ai-media-details");if(details){details.open=true;details.scrollIntoView({behavior:"smooth",block:"center"});}else toast("Visual tools are loading.");};
    document.querySelectorAll("[data-ai-starter]").forEach(function(button){button.onclick=function(){var input=$("aiInput");if(input){input.value=button.getAttribute("data-ai-starter")||"";var form=$("aiForm");if(form&&form.requestSubmit)form.requestSubmit();}};});
    if(aiInput)aiInput.onkeydown=function(e){if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();if(aiForm&&aiForm.requestSubmit)aiForm.requestSubmit();}};
    if(aiForm)aiForm.onsubmit=async function(e){e.preventDefault();var q=String(aiInput&&aiInput.value||"").trim();if(!q||state.aiBusy)return;var history=state.aiMessages.filter(function(m){return m.role==="you"||m.role==="ai";}).slice(-8);state.aiMessages.push({role:"you",text:q});saveNoirRecent();state.aiBusy=true;var requestId=++state.aiRequestId;renderView();try{var d=await api("/api/ai/chat",{method:"POST",timeoutMs:50000,body:JSON.stringify({message:q,history:history})});if(requestId!==state.aiRequestId)return;state.aiMessages.push({role:"ai",text:d.reply||"NOIR ® returned no text."});}catch(err){if(requestId!==state.aiRequestId)return;state.aiMessages.push({role:"error",text:err.message||"RIZORA could not respond. Try again."});}finally{if(requestId===state.aiRequestId){state.aiBusy=false;saveNoirRecent();renderView();var thread=$("rzAiThread");if(thread)thread.scrollTop=thread.scrollHeight;var nextInput=$("aiInput");if(nextInput)nextInput.focus();}}};
    if(window.RIZORA_VOICE_WIRE)window.RIZORA_VOICE_WIRE();
  }
  if(state.view==="discover"){var runDiscoverSearch=async function(){state.query=$("q").value.trim();try{state.search=state.query?await api("/api/v2/search?q="+encodeURIComponent(state.query)):null;view();wire();}catch(error){toast(error.message||"Search could not be completed.");}};$("doSearch").onclick=runDiscoverSearch;$("q").onkeydown=function(event){if(event.key==="Enter"){event.preventDefault();runDiscoverSearch();}};}
  if(state.view==="live"){
    var refreshLive=function(){load();};
    ["rzLiveRefresh","rzLiveRefreshTop","rzLiveRetry"].forEach(function(id){var b=$(id);if(b)b.onclick=refreshLive;});
    ["rzLiveStart","rzLiveStartTop"].forEach(function(id){var b=$(id);if(b)b.onclick=function(){
      var title=window.prompt("Live room title","RIZORA Live");
      if(title===null)return;
      api("/api/v2/live/start",{method:"POST",body:JSON.stringify({title:title.trim()||"RIZORA Live",category:"general"})}).then(function(){toast("Your live room is open.");load();}).catch(function(e){toast(e.message);});
    };});
    document.querySelectorAll("[data-live-join]").forEach(function(b){b.onclick=function(){b.disabled=true;api("/api/v2/live/join",{method:"POST",body:JSON.stringify({liveId:b.getAttribute("data-live-join")})}).then(function(){toast("You joined the live room.");}).catch(function(e){toast(e.message);}).finally(function(){b.disabled=false;});};});
  }
  if(state.view==="notifications")$("readAll").onclick=function(){api("/api/v2/notifications/read",{method:"POST"}).then(load);};
  if(state.view==="stories")wireStories();
  if(state.view==="communities")wireCommunities();
  if(state.view==="messages")wireMessages();
  if(state.view==="opportunities")wireOpportunities();
  if(state.view==="boosts")wireBoosts();
  if(state.view==="admin")wireAdmin();
  if(state.view==="profile"){document.querySelectorAll("[data-profile-tab]").forEach(function(button){button.onclick=function(){state.profileTab=button.getAttribute("data-profile-tab");load();};});var editor=$("rzProfileEditor"),edit=$("editProfile"),closeEditor=$("closeProfileEditor");if(edit&&editor)edit.onclick=function(){editor.style.display="block";};var profileSettings=$("profileSettings");if(profileSettings)profileSettings.onclick=function(){if(window.RIZORA_CONTROL_CENTER&&window.RIZORA_CONTROL_CENTER.preferences){window.RIZORA_CONTROL_CENTER.preferences();}else{toast("Profile settings are loading.");}};if(closeEditor&&editor)closeEditor.onclick=function(){editor.style.display="none";};$("profileForm").onsubmit=async function(e){e.preventDefault();var links=String($("pfLinks").value||"").split(/\r?\n/).map(function(row){var split=row.indexOf("|");return split<0?{label:"",url:row.trim()}:{label:row.slice(0,split).trim(),url:row.slice(split+1).trim()};}).filter(function(item){return item.url;});try{await api("/api/v2/profile",{method:"PATCH",body:JSON.stringify({avatarUrl:$("pfAvatar").value,bannerUrl:$("pfBanner").value,bio:$("pfBio").value,category:$("pfCategory").value,location:$("pfLocation").value,links:links})});toast("Profile updated.");load();}catch(err){toast(err.message);}};bindMediaPicker("pfAvatarFile","pfAvatarStatus","pfAvatar");bindMediaPicker("pfBannerFile","pfBannerStatus","pfBanner");function previewProfileImage(fileId,imageId){var file=$(fileId),image=$(imageId);if(!file||!image)return;file.addEventListener("change",function(){var selected=file.files&&file.files[0];if(!selected||!/^image\//.test(selected.type))return;var objectUrl=URL.createObjectURL(selected);image.onload=function(){URL.revokeObjectURL(objectUrl);};image.src=objectUrl;});}previewProfileImage("pfAvatarFile","pfAvatarPreview");previewProfileImage("pfBannerFile","pfBannerPreview");function bindProfileReset(buttonId,inputId,imageId,statusId,defaultUrl,label){var button=$(buttonId),input=$(inputId),image=$(imageId),field=$(inputId==="pfAvatarFile"?"pfAvatar":"pfBanner"),status=$(statusId);if(!button||!field||!image)return;button.onclick=function(){field.value=defaultUrl;if(input)input.value="";image.src=defaultUrl;if(status)status.textContent=label+" reset to default. Save profile to apply.";};}bindProfileReset("pfAvatarReset","pfAvatarFile","pfAvatarPreview","pfAvatarStatus","/assets/rizora-default-avatar.jpg","Profile photo");bindProfileReset("pfBannerReset","pfBannerFile","pfBannerPreview","pfBannerStatus","/assets/rizora-creator-banner.svg","Profile banner");var verifyBtn=$("verify");if(verifyBtn)verifyBtn.onclick=verification;var premiumHint=$("rzOpenPremiumFromProfile");if(premiumHint)premiumHint.onclick=function(){if(window.RIZORA_SUITE&&window.RIZORA_SUITE.open){window.RIZORA_SUITE.open();}else{toast("Premium is available from Creator Suite.");}};var dismissPremiumSuggestion=$("rzDismissPremiumSuggestion");if(dismissPremiumSuggestion)dismissPremiumSuggestion.onclick=function(){try{sessionStorage.setItem("rz_premium_suggestion_dismissed","1");}catch(_){ }var hint=$("rzPremiumVerificationHint");if(hint)hint.remove();};}
}
function renderView(){view();wire();}
async function load(){
  try{if(!state.user){var me=await api("/api/auth/me");state.user=me.user;}var x=await api("/api/v2/me");state.user=x.user;state.profile=x.profile;window.RIZORA_CURRENT_USER=state.user;state.points=Number(x.user.points||0);}catch(e){if(e&&e.status===401){state.user=null;window.RIZORA_CURRENT_USER=null;auth();}else{toast("RIZORA is reconnecting. Your session is still protected.");}return false;}
  try{if(state.view==="home"||state.view==="admin"){var updateResponse=await api("/api/v2/updates");state.updates=updateResponse.updates||[];}}catch(e){state.updates=[];}
  try{if(state.view==="home"){var ob=await api("/api/v2/onboarding");state.onboarding=Array.isArray(ob.tasks)?ob.tasks:[];}}catch(e){state.onboarding=[];}
  try{if(state.view==="home"){var f=await api("/api/v2/feed?tab="+state.feedTab+"&limit=20");state.feed=f.posts||[];}}catch(e){}
  if(state.view==="discover"){
    try{var discovered=await api("/api/v2/discover");state.discover=discovered;}
    catch(e){state.discover={posts:[],creators:[],trendingHashtags:[]};}
    if(state.activeHashtag){try{state.hashtagDetail=await api("/api/v2/hashtags/"+encodeURIComponent(state.activeHashtag));}catch(e){state.hashtagDetail={tag:state.activeHashtag,count:0,posts:[]};}}
    else if(state.discoverCategory!=="creators"&&state.discoverCategory!=="hashtags"){
      try{var category=state.discoverCategory==="for-you"?"all":state.discoverCategory;var page=await api("/api/v2/feed?tab="+encodeURIComponent(state.feedTab)+"&category="+encodeURIComponent(category)+"&offset=0&limit=20");state.feed=page.posts||[];state.feedOffset=Number(page.nextOffset||state.feed.length);state.feedHasMore=page.hasMore===true;}
      catch(e){state.feed=[];state.feedHasMore=false;}
    }else{state.feed=[];state.feedOffset=0;state.feedHasMore=false;}
  }
  try{if(state.view==="grow"){var a=await api("/api/tasks");var s=await api("/api/social/tasks");state.tasks=a.tasks||[];state.socialTasks=s.tasks||[];try{var referralData=await api("/api/referrals/me");state.referralLink=referralData.referralLink||"";}catch(_){state.referralLink="";}}}catch(e){}
  try{var n=await api("/api/v2/notifications");state.notifications=n.notifications||[];state.unreadNotificationCount=state.notifications.filter(function(item){return item.read!==true;}).length;}catch(e){state.notifications=[];state.unreadNotificationCount=0;}
  try{if(state.view==="profile"){state.verification=await api("/api/verification/me");state.safety=await api("/api/v2/safety/me");var profilePostData=await api("/api/v2/profile/posts?tab="+encodeURIComponent(state.profileTab||"posts"));state.profilePosts=profilePostData.posts||[];}}catch(e){state.profilePosts=[];}
  try{if(state.view==="safety"){state.safety=await api("/api/v2/safety/me");}}catch(e){}
  try{if(state.view==="stories"){var st=await api("/api/v2/stories");state.stories=st.stories||[];}}catch(e){}
  try{if(state.view==="communities"){var co=await api("/api/v2/communities");state.communities=co.communities||[];}}catch(e){}
  try{if(state.view==="messages"){var ms=await api("/api/v2/messages");state.conversations=ms.conversations||[];}}catch(e){}
  try{if(state.view==="opportunities"){var op=await api("/api/v2/opportunities");state.opportunities=op.opportunities||[];}}catch(e){}
  try{if(state.view==="analytics"){state.analytics=await api("/api/v2/analytics/overview");}}catch(e){}
  try{if(state.view==="boosts"){var bx=await api("/api/boosts");state.boosts=bx.boosts||[];}}catch(e){}
  if(state.view==="live"){
    try{var lives=await api("/api/v2/live/discover");state.live=Array.isArray(lives.lives)?lives.lives:[];state.liveError="";}catch(e){state.live=[];state.liveError=e.message||"Unable to load live rooms.";}
  }
  try{if(state.view==="official"){var of=await api("/api/official/profiles");state.official=of.profiles||[];}}catch(e){}
  try{if(state.view==="admin"&&state.user.role==="super_admin"){state.admin=await api("/api/superadmin/dashboard");}}catch(e){} try{if(state.view==="admin"&&state.user.role==="super_admin"){var vr=await api("/api/superadmin/verification/requests");state.adminVerification=vr.requests||[];}}catch(e){} try{if(state.view==="admin"&&state.user.role==="super_admin"){var sr=await api("/api/social/tasks/review-queue");state.adminSocialReviews=sr.reviews||[];}}catch(e){state.adminSocialReviews=[];}
  shell();
  return true;
}
async function refreshUnreadNotifications(){
  if(!state.user)return;
  try{
    var result=await api("/api/v2/notifications");state.notifications=result.notifications||[];state.unreadNotificationCount=state.notifications.filter(function(item){return item.read!==true;}).length;
    var count=state.unreadNotificationCount;
    [[document.getElementById("rzTopNotifications"),"Notifications"],[document.querySelector('.rz-mobile-nav [data-nav="notifications"]'),"Notifications"]].forEach(function(entry){var button=entry[0];if(!button)return;button.setAttribute("aria-label",entry[1]+(count?" ("+count+" unread)":""));var badge=button.querySelector(".rz-notification-count");if(count){if(!badge){badge=document.createElement("span");badge.className="rz-notification-count";badge.setAttribute("aria-hidden","true");var target=button.closest(".rz-mobile-nav")?button.querySelector("span"):button;(target||button).appendChild(badge);}badge.textContent=count>99?"99+":String(count);}else if(badge)badge.remove();});
  }catch(_){ }
}
async function verification(){
  var overlay=document.createElement("div");overlay.className="rz-overlay";
  overlay.innerHTML='<div class="rz-modal"><h2>Creator verification</h2><p class="rz-muted">Status: '+esc(state.verification&&state.verification.status||"not_submitted")+'</p><textarea id="verifyReason" class="rz-textarea" placeholder="Why should we verify you?"></textarea><input id="verifyUrl" class="rz-input" placeholder="Public proof URL"><button id="sendVerify" class="rz-btn primary">Submit</button><button id="closeVerify" class="rz-btn">Close</button></div>';
  document.body.appendChild(overlay);$("closeVerify").onclick=function(){overlay.remove();};$("sendVerify").onclick=async function(){try{await api("/api/verification/apply",{method:"POST",body:JSON.stringify({reason:$("verifyReason").value,proofUrl:$("verifyUrl").value})});overlay.remove();if(window.RIZORA_POPUP)window.RIZORA_POPUP("Verification submitted","Your creator verification request is now under review.","success");else toast("Verification submitted.");load();}catch(err){toast(err.message);}};
}
boot();
async function boot(){
  if(navigator.serviceWorker)navigator.serviceWorker.register("/service-worker.js").catch(function(){});
  // Render the public landing screen immediately. The backend auth check must not block
  // the first paint because the Render service may cold-start for several seconds.
  landing();
  try{
    var m=await api("/api/auth/me");
    if(m&&m.user){
      state.user=m.user;
      await load();
    }
  }catch(e){
    // Logged-out visitors stay on the public landing screen.
  }
}
setInterval(function(){if(document.visibilityState==="visible")refreshUnreadNotifications();},45000);
document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible")refreshUnreadNotifications();});
})();











