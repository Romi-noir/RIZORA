(() => {
  "use strict";

  if (document.getElementById("rizora-v9")) return;

  const style = document.createElement("style");
  style.id = "rizora-v9";

  style.textContent = `
    .rz9-logo,
    .rz9-logo-small{
      display:grid;
      place-items:center;
      font-family:Arial,Helvetica,sans-serif;
      font-weight:1000;
      color:#fff;
      background:
        radial-gradient(circle at 28% 22%,rgba(255,255,255,.28),transparent 25%),
        linear-gradient(135deg,#6d28d9 0%,#8b5cf6 48%,#4f46e5 100%);
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,.12),
        0 10px 35px rgba(124,58,237,.34);
      position:relative;
      overflow:hidden;
      flex:0 0 auto;
    }

    .rz9-logo::after,
    .rz9-logo-small::after{
      content:"";
      position:absolute;
      width:55%;
      height:18%;
      top:13%;
      left:8%;
      border-radius:999px;
      background:rgba(255,255,255,.16);
      transform:rotate(-18deg);
    }

    .rz9-logo{
      width:40px;
      height:40px;
      border-radius:13px;
      font-size:20px;
    }

    .rz9-logo-small{
      width:30px;
      height:30px;
      border-radius:10px;
      font-size:15px;
    }

    .rz9-loading{
      position:fixed;
      inset:0;
      z-index:99999;
      display:flex;
      align-items:center;
      justify-content:center;
      background:
        radial-gradient(circle at 50% 35%,rgba(124,58,237,.18),transparent 32%),
        #08090f;
      transition:opacity .45s ease,visibility .45s ease;
    }

    .rz9-loading.hide{
      opacity:0;
      visibility:hidden;
      pointer-events:none;
    }

    .rz9-loading-inner{
      text-align:center;
    }

    .rz9-loading .rz9-logo{
      width:72px;
      height:72px;
      margin:0 auto 18px;
      border-radius:22px;
      font-size:34px;
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,.12),
        0 0 75px rgba(124,58,237,.34);
      animation:rz9Pulse 1.8s ease-in-out infinite;
    }

    .rz9-loading-name{
      color:#fff;
      font-size:19px;
      font-weight:950;
      letter-spacing:.2em;
    }

    .rz9-loading-sub{
      margin-top:7px;
      color:#9093a5;
      font-size:11px;
      letter-spacing:.08em;
      text-transform:uppercase;
    }

    .rz9-loader{
      width:105px;
      height:3px;
      margin:17px auto 0;
      border-radius:999px;
      background:rgba(255,255,255,.08);
      overflow:hidden;
    }

    .rz9-loader span{
      display:block;
      width:35%;
      height:100%;
      border-radius:inherit;
      background:linear-gradient(90deg,#7c3aed,#a855f7);
      animation:rz9Load 1.1s ease-in-out infinite;
    }

    @keyframes rz9Load{
      0%{transform:translateX(-120%)}
      100%{transform:translateX(390%)}
    }

    @keyframes rz9Pulse{
      0%,100%{transform:scale(1)}
      50%{transform:scale(1.045)}
    }

    .rz9-empty{
      display:flex;
      align-items:center;
      gap:13px;
      margin:13px 0;
      padding:14px;
      border-radius:16px;
      border:1px solid rgba(255,255,255,.07);
      background:rgba(255,255,255,.025);
    }

    .rz9-empty-text strong{
      display:block;
      color:#fff;
      font-size:12px;
    }

    .rz9-empty-text span{
      display:block;
      margin-top:3px;
      color:#9093a5;
      font-size:11px;
      line-height:1.45;
    }

    .rz9-brandline{
      display:flex;
      align-items:center;
      gap:10px;
    }

    .rz9-brandtext{
      min-width:0;
    }

    .rz9-brandtext strong{
      display:block;
      color:#fff;
      font-size:15px;
      font-weight:950;
      letter-spacing:.13em;
    }

    .rz9-brandtext span{
      display:block;
      margin-top:2px;
      color:#838697;
      font-size:9px;
      letter-spacing:.08em;
      text-transform:uppercase;
    }

    @media(max-width:700px){
      .rz9-loading .rz9-logo{
        width:64px;
        height:64px;
      }
    }
  `;

  document.head.appendChild(style);

  function addFavicon(){
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#6d28d9"/>
            <stop offset=".52" stop-color="#8b5cf6"/>
            <stop offset="1" stop-color="#4f46e5"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="18" fill="url(#g)"/>
        <path d="M17 17h15c10 0 16 5 16 15s-6 15-16 15H17V17zm10 8v14h5c4 0 7-2 7-7s-3-7-7-7h-5z"
              fill="white"/>
      </svg>
    `;

    const href =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(svg);

    let link=document.querySelector('link[rel="icon"]');

    if(!link){
      link=document.createElement("link");
      link.rel="icon";
      document.head.appendChild(link);
    }

    link.href=href;
    link.type="image/svg+xml";
  }

  function addLoading(){
    if(document.getElementById("rz9-loading")) return;

    const loading=document.createElement("div");
    loading.id="rz9-loading";
    loading.className="rz9-loading";

    loading.innerHTML=`
      <div class="rz9-loading-inner">
        <div class="rz9-logo">R</div>
        <div class="rz9-loading-name">RIZORA</div>
        <div class="rz9-loading-sub">Creator Growth Studio</div>
        <div class="rz9-loader"><span></span></div>
      </div>
    `;

    document.body.appendChild(loading);

    setTimeout(()=>{
      loading.classList.add("hide");
      setTimeout(()=>loading.remove(),500);
    },700);
  }

  function addBranding(){
    const sidebar =
      document.querySelector(".sidebar") ||
      document.querySelector("aside");

    if(sidebar && !document.getElementById("rz9-side-brand")){
      const existing =
        sidebar.querySelector(".rz8-brand") ||
        sidebar.querySelector(".brand") ||
        sidebar.querySelector(".logo");

      if(!existing){
        const brand=document.createElement("div");
        brand.id="rz9-side-brand";
        brand.className="rz9-brandline";
        brand.style.marginBottom="15px";

        brand.innerHTML=`
          <div class="rz9-logo-small">R</div>
          <div class="rz9-brandtext">
            <strong>RIZORA</strong>
            <span>Creator Growth Studio</span>
          </div>
        `;

        sidebar.prepend(brand);
      }
    }

    const title=document.querySelector("title");
    if(title) title.textContent="RIZORA — Creator Growth Studio";
  }

  function brandEmptyStates(){
    const outputs = [
      ["boostOutput","Boost Studio","Run a boost to generate your first RIZORA performance signal."],
      ["hookOutput","Hook Intelligence","Generate hooks and sharpen the first seconds of your content."],
      ["hashtagOutput","Discovery Engine","Generate a focused hashtag set for your content."],
      ["captionOutput","Caption Engine","Create a stronger caption package for your post."],
      ["ideaOutput","Idea Engine","Generate content ideas and start building your idea bank."],
      ["analyzeOutput","Content Intelligence","Analyze a post to uncover useful performance signals."],
      ["performanceOutput","Performance Intelligence","Run an analysis to see what your content is doing."],
      ["abOutput","Experiment Intelligence","Create an A/B test to compare creative directions."]
    ];

    outputs.forEach(([id,title,text])=>{
      const el=document.getElementById(id);
      if(!el || el.dataset.rz9Done==="1") return;

      if(!el.textContent.trim()){
        el.innerHTML=`
          <div class="rz9-empty">
            <div class="rz9-logo-small">R</div>
            <div class="rz9-empty-text">
              <strong>${title}</strong>
              <span>${text}</span>
            </div>
          </div>
        `;
      }

      el.dataset.rz9Done="1";
    });
  }

  function run(){
    addFavicon();
    addBranding();
    brandEmptyStates();
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>{
      addLoading();
      run();
      setTimeout(brandEmptyStates,1000);
    },{once:true});
  }else{
    addLoading();
    run();
    setTimeout(brandEmptyStates,1000);
  }
})();
