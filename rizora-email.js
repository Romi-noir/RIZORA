"use strict";

function clean(value,max){
  return String(value == null ? "" : value).trim().slice(0,max || 5000);
}

function html(value){
  return clean(value,5000)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

function configured(){
  return Boolean(String(process.env.RESEND_API_KEY || "").trim());
}

function fromAddress(){
  return clean(
    process.env.RIZORA_EMAIL_FROM ||
    "RIZORA <noreply@rizora.com.ng>",
    160
  );
}

async function sendRizoraEmail(options){
  const to=clean(options && options.to,320);

  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)){
    throw new Error("Invalid recipient email.");
  }
  const subject=clean(options && options.subject,180);
  const text=clean(options && options.text,20000);
  const bodyHtml=String(options && options.html || "");
  if(!to)throw new Error("Recipient email is required.");
  if(!subject)throw new Error("Email subject is required.");
  if(!bodyHtml && !text)throw new Error("Email content is required.");
  const key=String(process.env.RESEND_API_KEY || "").trim();
  if(!key) return {configured:false,sent:false,reason:"EMAIL_PROVIDER_NOT_CONFIGURED"};

  const payload={
    from:fromAddress(),
    to:[to],
    subject:subject,
    html:bodyHtml || undefined,
    text:text || undefined
  };
  const reply=clean(process.env.RIZORA_EMAIL_REPLY_TO,320);
  if(reply)payload.reply_to=reply;

  const controller = new AbortController();

  const timeout = setTimeout(
    function(){
      controller.abort();
    },
    10000
  );

  let response;

  try {
    response = await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{
        "Authorization":"Bearer "+key,
        "Content-Type":"application/json"
      },
      body:JSON.stringify(payload),
      signal:controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  const data=await response.json().catch(function(){return {};});
  if(!response.ok){
    const message=String(
      data && data.message ||
      data && data.error ||
      "Transactional email provider rejected the request."
    ).slice(0,500);
    const error=new Error(message);
    error.status=response.status;
    error.provider="resend";
    throw error;
  }
  return {
    configured:true,
    sent:true,
    provider:"resend",
    id:String(data && data.id || "")
  };
}

async function sendRizoraWelcomeEmail(options){
  const displayName=clean(options && options.displayName || options && options.username || "Creator",120);
  const username=clean(options && options.username,80);
  const referralCode=clean(options && options.referralCode,100);
  const publicUrl=clean(options && options.publicUrl || "https://rizora.com.ng",300).replace(/\/$/,"");
  const safeName=html(displayName);
  const safeUsername=html(username);
  const safeReferral=html(referralCode);

  const subject="Welcome to RIZORA, @"+username;
  const text=[
    "Welcome to RIZORA, "+displayName+"!",
    "",
    "Your creator account is ready.",
    "Username: @"+username,
    referralCode ? "Referral code: "+referralCode : "",
    "",
    "CREATE. GROW. EARN.",
    "",
    "Open RIZORA: "+publicUrl,
    "",
    "RIZORA · Creator Social, Growth & AI"
  ].filter(Boolean).join("\n");

  const bodyHtml=
    '<div style="margin:0;background:#07050d;color:#f8f6ff;font-family:Arial,Helvetica,sans-serif;padding:32px 16px">'+
      '<div style="max-width:620px;margin:0 auto;background:#100b1d;border:1px solid #33215a;border-radius:22px;padding:30px">'+
        '<div style="font-size:12px;letter-spacing:4px;color:#bba8ff;font-weight:800">RIZORA</div>'+
        '<h1 style="margin:12px 0 8px;font-size:34px">Welcome, '+safeName+'.</h1>'+
        '<p style="color:#b8aec9;line-height:1.7">Your RIZORA creator account is ready. Your creator tools, missions, AI, community and growth systems are waiting for you.</p>'+
        '<div style="margin:22px 0;padding:18px;border-radius:16px;background:#090611;border:1px solid #2a1a49">'+
          '<div style="color:#8e80a7;font-size:12px;text-transform:uppercase;letter-spacing:2px">Your account</div>'+
          '<div style="margin-top:8px;font-weight:800">@'+safeUsername+'</div>'+
          (referralCode?'<div style="margin-top:10px;color:#b8aec9">Referral code: <b style="color:#fff">'+safeReferral+'</b></div>':"")+
        '</div>'+
        '<a href="'+html(publicUrl)+'" style="display:inline-block;padding:13px 19px;background:#7b4dff;color:#fff;text-decoration:none;border-radius:12px;font-weight:800">Open RIZORA</a>'+
        '<p style="margin-top:28px;color:#8e80a7;font-size:12px">CREATE. GROW. EARN.</p>'+
      '</div>'+
    '</div>';

  return sendRizoraEmail({
    to:options && options.to,
    subject:subject,
    text:text,
    html:bodyHtml
  });
}

module.exports={configured,sendRizoraEmail,sendRizoraWelcomeEmail};


