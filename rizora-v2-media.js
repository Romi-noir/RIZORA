"use strict";
(function(){
  const API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");
  const MAX=25*1024*1024;
  const TYPES=new Set(["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","audio/mpeg","audio/mp4","audio/wav","audio/ogg","audio/webm","application/pdf"]);

  function dataURL(blob){
    return new Promise(function(resolve,reject){
      const r=new FileReader();
      r.onload=function(){resolve(String(r.result||""));};
      r.onerror=function(){reject(new Error("Could not read the media file."));};
      r.readAsDataURL(blob);
    });
  }

  async function request(path,opt){
    opt=opt||{};
    const res=await fetch(API+path,Object.assign({
      credentials:"include",
      headers:window.RIZORA_AUTH_HEADERS?window.RIZORA_AUTH_HEADERS({"Content-Type":"application/json"}):{"Content-Type":"application/json"}
    },opt));
    const text=await res.text();
    let data={};
    try{data=text?JSON.parse(text):{};}catch(_){data={error:text};}
    if(!res.ok)throw new Error(data.message||data.error||"Media upload failed.");
    return data;
  }

  function setStatus(el,msg){
    if(!el)return;
    el.textContent=msg||"";
    el.hidden=!msg;
  }

  function uploadProviderFile(url,method,body,headers,statusEl){
    return new Promise(function(resolve,reject){
      var xhr=new XMLHttpRequest();xhr.open(method,url,true);xhr.timeout=120000;
      Object.keys(headers||{}).forEach(function(key){xhr.setRequestHeader(key,headers[key]);});
      xhr.upload.onprogress=function(event){if(event.lengthComputable)setStatus(statusEl,"Uploading "+Math.min(99,Math.round(event.loaded/event.total*100))+"%…");};
      xhr.onerror=function(){reject(new Error("The media provider could not be reached. Check your connection and try again."));};
      xhr.ontimeout=function(){reject(new Error("Upload took too long. Try again on a stronger connection."));};
      xhr.onload=function(){var result={};try{result=xhr.responseText?JSON.parse(xhr.responseText):{};}catch(_){}
        if(xhr.status<200||xhr.status>=300){reject(new Error(result.message||result.error||"The media provider could not save this file."));return;}
        resolve(result);
      };
      xhr.send(body);
    });
  }

  async function upload(file,statusEl,options){
    if(!file)throw new Error("Choose a media file first.");
    if(!TYPES.has(file.type))throw new Error("That media type is not supported on RIZORA.");
    if(file.size<=0)throw new Error("The selected file is empty.");
    if(file.size>MAX)throw new Error("Media files must be 25 MB or smaller.");
    options=options||{};
    if(!options.purpose&&window.state&&window.state.view==="messages")options.purpose="private";
    setStatus(statusEl,"Preparing a secure upload…");
    const session=await request("/api/v2/media/uploads/sign",{method:"POST",body:JSON.stringify({
      filename:file.name,mimeType:file.type,size:file.size,purpose:options.purpose==="private"?"private":"public"
    })});
    var providerResult;
    if(session.provider==="cloudinary"){
      var form=new FormData();form.append("file",file);form.append("api_key",session.upload.apiKey);form.append("timestamp",String(session.upload.timestamp));form.append("public_id",session.upload.publicId);form.append("overwrite","false");form.append("signature",session.upload.signature);
      providerResult=await uploadProviderFile(session.upload.uploadUrl,"POST",form,{},statusEl);
    }else if(session.provider==="supabase"){
      await uploadProviderFile(session.upload.uploadUrl,"PUT",file,{"Content-Type":file.type},statusEl);
      providerResult={bytes:file.size,mimeType:file.type};
    }else throw new Error("RIZORA could not choose a secure media provider.");
    setStatus(statusEl,"Confirming upload…");
    const done=await request("/api/v2/media/uploads/complete",{
      method:"POST",body:JSON.stringify({uploadId:session.uploadId,providerResponse:providerResult,bytes:file.size,mimeType:file.type})
    });
    setStatus(statusEl,"Upload complete.");
    return done.media;
  }

  async function objectUrl(url){
    var raw=String(url||"");
    if(!raw)return "";
    var parsed;
    try{parsed=new URL(raw,API);}catch(_){throw new Error("Invalid media URL.");}
    var path=parsed.origin===new URL(API).origin?parsed.pathname+parsed.search:parsed.pathname+parsed.search;
    var headers=window.RIZORA_AUTH_HEADERS?window.RIZORA_AUTH_HEADERS({}):{};
    var res=await fetch(API+path,{credentials:"include",headers:headers});
    if(!res.ok)throw new Error("Media could not be loaded.");
    var blob=await res.blob();
    return URL.createObjectURL(blob);
  }

  function bindPlayback(root){
    root=root||document;
    var elements=[];
    if(root.matches&&root.matches("[data-rz-media-src]"))elements.push(root);
    root.querySelectorAll("[data-rz-media-src]").forEach(function(el){elements.push(el);});
    elements.forEach(function(el){
      if(el.getAttribute("data-rz-media-ready")==="1")return;
      el.setAttribute("data-rz-media-ready","1");
      var raw=el.getAttribute("data-rz-media-src");
      objectUrl(raw).then(function(src){el.src=src;}).catch(function(){
        el.removeAttribute("data-rz-media-ready");
        var s=document.createElement("span");s.className="rz-error";s.textContent="Media unavailable.";el.replaceWith(s);
      });
      el.addEventListener("emptied",function(){
        if(el.src&&el.src.indexOf("blob:")===0){try{URL.revokeObjectURL(el.src);}catch(_){}}
      });
    });
  }

  function bind(fileId,statusId,urlId){
    const file=document.getElementById(fileId);
    const status=document.getElementById(statusId);
    const url=document.getElementById(urlId);
    if(!file)return;
    file.addEventListener("change",async function(){
      if(!file.files||!file.files[0])return;
      try{
        const media=await upload(file.files[0],status);
        if(url){url.value=API+media.url;url.dispatchEvent(new Event("change",{bubbles:true}));}
      }catch(e){
        setStatus(status,e.message);
        if(url)url.value="";
      }
    });
  }

  var uploadFieldRules={
    coverUrl:{accept:"image/jpeg,image/png,image/webp,image/gif",label:"Upload a series cover image"},
    mediaA:{accept:"image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm",label:"Upload media for variant A"},
    mediaB:{accept:"image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm",label:"Upload media for variant B"}
  };
  var uploadFieldIndex=0;

  function enhanceUploadField(field){
    var rule=field&&uploadFieldRules[field.name];
    if(!rule||field.type==="hidden"||field.getAttribute("data-rz-file-first")==="1"||!field.parentNode)return;
    field.setAttribute("data-rz-file-first","1");
    field.type="hidden";
    field.removeAttribute("placeholder");
    field.value="";
    var file=document.createElement("input");
    file.type="file";
    file.accept=rule.accept;
    file.className=field.className||"rz-input";
    file.id="rzUploadField"+(++uploadFieldIndex);
    file.setAttribute("aria-label",rule.label);
    var status=document.createElement("small");
    status.className="rz-muted";
    status.setAttribute("role","status");
    status.setAttribute("aria-live","polite");
    status.textContent="Choose a file from this device. No URL needed.";
    field.parentNode.insertBefore(file,field);
    field.parentNode.insertBefore(status,field);
    file.addEventListener("change",function(){
      if(!file.files||!file.files[0])return;
      var version=(file._rzUploadVersion||0)+1;
      file._rzUploadVersion=version;
      field.value="";
      var form=field.form;
      var buttons=form?Array.prototype.slice.call(form.querySelectorAll('button[type="submit"],button:not([type])')):[];
      buttons.forEach(function(button){button.disabled=true;});
      upload(file.files[0],status).then(function(media){
        if(version===file._rzUploadVersion)field.value=API+media.url;
      }).catch(function(error){
        if(version===file._rzUploadVersion)status.textContent=error.message||"Media upload failed.";
      }).finally(function(){
        if(version===file._rzUploadVersion)buttons.forEach(function(button){button.disabled=false;});
      });
    });
  }

  function enhanceFileFirstUploads(root){
    if(!root)return;
    var selector='input[name="coverUrl"],input[name="mediaA"],input[name="mediaB"]';
    if(root.matches&&root.matches(selector))enhanceUploadField(root);
    if(root.querySelectorAll)root.querySelectorAll(selector).forEach(enhanceUploadField);
  }

  async function audioToWav(blob){if(!blob||!/^audio\//i.test(blob.type||""))throw new Error("Choose an audio recording first.");if(/^audio\/(x-)?wav$/i.test(blob.type))return blob;var AudioContextClass=window.AudioContext||window.webkitAudioContext;if(!AudioContextClass)throw new Error("This browser cannot convert audio to WAV.");var context=new AudioContextClass();try{var decoded=await context.decodeAudioData(await blob.arrayBuffer());if(decoded.duration>600)throw new Error("Voice WAV files must be 10 minutes or shorter.");var rate=16000,frames=Math.max(1,Math.ceil(decoded.duration*rate)),channels=[];for(var c=0;c<decoded.numberOfChannels;c++)channels.push(decoded.getChannelData(c));var buffer=new ArrayBuffer(44+frames*2),view=new DataView(buffer);function write(offset,value){for(var i=0;i<value.length;i++)view.setUint8(offset+i,value.charCodeAt(i));}write(0,"RIFF");view.setUint32(4,36+frames*2,true);write(8,"WAVE");write(12,"fmt ");view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,"data");view.setUint32(40,frames*2,true);var samples=new Int16Array(buffer,44,frames);for(var n=0;n<frames;n++){var pos=n*decoded.sampleRate/rate,left=Math.floor(pos),mix=0;for(var ch=0;ch<channels.length;ch++){var data=channels[ch],a=data[left]||0,b=data[Math.min(left+1,data.length-1)]||0;mix+=(a+(b-a)*(pos-left))/channels.length;}var sample=Math.max(-1,Math.min(1,mix));samples[n]=sample<0?sample*32768:sample*32767;}return new Blob([buffer],{type:"audio/wav"});}finally{if(context.close)context.close().catch(function(){});}}

  window.RIZORA_AUDIO_TO_WAV=audioToWav;
  window.RIZORA_MEDIA_OBJECT_URL=objectUrl;
  window.RIZORA_MEDIA_BIND_PLAYBACK=bindPlayback;
  bindPlayback(document);
  enhanceFileFirstUploads(document);
  var observer=new MutationObserver(function(records){
    records.forEach(function(record){
      record.addedNodes.forEach(function(node){
        if(!node||node.nodeType!==1)return;
        bindPlayback(node);
        enhanceFileFirstUploads(node);
      });
    });
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.RIZORA_UPLOAD_FILE=upload;
  window.RIZORA_MEDIA_BIND=bind;
})();

