"use strict";
(function(){
  var API=String(window.RIZORA_API_BASE||location.origin).replace(/\/+$/,"");
  var active=null;
  var MAX_RECORDING_SECONDS=90;
  var MAX_AI_AUDIO_BYTES=5.5*1024*1024;

  function api(path,opt){
    if(window.RIZORA_API_CALL)return window.RIZORA_API_CALL(path,opt||{});
    var o=opt||{};
    o.credentials="include";
    o.headers=Object.assign({"Content-Type":"application/json"},window.RIZORA_AUTH_HEADERS?window.RIZORA_AUTH_HEADERS({}):{});
    return fetch(API+path,o).then(function(r){
      return r.text().then(function(t){
        var d={};try{d=t?JSON.parse(t):{};}catch(_){d={};}
        if(!r.ok)throw new Error(d.message||d.error||"Voice request failed.");
        return d;
      });
    });
  }

  function mime(){
    var types=["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/ogg","audio/mp4"];
    for(var i=0;i<types.length;i++)if(window.MediaRecorder&&MediaRecorder.isTypeSupported(types[i]))return types[i];
    return "";
  }

  function dataURL(blob){
    return new Promise(function(resolve,reject){
      var r=new FileReader();
      r.onload=function(){resolve(String(r.result||""));};
      r.onerror=function(){reject(new Error("Could not read the recording."));};
      r.readAsDataURL(blob);
    });
  }

  function setState(form,msg,error){
    var el=form.querySelector("[data-rz-voice-status]");
    if(!el){
      el=document.createElement("span");
      el.setAttribute("data-rz-voice-status","");
      el.className="rz-mini";
      form.appendChild(el);
    }
    el.textContent=msg||"";
    el.style.display=msg?"inline-block":"none";
    el.style.color=error?"#ff8d9d":"";
  }

  function resetButton(button,kind){
    if(!button)return;
    button.disabled=false;
    button.textContent=kind==="ai"?"🎙 Talk to AI":"🎙 Voice";
    button.setAttribute("aria-pressed","false");
  }

  function stopActive(){
    if(active&&active.recorder&&active.recorder.state!=="inactive"){
      active.button.textContent="Stopping…";
      active.button.disabled=true;
      active.recorder.stop();
    }
  }

  async function start(form,button,kind){
    if(active){stopActive();return;}
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
      setState(form,"Microphone recording is not supported in this browser.",true);
      return;
    }
    if(!window.MediaRecorder){
      setState(form,"Voice recording is not supported in this browser.",true);
      return;
    }
    var chosen=mime();
    if(!chosen){
      setState(form,"This browser has no supported RIZORA voice format.",true);
      return;
    }

    var stream;
    try{
      stream=await navigator.mediaDevices.getUserMedia({
        audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}
      });
    }catch(e){
      setState(form,"Microphone permission is required for voice notes.",true);
      return;
    }

    var chunks=[];
    var recorder;
    try{recorder=new MediaRecorder(stream,{mimeType:chosen});}
    catch(e){stream.getTracks().forEach(function(t){t.stop();});setState(form,"Could not start voice recording.",true);return;}

    active={recorder:recorder,button:button,form:form,kind:kind};
    button.disabled=false;
    button.setAttribute("aria-pressed","true");
    var started=Date.now();
    var timer=setInterval(function(){
      var sec=Math.floor((Date.now()-started)/1000);
      button.textContent="■ Stop "+Math.floor(sec/60)+":"+String(sec%60).padStart(2,"0");
      if(sec>=MAX_RECORDING_SECONDS)stopActive();
    },250);

    recorder.ondataavailable=function(e){if(e.data&&e.data.size)chunks.push(e.data);};
    recorder.onerror=function(){
      clearInterval(timer);
      stream.getTracks().forEach(function(t){t.stop();});
      active=null;
      resetButton(button,kind);
      setState(form,"Recording failed.",true);
    };
    recorder.onstop=async function(){
      clearInterval(timer);
      stream.getTracks().forEach(function(t){t.stop();});
      active=null;
      button.disabled=true;
      button.setAttribute("aria-pressed","false");
      var blob=new Blob(chunks,{type:chosen});
      if(!blob.size){setState(form,"No audio was captured.",true);return;}

      try{
        setState(form,"Processing voice…",false);
        if(kind==="ai"){
          if(blob.size>MAX_AI_AUDIO_BYTES)throw new Error("That recording is too large for RIZORA AI. Keep voice notes under 90 seconds.");
          var audio=await dataURL(blob);
          var d=await api("/api/ai/transcribe",{method:"POST",body:JSON.stringify({audio:audio,mimeType:chosen})});
          var text=String(d.text||"").trim();
          if(!text)throw new Error("I could not hear clear speech in that recording.");
          var input=form.querySelector("#aiInput");
          if(!input)throw new Error("RIZORA AI composer is unavailable. Reopen AI and try again.");
          input.value=text;
          if(typeof form.requestSubmit==="function")form.requestSubmit();
          else form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
          setState(form,"Voice sent to RIZORA AI.",false);
          return;
        }

        if(!window.RIZORA_UPLOAD_FILE)throw new Error("Voice media uploader is still loading. Try again.");
        var ext=chosen.indexOf("ogg")>=0?"ogg":chosen.indexOf("mp4")>=0?"m4a":"webm";
        var file=new File([blob],"rizora-voice-"+Date.now()+"."+ext,{type:chosen.split(";")[0]});
        var media=await window.RIZORA_UPLOAD_FILE(file,null);
        if(!media||!media.id)throw new Error("Voice upload did not return a media ID.");

        if(kind==="chat"){
          var target=form.getAttribute("data-chat-target");
          if(!target)throw new Error("Chat recipient could not be identified.");
          await api("/api/v2/messages/"+encodeURIComponent(target),{method:"POST",body:JSON.stringify({mediaId:media.id,messageType:"voice"})});
          setState(form,"Voice message sent.",false);
          if(window.RIZORA_OPEN_CHAT)window.RIZORA_OPEN_CHAT(target);
        }else{
          var postId=form.getAttribute("data-post-id");
          if(!postId)throw new Error("Comment post could not be identified.");
          var parentId=form.getAttribute("data-comment-parent")||"";
          await api("/api/v2/posts/"+encodeURIComponent(postId)+"/comment",{method:"POST",body:JSON.stringify({mediaId:media.id,messageType:"voice",parentId:parentId||null})});
          setState(form,"Voice comment posted.",false);
          if(window.RIZORA_REOPEN_COMMENTS)window.RIZORA_REOPEN_COMMENTS(postId);
        }
      }catch(e){setState(form,e.message,true);}
      finally{resetButton(button,kind);}
    };

    recorder.start(250);
    button.textContent="■ Stop 0:00";
    setState(form,"Recording…",false);
  }

  function wireForm(form,kind){
    if(!form||form.getAttribute("data-rz-voice-wired")==="1")return;
    form.setAttribute("data-rz-voice-wired","1");
    var button=document.createElement("button");
    button.type="button";
    button.className="rz-btn rz-voice-button";
    button.textContent=kind==="ai"?"🎙 Talk to AI":"🎙 Voice";
    button.setAttribute("data-rz-voice-button","");
    button.setAttribute("aria-label",kind==="ai"?"Record a voice question for RIZORA AI":"Record a RIZORA voice message");
    button.setAttribute("aria-pressed","false");
    button.title=kind==="ai"?"Record a voice question for RIZORA AI":"Record a voice message";
    form.appendChild(button);
    button.addEventListener("click",function(){start(form,button,kind);});
  }

  function wire(){
    wireForm(document.getElementById("messageForm"),"chat");
    wireForm(document.getElementById("rzCommentForm"),"comment");
    wireForm(document.getElementById("aiForm"),"ai");
  }

  var speakingButton=null;
  function speakAI(text,button){
    var value=String(text||"").trim();
    if(!value)return;
    if(!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)){
      if(window.RIZORA_TOAST)window.RIZORA_TOAST("Voice playback is not supported in this browser.");
      return;
    }
    if(window.speechSynthesis.speaking && speakingButton===button){
      window.speechSynthesis.cancel();
      if(button)button.textContent="🔊 Listen";
      speakingButton=null;
      return;
    }
    window.speechSynthesis.cancel();
    if(speakingButton)speakingButton.textContent="🔊 Listen";
    var utterance=new SpeechSynthesisUtterance(value);
    utterance.lang="en-NG";
    utterance.rate=1.02;
    utterance.pitch=1;
    speakingButton=button||null;
    if(button)button.textContent="⏹ Stop";
    utterance.onend=function(){if(button)button.textContent="🔊 Listen";if(speakingButton===button)speakingButton=null;};
    utterance.onerror=function(){if(button)button.textContent="🔊 Listen";if(speakingButton===button)speakingButton=null;};
    window.speechSynthesis.speak(utterance);
  }
  window.RIZORA_AI_SPEAK=speakAI;
  window.RIZORA_TOAST=window.RIZORA_TOAST||function(message){
    var t=document.getElementById("toast");if(!t)return;
    t.textContent=message||"";
    t.classList.add("show");
    clearTimeout(window.__rtVoice);
    window.__rtVoice=setTimeout(function(){t.classList.remove("show");},2400);
  };
  window.RIZORA_VOICE_WIRE=wire;
  var observer=new MutationObserver(wire);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",wire);else wire();
})();