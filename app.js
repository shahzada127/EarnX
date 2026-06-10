// ===== PAISABOOM - SUPABASE APP JS =====

let currentUser = null;
let userData = null;

// ===== AUTH STATE =====
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    currentUser = session.user;
    await loadUserData();
    showApp();
  } else {
    currentUser = null;
    userData = null;
    showAuth();
  }
});

// ===== LOAD USER DATA =====
async function loadUserData() {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (error || !data) {
      const refCode = generateRefCode();
      const newUser = {
        id: currentUser.id,
        name: currentUser.user_metadata?.name || 'PaisaBoom User',
        email: currentUser.email,
        coins: 0,
        total_earned: 0,
        referral_code: refCode,
        referred_by: null,
        referral_count: 0,
        referral_earnings: 0,
        last_check_in: null,
        check_in_streak: 0,
        tasks_completed: [],
        videos_watched: [],
        last_spin: null,
      };
      await supabase.from('users').insert(newUser);
      userData = newUser;
    } else {
      userData = data;
    }
    updateUI();
  } catch (e) {
    console.error('loadUserData error:', e);
  }
}

// ===== UPDATE UI =====
function updateUI() {
  if (!userData) return;
  document.querySelectorAll('.user-coins').forEach(el => el.textContent = formatCoins(userData.coins));
  setEl('balanceCoins', formatCoins(userData.coins));
  setEl('balancePKR', coinsToPKR(userData.coins));
  setEl('statCoins', formatCoins(userData.total_earned || 0));
  setEl('statRefs', userData.referral_count || 0);
  setEl('statStreak', userData.check_in_streak || 0);
  setEl('profileName', userData.name || 'User');
  setEl('profileEmail', userData.email || '');
  setEl('profileCoins', formatCoins(userData.coins));
  setEl('refCode', userData.referral_code || '');
  setEl('refCount', userData.referral_count || 0);
  setEl('refEarn', formatCoins(userData.referral_earnings || 0));
  loadTasks();
  loadCheckIn();
  loadWithdrawStatus();
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ===== NAVIGATION =====
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  if (page === 'earn') loadVideos();
  if (page === 'spin') initWheel();
  if (page === 'wallet') loadWithdrawHistory();
}

function showAuth() {
  document.getElementById('authView').style.display = 'flex';
  document.getElementById('appView').style.display = 'none';
  showLoginForm();
}

function showApp() {
  document.getElementById('authView').style.display = 'none';
  document.getElementById('appView').style.display = 'flex';
  showPage('home');
}

function showLoginForm() {
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('registerForm').style.display = 'none';
}

function showRegisterForm() {
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('registerForm').style.display = 'block';
}

// ===== LOGIN =====
async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;
  const btn = document.getElementById('loginBtn');
  if (!email || !pass) return showToast('Email aur password daalen', 'error');
  btn.textContent = 'Logging in...'; btn.disabled = true;
  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) {
    showToast(getAuthError(error.message), 'error');
    btn.textContent = 'Login Karen'; btn.disabled = false;
  }
}

// ===== REGISTER =====
async function doRegister() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pass = document.getElementById('regPass').value;
  const refBy = document.getElementById('regRef').value.trim().toUpperCase();
  const btn = document.getElementById('registerBtn');
  if (!name || !email || !pass) return showToast('Sari fields bharen', 'error');
  if (pass.length < 6) return showToast('Password 6+ characters', 'error');
  btn.textContent = 'Creating...'; btn.disabled = true;

  const { data, error } = await supabase.auth.signUp({
    email, password: pass,
    options: { data: { name } }
  });

  if (error) {
    showToast(getAuthError(error.message), 'error');
    btn.textContent = 'Account Banayein'; btn.disabled = false;
    return;
  }

  // Handle referral
  if (refBy && data.user) {
    const { data: refUser } = await supabase
      .from('users').select('id').eq('referral_code', refBy).single();
    if (refUser) {
      await supabase.from('users').update({
        referral_count: supabase.rpc ? undefined : undefined,
        coins: supabase.rpc ? undefined : undefined,
      }).eq('id', refUser.id);
      // Use RPC for atomic increment
      await supabase.rpc('increment_referral', { user_id: refUser.id, bonus: 500 });
    }
  }
}

// ===== TASKS =====
const TASKS = [
  { id: 'visit_daily', icon: '📱', name: 'Daily App Visit', nameUr: 'روزانہ آئیں', reward: 50 },
  { id: 'profile_complete', icon: '👤', name: 'Complete Profile', nameUr: 'پروفائل مکمل کریں', reward: 200 },
  { id: 'share_app', icon: '📢', name: 'Share App', nameUr: 'ایپ شیئر کریں', reward: 100 },
  { id: 'watch_3_videos', icon: '🎬', name: 'Watch 3 Videos', nameUr: '3 ویڈیوز دیکھیں', reward: 150 },
  { id: 'first_withdraw', icon: '💸', name: 'Submit Withdrawal', nameUr: 'پہلی وتھڈرال', reward: 100 },
];

function loadTasks() {
  const container = document.getElementById('tasksList');
  if (!container || !userData) return;
  container.innerHTML = '';
  const completed = userData.tasks_completed || [];
  TASKS.forEach(task => {
    const done = completed.includes(task.id);
    const div = document.createElement('div');
    div.className = 'task-item';
    div.innerHTML = `
      <div class="task-icon">${task.icon}</div>
      <div class="task-info">
        <div class="task-name">${task.name}</div>
        <div style="font-size:11px;color:var(--muted)">${task.nameUr}</div>
        <div class="task-reward">+${task.reward} Coins</div>
      </div>
      <button class="task-btn ${done ? 'done' : ''}" onclick="completeTask('${task.id}', ${task.reward})" ${done ? 'disabled' : ''}>
        ${done ? '✓ Done' : 'Karo'}
      </button>`;
    container.appendChild(div);
  });
}

async function completeTask(taskId, reward) {
  if (!userData || (userData.tasks_completed || []).includes(taskId)) return;
  const newTasks = [...(userData.tasks_completed || []), taskId];
  const { error } = await supabase.from('users').update({
    tasks_completed: newTasks,
    coins: (userData.coins || 0) + reward,
    total_earned: (userData.total_earned || 0) + reward
  }).eq('id', currentUser.id);
  if (!error) {
    userData.tasks_completed = newTasks;
    userData.coins += reward;
    userData.total_earned = (userData.total_earned || 0) + reward;
    showRewardModal(reward, 'Task Complete!', '🎯');
    updateUI();
  }
}

// ===== CHECK-IN =====
const CHECK_IN_REWARDS = [50, 75, 100, 125, 150, 200, 300];

function loadCheckIn() {
  const container = document.getElementById('checkinDays');
  if (!container || !userData) return;
  const streak = userData.check_in_streak || 0;
  const lastCheck = userData.last_check_in ? new Date(userData.last_check_in) : null;
  const today = new Date(); today.setHours(0,0,0,0);
  const lastDay = lastCheck ? new Date(lastCheck) : null;
  if (lastDay) lastDay.setHours(0,0,0,0);
  const checkedToday = lastDay && lastDay.getTime() === today.getTime();

  container.innerHTML = '';
  CHECK_IN_REWARDS.forEach((coins, i) => {
    const claimed = i < streak;
    const isToday = i === streak && !checkedToday;
    const div = document.createElement('div');
    div.className = `day-box ${claimed ? 'claimed' : ''} ${isToday ? 'today' : ''}`;
    div.innerHTML = `<span>${claimed ? '✓' : `D${i+1}`}</span><span class="day-coins">${coins}</span>`;
    container.appendChild(div);
  });

  const btn = document.getElementById('checkinBtn');
  if (btn) {
    btn.disabled = checkedToday;
    btn.textContent = checkedToday ? '✓ Aaj Ho Gaya' : '🎁 Check-in Karen';
  }
}

async function doCheckIn() {
  if (!userData) return;
  const lastCheck = userData.last_check_in ? new Date(userData.last_check_in) : null;
  const today = new Date(); today.setHours(0,0,0,0);
  if (lastCheck) {
    const ld = new Date(lastCheck); ld.setHours(0,0,0,0);
    if (ld.getTime() === today.getTime()) return;
  }
  const streak = (userData.check_in_streak || 0) % 7;
  const reward = CHECK_IN_REWARDS[streak];
  const { error } = await supabase.from('users').update({
    last_check_in: new Date().toISOString(),
    check_in_streak: (userData.check_in_streak || 0) + 1,
    coins: (userData.coins || 0) + reward,
    total_earned: (userData.total_earned || 0) + reward
  }).eq('id', currentUser.id);
  if (!error) {
    userData.last_check_in = new Date().toISOString();
    userData.check_in_streak = (userData.check_in_streak || 0) + 1;
    userData.coins += reward;
    userData.total_earned = (userData.total_earned || 0) + reward;
    showRewardModal(reward, 'Check-in Mubarak!', '🎁');
    updateUI();
  }
}

// ===== VIDEOS =====
async function loadVideos() {
  const container = document.getElementById('videosList');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">Load ho rahi hain...</p>';
  const { data: videos, error } = await supabase
    .from('videos').select('*').eq('active', true).order('created_at', { ascending: false });
  if (error || !videos?.length) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">📺 Abhi koi video nahi</p>';
    return;
  }
  container.innerHTML = '';
  const watched = userData.videos_watched || [];
  videos.forEach(v => {
    const isWatched = watched.includes(v.id);
    const thumb = v.thumbnail || `https://img.youtube.com/vi/${getYTId(v.url)}/mqdefault.jpg`;
    const div = document.createElement('div');
    div.className = 'video-item';
    div.innerHTML = `
      <div class="video-thumb" onclick="window.open('${v.url}','_blank')">
        <img src="${thumb}" alt="video" onerror="this.style.display='none';this.parentElement.innerHTML='▶️'">
      </div>
      <div class="video-info">
        <div class="video-title">${v.title}</div>
        <div class="video-reward">+${v.coins} Coins</div>
      </div>
      <button class="video-btn ${isWatched ? 'watched' : ''}" onclick="claimVideo('${v.id}', ${v.coins})" ${isWatched ? 'disabled' : ''}>
        ${isWatched ? '✓' : 'Claim'}
      </button>`;
    container.appendChild(div);
  });
  await loadYTSubscribes(watched);
}

async function loadYTSubscribes(watched) {
  const container = document.getElementById('ytSubsList');
  if (!container) return;
  const { data: channels } = await supabase.from('yt_channels').select('*').eq('active', true);
  if (!channels?.length) { container.innerHTML = ''; return; }
  container.innerHTML = `<div class="card-title">📺 YouTube Subscribe</div>`;
  channels.forEach(ch => {
    const done = watched.includes('yt_' + ch.id);
    const div = document.createElement('div');
    div.className = 'task-item';
    div.innerHTML = `
      <div class="task-icon">📺</div>
      <div class="task-info">
        <div class="task-name">${ch.name}</div>
        <div class="task-reward">+${ch.coins} Coins</div>
      </div>
      <button class="task-btn ${done ? 'done' : ''}" onclick="subscribeYT('${ch.id}','${ch.url}',${ch.coins})" ${done ? 'disabled' : ''}>
        ${done ? '✓ Done' : 'Subscribe'}
      </button>`;
    container.appendChild(div);
  });
}

async function claimVideo(videoId, coins) {
  if (!userData || (userData.videos_watched || []).includes(videoId)) return;
  const newWatched = [...(userData.videos_watched || []), videoId];
  const { error } = await supabase.from('users').update({
    videos_watched: newWatched,
    coins: (userData.coins || 0) + coins,
    total_earned: (userData.total_earned || 0) + coins
  }).eq('id', currentUser.id);
  if (!error) {
    userData.videos_watched = newWatched;
    userData.coins += coins;
    userData.total_earned = (userData.total_earned || 0) + coins;
    showRewardModal(coins, 'Video Dekhi!', '🎬');
    updateUI(); loadVideos();
  }
}

async function subscribeYT(channelId, url, coins) {
  window.open(url, '_blank');
  const key = 'yt_' + channelId;
  if ((userData.videos_watched || []).includes(key)) return;
  setTimeout(async () => {
    const newWatched = [...(userData.videos_watched || []), key];
    const { error } = await supabase.from('users').update({
      videos_watched: newWatched,
      coins: (userData.coins || 0) + coins,
      total_earned: (userData.total_earned || 0) + coins
    }).eq('id', currentUser.id);
    if (!error) {
      userData.videos_watched = newWatched;
      userData.coins += coins;
      userData.total_earned = (userData.total_earned || 0) + coins;
      showRewardModal(coins, 'Subscribe Ho Gaye!', '📺');
      updateUI();
    }
  }, 3000);
}

// ===== SPIN WHEEL =====
const SPIN_PRIZES = [
  { label: '50', coins: 50, color: '#1B5E20' },
  { label: '200', coins: 200, color: '#FFD600', textColor: '#1a1a1a' },
  { label: '100', coins: 100, color: '#1B5E20' },
  { label: 'Try Again', coins: 0, color: '#1A2235' },
  { label: '500', coins: 500, color: '#FF8F00', textColor: '#1a1a1a' },
  { label: '75', coins: 75, color: '#1B5E20' },
  { label: '150', coins: 150, color: '#004D40' },
  { label: 'Try Again', coins: 0, color: '#1A2235' },
];

let wheelAngle = 0;
let wheelInitialized = false;

function initWheel() {
  if (wheelInitialized) return;
  drawWheel(0); wheelInitialized = true;
}

function drawWheel(rotation) {
  const canvas = document.getElementById('spinWheel');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = 130, cy = 130, r = 125;
  const arc = (2 * Math.PI) / SPIN_PRIZES.length;
  ctx.clearRect(0, 0, 260, 260);
  SPIN_PRIZES.forEach((prize, i) => {
    const angle = rotation + i * arc;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + arc); ctx.closePath();
    ctx.fillStyle = prize.color; ctx.fill();
    ctx.strokeStyle = '#0A0F1A'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle + arc / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = prize.textColor || '#fff';
    ctx.font = 'bold 13px Poppins, sans-serif';
    ctx.fillText(prize.label === 'Try Again' ? '😢' : `🪙${prize.label}`, r - 10, 5);
    ctx.restore();
  });
  ctx.beginPath(); ctx.arc(cx, cy, 18, 0, 2 * Math.PI);
  ctx.fillStyle = '#0A0F1A'; ctx.fill();
  ctx.strokeStyle = '#00C853'; ctx.lineWidth = 3; ctx.stroke();
}

async function doSpin() {
  if (!userData) return;
  const lastSpin = userData.last_spin ? new Date(userData.last_spin) : null;
  const today = new Date(); today.setHours(0,0,0,0);
  if (lastSpin) {
    const ls = new Date(lastSpin); ls.setHours(0,0,0,0);
    if (ls.getTime() === today.getTime()) return showToast('Kal wapis aayen! 😊', 'info');
  }
  const btn = document.getElementById('spinBtn');
  btn.disabled = true; btn.textContent = '⏳ Spinning...';
  const prizeIndex = Math.floor(Math.random() * SPIN_PRIZES.length);
  const arc = 360 / SPIN_PRIZES.length;
  const targetAngle = 360 * 5 + (360 - prizeIndex * arc - arc / 2);
  const totalRotation = wheelAngle + targetAngle;
  let start = null;
  const duration = 4000;
  const startAngle = wheelAngle;
  function easeOut(t) { return 1 - Math.pow(1-t, 3); }
  function animate(ts) {
    if (!start) start = ts;
    const elapsed = ts - start;
    const progress = Math.min(elapsed / duration, 1);
    const current = startAngle + (totalRotation - startAngle) * easeOut(progress);
    drawWheel((current * Math.PI) / 180);
    if (progress < 1) requestAnimationFrame(animate);
    else { wheelAngle = totalRotation % 360; handleSpinResult(SPIN_PRIZES[prizeIndex]); }
  }
  requestAnimationFrame(animate);
}

async function handleSpinResult(prize) {
  const btn = document.getElementById('spinBtn');
  const updates = { last_spin: new Date().toISOString() };
  if (prize.coins > 0) {
    updates.coins = (userData.coins || 0) + prize.coins;
    updates.total_earned = (userData.total_earned || 0) + prize.coins;
  }
  await supabase.from('users').update(updates).eq('id', currentUser.id);
  userData.last_spin = new Date().toISOString();
  if (prize.coins > 0) {
    userData.coins += prize.coins;
    userData.total_earned = (userData.total_earned || 0) + prize.coins;
    showRewardModal(prize.coins, 'Spin Jeeta!', '🎰');
  } else {
    showToast('Agli baar acha hoga! 😅', 'info');
  }
  updateUI();
  btn.disabled = false; btn.textContent = '🎰 Spin Karen';
}

// ===== WITHDRAWAL =====
let selectedMethod = null;
let selectedAmount = null;

async function loadWithdrawStatus() {
  const locked = document.getElementById('withdrawLocked');
  const form = document.getElementById('withdrawForm');
  if (!locked || !form) return;
  const { data } = await supabase.from('settings').select('*').eq('id', 'app').single();
  if (data?.withdraw_locked) {
    locked.style.display = 'block'; form.style.display = 'none';
    const msg = document.getElementById('lockMsg');
    if (msg) msg.textContent = data.lock_message || 'Withdrawal abhi band hai.';
  } else {
    locked.style.display = 'none'; form.style.display = 'block';
  }
}

function selectMethod(method) {
  selectedMethod = method;
  document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-method="${method}"]`).classList.add('active');
}

function selectAmount(amt) {
  selectedAmount = amt;
  document.querySelectorAll('.amount-opt').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-amount="${amt}"]`).classList.add('active');
}

async function submitWithdraw() {
  if (!selectedMethod) return showToast('Payment method choose karen', 'error');
  if (!selectedAmount) return showToast('Amount choose karen', 'error');
  const accountNum = document.getElementById('accountNum').value.trim();
  if (!accountNum) return showToast('Account number daalen', 'error');
  const minCoins = selectedAmount * 10;
  if ((userData.coins || 0) < minCoins) return showToast(`${minCoins} coins chahiye!`, 'error');
  const btn = document.getElementById('withdrawBtn');
  btn.disabled = true; btn.textContent = 'Submitting...';
  const { error } = await supabase.from('withdrawals').insert({
    uid: currentUser.id,
    name: userData.name,
    email: userData.email,
    method: selectedMethod,
    amount: selectedAmount,
    coins_used: minCoins,
    account_number: accountNum,
    status: 'pending'
  });
  if (!error) {
    await supabase.from('users').update({ coins: userData.coins - minCoins }).eq('id', currentUser.id);
    userData.coins -= minCoins;
    updateUI();
    showToast('✅ Request submit ho gayi!');
    document.getElementById('accountNum').value = '';
    if (!(userData.tasks_completed || []).includes('first_withdraw')) {
      await completeTask('first_withdraw', 100);
    }
  } else {
    showToast('Error! Try again', 'error');
  }
  btn.disabled = false; btn.textContent = 'Request Karen';
}

async function loadWithdrawHistory() {
  const container = document.getElementById('withdrawHistory');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">Load ho raha hai...</p>';
  const { data, error } = await supabase.from('withdrawals')
    .select('*').eq('uid', currentUser.id).order('created_at', { ascending: false }).limit(10);
  if (!data?.length) {
    container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">💸 Koi request nahi</p>';
    return;
  }
  container.innerHTML = '';
  const icons = { jazzcash: '📱', easypaisa: '💚', bank: '🏦' };
  data.forEach(w => {
    const date = new Date(w.created_at).toLocaleDateString('en-PK');
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <div class="history-icon">${icons[w.method] || '💸'}</div>
      <div class="history-info">
        <div class="hi-method">${w.method.toUpperCase()} • ${w.account_number}</div>
        <div class="hi-date">${date}</div>
      </div>
      <div>
        <div class="history-amount">PKR ${w.amount}</div>
        <span class="history-status status-${w.status}">${w.status === 'pending' ? 'Pending' : w.status === 'approved' ? '✓ Approved' : '✗ Rejected'}</span>
      </div>`;
    container.appendChild(div);
  });
}

// ===== REFERRAL =====
function copyRefCode() {
  const code = userData?.referral_code || '';
  navigator.clipboard.writeText(`PaisaBoom se coins kamao! Code: ${code}\nhttps://paisaboom.vercel.app`)
    .then(() => showToast('✅ Copy ho gaya!'));
}

function shareApp() {
  const code = userData?.referral_code || '';
  const text = `PaisaBoom se paise kamao! Tasks, videos, spin aur withdraw! Code: ${code}`;
  if (navigator.share) navigator.share({ title: 'PaisaBoom', text, url: 'https://paisaboom.vercel.app' });
  else navigator.clipboard.writeText(text).then(() => showToast('✅ Copy ho gaya!'));
}

// ===== LOGOUT =====
async function doLogout() {
  await supabase.auth.signOut();
}

// ===== MODAL =====
function showRewardModal(coins, title, icon) {
  document.getElementById('modalIcon').textContent = icon;
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalCoins').textContent = `+${coins} Coins 🪙`;
  document.getElementById('rewardModal').classList.add('show');
}
function closeModal() { document.getElementById('rewardModal').classList.remove('show'); }

// ===== TOAST =====
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.style.background = type === 'error' ? 'var(--danger)' : type === 'info' ? '#1565C0' : 'var(--primary)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ===== HELPERS =====
function generateRefCode() { return Math.random().toString(36).substring(2,8).toUpperCase(); }
function formatCoins(n) { return n >= 1000 ? (n/1000).toFixed(1)+'K' : Math.floor(n).toString(); }
function coinsToPKR(coins) { return (coins/10).toFixed(0); }
function getYTId(url) { const m = url?.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/); return m ? m[1] : ''; }
function getAuthError(msg) {
  if (msg.includes('Invalid login')) return 'Email ya password galat hai';
  if (msg.includes('already registered')) return 'Email pehle se registered hai';
  if (msg.includes('weak')) return 'Password strong rakhen';
  return 'Koi error aayi. Try again karen.';
}
