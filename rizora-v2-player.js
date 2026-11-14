(function(){
  "use strict";
  var API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");
  var player={root:null,catalog:[],externalCatalog:[],current:null,queue:[],liked:new Set(),view:"all",query:"",shuffle:false,repeat:false,audio:new Audio(),localUrls:[],searchTimer:null,searchSeq:0,startsSinceAd:0,adDue:false,isAd:false,activeAd:null,adIndex:0,pendingTrack:null};
  var AUDIO_ADS=[
    {id:"rizora_ad_1",title:"RIZORA Audio Ad",artist:"RIZORA",artwork:"/rizora-cover.png",audioUrl:"/assets/ads/rizora-ad-1.mp3",source:"ad"},
    {id:"rizora_ad_2",title:"RIZORA Audio Ad",artist:"RIZORA",artwork:"/rizora-cover.png",audioUrl:"/assets/ads/rizora-ad-2.mp3",source:"ad"},
    {id:"rizora_ad_3",title:"Orekelewa 💕",artist:"RIZORA",artwork:"/rizora-cover.png",audioUrl:"/assets/ads/rizora-ad-3-orekelewa.mp3",source:"ad"}
  ];
  var audio=player.audio;
  audio.preload="metadata";

  function esc(value){return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  function url(value){var text=String(value||"").trim();if(/^https?:\/\//i.test(text)||/^blob:/i.test(text))return text;if(/^\/(?!\/)/.test(text)){if(/^\/api\/v2\/media\//i.test(text)&&/^(localhost|127\.0\.0\.1)$/i.test(location.hostname))return API+text;return text;}try{var parsed=new URL(text);if(parsed.hostname==="rizora-guse.onrender.com"&&!/^(localhost|127\.0\.0\.1)$/i.test(location.hostname)&&/^\/api\/v2\/media\//i.test(parsed.pathname))return location.origin+parsed.pathname+parsed.search;}catch(e){}return "";}
  function formatTime(value){var n=Math.max(0,Math.floor(Number(value)||0));return Math.floor(n/60)+":"+String(n%60).padStart(2,"0");}
  function likedIds(){try{var saved=JSON.parse(localStorage.getItem("rizora_player_liked")||"[]");return new Set(Array.isArray(saved)?saved:[]);}catch(e){return new Set();}}
  function saveLikes(){try{localStorage.setItem("rizora_player_liked",JSON.stringify(Array.from(player.liked)));}catch(e){}}
  function activeRoot(){return player.root&&player.root.isConnected?player.root:null;}
  function setStatus(text,error){var root=activeRoot(),node=root&&root.querySelector("#rzpStatus");if(node){node.textContent=text||"";node.classList.toggle("error",!!error);}}
  function findTrack(id){return player.catalog.find(function(item){return item.id===id;})||player.externalCatalog.find(function(item){return item.id===id;});}
  function art(track){var source=url(track&&track.artwork);return source?'<img src="'+esc(source)+'" alt="" loading="lazy">':'<span aria-hidden="true">♫</span>';}
  function safeTrack(item){return {id:String(item.id||"track_"+Date.now()+"_"+Math.random()),title:String(item.title||"Untitled release"),artist:String(item.artist||"Unknown artist"),artwork:url(item.artwork),audioUrl:url(item.audioUrl),genre:String(item.genre||""),duration:item.duration||"",source:String(item.source||""),storeUrl:url(item.storeUrl)};}

  async function searchAudius(query,sequence){
    try{
      var data=await window.RIZORA_API_CALL("/api/music/audius/search?q="+encodeURIComponent(query));
      if(sequence!==player.searchSeq)return;
      player.externalCatalog=(Array.isArray(data.tracks)?data.tracks:[]).map(safeTrack).filter(function(item){return item.id&&item.audioUrl;});
      renderTracks();
      setStatus(player.externalCatalog.length?"Audius results are ready to play or queue.":"No Audius tracks matched that search.");
    }catch(error){
      if(sequence!==player.searchSeq)return;
      player.externalCatalog=[];
      renderTracks();
      setStatus("Audius search is temporarily unavailable. RIZORA results are still shown.",true);
    }
  }
  function beginSearch(){
    var root=activeRoot(),search=root&&root.querySelector("#rzpSearch"),query=String(search&&search.value||"").trim();
    player.query=query.toLowerCase();player.externalCatalog=[];player.searchSeq++;
    var sequence=player.searchSeq;
    if(player.searchTimer)clearTimeout(player.searchTimer);
    renderTracks();
    if(query.length<2){setStatus(query?"Type at least two letters to search.":"Search RIZORA releases and Audius tracks.");return;}
    setStatus("Searching RIZORA and Audius…");
    player.searchTimer=setTimeout(function(){searchAudius(query,sequence);},300);
  }
  function visibleTracks(){
    var rows=player.catalog.slice();
    if(player.query)rows=rows.concat(player.externalCatalog);
    if(player.view==="liked")rows=rows.filter(function(item){return player.liked.has(String(item.id));});
    else if(player.view==="albums"){var seen={};rows=rows.filter(function(item){var key=String(item.artist||"")+"|"+String(item.artwork||"");if(seen[key])return false;seen[key]=true;return true;});}
    if(player.query)rows=rows.filter(function(item){return [item.title,item.artist,item.genre].join(" ").toLowerCase().indexOf(player.query)!==-1;});
    return rows;
  }
  function renderTracks(){
    var root=activeRoot(),list=root&&root.querySelector("#rzpTrackList");if(!list)return;
    var rows=visibleTracks();
    if(!rows.length){list.innerHTML='<div class="rzp-empty">'+(player.view==="liked"?"Like a track and it will stay in your library.":player.query?"No matching RIZORA or Audius songs.":"No playable releases yet. Search a song or import audio from this device.")+'</div>';return;}
    list.innerHTML=rows.map(function(track){
      var id=String(track.id),isLiked=player.liked.has(id),cover=art(track),guestDownload=!!root.hasAttribute("data-rzp-guest-mode"),external=track.source==="audius";
      var action=external?'<a class="rzp-download" href="'+esc(track.storeUrl||"https://audius.co/")+'" target="_blank" rel="noopener noreferrer">Audius ↗</a>':guestDownload?'<button type="button" class="rzp-guest-download" data-rzp-guest-download="'+esc(id)+'">Create account to download</button>':'<a class="rzp-download" href="'+esc(track.audioUrl)+'" download>Download</a>';
      return '<article class="rzp-track-row '+(player.current&&String(player.current.id)===id?"playing":"")+'"><button type="button" class="rzp-track-main" data-rzp-play="'+esc(id)+'"><span class="rzp-track-art">'+cover+'</span><span class="rzp-track-copy"><strong>'+esc(track.title||"Untitled release")+'</strong><small>'+esc(track.artist||"Unknown artist")+(external?' · Audius':'')+'</small></span><span class="rzp-track-length">'+esc(track.duration||"—")+'</span></button>'+action+'<button type="button" class="rzp-heart '+(isLiked?"liked":"")+'" data-rzp-like="'+esc(id)+'" aria-label="'+(isLiked?"Remove from Liked Songs":"Add to Liked Songs")+'" aria-pressed="'+(isLiked?"true":"false")+'">'+(isLiked?"♥":"♡")+'</button><button type="button" class="rzp-queue-add" data-rzp-queue-add="'+esc(id)+'" aria-label="Add to queue">＋</button></article>';
    }).join("");
  }
  function renderQueue(){var root=activeRoot(),list=root&&root.querySelector("#rzpQueueList");if(!list)return;list.innerHTML=player.queue.length?player.queue.map(function(track,index){return '<button type="button" class="rzp-queue-track" data-rzp-queue-play="'+index+'"><span class="rzp-track-art">'+art(track)+'</span><span><strong>'+esc(track.title||"Untitled release")+'</strong><small>'+esc(track.artist||"Unknown artist")+'</small></span><i>▶</i></button>';}).join(""):'<p class="rzp-empty">Your queue is clear. Add a track with ＋.</p>';}
  function renderNow(){
    var root=activeRoot();if(!root)return;
    var track=player.isAd?player.activeAd:player.current,cover=root.querySelector("#rzpNowArt"),title=root.querySelector("#rzpNowTitle"),artist=root.querySelector("#rzpNowArtist");
    root.setAttribute("data-rzp-ad-playing",player.isAd?"1":"0");
    if(typeof document!=="undefined")document.querySelectorAll("#rzPublicMusic [data-rz-guest-close]").forEach(function(control){control.disabled=player.isAd;});
    if(cover)cover.innerHTML=track?art(track):'<span aria-hidden="true">♫</span>';
    if(title)title.textContent=track?track.title||"Untitled release":"Choose a track";
    if(artist)artist.textContent=player.isAd?"Sponsored · RIZORA":track?(track.artist||"Unknown artist")+(track.source==="audius"?" · Audius":""):"Music Studio player";
    var dockCover=root.querySelector("#rzpDockArt"),dockTitle=root.querySelector("#rzpDockTitle"),dockArtist=root.querySelector("#rzpDockArtist");
    if(dockCover)dockCover.innerHTML=track?art(track):'<span aria-hidden="true">♫</span>';
    if(dockTitle)dockTitle.textContent=track?track.title||"Untitled release":"Choose a track";
    if(dockArtist)dockArtist.textContent=player.isAd?"RIZORA Sponsored Message":track?track.artist||"RIZORA creator":"RIZORA Music";
    var play=root.querySelector("#rzpPlayPause");if(play){play.textContent=player.isAd?"▶":audio.paused?"▶":"Ⅱ";play.setAttribute("aria-label",player.isAd?"Play sponsored message":audio.paused?"Play":"Pause");play.disabled=player.isAd&&!audio.paused;}
    ["#rzpNext","#rzpPrevious"].forEach(function(selector){var control=root.querySelector(selector);if(control)control.disabled=player.isAd;});
    var progress=root.querySelector("#rzpProgress");if(progress)progress.disabled=player.isAd;
    var heart=root.querySelector("#rzpNowLike");if(heart){var liked=!!(track&&!player.isAd&&player.liked.has(String(track.id)));heart.textContent=liked?"♥":"♡";heart.disabled=!track||player.isAd;heart.classList.toggle("liked",liked);}
    renderTracks();renderQueue();
  }
  function userGetsAdFree(){var user=window.RIZORA_CURRENT_USER||{},plan=String(user.plan||"free").toLowerCase();return user.ownerAccount===true||user.premiumPlus===true||plan==="premium"||plan==="premium_plus";}
  function playAd(){
    if(player.isAd||userGetsAdFree()||!player.adDue)return false;
    player.isAd=true;player.activeAd=AUDIO_ADS[player.adIndex%AUDIO_ADS.length];player.adIndex++;
    renderNow();setStatus("Sponsored message. It will finish before your music continues.");
    audio.src=player.activeAd.audioUrl;audio.load();audio.play().catch(function(){setStatus("Tap Play to start this sponsored message before your music continues.",true);renderNow();});
    return true;
  }
  async function playTrack(track){
    if(!track||!track.audioUrl){setStatus("This release has no playable audio preview.",true);return;}
    if(player.isAd){if(!player.current||track.id!==player.current.id)player.pendingTrack=track;setStatus("This sponsored message finishes before your selected song.");return;}
    if(player.adDue&&!userGetsAdFree()){player.pendingTrack=track;playAd();return;}
    if(userGetsAdFree()){player.startsSinceAd=0;player.adDue=false;}else{player.startsSinceAd++;if(player.startsSinceAd>=2)player.adDue=true;}
    player.current=track;renderNow();audio.src=track.audioUrl;audio.load();try{await audio.play();setStatus(track.source==="audius"?"Playing from Audius.":"Playing from your RIZORA library.");}catch(error){setStatus("Tap play again to start audio in this browser.",true);}renderNow();
  }
  function pushQueue(track){if(!track||!track.audioUrl){setStatus("This release has no audio preview to queue.",true);return;}player.queue.push(track);renderQueue();setStatus("Added to your queue.");}
  function nextTrack(){
    if(player.adDue&&!userGetsAdFree()){playAd();return;}
    var pool=player.catalog.concat(player.externalCatalog);
    if(player.repeat&&player.current){playTrack(player.current);return;}
    var next;if(player.shuffle&&pool.length)next=pool[Math.floor(Math.random()*pool.length)];else next=player.queue.shift();
    if(!next&&pool.length)next=pool.find(function(track){return player.current&&track.id!==player.current.id;})||pool[0];
    if(next)playTrack(next);else{audio.pause();setStatus("Your queue has finished.");}
  }
  function handleEnded(){
    if(player.isAd){player.isAd=false;player.activeAd=null;player.adDue=false;player.startsSinceAd=0;var pending=player.pendingTrack;player.pendingTrack=null;renderNow();setStatus("Sponsored message finished. Returning to music.");if(pending)playTrack(pending);else nextTrack();return;}
    if(player.adDue&&!userGetsAdFree()){playAd();return;}
    nextTrack();
  }
  async function loadCatalog(){
    var root=activeRoot();if(!root)return;var list=root.querySelector("#rzpTrackList");
    if(list)list.innerHTML='<div class="rzp-empty">Loading RIZORA releases…</div>';
    try{var data=await window.RIZORA_API_CALL("/api/music/public-catalog");player.catalog=(Array.isArray(data.catalog)?data.catalog:[]).map(safeTrack).filter(function(item){return item.id&&item.audioUrl;});renderTracks();setStatus(player.catalog.length?"RIZORA catalog ready. Search for more music on Audius.":"Search RIZORA releases and Audius tracks.");}
    catch(error){if(list)list.innerHTML='<div class="rzp-empty">Could not load the RIZORA catalog.</div>';setStatus(error.message||"Could not load releases. Check your connection and retry.",true);}
  }
  function bind(root){
    var mount=root&&root.querySelector("#rzsMusicPlayer");if(!mount||mount.__rzpWired)return;
    mount.__rzpWired=true;player.root=mount;player.liked=likedIds();
    mount.addEventListener("click",function(event){
      var button=event.target.closest("button");if(!button)return;
      var guestDownload=button.getAttribute("data-rzp-guest-download");if(guestDownload!==null){if(typeof window.RIZORA_GUEST_DOWNLOAD==="function")window.RIZORA_GUEST_DOWNLOAD();return;}
      var id=button.getAttribute("data-rzp-play");if(id){playTrack(findTrack(id));return;}
      id=button.getAttribute("data-rzp-like");if(id){player.liked.has(id)?player.liked.delete(id):player.liked.add(id);saveLikes();renderNow();return;}
      id=button.getAttribute("data-rzp-queue-add");if(id){pushQueue(findTrack(id));return;}
      var queueIndex=button.getAttribute("data-rzp-queue-play");if(queueIndex!==null){var selected=player.queue.splice(Number(queueIndex),1)[0];if(selected)playTrack(selected);return;}
      if(button.id==="rzpPlayPause"){if(player.isAd){if(audio.paused)audio.play().catch(function(){setStatus("Tap Play to continue the sponsored message.",true);});return;}if(audio.paused){if(player.current)audio.play().catch(function(){setStatus("Tap play again to start audio.",true);});else{var first=visibleTracks()[0];if(first)playTrack(first);}}else audio.pause();renderNow();return;}
      if(button.id==="rzpNext"){nextTrack();return;}
      if(button.id==="rzpPrevious"){if(audio.currentTime>3)audio.currentTime=0;else if(player.current)audio.currentTime=0;return;}
      if(button.id==="rzpShuffle"){player.shuffle=!player.shuffle;button.classList.toggle("active",player.shuffle);return;}
      if(button.id==="rzpRepeat"){player.repeat=!player.repeat;button.classList.toggle("active",player.repeat);button.setAttribute("aria-pressed",player.repeat?"true":"false");return;}
      if(button.id==="rzpNowLike"){if(player.current){var currentId=String(player.current.id);player.liked.has(currentId)?player.liked.delete(currentId):player.liked.add(currentId);saveLikes();renderNow();}return;}
      if(button.id==="rzpRetry"){loadCatalog();return;}
      var view=button.getAttribute("data-rzp-view");if(view){player.view=view;mount.querySelectorAll("[data-rzp-view]").forEach(function(item){item.classList.toggle("active",item===button);});renderTracks();return;}
    });
    var search=mount.querySelector("#rzpSearch");
    if(search){search.oninput=beginSearch;search.addEventListener("keydown",function(event){if(event.key==="Enter"){event.preventDefault();beginSearch();if(player.searchTimer){clearTimeout(player.searchTimer);player.searchTimer=null;}if(player.query.length>=2)searchAudius(search.value.trim(),player.searchSeq);}});}
    var progress=mount.querySelector("#rzpProgress"),volume=mount.querySelector("#rzpVolume");
    if(progress)progress.oninput=function(){if(!player.isAd&&audio.duration)audio.currentTime=(Number(progress.value)/100)*audio.duration;};
    if(volume)volume.oninput=function(){audio.volume=Number(volume.value);};
    var upload=mount.querySelector("#rzpLocalFile");
    if(upload)upload.onchange=function(){var file=upload.files&&upload.files[0];if(!file)return;if(!/^audio\//i.test(file.type)){setStatus("Choose an audio file.",true);return;}var fileUrl=URL.createObjectURL(file),track=safeTrack({id:"local_"+Date.now(),title:file.name.replace(/\.[^.]+$/,"") ,artist:"On this device",audioUrl:fileUrl});player.localUrls.push(fileUrl);player.catalog.unshift(track);player.view="all";playTrack(track);};
    audio.ontimeupdate=function(){var current=activeRoot(),slider=current&&current.querySelector("#rzpProgress"),elapsed=current&&current.querySelector("#rzpElapsed"),duration=current&&current.querySelector("#rzpDuration");if(slider&&audio.duration)slider.value=String(Math.round(audio.currentTime/audio.duration*100));if(elapsed)elapsed.textContent=formatTime(audio.currentTime);if(duration)duration.textContent=formatTime(audio.duration);};
    audio.onplay=renderNow;audio.onpause=renderNow;audio.onended=handleEnded;audio.onerror=function(){setStatus(player.isAd?"The sponsored message could not play. Tap Play to retry.":"This audio preview could not be played.",true);renderNow();};audio.volume=volume?Number(volume.value):.75;
    renderNow();loadCatalog();
  }
  player.wire=bind;player.playTrack=playTrack;player.handleEnded=handleEnded;player.nextTrack=nextTrack;
  window.RIZORA_PLAYER=player;
})();
