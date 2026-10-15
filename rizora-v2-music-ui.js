"use strict";
(function(){
  var API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,'');
  function esc(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
  async function api(path,opt){
    opt=opt||{};
    if(typeof window.RIZORA_API_CALL==='function')return window.RIZORA_API_CALL(path,opt);
    var headers=Object.assign({'Content-Type':'application/json'},opt.headers||{}),token='';
    try{token=String(localStorage.getItem('rizora_auth_token')||'').trim();}catch(_){ }
    if(token&&!headers.Authorization)headers.Authorization='Bearer '+token;
    var response=await fetch(API+path,{method:opt.method||'GET',headers:headers,credentials:'include',body:opt.body});
    var text=await response.text(),data={};try{data=text?JSON.parse(text):{};}catch(_){data={error:text};}
    if(!response.ok)throw new Error(data.message||data.error||'Request failed.');
    return data;
  }
  function toast(message){
    if(window.RIZORA_ENTERPRISE&&typeof window.RIZORA_ENTERPRISE.toast==='function'){window.RIZORA_ENTERPRISE.toast(message);return;}
    var target=document.getElementById('toast');if(!target)return;target.textContent=message;target.classList.add('show');clearTimeout(window.__rzMusicToast);window.__rzMusicToast=setTimeout(function(){target.classList.remove('show');},2600);
  }
  function releaseLocalBeatSketch(){if(window.__rzMusicSketchUrl){URL.revokeObjectURL(window.__rzMusicSketchUrl);window.__rzMusicSketchUrl='';}}
  function close(){var existing=document.getElementById('rzMusicOverlay');if(existing)existing.remove();releaseLocalBeatSketch();}
  function date(value){if(!value)return 'Date unavailable';try{return new Date(value).toLocaleString();}catch(_){return String(value);}}
  function platforms(items){return (Array.isArray(items)?items:[]).map(function(item){return '<span class="rz-music-pill">'+esc(String(item).replace(/_/g,' '))+'</span>';}).join('');}
  function aiResultHTML(result){
    if(!result||typeof result!=="object")throw new Error('Music AI returned no usable arrangement. Try again.');
    var sections=Array.isArray(result.sections)?result.sections.map(function(section){return '<article class="rz-music-ai-section"><strong>'+esc(section.name)+' · '+esc(section.bars)+' bars</strong><span>'+esc(section.focus)+'</span></article>';}).join(''):'';
    var structure=Array.isArray(result.structure)?result.structure.map(function(item){return '<span class="rz-music-pill">'+esc(item)+'</span>';}).join(''):'';
    var layers=Array.isArray(result.layers)?result.layers.map(function(item){return '<li>'+esc(item)+'</li>';}).join(''):'';
    if(result.type==='beat_concept')return '<div class="rz-music-ai-result"><div class="rz-music-ai-result-head"><div><div class="rz-kicker">CONCEPT READY</div><strong>'+esc(result.title||'Beat concept')+'</strong></div><span class="rz-music-ai-metric">'+esc(result.tempoBpm)+' BPM · '+esc(result.key)+'</span></div><p>'+esc(result.genre)+' · '+esc(result.mood)+'</p><div class="rz-music-ai-columns"><div><small>Groove</small><span>'+esc(result.groove)+'</span></div><div><small>Bass</small><span>'+esc(result.bass)+'</span></div><div><small>Palette</small><span>'+esc(result.palette)+'</span></div></div><div class="rz-music-ai-structure">'+structure+'</div><p class="rz-music-ai-note">'+esc(result.producerNote)+'</p></div>';
    return '<div class="rz-music-ai-result"><div class="rz-music-ai-result-head"><div><div class="rz-kicker">ARRANGEMENT READY</div><strong>'+esc(result.title||'Arrangement direction')+'</strong></div><span class="rz-music-ai-metric">'+esc(result.tempoBpm)+' BPM · '+esc(result.key)+'</span></div><p>'+esc(result.genre)+' · '+esc(result.mood)+'</p><div class="rz-music-ai-sections">'+sections+'</div><div class="rz-music-ai-columns"><div><small>Vocal direction</small><span>'+esc(result.vocalDirection)+'</span></div><div><small>Production layers</small><ul>'+layers+'</ul></div></div><div class="rz-music-ai-notes">'+(Array.isArray(result.mixNotes)?result.mixNotes.map(function(item){return '<span>'+esc(item)+'</span>';}).join(''):'')+'</div></div>';
  }
  function audioBufferToWav(audioBuffer){
    var channels=audioBuffer.numberOfChannels,frames=audioBuffer.length,bytesPerSample=2,blockAlign=channels*bytesPerSample,dataBytes=frames*blockAlign,buffer=new ArrayBuffer(44+dataBytes),view=new DataView(buffer),offset=0;
    function writeText(value){for(var index=0;index<value.length;index++)view.setUint8(offset++,value.charCodeAt(index));}
    writeText('RIFF');view.setUint32(offset,36+dataBytes,true);offset+=4;writeText('WAVE');writeText('fmt ');view.setUint32(offset,16,true);offset+=4;view.setUint16(offset,1,true);offset+=2;view.setUint16(offset,channels,true);offset+=2;view.setUint32(offset,audioBuffer.sampleRate,true);offset+=4;view.setUint32(offset,audioBuffer.sampleRate*blockAlign,true);offset+=4;view.setUint16(offset,blockAlign,true);offset+=2;view.setUint16(offset,16,true);offset+=2;writeText('data');view.setUint32(offset,dataBytes,true);offset+=4;
    for(var frame=0;frame<frames;frame++)for(var channel=0;channel<channels;channel++){var sample=Math.max(-1,Math.min(1,audioBuffer.getChannelData(channel)[frame]));view.setInt16(offset,sample<0?sample*32768:sample*32767,true);offset+=2;}
    return new Blob([buffer],{type:'audio/wav'});
  }
  async function renderBeatSketch(genre,mood,durationMs){
    var Offline=window.OfflineAudioContext||window.webkitOfflineAudioContext;
    if(!Offline)throw new Error('This browser does not support local beat rendering.');
    var sampleRate=22050,channels=2,durationSeconds=durationMs/1000,frameCount=Math.ceil(sampleRate*durationSeconds),context=new Offline(channels,frameCount,sampleRate),master=context.createGain();
    var bpm={Afrobeats:104,'R&B':82,'Hip-hop':90,Pop:112,Electronic:124,Alternative:105}[genre]||100,barSeconds=240/bpm,stepSeconds=barSeconds/16,genreKey=String(genre||'').toLowerCase(),minor=/dark|late night|reflective/i.test(mood||''),rootFrequency=minor?55:65.41;
    master.gain.value=.54;master.connect(context.destination);
    var noise=context.createBuffer(1,Math.ceil(sampleRate*.2),sampleRate),noiseData=noise.getChannelData(0);for(var sampleIndex=0;sampleIndex<noiseData.length;sampleIndex++)noiseData[sampleIndex]=Math.random()*2-1;
    function kick(time){var oscillator=context.createOscillator(),gain=context.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(112,time);oscillator.frequency.exponentialRampToValueAtTime(44,time+.15);gain.gain.setValueAtTime(.9,time);gain.gain.exponentialRampToValueAtTime(.001,time+.24);oscillator.connect(gain);gain.connect(master);oscillator.start(time);oscillator.stop(time+.25);}
    function noiseHit(time,length,frequency,volume,type){var source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();source.buffer=noise;filter.type=type;filter.frequency.value=frequency;gain.gain.setValueAtTime(volume,time);gain.gain.exponentialRampToValueAtTime(.001,time+length);source.connect(filter);filter.connect(gain);gain.connect(master);source.start(time);source.stop(time+length);}
    function bass(time,step){var oscillator=context.createOscillator(),gain=context.createGain(),frequency=rootFrequency*(step%3===1?1.5:step%3===2?2:1);oscillator.type='triangle';oscillator.frequency.value=frequency;gain.gain.setValueAtTime(.22,time);gain.gain.exponentialRampToValueAtTime(.001,time+.31);oscillator.connect(gain);gain.connect(master);oscillator.start(time);oscillator.stop(time+.32);}
    function chord(time){var notes=minor?[1,1.189,1.498]:[1,1.26,1.498];notes.forEach(function(ratio){var oscillator=context.createOscillator(),gain=context.createGain(),filter=context.createBiquadFilter();oscillator.type='triangle';oscillator.frequency.value=rootFrequency*2*ratio;filter.type='lowpass';filter.frequency.value=950;gain.gain.setValueAtTime(.001,time);gain.gain.linearRampToValueAtTime(.035,time+.08);gain.gain.setValueAtTime(.028,time+barSeconds*.68);gain.gain.exponentialRampToValueAtTime(.001,Math.min(durationSeconds,time+barSeconds*.9));oscillator.connect(filter);filter.connect(gain);gain.connect(master);oscillator.start(time);oscillator.stop(Math.min(durationSeconds,time+barSeconds));});}
    var kickPatterns=genreKey.indexOf('hip')>=0?[0,6,8,13]:genreKey.indexOf('elect')>=0?[0,4,8,12]:genreKey.indexOf('r&b')>=0?[0,7,10]:genreKey.indexOf('pop')>=0?[0,8]:[0,5,8,11,14];
    for(var bar=0;bar<Math.ceil(durationSeconds/barSeconds);bar++){
      var barStart=bar*barSeconds;if(barStart<durationSeconds)chord(barStart);
      for(var step=0;step<16;step++){
        var time=barStart+step*stepSeconds;if(time>=durationSeconds)break;
        if(kickPatterns.indexOf(step)>=0){kick(time);bass(time,step);}
        if(step===4||step===12)noiseHit(time,.17,1900,.22,'bandpass');
        if(step%2===1||(step===6&&bar%2===1))noiseHit(time,.045,8500,.075,'highpass');
      }
    }
    return audioBufferToWav(await context.startRendering());
  }
  function installMusicAudioStudio(root){
    var card=root&&root.querySelector('.rz-music-ai-card');
    if(!card||card.querySelector('#rzMusicAudioGenerate'))return;
    var studio=document.createElement('section');
    studio.className='rz-music-audio-studio';
    studio.innerHTML='<div class="rz-kicker">ORIGINAL AUDIO</div><h3>Generate music</h3><p class="rz-music-muted">Create a local beat sketch now or generate a full track with the connected music provider.</p><p class="rz-music-muted">Commercial-use rights depend on the provider plan. Confirm rights before distribution.</p><div class="rz-music-audio-controls"><label>Length<select id="rzMusicAudioLength"><option value="15000">15 seconds</option><option value="30000" selected>30 seconds</option><option value="60000">60 seconds</option></select></label><label class="rz-music-audio-instrumental"><input id="rzMusicAudioInstrumental" type="checkbox" checked> Instrumental</label></div><div class="rz-music-actions"><button type="button" class="rz-btn" id="rzMusicAudioSketch">Create beat sketch</button><button type="button" class="rz-btn primary" id="rzMusicAudioGenerate">Generate full track</button></div><div id="rzMusicAudioMessage" class="rz-music-message" role="status" aria-live="polite"></div><div id="rzMusicGeneratedPlayer" class="rz-music-generated-player"></div>';
    card.appendChild(studio);
    var button=studio.querySelector('#rzMusicAudioGenerate'),sketchButton=studio.querySelector('#rzMusicAudioSketch'),message=studio.querySelector('#rzMusicAudioMessage'),player=studio.querySelector('#rzMusicGeneratedPlayer'),localAudioUrl='';
    api('/api/music/audio-status').then(function(status){
      if(status.configured){message.textContent='Audio generation is connected.';return;}
      button.disabled=true;
      message.textContent='Connect a music-generation provider and persistent media storage to enable audio generation.';
    }).catch(function(){button.disabled=true;message.textContent='Audio generation status is unavailable. Try reopening Music Studio.';});
    sketchButton.onclick=async function(){
      var genre=root.querySelector('#rzMusicAiGenre'),mood=root.querySelector('#rzMusicAiMood'),length=Number(studio.querySelector('#rzMusicAudioLength').value);
      sketchButton.disabled=true;sketchButton.textContent='Rendering…';message.textContent='Building a local instrumental sketch. It will not be uploaded or saved to your catalog.';player.innerHTML='';
      try{
        var blob=await renderBeatSketch(genre?genre.value:'Afrobeats',mood?mood.value:'Modern',length);
        if(localAudioUrl)URL.revokeObjectURL(localAudioUrl);localAudioUrl=URL.createObjectURL(blob);window.__rzMusicSketchUrl=localAudioUrl;
        player.innerHTML='<audio controls preload="metadata" src="'+esc(localAudioUrl)+'"></audio><a class="rz-music-download" href="'+esc(localAudioUrl)+'" download="rizora-beat-sketch.wav">Download beat sketch</a>';
        message.textContent='Your beat sketch is ready to preview and download. It is a local instrumental draft, not a mastered track.';
      }catch(error){message.textContent=error.message||'Beat sketch could not be rendered.';}
      finally{sketchButton.disabled=false;sketchButton.textContent='Create beat sketch';}
    };
    button.onclick=async function(){
      var promptField=root.querySelector('#rzMusicAiPrompt'),prompt=promptField?promptField.value.trim():'';
      if(prompt.length<8){message.textContent='Add a short music description in Music Director first.';if(promptField)promptField.focus();return;}
      var durationMs=Number(studio.querySelector('#rzMusicAudioLength').value),format=root.querySelector('#rzMusicAiFormat'),genre=root.querySelector('#rzMusicAiGenre'),mood=root.querySelector('#rzMusicAiMood');
      releaseLocalBeatSketch();localAudioUrl='';button.disabled=true;button.textContent='Generating…';message.textContent='Composing your original audio. This can take a little while.';player.innerHTML='';
      try{
        var result=await api('/api/music/generate-audio',{method:'POST',body:JSON.stringify({prompt:prompt,genre:genre?genre.value:'Afrobeats',mood:mood?mood.value:'Modern',format:format?format.value:'Full track',durationMs:durationMs,forceInstrumental:studio.querySelector('#rzMusicAudioInstrumental').checked})});
        var media=result.media||{},url=API+(media.url||'');
        if(!media.url)throw new Error('The generated audio was not saved. Try again.');
        var audioField=root.querySelector('#rzMusicAudioUrl'),audioStatus=root.querySelector('#rzMusicAudioStatus'),audioPreview=root.querySelector('#rzMusicAudioPreview');
        if(audioField)audioField.value=url;
        if(audioStatus)audioStatus.textContent='Generated audio attached to this release draft.';
        if(audioPreview)audioPreview.innerHTML='<audio controls preload="metadata" src="'+esc(url)+'"></audio>';
        player.innerHTML='<audio controls preload="metadata" src="'+esc(url)+'"></audio><a class="rz-music-download" href="'+esc(url)+'" download="rizora-generated-track.mp3">Download audio</a>';
        if(window.RIZORA_MEDIA_BIND_PLAYBACK)window.RIZORA_MEDIA_BIND_PLAYBACK(player);
        message.textContent='Audio is ready and attached. Save the release draft to keep it in your catalog.';
      }catch(error){message.textContent=error.message||'Audio generation failed. Try again.';}
      finally{button.disabled=false;button.textContent='Generate audio';}
    };
  }
  function cleanMusicDistributionCopy(root){
    var hero=root.querySelector('.rz-music-hero p');
    if(hero)hero.textContent='Create audio, shape a release, and save it to your RIZORA catalog. External store delivery is not connected yet.';
    var visibility=root.querySelector('select[name="visibility"]');if(visibility){if(visibility.options[0]){visibility.options[0].textContent='Public RIZORA catalog';visibility.options[0].defaultSelected=false;}if(visibility.options[1]){visibility.options[1].textContent='Private draft';visibility.options[1].defaultSelected=true;}visibility.value='private';}
    var distributor=root.querySelector('.rz-music-distributor-note');
    if(distributor){var strong=distributor.querySelector('strong'),span=distributor.querySelector('span');if(strong)strong.textContent='RIZORA catalog';if(span)span.textContent='Saving here creates a draft; this does not send music to external stores.';}
    var destinations=root.querySelector('.rz-music-platforms');
    if(destinations){var heading=destinations.previousElementSibling;if(heading)heading.textContent='Delivery targets · plan only';var tiktok=destinations.querySelector('input[value="tiktok_music"]');if(tiktok){tiktok.value='tiktok';var label=tiktok.closest('label');if(label)label.lastChild.textContent=' TikTok / CapCut';}if(!root.querySelector('#rzMusicDeliveryHelp')){var help=document.createElement('div');help.id='rzMusicDeliveryHelp';help.className='rz-music-delivery-note';help.innerHTML='External delivery requires an approved distributor connection. These services open their own setup pages; RIZORA cannot submit your release to them yet.<div class="rz-music-provider-links"><a href="https://artists.spotify.com/en/providers" target="_blank" rel="noopener noreferrer">Spotify provider directory</a><a href="https://www.soundon.global/" target="_blank" rel="noopener noreferrer">TikTok SoundOn</a><a href="https://distrokid.com/" target="_blank" rel="noopener noreferrer">DistroKid</a><a href="https://cdbaby.com/" target="_blank" rel="noopener noreferrer">CD Baby</a><a href="https://revelator.com/product/revelator-api" target="_blank" rel="noopener noreferrer">Revelator API</a></div>';destinations.parentNode.appendChild(help);}}
    var submit=root.querySelector('#rzMusicSubmit');if(submit)submit.textContent='Save release draft';
  }
  function addMusicFormatSelector(root){
    if(!root)return;
    installMusicAudioStudio(root);
    cleanMusicDistributionCopy(root);
    var form=root&&root.querySelector('#rzMusicAiForm'),prompt=form&&form.querySelector('#rzMusicAiPrompt');
    if(!form||!prompt||form.querySelector('#rzMusicAiFormat'))return;
    var musicUser=window.RIZORA_CURRENT_USER||{},ownerLabel=root.querySelector('#rzMusicLabelChoice');
    if(!(musicUser.ownerAccount===true||musicUser.role==='super_admin')&&ownerLabel)ownerLabel.remove();
    var label=document.createElement('label'),select=document.createElement('select');
    label.appendChild(document.createTextNode('Create for'));
    select.id='rzMusicAiFormat';
    [['Full track','Full track'],['TikTok hook · 15 seconds','TikTok · 15s'],['Instagram Reel · 30 seconds','Instagram Reels · 30s'],['YouTube Short · 30 seconds','YouTube Shorts · 30s'],['Snapchat Spotlight · 10 seconds','Snapchat Spotlight · 10s'],['X clip · 30 seconds','X · 30s']].forEach(function(option){var node=document.createElement('option');node.textContent=option[0];node.value=option[1];select.appendChild(node);});
    label.appendChild(select);
    form.insertBefore(label,prompt.parentNode);
  }
  function mediaInput(root,fileId,statusId,urlId,previewId,kind){
    var file=root.querySelector('#'+fileId),status=root.querySelector('#'+statusId),url=root.querySelector('#'+urlId),preview=root.querySelector('#'+previewId);if(!file)return;
    file.onchange=async function(){if(!file.files||!file.files[0])return;try{status.textContent='Uploading '+(kind||'media')+'...';if(typeof window.RIZORA_UPLOAD_FILE!=='function')throw new Error('Media uploader is still loading.');var media=await window.RIZORA_UPLOAD_FILE(file.files[0],status);url.value=API+media.url;status.textContent='Upload complete.';if(preview){if(kind==='cover')preview.innerHTML='<img src="'+esc(url.value)+'" alt="Cover art preview">';else if(kind==='video')preview.innerHTML='<video controls muted src="'+esc(url.value)+'"></video>';else preview.innerHTML='<audio controls src="'+esc(url.value)+'"></audio>';}}catch(error){status.textContent=error.message||'Upload failed.';url.value='';}};
    url.oninput=function(){if(!preview||!url.value.trim())return;if(kind==='cover')preview.innerHTML='<img src="'+esc(url.value.trim())+'" alt="Cover art preview">';if(kind==='video')preview.innerHTML='<video controls muted src="'+esc(url.value.trim())+'"></video>';if(kind==='audio')preview.innerHTML='<audio controls src="'+esc(url.value.trim())+'"></audio>';};
  }
  function modal(){
    var overlay=document.createElement('div');overlay.id='rzMusicOverlay';overlay.className='rz-music-overlay';
    overlay.innerHTML='<section class="rz-music-panel" role="dialog" aria-modal="true" aria-labelledby="rzMusicTitle"><div class="rz-music-hero"><div class="rz-music-head"><div><div class="rz-kicker">RIZORA MUSIC / CREATOR OS</div><h2 id="rzMusicTitle">Music Studio</h2><p>RIZORA is the distributor for every release you save here. Choose the delivery destinations you want to prepare alongside your RIZORA catalog.</p></div><button type="button" class="rz-btn" id="rzMusicClose">Close</button></div></div><div class="rz-music-grid"><section class="rz-music-card"><div class="rz-kicker">BUILD YOUR RELEASE</div><h3>Release identity</h3><form id="rzMusicReleaseForm" class="rz-music-form"><label>Release title<input name="title" maxlength="160" placeholder="Midnight in Lagos" required></label><label>Artist name<input name="artist" maxlength="120" placeholder="Artist or stage name" required></label><div class="rz-music-form-two"><label>Genre<select name="genre"><option>Afrobeats</option><option>R&amp;B</option><option>Hip-hop</option><option>Pop</option><option>Electronic</option><option>Alternative</option></select></label><label>Mood<select name="mood"><option>Modern</option><option>Late night</option><option>Uplifting</option><option>Dark</option><option>Reflective</option></select></label></div><input name="releaseId" type="hidden"><div class="rz-music-media-zone"><div><div class="rz-kicker">COVER ART &amp; VISUALS</div><div class="rz-music-muted">Add the image, audio and video your audience should see with this release.</div></div><div class="rz-music-media-row"><div><strong>Cover art</strong><input id="rzMusicCoverFile" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><input name="artwork" id="rzMusicArtwork" type="hidden"><small id="rzMusicCoverStatus" class="rz-music-muted"></small></div><div id="rzMusicCoverPreview" class="rz-music-preview"></div></div><div class="rz-music-media-row"><div><strong>Audio preview</strong><input id="rzMusicAudioFile" type="file" accept="audio/*"><input name="audioUrl" id="rzMusicAudioUrl" type="hidden"><small id="rzMusicAudioStatus" class="rz-music-muted"></small></div><div id="rzMusicAudioPreview" class="rz-music-preview"></div></div><div class="rz-music-media-row"><div><strong>Visual / video</strong><input id="rzMusicVideoFile" type="file" accept="video/mp4,video/webm,image/*"><input name="videoUrl" id="rzMusicVideoUrl" type="hidden"><small id="rzMusicVideoStatus" class="rz-music-muted"></small></div><div id="rzMusicVideoPreview" class="rz-music-preview"></div></div></div><label>Visibility<select name="visibility"><option value="public">Public RIZORA release</option><option value="private">Private catalog draft</option></select></label><div class="rz-music-distributor-note"><strong>Distributor: RIZORA</strong><span>RIZORA manages the release record and delivery preparation.</span></div><label id="rzMusicLabelChoice" data-owner-only>Label<input name="labelChoice" maxlength="120" placeholder="Royal Saents Records by default"></label><div><div class="rz-music-muted" style="margin-bottom:7px">Destinations</div><div class="rz-music-platforms"><label class="rz-music-platform rz-music-rizora"><input type="checkbox" checked disabled> RIZORA (included)</label><label class="rz-music-platform"><input type="checkbox" name="platforms" value="spotify" checked> Spotify</label><label class="rz-music-platform"><input type="checkbox" name="platforms" value="apple_music" checked> Apple Music</label><label class="rz-music-platform"><input type="checkbox" name="platforms" value="youtube_music" checked> YouTube Music</label><label class="rz-music-platform"><input type="checkbox" name="platforms" value="tiktok_music" checked> TikTok Music</label></div></div><div class="rz-music-actions"><button class="rz-btn primary" type="submit" id="rzMusicSubmit">Save &amp; distribute</button><button class="rz-btn" type="button" id="rzMusicReset">Reset</button></div><div id="rzMusicFormMessage" class="rz-music-message" role="status"></div></form></section><section class="rz-music-card rz-music-ai-card"><div class="rz-kicker">MUSIC AI</div><h3>Music Director</h3><p class="rz-music-muted">Direct the sound, get a structured arrangement, then carry it into your release.</p><form id="rzMusicAiForm" class="rz-music-form"><label>Genre<select id="rzMusicAiGenre"><option>Afrobeats</option><option>R&amp;B</option><option>Hip-hop</option><option>Pop</option><option>Electronic</option><option>Alternative</option></select></label><label>Mood<select id="rzMusicAiMood"><option>Modern</option><option>Late night</option><option>Uplifting</option><option>Dark</option><option>Reflective</option></select></label><label>What are you making?<textarea id="rzMusicAiPrompt" class="rz-textarea" maxlength="1200" placeholder="Describe the sound, feeling or vocal idea."></textarea></label><div class="rz-music-actions"><button class="rz-btn primary" type="submit">Build arrangement</button><button class="rz-btn" type="button" id="rzMusicAiBeat">Design beat</button></div><div id="rzMusicAiMessage" class="rz-music-message" role="status"></div><div id="rzMusicAiResult" class="rz-music-ai-result-slot" aria-live="polite"></div></form></section><section class="rz-music-card"><div class="rz-music-toolbar"><div><div class="rz-kicker">CATALOG</div><strong id="rzMusicCatalogTitle">Your distributed releases</strong></div><div class="rz-music-actions"><button type="button" class="rz-btn" id="rzMusicMine">My catalog</button><button type="button" class="rz-btn" id="rzMusicPublic">Public releases</button><button type="button" class="rz-btn" id="rzMusicRefresh">Refresh</button></div></div><div id="rzMusicCatalog" class="rz-music-catalog"><div class="rz-music-empty">Loading your catalog...</div></div></section></div></section>';
    document.body.appendChild(overlay);var musicUser=window.RIZORA_CURRENT_USER||{},musicOwner=musicUser.ownerAccount===true||musicUser.role==='super_admin'||['romi','israel'].indexOf(String(musicUser.username||'').toLowerCase())>=0,ownerLabel=overlay.querySelector('#rzMusicLabelChoice');if(!musicOwner&&ownerLabel)ownerLabel.remove();overlay.querySelector('#rzMusicClose').onclick=close;overlay.addEventListener('click',function(event){if(event.target===overlay)close();});document.addEventListener('keydown',function onKey(event){if(event.key==='Escape'){close();document.removeEventListener('keydown',onKey);}});
    mediaInput(overlay,'rzMusicCoverFile','rzMusicCoverStatus','rzMusicArtwork','rzMusicCoverPreview','cover');mediaInput(overlay,'rzMusicAudioFile','rzMusicAudioStatus','rzMusicAudioUrl','rzMusicAudioPreview','audio');mediaInput(overlay,'rzMusicVideoFile','rzMusicVideoStatus','rzMusicVideoUrl','rzMusicVideoPreview','video');    var aiForm=overlay.querySelector('#rzMusicAiForm'),aiBeat=overlay.querySelector('#rzMusicAiBeat'),aiMessage=overlay.querySelector('#rzMusicAiMessage');
    var aiResult=overlay.querySelector('#rzMusicAiResult');
    async function runMusicAI(path,payload,label){if(!aiMessage)return;var format=overlay.querySelector('#rzMusicAiFormat');payload.format=format?format.value:'Full track';aiMessage.textContent=label+'...';if(aiResult)aiResult.innerHTML='';try{var response=await api(path,{method:'POST',body:JSON.stringify(payload)}),result=response.result||(response.project&&response.project.arrangement)||(response.beat&&response.beat.concept);aiMessage.textContent=result?'Your '+(result.type==='beat_concept'?'beat concept':'arrangement')+' is ready.':'Music direction saved.';if(aiResult)aiResult.innerHTML=aiResultHTML(result);toast(result?'Music direction ready.':'Music direction saved.');}catch(error){aiMessage.textContent=error.message||'Music AI is unavailable.';}}
    if(aiForm)aiForm.onsubmit=function(event){event.preventDefault();runMusicAI('/api/music/ai-direct',{prompt:aiForm.querySelector('#rzMusicAiPrompt').value.trim(),genre:aiForm.querySelector('#rzMusicAiGenre').value,mood:aiForm.querySelector('#rzMusicAiMood').value},'Directing your arrangement');};
    if(aiBeat)aiBeat.onclick=function(){runMusicAI('/api/music/create-beat',{prompt:aiForm.querySelector('#rzMusicAiPrompt').value.trim(),genre:aiForm.querySelector('#rzMusicAiGenre').value,mood:aiForm.querySelector('#rzMusicAiMood').value,style:'modern creator sound'},'Creating your beat concept');};    return overlay;
  }
  function releaseCard(item,publicMode){
    var title=item.title||'Untitled Release',id=item.releaseId||item.id||'',cover=item.artwork?'<img class="rz-music-release-cover" src="'+esc(item.artwork)+'" alt="'+esc(title)+' cover art">':'';var visual=item.videoUrl||item.visualUrl,media='';if(item.audioUrl)media+='<audio controls preload="metadata" data-rz-media-src="'+esc(item.audioUrl)+'"></audio>';if(visual)media+='<video controls muted preload="metadata" data-rz-media-src="'+esc(visual)+'"></video>';
    return '<article class="rz-music-release">'+cover+'<div class="rz-music-release-top"><div><h3>'+esc(title)+'</h3><div class="rz-music-meta"><span>'+esc(item.artist||'Unknown artist')+'</span><span>'+esc(item.label||'RIZORA')+'</span><span>'+esc(date(item.createdAt))+'</span></div></div><span class="rz-music-pill">'+esc(item.status||'public')+'</span></div><div class="rz-music-meta">'+platforms(item.platforms)+'</div>'+(media?'<div class="rz-music-release-media">'+media+'</div>':'')+(publicMode?'':'<div class="rz-music-actions"><button type="button" class="rz-btn small" data-rz-music-status="'+esc(id)+'">View status</button></div>')+'</article>';
  }
  async function loadCatalog(root,mode){
    var target=root&&root.querySelector('#rzMusicCatalog'),title=root&&root.querySelector('#rzMusicCatalogTitle');if(!target)return;var publicMode=mode==='public';target.innerHTML='<div class="rz-music-empty">Loading '+(publicMode?'public releases':'your catalog')+'...</div>';if(title)title.textContent=publicMode?'Public RIZORA releases':'Your releases';
    try{var data=await api(publicMode?'/api/music/public-catalog':'/api/music/catalog'),rows=Array.isArray(data.catalog)?data.catalog:[];target.innerHTML=rows.map(function(row){return releaseCard(row,publicMode);}).join('')||'<div class="rz-music-empty">'+(publicMode?'No public releases yet.':'No releases yet. Add your first release above.')+'</div>';if(window.RIZORA_MEDIA_BIND_PLAYBACK)window.RIZORA_MEDIA_BIND_PLAYBACK(target);target.querySelectorAll('[data-rz-music-status]').forEach(function(button){button.onclick=async function(){var id=button.getAttribute('data-rz-music-status');if(!id)return;button.disabled=true;try{var status=await api('/api/music/distribution-status/'+encodeURIComponent(id)),release=status.release||{};toast(release.deliveryState==='not_sent'?'Draft saved; no external stores were contacted.':(release.title||'Release status available.'));}catch(error){toast(error.message||'Unable to load release status.');}finally{button.disabled=false;}};});}catch(error){target.innerHTML='<div class="rz-music-error">'+esc(error.message||'Unable to load the catalog.')+'</div>';}
  }
  function resetPlatforms(root){root.querySelectorAll('input[name="platforms"]').forEach(function(input){input.checked=true;});}
  function open(){
    var root=modal(),form=root.querySelector('#rzMusicReleaseForm'),message=root.querySelector('#rzMusicFormMessage'),submit=root.querySelector('#rzMusicSubmit'),mode='mine';resetPlatforms(root);root.querySelector('#rzMusicMine').onclick=function(){mode='mine';loadCatalog(root,mode);};root.querySelector('#rzMusicPublic').onclick=function(){mode='public';loadCatalog(root,mode);};root.querySelector('#rzMusicRefresh').onclick=function(){loadCatalog(root,mode);};root.querySelector('#rzMusicReset').onclick=function(){form.reset();resetPlatforms(root);message.textContent='';};
    form.onsubmit=async function(event){event.preventDefault();message.textContent='';submit.disabled=true;submit.textContent='Saving...';var selected=[];form.querySelectorAll('input[name="platforms"]:checked').forEach(function(input){selected.push(input.value);});try{var result=await api('/api/music/distribute',{method:'POST',body:JSON.stringify({title:form.title.value.trim(),artist:form.artist.value.trim(),releaseId:form.releaseId.value.trim()||null,genre:form.genre.value,mood:form.mood.value,artwork:form.artwork.value.trim()||null,audioUrl:form.audioUrl.value.trim()||null,videoUrl:form.videoUrl.value.trim()||null,visualUrl:form.videoUrl.value.trim()||null,visibility:form.visibility.value,platforms:selected,labelChoice:form.labelChoice.value.trim()||null})});if(result.distribution&&result.distribution.releaseId)form.releaseId.value=result.distribution.releaseId;message.style.color='#b9f6d0';message.textContent='Release draft saved to RIZORA. No external store was contacted.';await loadCatalog(root,'mine');toast('Release draft saved; external delivery is not connected.');}catch(error){message.style.color='';message.textContent=error.message||'Release draft could not be saved.';}finally{submit.disabled=false;submit.textContent='Save release draft';}};loadCatalog(root,mode);setTimeout(function(){var first=root.querySelector('input[name="title"]');if(first)first.focus();},50);
  }
  function inject(){var aside=document.querySelector('.rz-sidebar');if(aside&&!document.getElementById('rzMusicSidebar')){var box=document.createElement('div');box.id='rzMusicSidebar';box.className='rz-music-sidebar';box.innerHTML='<div class="rz-enterprise-heading">RIZORA MUSIC</div><button type="button" class="rz-btn" id="rzMusicOpenSidebar">Open Music Studio</button>';aside.appendChild(box);box.querySelector('#rzMusicOpenSidebar').onclick=open;}}
  window.RIZORA_MUSIC={open:open,loadCatalog:function(){var root=document.getElementById('rzMusicOverlay');if(root)loadCatalog(root,'mine');else open();}};setTimeout(function(){inject();if(document.body)new MutationObserver(function(){inject();addMusicFormatSelector(document.getElementById('rzMusicOverlay'));}).observe(document.body,{childList:true,subtree:true});},260);
  document.addEventListener("submit",function(event){
    var form=event.target;
    if(!form||form.id!=="rzMusicReleaseForm"||form.querySelector('[name="labelChoice"]'))return;
    var labelChoice=document.createElement("input");
    labelChoice.type="hidden";
    labelChoice.name="labelChoice";
    labelChoice.value="";
    form.appendChild(labelChoice);
  },true);
})();
