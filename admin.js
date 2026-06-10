// ===== PAISABOOM ADMIN PANEL - SUPABASE =====

const ADMIN_EMAIL = 'paisaboom.admin@gmail.com';

let adminUser = null;

// Auth check
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session?.user && session.user.email === ADMIN_EMAIL) {
    adminUser = session.user;
    showAdminPanel();
    loadDashboard();
  } else if (session?.user) {
    await supabase.auth.signOut();
    showAdminAuth();
    showAdminToast('Access denied!', 'error');
  } else {
    showAdminAuth();
  }
});

function showAdminAuth() {
  document.getElementById('adminAuth').style.display = 'flex';
  document.getElementById('adminPanel').style.display = 'none';
}
function showAdminPanel() {
  document.getElementById('adminAuth').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'flex';
}

async function adminLogin() {
  const email = document.getElementById('adminEmail').value.trim();
  const pass = document.getElementById('adminPass').value;
  const btn = document.getElementById('adminLoginBtn');
  btn.disabled = true; btn.textContent = 'Logging in...';
  const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) {
    showAdminToast('Email ya password galat hai!', 'error');
    btn.disabled = false; btn.textContent = 'Admin Login';
  }
}

async function adminLogout() {
  if (confirm('Logout karna chahte hain?')) await supabase.auth.signOut();
}

function showAdminPage(page) {
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
  document.getElementById('apage-' + page).classList.add('active');
  document.querySelector(`[data-apage="${page}"]`).classList.add('active');
  if (page === 'dashboard') loadDashboard();
  if (page === 'withdrawals') loadWithdrawals();
  if (page === 'videos') loadAdminVideos();
  if (page === 'yt') loadAdminYT();
  if (page === 'users') loadUsers();
  if (page === 'settings') loadSettings();
}

// ===== DASHBOARD =====
async function loadDashboard() {
  const [{ count: totalUsers }, { count: totalWith }, { count: pending }] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('withdrawals').select('*', { count: 'exact', head: true }),
    supabase.from('withdrawals').select('*', { count: 'exact', head: true }).eq('status', 'pending')
  ]);
  setEl('dTotalUsers', totalUsers || 0);
  setEl('dTotalWith', totalWith || 0);
  setEl('dPending', pending || 0);

  const { data: users } = await supabase.from('users').select('total_earned');
  const total = users?.reduce((s, u) => s + (u.total_earned || 0), 0) || 0;
  setEl('dTotalCoins', (total/1000).toFixed(1) + 'K');

  const { data: recent } = await supabase.from('withdrawals').select('*').order('created_at', { ascending: false }).limit(5);
  const tbody = document.getElementById('recentWithdrawals');
  tbody.innerHTML = '';
  recent?.forEach(w => {
    const date = new Date(w.created_at).toLocaleDateString('en-PK');
    tbody.innerHTML += `<tr>
      <td>${w.name || '-'}</td>
      <td>${w.method?.toUpperCase()}</td>
      <td>PKR ${w.amount}</td>
      <td>${date}</td>
      <td><span class="badge badge-${w.status}">${w.status}</span></td>
    </tr>`;
  });
}

// ===== WITHDRAWALS =====
let currentFilter = 'pending';

function filterWithdrawals(status) {
  currentFilter = status;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-filter="${status}"]`).classList.add('active');
  loadWithdrawals();
}

async function loadWithdrawals() {
  const tbody = document.getElementById('withdrawTable');
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">Load ho raha hai...</td></tr>';
  let query = supabase.from('withdrawals').select('*').order('created_at', { ascending: false }).limit(50);
  if (currentFilter !== 'all') query = query.eq('status', currentFilter);
  const { data } = await query;
  tbody.innerHTML = '';
  if (!data?.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:20px">Koi record nahi</td></tr>';
    return;
  }
  data.forEach(w => {
    const date = new Date(w.created_at).toLocaleDateString('en-PK');
    tbody.innerHTML += `<tr>
      <td><div style="font-weight:600">${w.name}</div><div style="font-size:11px;color:var(--muted)">${w.email}</div></td>
      <td>${w.method?.toUpperCase()}<br><span style="font-size:11px;color:var(--muted)">${w.account_number}</span></td>
      <td style="font-weight:700">PKR ${w.amount}</td>
      <td>${w.coins_used} 🪙</td>
      <td>${date}</td>
      <td>${w.status === 'pending' ? `
        <div class="btn-group">
          <button class="admin-btn-sm" onclick="updateWithdrawal('${w.id}','${w.uid}','approved')">✓ Approve</button>
          <button class="admin-btn-danger" onclick="updateWithdrawal('${w.id}','${w.uid}','rejected',${w.coins_used})">✗ Reject</button>
        </div>` : `<span class="badge badge-${w.status}">${w.status}</span>`}
      </td>
    </tr>`;
  });
}

async function updateWithdrawal(wId, uid, status, refundCoins = 0) {
  await supabase.from('withdrawals').update({ status }).eq('id', wId);
  if (status === 'rejected' && refundCoins > 0) {
    const { data: user } = await supabase.from('users').select('coins').eq('id', uid).single();
    if (user) await supabase.from('users').update({ coins: (user.coins || 0) + refundCoins }).eq('id', uid);
  }
  showAdminToast(`✅ ${status === 'approved' ? 'Approved' : 'Rejected'}!`);
  loadWithdrawals(); loadDashboard();
}

// ===== VIDEOS =====
async function loadAdminVideos() {
  const container = document.getElementById('videoListAdmin');
  container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">Load ho raha hai...</p>';
  const { data } = await supabase.from('videos').select('*').order('created_at', { ascending: false });
  container.innerHTML = '';
  if (!data?.length) { container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">Koi video nahi</p>'; return; }
  data.forEach(v => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px;background:var(--card2);border:1px solid var(--border);border-radius:10px;margin-bottom:8px';
    div.innerHTML = `
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px">${v.title}</div>
        <div style="font-size:11px;color:var(--muted)">${v.url}</div>
        <div style="font-size:12px;color:var(--primary)">+${v.coins} Coins • ${v.active ? '✅ Active' : '❌ Hidden'}</div>
      </div>
      <div class="btn-group">
        <button class="admin-btn-warning" onclick="toggleVideo('${v.id}',${v.active})">${v.active ? 'Hide' : 'Show'}</button>
        <button class="admin-btn-danger" onclick="deleteVideo('${v.id}')">Delete</button>
      </div>`;
    container.appendChild(div);
  });
}

async function addVideo() {
  const title = document.getElementById('vTitle').value.trim();
  const url = document.getElementById('vUrl').value.trim();
  const coins = parseInt(document.getElementById('vCoins').value) || 100;
  const thumbnail = document.getElementById('vThumb').value.trim();
  if (!title || !url) return showAdminToast('Title aur URL daalen!', 'error');
  await supabase.from('videos').insert({ title, url, coins, thumbnail, active: true });
  document.getElementById('vTitle').value = '';
  document.getElementById('vUrl').value = '';
  document.getElementById('vThumb').value = '';
  showAdminToast('✅ Video add ho gayi!');
  loadAdminVideos();
}

async function toggleVideo(id, active) {
  await supabase.from('videos').update({ active: !active }).eq('id', id);
  showAdminToast('Updated!'); loadAdminVideos();
}

async function deleteVideo(id) {
  if (!confirm('Delete karna chahte hain?')) return;
  await supabase.from('videos').delete().eq('id', id);
  showAdminToast('Deleted!'); loadAdminVideos();
}

// ===== YT CHANNELS =====
async function loadAdminYT() {
  const container = document.getElementById('ytListAdmin');
  container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">Load ho raha hai...</p>';
  const { data } = await supabase.from('yt_channels').select('*').order('created_at', { ascending: false });
  container.innerHTML = '';
  if (!data?.length) { container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">Koi channel nahi</p>'; return; }
  data.forEach(ch => {
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px;background:var(--card2);border:1px solid var(--border);border-radius:10px;margin-bottom:8px';
    div.innerHTML = `
      <div style="font-size:24px">📺</div>
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px">${ch.name}</div>
        <div style="font-size:11px;color:var(--muted)">${ch.url}</div>
        <div style="font-size:12px;color:var(--primary)">+${ch.coins} Coins • ${ch.active ? '✅ Active' : '❌ Hidden'}</div>
      </div>
      <div class="btn-group">
        <button class="admin-btn-warning" onclick="toggleYT('${ch.id}',${ch.active})">${ch.active ? 'Hide' : 'Show'}</button>
        <button class="admin-btn-danger" onclick="deleteYT('${ch.id}')">Delete</button>
      </div>`;
    container.appendChild(div);
  });
}

async function addYTChannel() {
  const name = document.getElementById('ytName').value.trim();
  const url = document.getElementById('ytUrl').value.trim();
  const coins = parseInt(document.getElementById('ytCoins').value) || 150;
  if (!name || !url) return showAdminToast('Name aur URL daalen!', 'error');
  await supabase.from('yt_channels').insert({ name, url, coins, active: true });
  document.getElementById('ytName').value = '';
  document.getElementById('ytUrl').value = '';
  showAdminToast('✅ Channel add ho gaya!');
  loadAdminYT();
}

async function toggleYT(id, active) {
  await supabase.from('yt_channels').update({ active: !active }).eq('id', id);
  showAdminToast('Updated!'); loadAdminYT();
}

async function deleteYT(id) {
  if (!confirm('Delete?')) return;
  await supabase.from('yt_channels').delete().eq('id', id);
  showAdminToast('Deleted!'); loadAdminYT();
}

// ===== USERS =====
async function loadUsers() {
  const tbody = document.getElementById('usersTable');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">Load ho raha hai...</td></tr>';
  const { data } = await supabase.from('users').select('*').order('total_earned', { ascending: false }).limit(50);
  tbody.innerHTML = '';
  data?.forEach(u => {
    const date = new Date(u.created_at).toLocaleDateString('en-PK');
    tbody.innerHTML += `<tr>
      <td><div style="font-weight:600">${u.name}</div><div style="font-size:11px;color:var(--muted)">${u.email}</div></td>
      <td style="color:var(--accent);font-weight:700">${u.coins || 0} 🪙</td>
      <td>${u.referral_count || 0}</td>
      <td>${date}</td>
      <td><button class="admin-btn-sm" onclick="addCoinsToUser('${u.id}','${u.name}',${u.coins||0})">+ Coins</button></td>
    </tr>`;
  });
}

async function addCoinsToUser(uid, name, currentCoins) {
  const coins = parseInt(prompt(`${name} ko kitne coins dene hain?`));
  if (!coins || isNaN(coins)) return;
  await supabase.from('users').update({ coins: currentCoins + coins, total_earned: supabase.rpc ? currentCoins + coins : currentCoins + coins }).eq('id', uid);
  showAdminToast(`✅ ${coins} coins ${name} ko diye!`);
  loadUsers();
}

async function searchUser() {
  const q = document.getElementById('userSearch').value.trim();
  if (!q) return loadUsers();
  const tbody = document.getElementById('usersTable');
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Searching...</td></tr>';
  const { data } = await supabase.from('users').select('*')
    .or(`name.ilike.%${q}%,email.ilike.%${q}%`).limit(20);
  tbody.innerHTML = '';
  data?.forEach(u => {
    tbody.innerHTML += `<tr>
      <td><div style="font-weight:600">${u.name}</div><div style="font-size:11px;color:var(--muted)">${u.email}</div></td>
      <td style="color:var(--accent);font-weight:700">${u.coins || 0} 🪙</td>
      <td>${u.referral_count || 0}</td>
      <td>-</td>
      <td><button class="admin-btn-sm" onclick="addCoinsToUser('${u.id}','${u.name}',${u.coins||0})">+ Coins</button></td>
    </tr>`;
  });
}

// ===== SETTINGS =====
async function loadSettings() {
  const { data } = await supabase.from('settings').select('*').eq('id', 'app').single();
  if (!data) return;
  document.getElementById('withdrawLockToggle').checked = data.withdraw_locked || false;
  document.getElementById('lockMessageInput').value = data.lock_message || '';
  document.getElementById('minCoinsInput').value = data.min_coins || 500;
  document.getElementById('coinRateInput').value = data.coin_rate || 10;
  document.getElementById('spinCooldownInput').value = data.spin_cooldown || 24;
}

async function saveSettings() {
  const settings = {
    withdraw_locked: document.getElementById('withdrawLockToggle').checked,
    lock_message: document.getElementById('lockMessageInput').value,
    min_coins: parseInt(document.getElementById('minCoinsInput').value) || 500,
    coin_rate: parseInt(document.getElementById('coinRateInput').value) || 10,
    spin_cooldown: parseInt(document.getElementById('spinCooldownInput').value) || 24,
    updated_at: new Date().toISOString()
  };
  await supabase.from('settings').upsert({ id: 'app', ...settings });
  showAdminToast('✅ Settings save ho gayi!');
}

async function toggleWithdrawLock() {
  const locked = document.getElementById('withdrawLockToggle').checked;
  await supabase.from('settings').upsert({ id: 'app', withdraw_locked: locked });
  showAdminToast(`Withdrawal ${locked ? '🔒 Lock' : '🔓 Unlock'} ho gaya!`);
}

// ===== HELPERS =====
function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function showAdminToast(msg, type = 'success') {
  const toast = document.getElementById('adminToast');
  toast.textContent = msg;
  toast.style.background = type === 'error' ? 'var(--danger)' : 'var(--primary)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
