// ===== EarnPro - Full App Logic (Updated with Lucky Wheel, Videos, iPhone Prize) =====

const waitForFB = () => new Promise(resolve => {
  const check = () => window._fb ? resolve(window._fb) : setTimeout(check, 50);
  check();
});

// ===== TOAST =====
function showToast(msg, type = "success") {
  let t = document.querySelector(".toast");
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = `toast ${type}`;
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => t.classList.remove("show"), 3000);
}

const app = document.getElementById("app");
function render(html) { app.innerHTML = html; }

async function logout() {
  const { auth, signOut } = await waitForFB();
  await signOut(auth);
}

// ===== LOGIN =====
window.renderLogin = function () {
  render(`
    <div class="login-page">
      <div class="login-card">
        <div class="logo-area">
          <span class="logo-emoji">💰</span>
          <h1 class="logo-title">EarnPro</h1>
          <p class="logo-sub">Earn Coins. Win Rewards.</p>
        </div>
        <div class="card">
          <div class="tab-row">
            <button class="tab active" id="tab-login" onclick="switchTab('login')">Login</button>
            <button class="tab" id="tab-register" onclick="switchTab('register')">Register</button>
          </div>
          <div id="form-area">${loginForm()}</div>
        </div>
      </div>
    </div>`);
};

window.switchTab = function (tab) {
  document.getElementById("tab-login").classList.toggle("active", tab === "login");
  document.getElementById("tab-register").classList.toggle("active", tab === "register");
  document.getElementById("form-area").innerHTML = tab === "login" ? loginForm() : registerForm();
};

function loginForm() {
  return `
    <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="login-email" type="email" placeholder="email@example.com"/></div>
    <div class="form-group"><label class="form-label">Password</label><input class="form-input" id="login-pass" type="password" placeholder="••••••••"/></div>
    <div id="auth-error"></div>
    <button class="btn-primary" onclick="doLogin()">Login Karein</button>
    <p class="hint-text">Admin: admin@earnpro.com / admin123</p>`;
}

function registerForm() {
  return `
    <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="reg-name" placeholder="Apna naam"/></div>
    <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="reg-email" type="email" placeholder="email@example.com"/></div>
    <div class="form-group"><label class="form-label">Password</label><input class="form-input" id="reg-pass" type="password" placeholder="Min 6 characters"/></div>
    <div class="form-group"><label class="form-label">Invite Code (Optional)</label><input class="form-input" id="reg-invite" placeholder="Friend ka invite code"/></div>
    <div id="auth-error"></div>
    <button class="btn-primary" onclick="doRegister()">Account Banayein</button>`;
}

window.doLogin = async function () {
  const email = document.getElementById("login-email").value.trim();
  const pass = document.getElementById("login-pass").value;
  const errEl = document.getElementById("auth-error");
  if (!email || !pass) { errEl.innerHTML = `<div class="error-msg">Email aur password zaruri hain</div>`; return; }
  const btn = document.querySelector(".btn-primary");
  btn.disabled = true; btn.textContent = "...";
  try {
    const { auth, signInWithEmailAndPassword } = await waitForFB();
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    let msg = "Login fail hua";
    if (e.code === "auth/user-not-found" || e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") msg = "Galat email ya password";
    if (e.code === "auth/too-many-requests") msg = "Zyada attempts. Thodi der baad try karein";
    errEl.innerHTML = `<div class="error-msg">${msg}</div>`;
    btn.disabled = false; btn.textContent = "Login Karein";
  }
};

window.doRegister = async function () {
  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const pass = document.getElementById("reg-pass").value;
  const invite = document.getElementById("reg-invite").value.trim().toUpperCase();
  const errEl = document.getElementById("auth-error");
  if (!name || !email || !pass) { errEl.innerHTML = `<div class="error-msg">Sab fields bharein</div>`; return; }
  if (pass.length < 6) { errEl.innerHTML = `<div class="error-msg">Password min 6 characters</div>`; return; }
  const btn = document.querySelector(".btn-primary");
  btn.disabled = true; btn.textContent = "...";
  try {
    const { auth, db, createUserWithEmailAndPassword, doc, setDoc, getDocs, collection, updateDoc, increment, serverTimestamp } = await waitForFB();
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    const uid = cred.user.uid;
    const myCode = "EARN-" + name.replace(/\s/g,"").toUpperCase().slice(0,6) + Math.random().toString(36).slice(2,5).toUpperCase();
    await setDoc(doc(db, "users", uid), {
      name, email, coins: 0, role: "user",
      inviteCode: myCode, invitedBy: invite || null,
      referralCount: 0, totalWithdrawn: 0, spinsAvailable: 0,
      completedTasks: [], watchedVideos: [], lastCheckin: null,
      iPhoneWinner: false, createdAt: serverTimestamp(), status: "active"
    });
    if (invite) {
      const usersSnap = await getDocs(collection(db, "users"));
      usersSnap.forEach(async (d) => {
        if (d.data().inviteCode === invite) {
          // Referrer ko +50 coins + 1 spin milega
          await updateDoc(doc(db, "users", d.id), { coins: increment(50), referralCount: increment(1), spinsAvailable: increment(1) });
        }
      });
    }
  } catch (e) {
    let msg = "Registration fail";
    if (e.code === "auth/email-already-in-use") msg = "Yeh email pehle se registered hai";
    errEl.innerHTML = `<div class="error-msg">${msg}</div>`;
    btn.disabled = false; btn.textContent = "Account Banayein";
  }
};

// ===== USER PANEL =====
let _userPage = "dashboard";

window.renderUserPanel = async function () {
  const u = window._currentUser;
  render(`
    <div class="app-shell">
      <div id="install-banner" class="install-banner hidden">
        <p>📱 EarnPro install karein!</p>
        <button class="install-btn" onclick="installApp()">Install</button>
      </div>
      <div class="header">
        <div class="header-left"><p>Welcome back</p><h2>${u.name} 👋</h2></div>
        <div class="coin-badge">💰 <span id="coin-display">${u.coins||0}</span></div>
      </div>
      <div class="page-content" id="main-content"></div>
      <nav class="bottom-nav">
        ${[["dashboard","🏠","Home"],["tasks","✅","Tasks"],["wheel","🎡","Wheel"],["videos","▶️","Videos"],["wallet","💳","Wallet"]].map(([id,icon,label]) =>
          `<button class="nav-btn ${_userPage===id?'active':''}" onclick="goPage('${id}')">
            <span class="nav-icon">${icon}</span><span class="nav-label">${label}</span>
          </button>`).join("")}
      </nav>
    </div>`);
  goPage(_userPage);
};

window.goPage = function (page) {
  _userPage = page;
  document.querySelectorAll(".nav-btn").forEach(b => {
    const lbl = b.querySelector(".nav-label")?.textContent;
    const map = {dashboard:"Home",tasks:"Tasks",wheel:"Wheel",videos:"Videos",wallet:"Wallet"};
    b.classList.toggle("active", map[page] === lbl);
  });
  ({dashboard:dashboardPage,tasks:tasksPage,wheel:wheelPage,videos:videosPage,wallet:walletPage})[page]?.();
};

function updateCoinDisplay() {
  const el = document.getElementById("coin-display");
  if (el) el.textContent = window._currentUser.coins || 0;
}

// ---- DASHBOARD ----
async function dashboardPage() {
  const u = window._currentUser;
  const today = new Date().toDateString();
  const checkedIn = u.lastCheckin === today;
  document.getElementById("main-content").innerHTML = `
    <div class="hero-card">
      <p class="hero-label">Total Balance</p>
      <div class="hero-coins">💰 ${u.coins||0}</div>
      <p class="hero-sub">Coins</p>
    </div>
    <div class="stats-row">
      <div class="stat-box"><span class="stat-icon">🎡</span><span class="stat-val">${u.spinsAvailable||0}</span><span class="stat-lbl">Spins</span></div>
      <div class="stat-box"><span class="stat-icon">👥</span><span class="stat-val">${u.referralCount||0}</span><span class="stat-lbl">Invites</span></div>
      <div class="stat-box"><span class="stat-icon">▶️</span><span class="stat-val">${(u.watchedVideos||[]).length}</span><span class="stat-lbl">Videos</span></div>
    </div>
    ${u.iPhoneWinner ? `<div class="iphone-winner-banner">🏆 Mubarak Ho! Admin ne aapko iPhone 11 Pro approve kiya hai! Admin se rabta karein.</div>` : ''}
    <p class="section-title">Quick Actions</p>
    <div class="quick-grid">
      <div class="quick-card ${checkedIn?'done':''}" onclick="${checkedIn?'':' doCheckin()'}">
        <span class="quick-icon">📅</span><span class="quick-label">Check-In</span>
        <span style="color:${checkedIn?'#10b981':'#64748b'};font-size:11px">${checkedIn?'Done!':'+10 Coins'}</span>
      </div>
      <div class="quick-card" onclick="goPage('wheel')"><span class="quick-icon">🎡</span><span class="quick-label">Lucky Wheel</span><span style="color:#fbbf24;font-size:11px">${u.spinsAvailable||0} Spins</span></div>
      <div class="quick-card" onclick="goPage('videos')"><span class="quick-icon">▶️</span><span class="quick-label">Watch Videos</span><span style="color:#64748b;font-size:11px">+5 coins each</span></div>
      <div class="quick-card" onclick="goPage('wallet')"><span class="quick-icon">💳</span><span class="quick-label">Wallet</span><span style="color:#64748b;font-size:11px">Withdraw</span></div>
    </div>`;
}

// ---- TASKS ----
async function tasksPage() {
  const u = window._currentUser;
  const today = new Date().toDateString();
  const done = u.completedTasks || [];
  const tasks = [
    { id:"checkin_"+today, icon:"📅", name:"Daily Check-In", desc:"Rozana +10 coins", coins:10, isDaily:true, action:"doCheckin()" },
    { id:"yt_subscribe", icon:"▶️", name:"YouTube Subscribe", desc:"Channel subscribe karein", coins:25, action:"doYT()" },
    { id:"whatsapp_share", icon:"📢", name:"WhatsApp Share", desc:"App share karein", coins:15, action:"doShare()" },
    { id:"rate_app", icon:"⭐", name:"App Rate Karein", desc:"5 star dein", coins:20, action:"doRate()" },
  ];
  document.getElementById("main-content").innerHTML = `
    <h2 class="page-title">Daily Tasks</h2>
    <div class="invite-task-card">
      <div style="display:flex;align-items:center;gap:14px">
        <span style="font-size:34px">👥</span>
        <div>
          <div class="task-name">Dosto Ko Invite Karein</div>
          <div class="task-desc">Har invite par → +50 coins + 1 Lucky Spin!</div>
        </div>
      </div>
      <button class="task-btn" onclick="goPage('wallet');setTimeout(()=>invitePage(),100)">Invite Code</button>
    </div>
    ${tasks.map(t => {
      const isDone = done.includes(t.id) || (t.isDaily && u.lastCheckin === today);
      return `<div class="task-card ${isDone?'done':''}">
        <span class="task-icon">${t.icon}</span>
        <div class="task-info"><div class="task-name">${t.name}</div><div class="task-desc">${t.desc}</div></div>
        <div class="task-right">
          <div class="task-coins">+${t.coins} 💰</div>
          <button class="task-btn ${isDone?'done':''}" ${isDone?'':'onclick="'+t.action+'"'}>${isDone?'✓ Done':'Karein'}</button>
        </div>
      </div>`;
    }).join("")}`;
}

// ---- LUCKY WHEEL ----
// Wheel prizes — 8 slices
// iPhone aur 5000 coins sirf tab milenge jab admin ne user ko allow kiya ho
// Baaki sab ko sirf 10–100 coins milenge (normal prizes)
const WHEEL_PRIZES = [
  { label: "10 💰",      coins: 10,   color: "#0f2744", textColor: "#7dd3fc",  type: "coins" },
  { label: "50 💰",      coins: 50,   color: "#1e1b4b", textColor: "#a5b4fc",  type: "coins" },
  { label: "20 💰",      coins: 20,   color: "#0f2744", textColor: "#93c5fd",  type: "coins" },
  { label: "📱 iPhone!", coins: 0,    color: "#3d1200", textColor: "#fbbf24",  type: "iphone", isSpecial: true },
  { label: "30 💰",      coins: 30,   color: "#0f2744", textColor: "#7dd3fc",  type: "coins" },
  { label: "5000 💰",    coins: 5000, color: "#14270f", textColor: "#6ee7b7",  type: "coins5k", isSpecial: true },
  { label: "100 💰",     coins: 100,  color: "#1e1b4b", textColor: "#c4b5fd",  type: "coins" },
  { label: "Try Again!", coins: 0,    color: "#1a1a2e", textColor: "#94a3b8",  type: "tryagain" },
];

// Index shortcuts
const IDX_IPHONE  = 3;
const IDX_5000    = 5;
const IDX_TRYAGAIN = 7;

// Normal prize indices (coins only, max 100)
const NORMAL_IDXS = [0, 1, 2, 4, 6]; // 10,50,20,30,100

let wheelSpinning = false;

async function wheelPage() {
  const u = window._currentUser;
  const spins = u.spinsAvailable || 0;
  const freeSpin = !u.freeSpinUsed; // ek free spin hamesha milti hai
  const totalAvail = spins + (freeSpin ? 1 : 0);
  const size = Math.min(window.innerWidth - 32, 310);

  document.getElementById("main-content").innerHTML = `
    <h2 class="page-title">🎡 Lucky Wheel</h2>

    <!-- Spin counters -->
    <div class="spin-counters">
      <div class="spin-counter-box">
        <span class="sc-icon">🎯</span>
        <span class="sc-val">${spins}</span>
        <span class="sc-lbl">Paid Spins</span>
      </div>
      <div class="spin-counter-box ${freeSpin?'free-available':''}">
        <span class="sc-icon">🎁</span>
        <span class="sc-val">${freeSpin?'1':'0'}</span>
        <span class="sc-lbl">Free Spin</span>
      </div>
    </div>

    <!-- Wheel -->
    <div class="wheel-wrap">
      <div class="wheel-pointer">▼</div>
      <canvas id="wheelCanvas" width="${size}" height="${size}"
        style="border-radius:50%;box-shadow:0 0 50px #fbbf2435,0 0 100px #6366f115;display:block;margin:0 auto">
      </canvas>
    </div>

    <!-- Spin button -->
    <button id="spin-btn" class="btn-spin ${totalAvail===0?'disabled':''}"
      onclick="spinWheel()" ${totalAvail===0?'disabled':''}>
      ${totalAvail===0 ? '🔒 Koi Spin Nahi — Invite Karo!' : freeSpin ? '🎁 FREE SPIN KAREIN!' : '🎡 SPIN KAREIN!'}
    </button>

    ${totalAvail===0 ? `<p class="spin-earn-tip">💡 Har ek invite karo → 1 paid spin milti hai!</p>` : ''}
    ${freeSpin && totalAvail>0 ? `<p class="spin-earn-tip" style="color:#10b981">✨ Aapki ek FREE spin baqi hai!</p>` : ''}

    <div id="wheel-result"></div>

    <!-- Prize table -->
    <div class="prize-list">
      <p class="section-title" style="margin-top:20px">Wheel Prizes</p>
      ${WHEEL_PRIZES.map(p => `
        <div class="prize-row ${p.isSpecial?'special-prize-row':''}">
          <span>${p.label}</span>
          <span style="font-size:11px;color:${p.isSpecial?'#fbbf24':p.type==='tryagain'?'#64748b':'#94a3b8'}">
            ${p.type==='iphone'?'Grand Prize — Admin Approval'
              :p.type==='coins5k'?'Mega Prize — Admin Approval'
              :p.type==='tryagain'?'Better luck next time!'
              :'+'+p.coins+' coins milenge'}
          </span>
        </div>`).join("")}
    </div>`;

  drawWheelCanvas(size);
}

function drawWheelCanvas(size, rotationRad = 0) {
  const canvas = document.getElementById("wheelCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const cx = size/2, cy = size/2, r = size/2 - 3;
  const slice = (2 * Math.PI) / WHEEL_PRIZES.length;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotationRad);
  ctx.translate(-cx, -cy);

  WHEEL_PRIZES.forEach((prize, i) => {
    const start = i * slice - Math.PI/2;
    const end   = start + slice;

    // Slice fill
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,end); ctx.closePath();
    ctx.fillStyle = prize.color; ctx.fill();
    // Border
    ctx.strokeStyle = "#0a1628"; ctx.lineWidth = 2.5; ctx.stroke();

    // Outer accent line for special prizes
    if (prize.isSpecial) {
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r-1,start,end); ctx.closePath();
      ctx.strokeStyle = prize.type==='iphone'?"#f97316":"#10b981"; ctx.lineWidth=2; ctx.stroke();
    }

    // Text
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + slice/2);
    ctx.textAlign = "right";
    const fs = prize.isSpecial ? 10 : prize.type==='tryagain' ? 9 : 12;
    ctx.font = `800 ${fs}px Sora, sans-serif`;
    ctx.fillStyle = prize.textColor;
    // Glow for special
    if (prize.isSpecial) { ctx.shadowColor = prize.textColor; ctx.shadowBlur = 6; }
    ctx.fillText(prize.label, r - 8, 5);
    ctx.shadowBlur = 0;
    ctx.restore();
  });

  ctx.restore();

  // Center circle
  const grad = ctx.createRadialGradient(cx,cy,4,cx,cy,22);
  grad.addColorStop(0,"#1e293b"); grad.addColorStop(1,"#0f172a");
  ctx.beginPath(); ctx.arc(cx,cy,22,0,2*Math.PI);
  ctx.fillStyle = grad; ctx.fill();
  ctx.strokeStyle = "#fbbf24"; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#fbbf24"; ctx.font = "bold 16px Sora";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("💰", cx, cy);
}

window.spinWheel = async function () {
  const u = window._currentUser;
  const hasPaidSpin = (u.spinsAvailable || 0) > 0;
  const hasFreeSpin = !u.freeSpinUsed;
  if (wheelSpinning || (!hasPaidSpin && !hasFreeSpin)) return;

  wheelSpinning = true;
  const isFreeSpin = !hasPaidSpin && hasFreeSpin; // free spin use ho rahi hai

  const btn = document.getElementById("spin-btn");
  if (btn) { btn.disabled = true; btn.textContent = "🌀 Spinning..."; }

  // ====== PRIZE DECISION LOGIC ======
  // Admin ne agar user ko bigPrizeAllowed set kiya hai to iPhone/5000 land kar sakta hai
  // Warna sirf normal coins (10–100) ya tryagain
  const bigPrizeAllowed = u.bigPrizeAllowed === true;

  let prizeIndex;
  const rand = Math.random();

  if (bigPrizeAllowed) {
    // Admin allowed — full wheel active
    if (rand < 0.02)       prizeIndex = IDX_IPHONE;   // 2% iPhone
    else if (rand < 0.06)  prizeIndex = IDX_5000;      // 4% 5000 coins
    else if (rand < 0.20)  prizeIndex = IDX_TRYAGAIN;  // 14% try again
    else {
      prizeIndex = NORMAL_IDXS[Math.floor(Math.random() * NORMAL_IDXS.length)];
    }
  } else {
    // Admin allowed nahi — sirf normal coins ya try again
    // iPhone aur 5000 kabhi nahi land honge
    if (rand < 0.18) prizeIndex = IDX_TRYAGAIN; // 18% try again
    else prizeIndex = NORMAL_IDXS[Math.floor(Math.random() * NORMAL_IDXS.length)];
  }

  // Animate wheel
  const size = document.getElementById("wheelCanvas").width;
  const sliceDeg = 360 / WHEEL_PRIZES.length;
  // Target: pointer (top) pe selected prize aaye
  const targetDeg = 360 * 6 + (360 - prizeIndex * sliceDeg - sliceDeg / 2 + 90);
  const duration = 4500;
  const startTime = performance.now();
  let lastRad = 0;

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Cubic ease out
    const ease = 1 - Math.pow(1 - progress, 4);
    const currentDeg = ease * targetDeg;
    const currentRad = (currentDeg * Math.PI) / 180;
    lastRad = currentRad;
    drawWheelCanvas(size, currentRad);
    if (progress < 1) requestAnimationFrame(animate);
    else { wheelSpinning = false; awardPrize(prizeIndex, isFreeSpin); }
  }

  requestAnimationFrame(animate);
};

async function awardPrize(prizeIndex, isFreeSpin) {
  const prize = WHEEL_PRIZES[prizeIndex];
  const u = window._currentUser;
  const { db, doc, updateDoc, increment, addDoc, collection, serverTimestamp } = await waitForFB();

  // Deduct spin
  const spinUpdate = isFreeSpin
    ? { freeSpinUsed: true }
    : { spinsAvailable: increment(-1) };

  const resultEl = document.getElementById("wheel-result");

  // ---- TRY AGAIN ----
  if (prize.type === "tryagain") {
    await updateDoc(doc(db,"users",u.uid), spinUpdate);
    if (isFreeSpin) u.freeSpinUsed = true;
    else u.spinsAvailable = Math.max(0,(u.spinsAvailable||0)-1);

    resultEl.innerHTML = `
      <div class="prize-popup try-again">
        <div style="font-size:52px">😅</div>
        <h3>Try Again!</h3>
        <p>Is baar qismat ne saath nahi diya — agle spin mein zaroor jeetenge!</p>
        <div class="result-btns">
          ${(u.spinsAvailable||0)+(u.freeSpinUsed?0:1) > 0
            ? `<button class="btn-spin" style="margin-bottom:0;animation:none" onclick="wheelPage()">🎡 Dobara Spin</button>`
            : `<p style="color:#64748b;font-size:13px;margin-top:4px">💡 Invite karo aur aur spins pao!</p>`}
        </div>
      </div>`;
    return;
  }

  // ---- iPHONE PRIZE ----
  if (prize.type === "iphone") {
    await updateDoc(doc(db,"users",u.uid), { ...spinUpdate, iphonePending: true, bigPrizeAllowed: false });
    await addDoc(collection(db,"iphoneClaims"), {
      uid: u.uid, userName: u.name, userEmail: u.email,
      prize: "iPhone 11 Pro", status: "Pending", createdAt: serverTimestamp()
    });
    if (isFreeSpin) u.freeSpinUsed = true;
    else u.spinsAvailable = Math.max(0,(u.spinsAvailable||0)-1);
    u.bigPrizeAllowed = false;
    updateCoinDisplay();
    resultEl.innerHTML = `
      <div class="prize-popup iphone">
        <div style="font-size:64px">📱</div>
        <h3 style="color:#fbbf24">MUBARAK HO!!!</h3>
        <p>Aapne <strong style="color:#fbbf24">iPhone 11 Pro</strong> jeeta!<br>Admin se approval pending hai — aapko jald contact kiya jayega!</p>
        <button class="btn-primary" onclick="wheelPage()">✅ Theek Hai</button>
      </div>`;
    return;
  }

  // ---- 5000 COINS ----
  if (prize.type === "coins5k") {
    await updateDoc(doc(db,"users",u.uid), { ...spinUpdate, coins: increment(5000), bigPrizeAllowed: false });
    await addDoc(collection(db,"iphoneClaims"), {
      uid: u.uid, userName: u.name, userEmail: u.email,
      prize: "5000 Coins", status: "Approved", createdAt: serverTimestamp()
    });
    if (isFreeSpin) u.freeSpinUsed = true;
    else u.spinsAvailable = Math.max(0,(u.spinsAvailable||0)-1);
    u.coins = (u.coins||0) + 5000;
    u.bigPrizeAllowed = false;
    updateCoinDisplay();
    resultEl.innerHTML = `
      <div class="prize-popup coins5k">
        <div style="font-size:64px">🤑</div>
        <h3 style="color:#10b981">JACKPOT!!!</h3>
        <p>Aapne <strong style="color:#fbbf24">5000 Coins</strong> jeete! Ye coins aapke wallet mein add ho gaye!</p>
        <button class="btn-primary" style="background:linear-gradient(135deg,#10b981,#059669)" onclick="wheelPage()">🎉 Shukriya!</button>
      </div>`;
    return;
  }

  // ---- NORMAL COINS ----
  await updateDoc(doc(db,"users",u.uid), { ...spinUpdate, coins: increment(prize.coins) });
  if (isFreeSpin) u.freeSpinUsed = true;
  else u.spinsAvailable = Math.max(0,(u.spinsAvailable||0)-1);
  u.coins = (u.coins||0) + prize.coins;
  updateCoinDisplay();

  const hasMoreSpins = (u.spinsAvailable||0) + (u.freeSpinUsed?0:1) > 0;
  resultEl.innerHTML = `
    <div class="prize-popup">
      <div style="font-size:52px">🎉</div>
      <h3>Mubarak Ho!</h3>
      <p>Aapne <strong style="color:#fbbf24">${prize.coins} Coins</strong> jeete!<br>Yeh aapke wallet mein add ho gaye.</p>
      <div class="result-btns">
        ${hasMoreSpins
          ? `<button class="btn-spin" style="margin-bottom:8px;animation:none" onclick="wheelPage()">🎡 Dobara Spin</button>`
          : ''}
        <button class="btn-outline" style="margin-top:0" onclick="goPage('wallet')">💳 Wallet Dekho</button>
      </div>
    </div>`;

// ---- VIDEOS ----
const SAMPLE_VIDEOS = [
  { id:"vid1", title:"Earn Money Online Pakistan 2025", channel:"Tech PK", duration:"3:45", coins:5, url:"https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { id:"vid2", title:"JazzCash Account Kaise Banayein", channel:"Digital PK", duration:"4:12", coins:5, url:"https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { id:"vid3", title:"Fiverr Par Kaam Kaise Milta Hai", channel:"Freelance PK", duration:"6:30", coins:8, url:"https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { id:"vid4", title:"Easypaisa Se Transfer Karna Seekho", channel:"Finance PK", duration:"2:55", coins:5, url:"https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { id:"vid5", title:"Online Business Ideas Pakistan 2025", channel:"Business PK", duration:"8:00", coins:10, url:"https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
  { id:"vid6", title:"Upwork Profile Kaise Banayein", channel:"Freelance PK", duration:"5:20", coins:7, url:"https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
];

async function videosPage() {
  const u = window._currentUser;
  const watched = u.watchedVideos || [];
  document.getElementById("main-content").innerHTML = `
    <h2 class="page-title">▶️ Videos Dekho, Coins Pao</h2>
    <div class="video-info-bar">
      <span>📺 Video dekho → Coins milte hain</span>
    </div>
    ${SAMPLE_VIDEOS.map(v => {
      const isDone = watched.includes(v.id);
      return `<div class="video-card ${isDone?'done':''}">
        <div class="video-thumb" onclick="${isDone?'':' watchVideo(\''+v.id+'\',\''+v.url+'\','+v.coins+')'}">
          <div class="thumb-inner">▶</div>
          ${isDone?'<div class="thumb-done">✓</div>':''}
        </div>
        <div class="video-info">
          <div class="video-title">${v.title}</div>
          <div class="video-meta">${v.channel} • ${v.duration}</div>
          <div class="video-coins-row">
            <span class="video-coins">+${v.coins} 💰</span>
            ${isDone
              ? '<span class="video-watched">✓ Dekh liya</span>'
              : `<button class="video-btn" onclick="watchVideo('${v.id}','${v.url}',${v.coins})">Watch & Earn</button>`}
          </div>
        </div>
      </div>`;
    }).join("")}
    <div id="video-modal"></div>`;
}

window.watchVideo = async function (vidId, url, coins) {
  const u = window._currentUser;
  if ((u.watchedVideos||[]).includes(vidId)) { showToast("Yeh video pehle dekh chuke ho!", "error"); return; }

  // Modal dikhao — 10 second timer
  let seconds = 10;
  document.getElementById("video-modal").innerHTML = `
    <div class="vid-overlay">
      <div class="vid-modal">
        <div style="font-size:14px;color:#7dd3fc;margin-bottom:10px">Video dekh rahe hain...</div>
        <div class="vid-timer-ring">
          <span id="vid-countdown">${seconds}</span>s
        </div>
        <p style="color:#64748b;font-size:13px;margin:12px 0">Link khul raha hai YouTube par</p>
        <div id="vid-claim-btn"></div>
        <button class="btn-outline" style="margin-top:8px" onclick="closeVideoModal()">Cancel</button>
      </div>
    </div>`;

  window.open(url, "_blank");

  const timer = setInterval(() => {
    seconds--;
    const el = document.getElementById("vid-countdown");
    if (el) el.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(timer);
      const claimEl = document.getElementById("vid-claim-btn");
      if (claimEl) claimEl.innerHTML = `<button class="btn-primary" onclick="claimVideoCoins('${vidId}',${coins})">🎉 +${coins} Coins Claim Karein!</button>`;
    }
  }, 1000);
};

window.claimVideoCoins = async function (vidId, coins) {
  const u = window._currentUser;
  if ((u.watchedVideos||[]).includes(vidId)) { showToast("Pehle hi claim ho chuka!", "error"); closeVideoModal(); return; }
  const { db, doc, updateDoc, increment } = await waitForFB();
  await updateDoc(doc(db, "users", u.uid), { coins: increment(coins), watchedVideos: [...(u.watchedVideos||[]), vidId] });
  u.coins = (u.coins||0) + coins;
  u.watchedVideos = [...(u.watchedVideos||[]), vidId];
  updateCoinDisplay();
  closeVideoModal();
  showToast(`▶️ +${coins} Coins! Video watch bonus!`);
  videosPage();
};

window.closeVideoModal = function () {
  const el = document.getElementById("video-modal");
  if (el) el.innerHTML = "";
};

// ---- WALLET ----
async function walletPage() {
  const u = window._currentUser;
  document.getElementById("main-content").innerHTML = `
    <h2 class="page-title">💳 Wallet</h2>
    <div class="wallet-card">
      <div class="wallet-label">Available Coins</div>
      <div class="wallet-coins">💰 ${u.coins||0}</div>
      <div class="wallet-pkr">Min withdrawal: 100 coins</div>
      <button class="btn-primary" onclick="toggleWithdraw()">💸 Withdraw Karein</button>
    </div>
    <div id="withdraw-form-wrap"></div>
    <p class="section-title">Invite & Earn</p>
    <div class="code-box">
      <div class="code-label">Aapka Invite Code</div>
      <div class="code-value">${u.inviteCode||''}</div>
    </div>
    <button class="btn-outline" onclick="copyCode('${u.inviteCode}')">📋 Copy Code</button>
    <div style="height:16px"></div>
    <p class="section-title">Withdrawal History</p>
    <div id="withdraw-history"><div class="loading-row">Loading...</div></div>`;
  loadWithdrawHistory();
}

async function loadWithdrawHistory() {
  const { db, collection, getDocs, query, orderBy } = await waitForFB();
  const uid = window._currentUser.uid;
  try {
    const snap = await getDocs(query(collection(db, `users/${uid}/withdrawals`), orderBy("createdAt","desc")));
    const el = document.getElementById("withdraw-history");
    if (!el) return;
    if (snap.empty) { el.innerHTML = `<div class="empty-state">💸 Abhi tak koi withdrawal nahi</div>`; return; }
    el.innerHTML = snap.docs.map(d => {
      const w = d.data();
      return `<div class="withdraw-item">
        <div class="withdraw-info"><p>💰 ${w.amount} coins</p><small>${w.method} • ${w.account} • ${w.date||''}</small></div>
        <span class="status-badge ${w.status?.toLowerCase()}">${w.status}</span>
      </div>`;
    }).join("");
  } catch(e) { console.log(e); }
}

let withdrawShown = false;
window.toggleWithdraw = function () {
  const wrap = document.getElementById("withdraw-form-wrap");
  if (withdrawShown) { wrap.innerHTML = ""; withdrawShown = false; return; }
  withdrawShown = true;
  wrap.innerHTML = `
    <div class="withdraw-form">
      <h3>Withdrawal Request</h3>
      <div class="form-group"><label class="form-label">Amount (Coins)</label><input class="form-input" id="w-amount" type="number" placeholder="Min 100"/></div>
      <div class="form-group"><label class="form-label">Method</label>
        <select class="form-input" id="w-method"><option>JazzCash</option><option>Easypaisa</option><option>Bank Transfer</option></select>
      </div>
      <div class="form-group"><label class="form-label">Account Number</label><input class="form-input" id="w-account" placeholder="03XX-XXXXXXX"/></div>
      <div id="w-error"></div>
      <button class="btn-primary" onclick="submitWithdraw()">Request Bhejein</button>
    </div>`;
};

window.submitWithdraw = async function () {
  const amount = parseInt(document.getElementById("w-amount").value);
  const method = document.getElementById("w-method").value;
  const account = document.getElementById("w-account").value.trim();
  const errEl = document.getElementById("w-error");
  const u = window._currentUser;
  if (!amount || amount < 100) { errEl.innerHTML = `<div class="error-msg">Minimum 100 coins</div>`; return; }
  if (amount > (u.coins||0)) { errEl.innerHTML = `<div class="error-msg">Itne coins nahi hain</div>`; return; }
  if (!account) { errEl.innerHTML = `<div class="error-msg">Account number daalein</div>`; return; }
  const btn = document.querySelector(".withdraw-form .btn-primary");
  btn.disabled = true; btn.textContent = "...";
  const { db, doc, updateDoc, addDoc, collection, serverTimestamp, increment } = await waitForFB();
  await updateDoc(doc(db, "users", u.uid), { coins: increment(-amount) });
  await addDoc(collection(db, `users/${u.uid}/withdrawals`), { amount, method, account, status:"Pending", date:new Date().toLocaleDateString(), createdAt:serverTimestamp() });
  await addDoc(collection(db, "withdrawalRequests"), { uid:u.uid, userName:u.name, amount, method, account, status:"Pending", date:new Date().toLocaleDateString(), createdAt:serverTimestamp() });
  u.coins = (u.coins||0) - amount;
  updateCoinDisplay();
  showToast("✅ Withdrawal request bhej di!");
  walletPage();
};

// ===== TASK ACTIONS =====
window.doCheckin = async function () {
  const u = window._currentUser;
  const today = new Date().toDateString();
  if (u.lastCheckin === today) { showToast("Aaj check-in ho chuka hai!", "error"); return; }
  const { db, doc, updateDoc, increment } = await waitForFB();
  await updateDoc(doc(db, "users", u.uid), { coins: increment(10), lastCheckin: today });
  u.coins = (u.coins||0)+10; u.lastCheckin = today;
  updateCoinDisplay(); showToast("📅 Daily Check-In! +10 Coins"); dashboardPage();
};
window.doYT = async function () {
  const u = window._currentUser;
  if ((u.completedTasks||[]).includes("yt_subscribe")) { showToast("Pehle se ho gaya!", "error"); return; }
  window.open("https://youtube.com","_blank");
  const { db, doc, updateDoc, increment } = await waitForFB();
  await updateDoc(doc(db, "users", u.uid), { coins: increment(25), completedTasks:[...(u.completedTasks||[]),"yt_subscribe"] });
  u.coins=(u.coins||0)+25; u.completedTasks=[...(u.completedTasks||[]),"yt_subscribe"];
  updateCoinDisplay(); showToast("▶️ +25 Coins!"); tasksPage();
};
window.doShare = async function () {
  const u = window._currentUser;
  if ((u.completedTasks||[]).includes("whatsapp_share")) { showToast("Pehle se share ho gaya!", "error"); return; }
  const text = `💰 EarnPro se paise kamao! Code: ${u.inviteCode}`;
  if (navigator.share) navigator.share({title:"EarnPro",text});
  else { navigator.clipboard?.writeText(text); showToast("Copy ho gaya!"); }
  const { db, doc, updateDoc, increment } = await waitForFB();
  await updateDoc(doc(db, "users", u.uid), { coins:increment(15), completedTasks:[...(u.completedTasks||[]),"whatsapp_share"] });
  u.coins=(u.coins||0)+15; u.completedTasks=[...(u.completedTasks||[]),"whatsapp_share"];
  updateCoinDisplay(); showToast("📢 +15 Coins!"); tasksPage();
};
window.doRate = async function () {
  const u = window._currentUser;
  if ((u.completedTasks||[]).includes("rate_app")) { showToast("Pehle se rating di hai!", "error"); return; }
  const { db, doc, updateDoc, increment } = await waitForFB();
  await updateDoc(doc(db, "users", u.uid), { coins:increment(20), completedTasks:[...(u.completedTasks||[]),"rate_app"] });
  u.coins=(u.coins||0)+20; u.completedTasks=[...(u.completedTasks||[]),"rate_app"];
  updateCoinDisplay(); showToast("⭐ +20 Coins!"); tasksPage();
};
window.copyCode = function (code) { navigator.clipboard?.writeText(code); showToast("📋 Code copy ho gaya!"); };

// ===== ADMIN PANEL =====
let _adminPage = "overview";
window.renderAdminPanel = async function () {
  const u = window._currentUser;
  render(`
    <div class="app-shell">
      <div class="header admin-header">
        <div class="header-left"><p>Admin Panel</p><h2>⚙️ ${u.name}</h2></div>
        <button class="logout-btn" onclick="logout()">Logout</button>
      </div>
      <div class="page-content" id="admin-content"></div>
      <nav class="bottom-nav admin-nav">
        ${[["overview","📊","Overview"],["users","👥","Users"],["withdrawals","💸","Payouts"],["iphone","📱","iPhone"],["videos","▶️","Videos"]].map(([id,icon,label]) =>
          `<button class="nav-btn ${_adminPage===id?'active':''}" onclick="goAdminPage('${id}')">
            <span class="nav-icon">${icon}</span><span class="nav-label">${label}</span>
          </button>`).join("")}
      </nav>
    </div>`);
  goAdminPage(_adminPage);
};

window.goAdminPage = function (page) {
  _adminPage = page;
  document.querySelectorAll(".admin-nav .nav-btn").forEach(b => {
    const map = {overview:"Overview",users:"Users",withdrawals:"Payouts",iphone:"iPhone",videos:"Videos"};
    b.classList.toggle("active", map[page] === b.querySelector(".nav-label")?.textContent);
  });
  ({overview:adminOverview,users:adminUsers,withdrawals:adminWithdrawals,iphone:adminIphone,videos:adminVideos})[page]?.();
};

async function adminOverview() {
  document.getElementById("admin-content").innerHTML = `<h2 class="page-title">📊 Overview</h2><div class="loading-row">Loading...</div>`;
  const { db, collection, getDocs, query, orderBy } = await waitForFB();
  const [usersSnap, wSnap, iSnap] = await Promise.all([
    getDocs(collection(db,"users")),
    getDocs(query(collection(db,"withdrawalRequests"),orderBy("createdAt","desc"))),
    getDocs(collection(db,"iphoneClaims"))
  ]);
  const users = usersSnap.docs.map(d=>d.data());
  const wreqs = wSnap.docs.map(d=>d.data());
  const iclaims = iSnap.docs.map(d=>d.data());
  document.getElementById("admin-content").innerHTML = `
    <h2 class="page-title">📊 Overview</h2>
    <div class="stats-grid-2">
      <div class="admin-stat" style="border-left:4px solid #6366f1"><span style="font-size:28px">👥</span><span class="admin-stat-val">${users.length}</span><span class="admin-stat-lbl">Total Users</span></div>
      <div class="admin-stat" style="border-left:4px solid #fbbf24"><span style="font-size:28px">💰</span><span class="admin-stat-val">${users.reduce((s,u)=>s+(u.coins||0),0)}</span><span class="admin-stat-lbl">Total Coins</span></div>
      <div class="admin-stat" style="border-left:4px solid #ef4444"><span style="font-size:28px">⏳</span><span class="admin-stat-val">${wreqs.filter(w=>w.status==="Pending").length}</span><span class="admin-stat-lbl">Pending Withdrawals</span></div>
      <div class="admin-stat" style="border-left:4px solid #f59e0b"><span style="font-size:28px">📱</span><span class="admin-stat-val">${iclaims.filter(c=>c.status==="Pending").length}</span><span class="admin-stat-lbl">iPhone Claims</span></div>
    </div>`;
}

async function adminUsers() {
  document.getElementById("admin-content").innerHTML = `<h2 class="page-title">👥 Users</h2><div class="loading-row">Loading...</div>`;
  const { db, collection, getDocs, doc, updateDoc, increment } = await waitForFB();
  const snap = await getDocs(collection(db,"users"));
  let html = `<h2 class="page-title">👥 Users (${snap.size})</h2>`;
  snap.docs.forEach(d => {
    const u = d.data(); const uid = d.id;
    if (u.role==="admin") return;
    html += `<div class="user-card">
      <div class="user-card-header">
        <div><div class="user-name">${u.name}</div><div class="user-detail">${u.email}</div></div>
        <span class="status-badge ${u.status==='active'?'approved':'rejected'}">${u.status||'active'}</span>
      </div>
      <div class="user-meta">
        <span>💰 ${u.coins||0}</span><span>🎡 ${u.spinsAvailable||0} spins</span><span>👥 ${u.referralCount||0} refs</span>
      </div>
      <div class="btn-row">
        <button class="btn-green" onclick="adminAddCoins('${uid}','${u.name}')">+ Coins</button>
        <button class="btn-purple" onclick="adminAddSpins('${uid}','${u.name}')">+ Spins</button>
        <button class="btn-red" onclick="adminBlockUser('${uid}','${u.status||\'active\'}')">🚫 ${u.status==='blocked'?'Unblock':'Block'}</button>
      </div>
    </div>`;
  });
  document.getElementById("admin-content").innerHTML = html;
}

window.adminAddCoins = async function (uid, name) {
  const amt = prompt(`${name} ko kitne coins dene hain?`);
  if (!amt || isNaN(amt)) return;
  const { db, doc, updateDoc, increment } = await waitForFB();
  await updateDoc(doc(db,"users",uid),{coins:increment(parseInt(amt))});
  showToast(`✅ ${amt} coins diye`); adminUsers();
};
window.adminAddSpins = async function (uid, name) {
  const amt = prompt(`${name} ko kitne spins dene hain?`);
  if (!amt || isNaN(amt)) return;
  const { db, doc, updateDoc, increment } = await waitForFB();
  await updateDoc(doc(db,"users",uid),{spinsAvailable:increment(parseInt(amt))});
  showToast(`🎡 ${amt} spins diye`); adminUsers();
};
window.adminBlockUser = async function (uid, currentStatus) {
  const newStatus = currentStatus==="blocked"?"active":"blocked";
  const { db, doc, updateDoc } = await waitForFB();
  await updateDoc(doc(db,"users",uid),{status:newStatus});
  showToast(`User ${newStatus==="blocked"?"block":"unblock"} ho gaya`); adminUsers();
};

async function adminWithdrawals() {
  document.getElementById("admin-content").innerHTML = `<h2 class="page-title">💸 Withdrawals</h2><div class="loading-row">Loading...</div>`;
  const { db, collection, getDocs, query, orderBy, doc, updateDoc, increment } = await waitForFB();
  const snap = await getDocs(query(collection(db,"withdrawalRequests"),orderBy("createdAt","desc")));
  let html = `<h2 class="page-title">💸 Withdrawal Requests</h2>`;
  if (snap.empty) { html += `<div class="empty-state">Koi request nahi</div>`; }
  snap.docs.forEach(d => {
    const w = d.data(); const wid = d.id;
    html += `<div class="user-card">
      <div class="user-card-header">
        <div><div class="user-name">${w.userName}</div><div class="user-detail">${w.method} • ${w.account}</div><div class="user-detail">${w.date||''}</div></div>
        <div style="text-align:right"><div style="color:#fbbf24;font-weight:700;font-family:Sora;font-size:18px">💰 ${w.amount}</div>
        <span class="status-badge ${w.status?.toLowerCase()}">${w.status}</span></div>
      </div>
      ${w.status==='Pending'?`<div class="btn-row">
        <button class="btn-green" onclick="approveW('${wid}')">✅ Approve</button>
        <button class="btn-red" onclick="rejectW('${wid}','${w.uid}',${w.amount})">❌ Reject</button>
      </div>`:''}
    </div>`;
  });
  document.getElementById("admin-content").innerHTML = html;
}
window.approveW = async function(wid){const{db,doc,updateDoc}=await waitForFB();await updateDoc(doc(db,"withdrawalRequests",wid),{status:"Approved"});showToast("✅ Approved!");adminWithdrawals();};
window.rejectW = async function(wid,uid,amount){const{db,doc,updateDoc,increment}=await waitForFB();await updateDoc(doc(db,"withdrawalRequests",wid),{status:"Rejected"});await updateDoc(doc(db,"users",uid),{coins:increment(amount)});showToast("❌ Rejected — coins wapas");adminWithdrawals();};

// ---- ADMIN: BIG PRIZE CONTROL ----
async function adminIphone() {
  document.getElementById("admin-content").innerHTML = `<h2 class="page-title">📱 Big Prize Control</h2><div class="loading-row">Loading...</div>`;
  const { db, collection, getDocs, query, orderBy } = await waitForFB();
  const [claimsSnap, usersSnap] = await Promise.all([
    getDocs(query(collection(db,"iphoneClaims"), orderBy("createdAt","desc"))),
    getDocs(collection(db,"users"))
  ]);

  let html = `
    <h2 class="page-title">🎛️ Big Prize Control</h2>
    <div class="iphone-admin-info">
      <span style="font-size:36px">🎛️</span>
      <p style="margin-top:8px">
        <strong style="color:#fbbf24">Aap control karte ho</strong> ke kise wheel par <strong>iPhone 11 Pro</strong> ya <strong>5000 Coins</strong> land ho sakta hai.<br><br>
        ✅ Allow karo → us user ki agli spin mein big prize land ho sakta hai.<br>
        🔒 Lock karo → sirf 10–100 coins ya Try Again milega.
      </p>
    </div>

    <p class="section-title">👥 Users — Big Prize Permission</p>
    ${usersSnap.docs.filter(d => d.data().role !== 'admin').map(d => {
      const u = d.data(); const uid = d.id;
      const allowed = u.bigPrizeAllowed === true;
      return `<div class="user-card">
        <div class="user-card-header">
          <div>
            <div class="user-name">${u.name}</div>
            <div class="user-detail">${u.email} • 🎡 ${u.spinsAvailable||0} spins</div>
          </div>
          <span class="status-badge ${allowed?'approved':'rejected'}">${allowed?'🔓 Allowed':'🔒 Locked'}</span>
        </div>
        <div class="btn-row">
          <button class="btn-green" onclick="toggleBigPrize('${uid}', true)">🔓 Big Prize Allow</button>
          <button class="btn-red" onclick="toggleBigPrize('${uid}', false)">🔒 Lock</button>
        </div>
      </div>`;
    }).join("")}

    <p class="section-title" style="margin-top:22px">🏆 Prize Claims History</p>
    ${claimsSnap.empty ? `<div class="empty-state">Koi claim nahi abhi tak</div>` : ''}
    ${claimsSnap.docs.map(d => {
      const c = d.data(); const cid = d.id;
      const isIphone = c.prize === 'iPhone 11 Pro';
      return `<div class="user-card">
        <div class="user-card-header">
          <div>
            <div class="user-name">${isIphone?'📱':'🤑'} ${c.userName}</div>
            <div class="user-detail">${c.prize} • ${c.userEmail}</div>
          </div>
          <span class="status-badge ${c.status==='Approved'?'approved':c.status==='Rejected'?'rejected':'pending'}">${c.status}</span>
        </div>
        ${c.status==='Pending' && isIphone ? `
          <div class="btn-row" style="margin-top:10px">
            <button class="btn-green" onclick="approveIphone('${cid}','${c.uid}')">✅ iPhone De Do</button>
            <button class="btn-red" onclick="rejectIphone('${cid}','${c.uid}')">❌ Reject</button>
          </div>` : ''}
      </div>`;
    }).join("")}`;

  document.getElementById("admin-content").innerHTML = html;
}

window.toggleBigPrize = async function(uid, allow) {
  const { db, doc, updateDoc } = await waitForFB();
  await updateDoc(doc(db,"users",uid), { bigPrizeAllowed: allow });
  showToast(allow ? "🔓 Big prize allow kar diya!" : "🔒 Lock ho gaya");
  adminIphone();
};

window.approveIphone = async function(cid, uid) {
  const { db, doc, updateDoc } = await waitForFB();
  await updateDoc(doc(db,"iphoneClaims",cid), { status:"Approved" });
  await updateDoc(doc(db,"users",uid), { iPhoneWinner:true });
  showToast("✅ iPhone approved! User ko banner dikhega");
  adminIphone();
};
window.rejectIphone = async function(cid, uid) {
  const { db, doc, updateDoc } = await waitForFB();
  await updateDoc(doc(db,"iphoneClaims",cid), { status:"Rejected" });
  await updateDoc(doc(db,"users",uid), { iphonePending:false });
  showToast("❌ Reject ho gaya");
  adminIphone();
};

// ---- ADMIN: VIDEOS MANAGEMENT ----
async function adminVideos() {
  document.getElementById("admin-content").innerHTML = `
    <h2 class="page-title">▶️ Videos Management</h2>
    <p style="color:#7dd3fc;font-size:13px;margin-bottom:12px">Naye videos Firestore "videos" collection mein add karein.</p>
    <button class="btn-primary" style="margin-bottom:18px" onclick="showAddVideoForm()">+ Naya Video Add Karein</button>
    <div id="add-video-form"></div>
    ${SAMPLE_VIDEOS.map(v=>`<div class="user-card">
      <div style="display:flex;gap:12px;align-items:center">
        <span style="font-size:30px">▶️</span>
        <div style="flex:1">
          <div class="user-name">${v.title}</div>
          <div class="user-detail">${v.channel} • ${v.duration}</div>
          <div style="color:#fbbf24;font-size:13px">+${v.coins} coins</div>
        </div>
        <span class="status-badge approved">Active</span>
      </div>
    </div>`).join("")}`;
}

window.showAddVideoForm = function() {
  document.getElementById("add-video-form").innerHTML = `
    <div class="withdraw-form" style="margin-bottom:16px">
      <div class="form-group"><label class="form-label">Video Title</label><input class="form-input" id="v-title" placeholder="Video ka naam"/></div>
      <div class="form-group"><label class="form-label">YouTube URL</label><input class="form-input" id="v-url" placeholder="https://youtube.com/..."/></div>
      <div class="form-group"><label class="form-label">Coins Reward</label><input class="form-input" id="v-coins" type="number" placeholder="5"/></div>
      <button class="btn-primary" onclick="saveVideo()">Video Save Karein</button>
    </div>`;
};

window.saveVideo = async function() {
  const title = document.getElementById("v-title").value.trim();
  const url = document.getElementById("v-url").value.trim();
  const coins = parseInt(document.getElementById("v-coins").value)||5;
  if (!title||!url) { showToast("Title aur URL zaruri hain","error"); return; }
  const { db, addDoc, collection, serverTimestamp } = await waitForFB();
  await addDoc(collection(db,"videos"),{title,url,coins,active:true,createdAt:serverTimestamp()});
  showToast("✅ Video add ho gaya!"); adminVideos();
};

window.logout = logout;
