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
      headers:{"Content-Type":"application/json"}
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

  window.RIZORA_UPLOAD_FILE=upload;
  window.RIZORA_MEDIA_BIND=bind;
})();
