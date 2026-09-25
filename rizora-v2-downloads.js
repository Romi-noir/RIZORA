"use strict";
(function(){
  var API=String(window.RIZORA_API_BASE||location.origin).replace(/\\/+$/,"");
  var WATERMARK_TEXT="RIZORA  •  rizora.com.ng";
  var LOGO_URL="/rizora-cover.png";

  function toast(msg){
    if(window.RIZORA_ENTERPRISE&&window.RIZORA_ENTERPRISE.toast){window.RIZORA_ENTERPRISE.toast(msg);return;}
    var t=document.getElementById("toast");
    if(!t)return;
    t.textContent=msg;
    t.classList.add("show");
    clearTimeout(window.__rzDownloadToast);
    window.__rzDownloadToast=setTimeout(function(){t.classList.remove("show");},2600);
  }

  function safeName(name){
    return String(name||"download").replace(/[^a-z0-9._-]+/gi,"_").slice(0,120)||"download";
  }

  function stamp(){
    return new Date().toISOString().replace(/[:.]/g,"-");
  }

  function filenameFromUrl(url,fallback){
    try{
      var p=new URL(url,location.href).pathname.split("/").pop()||fallback;
      return safeName(decodeURIComponent(p));
    }catch(_){return safeName(fallback||"rizora-media");}
  }

  async function getBlob(url){
    var target=String(url||"").trim();
    if(!target)throw new Error("Media URL is missing.");
    var res=await fetch(target.startsWith("http")?target:(API+target),{credentials:"include"});
    if(!res.ok)throw new Error("RIZORA could not fetch that file.");
    return await res.blob();
  }

  function trigger(blob,name){
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");
    a.href=url;
    a.download=safeName(name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function(){URL.revokeObjectURL(url);},1500);
  }

  function loadImage(src){
    return new Promise(function(resolve,reject){
      var img=new Image();
      img.onload=function(){resolve(img);};
      img.onerror=function(){reject(new Error("Could not read the image for watermarking."));};
      img.src=src;
    });
  }

  function drawWatermark(ctx,w,h,logo){
    var pad=Math.max(18,Math.round(Math.min(w,h)*0.028));
    var boxH=Math.max(44,Math.round(Math.min(w,h)*0.095));
    var logoSize=Math.max(28,Math.round(boxH*0.72));
    var x=w-pad-logoSize;
    var y=pad;
    ctx.save();
    ctx.globalAlpha=0.82;
    ctx.shadowColor="rgba(0,0,0,.35)";
    ctx.shadowBlur=12;
    ctx.drawImage(logo,x,y,logoSize,logoSize);
    ctx.shadowBlur=0;
    ctx.font="700 "+Math.max(14,Math.round(boxH*0.34))+"px system-ui,-apple-system,Segoe UI,sans-serif";
    ctx.textAlign="right";
    ctx.textBaseline="middle";
    ctx.fillStyle="rgba(255,255,255,.94)";
    ctx.fillText(WATERMARK_TEXT,w-pad,y+logoSize+Math.max(18,Math.round(boxH*.5)));
    ctx.globalAlpha=0.15;
    ctx.fillStyle="#ffffff";
    ctx.fillRect(w-pad-260,h-pad-34,260,34);
    ctx.globalAlpha=0.72;
    ctx.fillStyle="#ffffff";
    ctx.font="800 12px system-ui,-apple-system,Segoe UI,sans-serif";
    ctx.fillText("RIZORA",w-pad-14,h-pad-14);
    ctx.restore();
  }

  async function watermarkImage(url){
    toast("Preparing your RIZORA-watermarked image…");
    var blob=await getBlob(url);
    var src=URL.createObjectURL(blob);
    try{
      var img=await loadImage(src);
      var canvas=document.createElement("canvas");
      canvas.width=img.naturalWidth||img.width;
      canvas.height=img.naturalHeight||img.height;
      var ctx=canvas.getContext("2d",{alpha:false});
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      var logo=await loadImage(LOGO_URL);
      drawWatermark(ctx,canvas.width,canvas.height,logo);
      var mime=/webp/i.test(blob.type)?"image/webp":"image/png";
      var out=await new Promise(function(resolve,reject){
        canvas.toBlob(function(b){b?resolve(b):reject(new Error("Could not encode the watermarked image."));},mime,0.94);
      });
      var original=filenameFromUrl(url,"rizora-image");
      var base=original.replace(/.[^.]+$/,"");
      trigger(out,base+"-RIZORA-watermarked."+(mime==="image/webp"?"webp":"png"));
      toast("Watermarked RIZORA download ready.");
    }finally{URL.revokeObjectURL(src);}
  }

  function supportedRecorder(){
    if(typeof MediaRecorder==="undefined")return "";
    var types=["video/webm;codecs=vp9,opus","video/webm;codecs=vp8,opus","video/webm"];
    for(var i=0;i<types.length;i++)if(MediaRecorder.isTypeSupported(types[i]))return types[i];
    return "";
  }

  async function watermarkVideo(url){
    var mime=supportedRecorder();
    if(!mime){
      toast("This browser cannot encode a watermarked video. Use a Chromium-based browser for RIZORA downloads.");
      throw new Error("Watermarked video export is not supported by this browser.");
    }
    toast("Rendering RIZORA watermark onto the video…");
    var blob=await getBlob(url);
    var sourceUrl=URL.createObjectURL(blob),video=document.createElement("video");
    video.src=sourceUrl;video.crossOrigin="anonymous";video.playsInline=true;video.preload="auto";
    video.style.position="fixed";video.style.left="-99999px";document.body.appendChild(video);
    try{
      await new Promise(function(resolve,reject){
        video.onloadedmetadata=function(){resolve();};
        video.onerror=function(){reject(new Error("Could not read the video."));};
      });
      if(!video.captureStream||!HTMLCanvasElement.prototype.captureStream)throw new Error("Video watermark export is not supported.");
      var width=video.videoWidth||1280,height=video.videoHeight||720,fps=30;
      var canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
      var ctx=canvas.getContext("2d",{alpha:false});
      var logo=await loadImage(LOGO_URL);
      var canvasStream=canvas.captureStream(fps);
      var sourceStream=video.captureStream();
      var tracks=canvasStream.getVideoTracks();
      sourceStream.getAudioTracks().forEach(function(t){tracks.push(t);});
      var combined=new MediaStream(tracks);
      var recorder=new MediaRecorder(combined,{mimeType:mime});
      var chunks=[];
      recorder.ondataavailable=function(e){if(e.data&&e.data.size)chunks.push(e.data);};
      var done=new Promise(function(resolve,reject){recorder.onstop=resolve;recorder.onerror=function(){reject(new Error("Video export failed."));};});
      video.currentTime=0;
      await video.play();
      recorder.start(1000);
      var running=true;
      function paint(){
        if(!running)return;
        ctx.drawImage(video,0,0,width,height);
        drawWatermark(ctx,width,height,logo);
        requestAnimationFrame(paint);
      }
      paint();
      await new Promise(function(resolve){video.onended=resolve;});
      running=false;
      recorder.stop();
      await done;
      var out=new Blob(chunks,{type:mime});
      var original=filenameFromUrl(url,"rizora-video");
      var base=original.replace(/.[^.]+$/,"");
      trigger(out,base+"-RIZORA-watermarked.webm");
      toast("Watermarked RIZORA video ready.");
    }catch(e){
      toast(e.message||"Video watermark failed.");
      throw e;
    }finally{
      try{video.pause();}catch(_){}
      try{video.src="";}catch(_){}
      if(video.parentNode)video.parentNode.removeChild(video);
      URL.revokeObjectURL(sourceUrl);
    }
  }

  function audioFilename(url){
    var n=filenameFromUrl(url,"rizora-audio");
    if(/\.(mp3|m4a|wav|ogg)$/i.test(n))return n.replace(/\.[^.]+$/,"")+"-RIZORA."+n.split(".").pop();
    return n+"-RIZORA";
  }

  async function downloadAudio(url){
    toast("Preparing RIZORA-branded audio download…");
    var blob=await getBlob(url);
    trigger(blob,audioFilename(url));
    toast("RIZORA-branded audio download ready.");
  }

  async function downloadMedia(url){
    var lower=String(url||"").split("?")[0].toLowerCase();
    if(/\.(jpg|jpeg|png|webp|gif)$/i.test(lower))return watermarkImage(url);
    if(/\.(mp4|webm|mov|m4v)$/i.test(lower))return watermarkVideo(url);
    if(/\.(mp3|m4a|wav|ogg)$/i.test(lower))return downloadAudio(url);
    var blob=await getBlob(url);
    trigger(blob,filenameFromUrl(url,"rizora-download").replace(/\.[^.]+$/,"")+"-RIZORA");
    toast("RIZORA download ready.");
  }

  function brandTextBlob(blob){
    var type=String(blob.type||"application/octet-stream").toLowerCase();
    if(type.indexOf("json")>=0){
      try{
        var parsed=JSON.parse(awaitTextSync(blob));
      }catch(_){return blob;}
      parsed={rizora:{downloadedFrom:"rizora.com.ng",watermark:"RIZORA",watermarkedAt:new Date().toISOString()},data:parsed};
      return new Blob([JSON.stringify(parsed,null,2)],{type:"application/json;charset=utf-8"});
    }
    return blob;
  }

  function readAsText(blob){
    return blob.text();
  }

  window.RIZORA_DOWNLOAD={
    media:downloadMedia,
    blob:function(blob,name,kind){
      var type=String(blob&&blob.type||"").toLowerCase();
      var n=safeName(name||"rizora-download");
      if(type.indexOf("csv")>=0){
        var header="# RIZORA DOWNLOAD | rizora.com.ng | "+new Date().toISOString()+"\n";
        trigger(new Blob([header,blob],{type:"text/csv;charset=utf-8"}),n);
      }else if(type.indexOf("json")>=0){
        blob.text().then(function(txt){
          var parsed;
          try{parsed=JSON.parse(txt);}catch(_){parsed={content:txt};}
          var out={rizora:{downloadedFrom:"rizora.com.ng",watermark:"RIZORA",watermarkedAt:new Date().toISOString(),kind:kind||"data"},data:parsed};
          trigger(new Blob([JSON.stringify(out,null,2)],{type:"application/json;charset=utf-8"}),n);
        });
      }else{
        trigger(blob,n);
      }
    },
    filename:audioFilename
  };

  function getUrlFromElement(el){
    if(!el)return "";
    return el.getAttribute("data-rizora-download")||el.getAttribute("src")||el.getAttribute("href")||"";
  }

  function addButton(target,url){
    if(!url||target.dataset.rizoraDownloadBound==="1")return;
    target.dataset.rizoraDownloadBound="1";
    var b=document.createElement("button");
    b.type="button";b.className="rz-btn rz-download-watermark";b.setAttribute("data-rizora-download",url);
    b.textContent="Download RIZORA";
    var wrap=target.closest(".rz-post-media,.rz-up-media,.rz-growth-card,.rz-card,.rz-hub-media-row")||target.parentElement;
    if(wrap){
      if(wrap.querySelector(".rz-download-watermark"))return;
      wrap.appendChild(b);
    }
  }

  function scan(){
    document.querySelectorAll("img[src],video[src],audio[src],a[href]").forEach(function(el){
      var url=el.getAttribute("src")||el.getAttribute("href")||"";
      if(url.indexOf("/api/v2/media/")<0)return;
      addButton(el,url);
    });
  }

  document.addEventListener("click",function(e){
    var b=e.target.closest&&e.target.closest("[data-rizora-download]");
    if(!b)return;
    e.preventDefault();e.stopPropagation();
    downloadMedia(getUrlFromElement(b)).catch(function(err){console.error(err);});
  });

  function boot(){
    scan();
    new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);else boot();
})();