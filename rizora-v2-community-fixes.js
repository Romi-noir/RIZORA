"use strict";
(function(){
  var API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,'');
  var mediaState={imageUrl:"",videoUrl:"",imageBlob:null,videoBlob:null};
  var seenNotifications=null;

  function esc(value){return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
  function call(path,opt){return window.RIZORA_API_CALL?window.RIZORA_API_CALL(path,opt):fetch(API+path,Object.assign({credentials:"include",headers:{"Content-Type":"application/json","Accept":"application/json"}},opt||{})).then(function(r){return r.json().then(function(d){if(!r.ok)throw new Error(d.message||d.error||"Request failed.");return d;});});}
  function current(){return window.state&&window.state.user||window.RIZORA_CURRENT_USER||null;}
  function hash(text){var n=0;String(text||"").split("").forEach(function(ch){n=((n<<5)-n)+ch.charCodeAt(0);n|=0;});return Math.abs(n);}
  function revoke(name){if(mediaState[name]){try{URL.revokeObjectURL(mediaState[name]);}catch(_){ }mediaState[name]="";}}
  function download(blob,name){if(!blob)return;var url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(url);},1500);}

  function drawArtwork(prompt,frame){
    var canvas=document.createElement("canvas"),size=1024;canvas.width=size;canvas.height=size;
    var ctx=canvas.getContext("2d"),seed=hash(prompt),hue=seed%360;
    var gradient=ctx.createLinearGradient(0,0,size,size);gradient.addColorStop(0,"hsl("+hue+",75%,10%)");gradient.addColorStop(.52,"#10071d");gradient.addColorStop(1,"hsl("+((hue+90)%360)+",80%,18%)");ctx.fillStyle=gradient;ctx.fillRect(0,0,size,size);
    var glow=ctx.createRadialGradient(size*.72,size*.25,10,size*.72,size*.25,size*.75);glow.addColorStop(0,"rgba(255,205,102,.45)"),glow.addColorStop(1,"rgba(255,80,210,0)");ctx.fillStyle=glow;ctx.fillRect(0,0,size,size);
    ctx.globalAlpha=.18;ctx.strokeStyle="#f5c76c";ctx.lineWidth=2;for(var i=0;i<18;i++){var y=90+i*54;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(size,y+Math.sin(i+seed)*70);ctx.stroke();}ctx.globalAlpha=1;
    ctx.fillStyle="#f8d48c";ctx.textAlign="center";ctx.font="800 76px system-ui, sans-serif";ctx.fillText("RIZORA",size/2,180);
    ctx.font="500 26px system-ui, sans-serif";ctx.fillStyle="#f4e7ca";ctx.fillText("AI CREATOR RELEASE",size/2,226);
    ctx.font="700 34px system-ui, sans-serif";ctx.fillStyle="#fff";var words=String(prompt||"Your next release").trim().slice(0,54);var lines=[];for(var j=0;j<words.length;j+=26)lines.push(words.slice(j,j+26));lines.slice(0,2).forEach(function(line,index){ctx.fillText(line.toUpperCase(),size/2,760+index*48);});
    ctx.font="500 22px system-ui, sans-serif";ctx.fillStyle="#e8bcff";ctx.fillText("CREATE · GROW · EARN",size/2,920);
    if(frame){ctx.strokeStyle="rgba(255,211,111,.85)";ctx.lineWidth=5;ctx.beginPath();for(var x=0;x<=size;x+=8){var wave=Math.sin(x/30+frame)*22+Math.sin(x/9+frame*2)*8;var yy=550+wave; if(x===0)ctx.moveTo(x,yy);else ctx.lineTo(x,yy);}ctx.stroke();}
    return canvas;
  }
  function generateImage(root){
    var input=root.querySelector("#rzMediaPrompt"),status=root.querySelector("#rzMediaStatus"),preview=root.querySelector("#rzMediaPreview");
    var prompt=String(input&&input.value||"").trim();if(!prompt){if(status)status.textContent="Describe the release first.";return;}
    if(status)status.textContent="RIZORA is generating cover art in your browser…";
    var canvas=drawArtwork(prompt,0);canvas.toBlob(function(blob){revoke("imageUrl");mediaState.imageBlob=blob;mediaState.imageUrl=URL.createObjectURL(blob);if(preview){preview.innerHTML='<img src="'+mediaState.imageUrl+'" alt="Generated RIZORA cover art"><div class="rz-media-actions"><button type="button" class="rz-btn" data-rz-download-image>Download JPG</button></div>';preview.querySelector("[data-rz-download-image]").onclick=function(){download(mediaState.imageBlob,"rizora-cover.jpg");};}if(status)status.textContent="Cover art ready.";},"image/jpeg",.92);
  }
  function generateVideo(root){
    var input=root.querySelector("#rzMediaPrompt"),status=root.querySelector("#rzMediaStatus"),preview=root.querySelector("#rzMediaPreview"),prompt=String(input&&input.value||"").trim();
    if(!prompt){if(status)status.textContent="Describe the release first.";return;}
    if(!window.MediaRecorder){if(status)status.textContent="Video generation is not supported in this browser. Generate an image instead.";return;}
    if(status)status.textContent="RIZORA is rendering a short visualizer…";
    var canvas=drawArtwork(prompt,0),stream=canvas.captureStream(30),mime=MediaRecorder.isTypeSupported("video/webm;codecs=vp9")?"video/webm;codecs=vp9":"video/webm",recorder=new MediaRecorder(stream,{mimeType:mime}),chunks=[],frame=0;
    recorder.ondataavailable=function(e){if(e.data&&e.data.size)chunks.push(e.data);};recorder.onstop=function(){stream.getTracks().forEach(function(t){t.stop();});var blob=new Blob(chunks,{type:mime});revoke("videoUrl");mediaState.videoBlob=blob;mediaState.videoUrl=URL.createObjectURL(blob);if(preview){preview.innerHTML='<video controls playsinline src="'+mediaState.videoUrl+'"></video><div class="rz-media-actions"><button type="button" class="rz-btn" data-rz-download-video>Download WebM</button></div>';preview.querySelector("[data-rz-download-video]").onclick=function(){download(mediaState.videoBlob,"rizora-visualizer.webm");};}if(status)status.textContent="Visualizer ready.";};
    recorder.start();var timer=setInterval(function(){frame+=.12;var next=drawArtwork(prompt,frame),ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(next,0,0);},33);setTimeout(function(){clearInterval(timer);if(recorder.state!=="inactive")recorder.stop();},6000);
  }
  function mediaLab(){return '<section class="rz-card rz-ai-media-lab" id="rzAiMediaLab"><div class="rz-section-title"><div><div class="rz-kicker">RIZORA AI MEDIA LAB</div><h3>Turn an idea into a visual</h3><p class="rz-muted">Create cover art and a short music visualizer locally in your browser. No paid API or upload is required.</p></div><span class="rz-badge ok">READY</span></div><textarea id="rzMediaPrompt" class="rz-textarea" maxlength="500" placeholder="e.g. Afro-funk Lagos night, gold street lights, 120 BPM"></textarea><div class="rz-actions"><button type="button" class="rz-btn primary" data-rz-generate-image>Generate image</button><button type="button" class="rz-btn" data-rz-generate-video>Generate video</button></div><div id="rzMediaStatus" class="rz-mini" role="status" aria-live="polite"></div><div id="rzMediaPreview" class="rz-media-lab-preview"><div class="rz-empty">Your generated image or video will appear here.</div></div></section>';}
  function mountMediaLab(){
    if(!window.state||window.state.view!=="ai")return;
    var content=document.getElementById("content");if(!content||document.getElementById("rzAiMediaLab"))return;
    var form=document.getElementById("aiForm");if(form)form.insertAdjacentHTML("beforebegin",mediaLab());else content.insertAdjacentHTML("beforeend",mediaLab());
    var root=document.getElementById("rzAiMediaLab");root.querySelector("[data-rz-generate-image]").onclick=function(){generateImage(root);};root.querySelector("[data-rz-generate-video]").onclick=function(){generateVideo(root);};
  }

  function upgradeMessageMedia(root){
    (root||document).querySelectorAll("audio[data-rz-media-src]").forEach(function(audio){var raw=audio.getAttribute("data-rz-media-src")||"",clean=raw.split("?")[0].toLowerCase(),replacement=null;
      if(/\.(png|jpe?g|webp|gif)$/.test(clean)){replacement=document.createElement("img");replacement.alt="Message image";replacement.loading="lazy";}
      else if(/\.(mp4|webm|mov)$/.test(clean)){replacement=document.createElement("video");replacement.controls=true;replacement.playsInline=true;replacement.preload="metadata";}
      if(replacement){replacement.setAttribute("data-rz-media-src",raw);audio.replaceWith(replacement);if(window.RIZORA_MEDIA_BIND_PLAYBACK)window.RIZORA_MEDIA_BIND_PLAYBACK(replacement.parentNode||document);}
    });
  }
  function enhanceChatForm(form){
    if(!form||form.getAttribute("data-rz-community-chat")==="1")return;
    form.setAttribute("data-rz-community-chat","1");
    var input=document.createElement("input");input.type="file";input.accept="image/*,video/*,audio/*";input.className="rz-chat-file";input.setAttribute("aria-label","Attach image, video or audio");
    var label=document.createElement("label");label.className="rz-btn rz-chat-attach";label.textContent="Attach";label.appendChild(input);
    var status=document.createElement("span");status.className="rz-chat-upload-status rz-mini";status.setAttribute("role","status");
    form.insertBefore(label,form.querySelector("button"));form.insertBefore(status,form.querySelector("button"));
    var media=null;
    input.addEventListener("change",async function(){var file=input.files&&input.files[0];if(!file)return;try{status.textContent="Uploading…";media=await window.RIZORA_UPLOAD_FILE(file,status);status.textContent="Attached: "+file.name;}catch(e){media=null;status.textContent=e.message||"Upload failed.";}});
    form.onsubmit=async function(e){e.preventDefault();var text=(form.querySelector("#messageText")||{}).value||"",target=form.getAttribute("data-chat-target");text=String(text).trim();if(!text&&!media){status.textContent="Write a message or attach media.";return;}var button=form.querySelector("button[type=submit],button:not([type])");if(button)button.disabled=true;try{await call("/api/v2/messages/"+encodeURIComponent(target),{method:"POST",body:JSON.stringify({text:text,mediaId:media&&media.id||""})});if(window.openChat)window.openChat(target);}catch(err){status.textContent=err.message||"Message could not be sent.";}finally{if(button)button.disabled=false;}};
  }
  function patchOpenChat(){
    if(typeof window.openChat!=="function"||window.openChat.__rzCommunity)return;
    var original=window.openChat;
    function wrapped(target){return Promise.resolve(original(target)).then(function(result){setTimeout(function(){enhanceChatForm(document.getElementById("messageForm"));upgradeMessageMedia(document.getElementById("chatBox"));},0);return result;});}
    wrapped.__rzCommunity=true;window.openChat=wrapped;window.RIZORA_OPEN_CHAT=wrapped;
  }
  function decorateDiscover(){
    document.querySelectorAll("[data-profile-user]").forEach(function(button){if(button.getAttribute("data-rz-bound")==="1")return;button.setAttribute("data-rz-bound","1");button.onclick=function(){openPublicProfile(button.getAttribute("data-profile-user"));};});
  }
  async function openPublicProfile(username){
    var overlay=document.createElement("div");overlay.className="rz-overlay rz-public-profile-overlay";overlay.innerHTML='<section class="rz-modal rz-public-profile-modal"><button type="button" class="rz-btn rz-public-profile-close">Close</button><div class="rz-public-profile-loading">Loading profile…</div></section>';document.body.appendChild(overlay);overlay.querySelector(".rz-public-profile-close").onclick=function(){overlay.remove();};
    try{var data=await call("/api/public/creator/"+encodeURIComponent(username));var c=data.creator||{},p=c.profile||{};overlay.querySelector(".rz-public-profile-modal").innerHTML='<button type="button" class="rz-btn rz-public-profile-close">Close</button><div class="rz-public-profile-head">'+(p.avatarUrl?'<img src="'+esc(p.avatarUrl)+'" alt="">':'<div class="rz-avatar">'+esc((c.displayName||c.username||"R").slice(0,2).toUpperCase())+'</div>')+'<div><div class="rz-kicker">RIZORA CREATOR</div><h2>'+esc(c.displayName||c.username||"Creator")+'</h2><div class="rz-mini">@'+esc(c.publicUsername||c.username||username)+'</div></div></div><p class="rz-public-profile-bio">'+esc(p.bio||"Creator on RIZORA")+'</p><div class="rz-actions"><a class="rz-btn primary" href="/creator/'+encodeURIComponent(c.publicUsername||c.username||username)+'/">Open full profile</a><button type="button" class="rz-btn" data-rz-profile-message>Message</button></div>';overlay.querySelector(".rz-public-profile-close").onclick=function(){overlay.remove();};overlay.querySelector("[data-rz-profile-message]").onclick=function(){overlay.remove();if(window.RIZORA_GOTO)window.RIZORA_GOTO("messages");setTimeout(function(){if(window.RIZORA_OPEN_CHAT)window.RIZORA_OPEN_CHAT(c.username||username);},250);};}catch(error){overlay.querySelector(".rz-public-profile-loading").textContent=error.message||"Profile could not be loaded.";}
  }
  function theme(){try{return localStorage.getItem("rizora_profile_theme")||"dark";}catch(_){return "dark";}}
  function applyTheme(root,value){var card=root&&root.querySelector(".rz-profile-card");if(!card)return;card.classList.remove("rz-profile-theme-dark","rz-profile-theme-purple","rz-profile-theme-light");card.classList.add("rz-profile-theme-"+value);try{localStorage.setItem("rizora_profile_theme",value);}catch(_){}}
  function profileThemeControls(){
    if(!window.state||window.state.view!=="profile")return;var card=document.querySelector(".rz-profile-card");if(!card||document.getElementById("rzProfileThemes"))return;var box=document.createElement("div");box.id="rzProfileThemes";box.className="rz-profile-themes";box.innerHTML='<div><div class="rz-kicker">PROFILE STYLE</div><span class="rz-mini">Choose how your public profile feels.</span></div><div class="rz-profile-theme-buttons"><button type="button" data-rz-profile-theme="dark">Dark</button><button type="button" data-rz-profile-theme="purple">Purple</button><button type="button" data-rz-profile-theme="light">Light</button></div>';card.querySelector(".rz-profile-inner")?.appendChild(box);applyTheme(document,theme());box.querySelectorAll("[data-rz-profile-theme]").forEach(function(button){button.onclick=function(){applyTheme(document,button.getAttribute("data-rz-profile-theme"));box.querySelectorAll("button").forEach(function(x){x.classList.toggle("active",x===button);});};});var active=box.querySelector('[data-rz-profile-theme="'+theme()+'"]');if(active)active.classList.add("active");
  }
  function liveBanner(){
    if(!window.state||window.state.view!=="live")return;var list=document.querySelector(".rz-live-list");if(list&&!document.getElementById("rzLiveBanner")){var banner=document.createElement("div");banner.id="rzLiveBanner";banner.className="rz-live-banner";banner.innerHTML='<img src="/assets/rizora-live.png" alt="RIZORA LIVE"><div><strong>RIZORA LIVE</strong><span>Join creators in real time or start your own room.</span></div>';list.insertBefore(banner,list.firstChild);}
    document.querySelectorAll(".rz-avatar-wrap").forEach(function(el){var id=el.getAttribute("data-rz-avatar-user");if(el.querySelector(".rz-live-badge")||(id&&Array.isArray(window.RIZORA_LIVE_USERS)&&window.RIZORA_LIVE_USERS.indexOf(id)!==-1))el.classList.add("rz-avatar-live");});
  }
  var lastPoll=0;
  async function pollNotifications(){
    var user=current();if(!user||!window.RIZORA_API_CALL||Date.now()-lastPoll<15000)return;lastPoll=Date.now();try{var data=await call("/api/v2/notifications"),items=Array.isArray(data.notifications)?data.notifications:[];if(!seenNotifications){seenNotifications=new Set(items.map(function(n){return n.id;}));return;}items.slice().reverse().forEach(function(n){if(seenNotifications.has(n.id))return;seenNotifications.add(n.id);if(window.RIZORA_POPUP)window.RIZORA_POPUP(n.title||"RIZORA notification",n.message||"You have a new update.","success");});var unread=items.filter(function(n){return !n.read;}).length;document.querySelectorAll('[data-nav="notifications"]').forEach(function(nav){var badge=nav.querySelector(".rz-notification-count");if(!badge){badge=document.createElement("b");badge.className="rz-notification-count";nav.appendChild(badge);}badge.textContent=unread>99?"99+":String(unread);badge.hidden=!unread;});}catch(_){}}
  function run(){patchOpenChat();mountMediaLab();decorateDiscover();profileThemeControls();liveBanner();pollNotifications();}
  setInterval(pollNotifications,22000);setInterval(run,1800);
  if(document.body)new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
  window.RIZORA_COMMUNITY_FIXES={openPublicProfile:openPublicProfile,generateImage:generateImage,generateVideo:generateVideo};
  setTimeout(run,300);
})();

