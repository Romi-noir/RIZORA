"use strict";

function ensureLive(db){
  db.liveSessions = db.liveSessions || [];
  db.creatorCoins = db.creatorCoins || [];
  db.walletTransactions = db.walletTransactions || [];
  db.gifts = db.gifts || [];
  db.liveViewers = db.liveViewers || [];
  db.liveReports = db.liveReports || [];
  db.liveBlocks = db.liveBlocks || [];
}

function cleanupLiveSessions(db){

  const now = Date.now();

  db.liveSessions.forEach(
    live=>{

      if(
        live.active &&
        now - new Date(live.startedAt).getTime() > 6 * 60 * 60 * 1000
      ){
        live.active=false;
        live.endedAt=new Date().toISOString();
        live.autoClosed=true;
      }

    }
  );

}


function uid(prefix){
  return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2,8);
}

function safeString(v,max){
  return String(v || "").trim().slice(0,max || 200);
}

function coinAccount(db,userId){
  let account=db.creatorCoins.find(x=>x.userId===userId);

  if(!account){
    account={
      userId,
      coins:0,
      updatedAt:new Date().toISOString()
    };

    db.creatorCoins.push(account);
  }

  return account;
}

function addCoins(db,userId,amount,type){

  const value = Number(amount);

  if(
    !userId ||
    !Number.isFinite(value) ||
    value <= 0
  ){
    return null;
  }

  const account=coinAccount(db,userId);

  account.coins = Math.max(
    0,
    Number(account.coins || 0) + value
  );

  account.updatedAt=new Date().toISOString();

  const transaction = {
    id:uid("wallet"),
    userId,
    amount:value,
    type,
    createdAt:new Date().toISOString()
  };

  db.walletTransactions.push(transaction);

  return account;
}

function removeCoins(db,userId,amount,type){

  const value = Number(amount);

  if(
    !userId ||
    !Number.isFinite(value) ||
    value <= 0
  ){
    return null;
  }

  const account=coinAccount(db,userId);

  if(
    Number(account.coins || 0) < value
  ){
    return null;
  }

  account.coins -= value;
  account.updatedAt=new Date().toISOString();

  const transaction = {
    id:uid("wallet"),
    userId,
    amount:-value,
    type,
    createdAt:new Date().toISOString()
  };

  db.walletTransactions.push(transaction);

  return account;
}


async function handleRizoraLive(ctx){

  const {
    req,
    res,
    db,
    saveDB,
    getCurrentUser,
    sendJSON,
    sendError,
    hasPremium
  }=ctx;


  ensureLive(db);

  cleanupLiveSessions(db);

  const url=new URL(req.url,"http://localhost");
  const path=url.pathname;
  const method=req.method;

  const user=getCurrentUser(db,req);


  if(path==="/api/v2/live/analytics" && method==="GET"){

    if(!user){
      return sendError(
        res,
        401,
        "Authentication required."
      );
    }

    const sessions =
      db.liveSessions.filter(
        x=>x.userId===user.id
      );

    const totalGiftRevenue =
      sessions.reduce(
        (sum,x)=>
          sum + Number(x.giftRevenue || 0),
        0
      );

    const peakViewers =
      sessions.reduce(
        (max,x)=>
          Math.max(
            max,
            Number(x.peakViewers || 0)
          ),
        0
      );

    const totalViewerJoins =
      sessions.reduce(
        (sum,x)=>
          sum + Number(x.totalViewerJoins || 0),
        0
      );

    return sendJSON(res,200,{
      success:true,
      sessions:sessions.length,
      peakViewers,
      totalViewerJoins,
      totalGiftRevenue
    });

  }

  if(path==="/api/v2/live/report" && method==="POST"){

    if(!user){
      return sendError(
        res,
        401,
        "Authentication required."
      );
    }

    let body="";

    for await(const chunk of req){
      body+=chunk;
    }

    const data=JSON.parse(body || "{}");

    const liveId=safeString(
      data.liveId,
      100
    );

    const reason=safeString(
      data.reason || "community violation",
      200
    );

    const live =
      db.liveSessions.find(
        x=>x.id===liveId
      );

    if(!live){
      return sendError(
        res,
        404,
        "Live session not found."
      );
    }

    db.liveReports.push({
      id:uid("report"),
      liveId,
      reporterId:user.id,
      reason,
      createdAt:new Date().toISOString()
    });

    live.reports =
      Number(live.reports || 0) + 1;

    saveDB(db);

    return sendJSON(res,200,{
      success:true
    });

  }

  if(path==="/api/v2/live/status" && method==="GET"){

    const liveUsers=db.liveSessions.filter(x=>x.active).map(x=>({
      userId:x.userId,
      username:x.username
    }));

    return sendJSON(res,200,{
      success:true,
      online:true,
      liveCount:liveUsers.length,
      liveUsers
    });

  }


  if(path==="/api/v2/live/start" && method==="POST"){

    if(!user){
      return sendError(res,401,"Authentication required.");
    }


    if(
      typeof hasPremium === "function" &&
      !hasPremium(user)
    ){
      return sendError(
        res,
        403,
        "Premium subscription required to host live streams."
      );
    }

    const followers =
      Number(
        user.followersCount ||
        user.followers ||
        0
      );

    if(followers < 800){
      return sendError(
        res,
        403,
        "You need at least 800 followers to host live streams."
      );
    }

    const existingLive =
      db.liveSessions.find(
        x=>x.userId===user.id && x.active
      );

    if(existingLive){
      return sendError(
        res,
        400,
        "You already have an active live session."
      );
    }
    const live={
      id:uid("live"),
      userId:user.id,
      username:user.username,
      title:safeString(data.title || "RIZORA Live",100),
      category:safeString(data.category || "general",50),
      tags:Array.isArray(data.tags)
        ? data.tags.slice(0,10).map(x=>safeString(x,30))
        : [],
      thumbnail:safeString(data.thumbnail || "",300),
      startedAt:new Date().toISOString(),
      active:true,
      rewardClaimed:false,
      viewers:0,
      peakViewers:0,
      totalViewerJoins:0,
      giftRevenue:0,
      engagementScore:0,
      reports:0,
      blockedCount:0
    };


    db.liveSessions.push(live);

    saveDB(db);


    return sendJSON(res,200,{
      success:true,
      live
    });

  }



  if(path==="/api/v2/live/join" && method==="POST"){

    if(!user){
      return sendError(
        res,
        401,
        "Authentication required."
      );
    }

    let body="";

    for await(const chunk of req){
      body+=chunk;
    }

    const data=JSON.parse(body || "{}");

    const liveId=safeString(
      data.liveId,
      100
    );

    const live =
      db.liveSessions.find(
        x=>x.id===liveId && x.active
      );

    if(!live){
      return sendError(
        res,
        404,
        "Live session not found."
      );
    }

    const existing =
      db.liveViewers.find(
        x=>
          x.liveId===liveId &&
          x.userId===user.id &&
          x.active
      );

    if(existing){
      return sendError(
        res,
        400,
        "Already joined."
      );
    }

    db.liveViewers.push({
      id:uid("viewer"),
      liveId,
      userId:user.id,
      joinedAt:new Date().toISOString(),
      active:true
    });

    live.totalViewerJoins =
      Number(live.totalViewerJoins || 0) + 1;

    live.viewers =
      db.liveViewers.filter(
        x=>
          x.liveId===liveId &&
          x.active
      ).length;

    live.peakViewers = Math.max(
      Number(live.peakViewers || 0),
      live.viewers
    );

    saveDB(db);

    return sendJSON(res,200,{
      success:true,
      viewers:live.viewers
    });

  }


  if(path==="/api/v2/live/leave" && method==="POST"){

    if(!user){
      return sendError(
        res,
        401,
        "Authentication required."
      );
    }

    let body="";

    for await(const chunk of req){
      body+=chunk;
    }

    const data=JSON.parse(body || "{}");

    const liveId=safeString(
      data.liveId,
      100
    );

    const viewer =
      db.liveViewers.find(
        x=>
          x.liveId===liveId &&
          x.userId===user.id &&
          x.active
      );

    if(viewer){
      viewer.active=false;
      viewer.leftAt=new Date().toISOString();
    }

    const live =
      db.liveSessions.find(
        x=>x.id===liveId
      );

    if(live){
      live.viewers =
        db.liveViewers.filter(
          x=>
            x.liveId===liveId &&
            x.active
        ).length;
    }

    saveDB(db);

    return sendJSON(res,200,{
      success:true,
      viewers:live?.viewers || 0
    });

  }


  if(path==="/api/v2/live/end" && method==="POST"){

    if(!user){
      return sendError(res,401,"Authentication required.");
    }


    const live=db.liveSessions.find(
      x=>x.userId===user.id && x.active
    );


    if(live){

      if(live.rewardClaimed){
        return sendError(
          res,
          400,
          "Live reward already claimed."
        );
      }

      const minutes=Math.floor(
        (Date.now()-new Date(live.startedAt))/60000
      );

      if(minutes < 5){
        return sendError(
          res,
          400,
          "Live session must last at least 5 minutes."
        );
      }

      live.active=false;
      live.endedAt=new Date().toISOString();

      addCoins(
        db,
        user.id,
        minutes,
        "live_time_reward"
      );

      live.rewardClaimed=true;

    }


    saveDB(db);


    return sendJSON(res,200,{
      success:true
    });

  }



  if(path==="/api/v2/live/gift" && method==="POST"){

    if(!user){
      return sendError(res,401,"Authentication required.");
    }


    let body="";

    for await(const chunk of req){
      body+=chunk;
    }


    const data=JSON.parse(body || "{}");


    const creatorId=safeString(data.creatorId,100);
    const amount=Number(data.amount || 0);


    
    const creator =
      db.users &&
      db.users.find(
        x=>x.id===creatorId
      );

    if(
      !creatorId ||
      !Number.isFinite(amount) ||
      amount<=0 ||
      amount>100000
    ){
      return sendError(
        res,
        400,
        "Invalid gift."
      );
    }

    if(creatorId===user.id){
      return sendError(
        res,
        400,
        "You cannot gift yourself."
      );
    }

    if(!creator){
      return sendError(
        res,
        404,
        "Creator not found."
      );
    }




    const gift={
      id:uid("gift"),
      from:user.id,
      to:creatorId,
      amount,
      createdAt:new Date().toISOString()
    };
    const senderBalance =
      coinAccount(
        db,
        user.id
      );

    if(
      Number(senderBalance.coins || 0) < amount
    ){
      return sendError(
        res,
        400,
        "Insufficient coins."
      );
    }

    removeCoins(
      db,
      user.id,
      amount,
      "gift_sent"
    );

    db.gifts.push(gift);


    addCoins(
      db,
      creatorId,
      amount,
      "gift_received"
    );

    const activeLive =
      db.liveSessions.find(
        x=>
          x.userId===creatorId &&
          x.active
      );

    if(activeLive){
      activeLive.giftRevenue =
        Number(activeLive.giftRevenue || 0) + amount;
    }


    saveDB(db);


    return sendJSON(res,200,{
      success:true,
      gift
    });

  }



  if(path==="/api/v2/gifts" && method==="GET"){

    if(!user){
      return sendError(
        res,
        401,
        "Authentication required."
      );
    }

    const sent =
      db.gifts
      .filter(
        x=>x.from===user.id
      )
      .map(
        x=>{
          const creator =
            db.users &&
            db.users.find(
              u=>u.id===x.to
            );

          return {
            username:
              creator?.username ||
              "creator",
            amount:Number(x.amount || 0),
            createdAt:x.createdAt
          };
        }
      );

    const received =
      db.gifts
      .filter(
        x=>x.to===user.id
      )
      .map(
        x=>{
          const sender =
            db.users &&
            db.users.find(
              u=>u.id===x.from
            );

          return {
            username:
              sender?.username ||
              "creator",
            amount:Number(x.amount || 0),
            createdAt:x.createdAt
          };
        }
      );

    return sendJSON(res,200,{
      success:true,
      sent,
      received
    });

  }


  if(path==="/api/v2/wallet" && method==="GET"){

    if(!user){
      return sendError(res,401,"Authentication required.");
    }


    const account=coinAccount(db,user.id);


    return sendJSON(res,200,{
      success:true,
      coins:account.coins,
      transactions:
        db.walletTransactions
        .filter(
          x=>x.userId===user.id
        )
        .map(
          x=>({
            id:x.id,
            amount:x.amount,
            type:x.type,
            createdAt:x.createdAt
          })
        )
    });

  }



  if(path==="/api/v2/live/leaderboard" && method==="GET"){

    const leaderboard =
      db.creatorCoins
      .slice()
      .sort(
        (a,b)=>b.coins-a.coins
      )
      .slice(0,50)
      .map(
        x=>{
          const creator =
            db.users &&
            db.users.find(
              u=>u.id===x.userId
            );

          return {
            username:
              creator?.username ||
              "creator",
            coins:Number(x.coins || 0)
          };
        }
      );


    return sendJSON(res,200,{
      success:true,
      leaderboard
    });

  }


  return false;
}


module.exports={
  handleRizoraLive
};











































