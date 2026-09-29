"use strict";
(function(){
  const API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");
  const MAX=25*1024*1024;
  const SIMPLE=600*1024;
  const CHUNK=512*1024;
  const TYPES=new Set(["image/jpeg","image/png","image/webp","image/gif","video/mp4","video/webm","audio/mpeg","audio/mp4","audio/wav","audio/ogg"]);

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

  async function upload(file,statusEl){
    if(!file)throw new Error("Choose a media file first.");
    if(!TYPES.has(file.type))throw new Error("That media type is not supported on RIZORA.");
    if(file.size<=0)throw new Error("The selected file is empty.");
    if(file.size>MAX)throw new Error("Media files must be 25 MB or smaller.");

    if(file.size<=SIMPLE){
      setStatus(statusEl,"Uploading…");
      const result=await request("/api/v2/media/upload",{method:"POST",body:JSON.stringify({
        filename:file.name,mimeType:file.type,data:await dataURL(file)
      })});
      setStatus(statusEl,"Upload complete.");
      return result.media;
    }

    setStatus(statusEl,"Preparing secure upload…");
    const session=await request("/api/v2/media/sessions",{method:"POST",body:JSON.stringify({
      filename:file.name,mimeType:file.type,size:file.size
    })});

    for(let index=0;index<session.totalChunks;index++){
      const start=index*CHUNK;
      const end=Math.min(file.size,start+CHUNK);
      const chunk=file.slice(start,end);
      setStatus(statusEl,"Uploading "+(index+1)+" / "+session.totalChunks+"…");
      await request("/api/v2/media/sessions/"+encodeURIComponent(session.uploadId)+"/chunk",{
        method:"POST",
        body:JSON.stringify({index,data:await dataURL(chunk)})
      });
    }

    setStatus(statusEl,"Finalizing media…");
    const done=await request("/api/v2/media/sessions/"+encodeURIComponent(session.uploadId)+"/complete",{
      method:"POST",body:"{}"
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
    root.querySelectorAll("[data-rz-media-src]").forEach(function(el){
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
        if(url)url.value=API+media.url;
      }catch(e){
        setStatus(status,e.message);
        if(url)url.value="";
      }
    });
  }

  window.RIZORA_MEDIA_OBJECT_URL=objectUrl;
  window.RIZORA_MEDIA_BIND_PLAYBACK=bindPlayback;
  var observer=new MutationObserver(function(){bindPlayback(document);});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.RIZORA_UPLOAD_FILE=upload;
  window.RIZORA_MEDIA_BIND=bind;
})();
