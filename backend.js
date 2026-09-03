
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}
function playSfx(freqStart, freqEnd, type, duration, vol) {
    if (!audioCtx) return;
    try {
        let osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freqStart, audioCtx.currentTime);
        if(freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, audioCtx.currentTime + duration);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + duration);
    } catch(e){}
}


function showToast(msg, isSuccess = false) {
    const toast = document.getElementById('toastMsg');
    toast.innerText = msg;
    if (isSuccess) toast.classList.add('toast-success');
    else toast.classList.remove('toast-success');
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function formatDist(d) {
    if (d >= 1000) {
        let km = (d / 1000).toFixed(1);
        return (km.endsWith('.0') ? km.slice(0, -2) : km) + "km";
    }
    return d + "m";
}

function lerpColor(c1, c2, t) {
    const hex2rgb = c => [parseInt(c.slice(1,3),16), parseInt(c.slice(3,5),16), parseInt(c.slice(5,7),16)];
    const [r1, g1, b1] = hex2rgb(c1);
    const [r2, g2, b2] = hex2rgb(c2);
    const r = Math.round(r1 + (r2 - r1)*t);
    const g = Math.round(g1 + (g2 - g1)*t);
    const b = Math.round(b1 + (b2 - b1)*t);
    return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}


let totalCoins = parseInt(localStorage.getItem('edward_total_coins')) || 0;
let runCoins = 0; 
let ownedSkins = JSON.parse(localStorage.getItem('edward_owned_skins')) || ['default'];
let selectedSkin = localStorage.getItem('edward_selected_skin') || 'default';
let highDistance = parseInt(localStorage.getItem('edward_high_dist')) || 0;
let gameMode = 'normal';

document.getElementById('loginHighScore').innerText = formatDist(highDistance);

const skinsData = [
    { id: 'default', name: 'Default', price: 0 },
    { id: 'ninja', name: 'Ninja', price: 100 },
    { id: 'spongebob', name: 'Spongebob', price: 150 },
    { id: 'patrick', name: 'Patrick', price: 150 },
    { id: 'mario', name: 'Mario', price: 200 },
    { id: 'luigi', name: 'Luigi', price: 200 },
    { id: 'pikachu', name: 'Pikachu', price: 250 },
    { id: 'zombie', name: 'Zombie', price: 250 },
    { id: 'astronaut', name: 'Astronaut', price: 300 },
    { id: 'batman', name: 'Batman', price: 350 },
    { id: 'superman', name: 'Superman', price: 350 },
    { id: 'spiderman', name: 'Spider-Man', price: 400 },
    { id: 'ironman', name: 'Iron Man', price: 450 },
    { id: 'amongus', name: 'Among Us', price: 150 },
    { id: 'angrybird', name: 'Angry Bird', price: 150 },
    { id: 'creeper', name: 'Creeper', price: 180 },
    { id: 'minion', name: 'Minion', price: 200 },
    { id: 'shinchan', name: 'Shinchan', price: 220 },
    { id: 'doraemon', name: 'Doraemon', price: 250 },
    { id: 'skeleton', name: 'Skeleton', price: 250 },
    { id: 'pirate', name: 'Bajak Laut', price: 280 },
    { id: 'naruto', name: 'Naruto', price: 300 },
    { id: 'robot', name: 'Robot', price: 320 },
    { id: 'vampire', name: 'Vampire', price: 320 },
    { id: 'wizard', name: 'Wizard', price: 350 },
    { id: 'knight', name: 'Ksatria', price: 380 },
    { id: 'flash', name: 'Flash', price: 400 },
    { id: 'deadpool', name: 'Deadpool', price: 420 },
    { id: 'capamerica', name: 'Captain America', price: 420 },
    { id: 'thor', name: 'Thor', price: 450 },
    { id: 'goku', name: 'Goku', price: 480 },
    { id: 'hulk', name: 'Hulk', price: 480 },
    { id: 'venom', name: 'Venom', price: 550 },
    { id: 'bbb_biasa', name: 'Boboiboy', price: 500 },
    { id: 'bbb_petir', name: 'BBB Petir', price: 700 },
    { id: 'bbb_angin', name: 'BBB Angin', price: 700 },
    { id: 'bbb_tanah', name: 'BBB Tanah', price: 700 },
    { id: 'bbb_daun', name: 'BBB Daun', price: 750 },
    { id: 'bbb_api', name: 'BBB Api', price: 800 },
    { id: 'bbb_air', name: 'BBB Air', price: 800 },
    { id: 'bbb_cahaya', name: 'BBB Cahaya', price: 900 },
    { id: 'bbb_halilintar', name: 'Halilintar', price: 1200 },
    { id: 'bbb_taufan', name: 'BBB Taufan', price: 1200 },
    { id: 'bbb_gempa', name: 'BBB Gempa', price: 1200 },
    { id: 'bbb_blaze', name: 'BBB Blaze', price: 1400 },
    { id: 'bbb_ice', name: 'BBB Ice', price: 1400 },
    { id: 'bbb_solar', name: 'BBB Solar', price: 1800 },
    { id: 'bbb_frostfire', name: 'Frostfire', price: 1900 },
    { id: 'bbb_supra', name: 'BBB Supra', price: 2000 }
];

function getAuraColors(skinId, baseColor) {
    switch(skinId) {
        case 'bbb_biasa': return { p: '#ff5722', s: '#ffaa00' };
        case 'bbb_petir': return { p: '#facc15', s: '#ffffff' };
        case 'bbb_angin': return { p: '#38bdf8', s: '#e0f2fe' };
        case 'bbb_tanah': return { p: '#b45309', s: '#78350f' };
        case 'bbb_daun': return { p: '#4ade80', s: '#16a34a' };
        case 'bbb_api': return { p: '#ff4500', s: '#ff2200' };
        case 'bbb_air': return { p: '#06b6d4', s: '#67e8f9' };
        case 'bbb_cahaya': return { p: '#fef08a', s: '#ffffff' };
        case 'bbb_halilintar': return { p: '#dc2626', s: '#ff0055' };
        case 'bbb_taufan': return { p: '#0288d1', s: '#00ffff' };
        case 'bbb_gempa': return { p: '#d97706', s: '#b45309' };
        case 'bbb_blaze': return { p: '#ea580c', s: '#ff3d00' };
        case 'bbb_ice': return { p: '#a5f3fc', s: '#0288d1' };
        case 'bbb_solar': return { p: '#facc15', s: '#ffffff' };
        case 'bbb_frostfire': return { p: '#ff4500', s: '#00ffff' };
        case 'bbb_supra': return { p: '#c084fc', s: '#ffffff' };
        default: return { p: 'transparent', s: 'transparent' };
    }
}

function updateMenuCoins() {
    document.getElementById('menuCoinsDisplay').innerText = `TOTAL KOIN: ${totalCoins} 🪙`;
    document.getElementById('shopTotalCoins').innerText = `${totalCoins} 🪙`;
}

function renderSkinPreview(canvas, skinId, baseColor) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height - 10);
    const fakeP = { grounded: true, vy: 0, vx: 0, isDashing: false };
    drawPlayerAura(ctx, skinId, baseColor);
    drawPlayerSkin(ctx, fakeP, 0, skinId, baseColor);
    ctx.restore();
}

function renderShop() {
    const grid = document.getElementById('shopGrid');
    grid.innerHTML = '';
    skinsData.forEach(skin => {
        const isOwned = ownedSkins.includes(skin.id);
        const isSelected = selectedSkin === skin.id;
        let btnHTML = isSelected ? `<button class="skin-btn btn-selected" disabled>DIPAKAI</button>` :
                      isOwned ? `<button class="skin-btn btn-select" onclick="selectSkin('${skin.id}')">PAKAI</button>` :
                      `<button class="skin-btn btn-buy" onclick="buySkin('${skin.id}', ${skin.price})">BELI ${skin.price} 🪙</button>`;
        grid.innerHTML += `
            <div class="skin-card ${isOwned ? 'owned' : ''} ${isSelected ? 'selected' : ''}">
                <canvas class="skin-preview" id="skinPreview_${skin.id}" width="72" height="82"></canvas>
                <div class="skin-name">${skin.name}</div>
                ${!isOwned ? `<div class="skin-price">${skin.price} 🪙</div>` : `<div class="skin-price" style="color:#558b2f;">Dimiliki</div>`}
                ${btnHTML}
            </div>`;
    });
    skinsData.forEach(skin => {
        const canvas = document.getElementById(`skinPreview_${skin.id}`);
        renderSkinPreview(canvas, skin.id, skin.id === 'default' ? playerColor : '#a855f7');
    });
}

window.buySkin = function(id, price) {
    initAudio();
    if (totalCoins >= price) {
        totalCoins -= price; ownedSkins.push(id);
        localStorage.setItem('edward_total_coins', totalCoins);
        localStorage.setItem('edward_owned_skins', JSON.stringify(ownedSkins));
        playSfx(500, 1000, 'sine', 0.2, 0.1); selectSkin(id); updateMenuCoins(); showToast("Skin Berhasil Dibeli!", true);
    } else { playSfx(150, 100, 'sawtooth', 0.2, 0.1); showToast("Koin tidak cukup!"); }
}
window.selectSkin = function(id) {
    initAudio(); selectedSkin = id; localStorage.setItem('edward_selected_skin', selectedSkin);
    playSfx(400, 600, 'square', 0.1, 0.05); renderShop();
}

document.getElementById('openShopBtn').addEventListener('click', () => {
    initAudio(); document.getElementById('shopModal').style.display = 'flex';
    setTimeout(() => document.getElementById('shopModal').style.opacity = '1', 10); renderShop();
});
document.getElementById('closeShopBtn').addEventListener('click', () => {
    initAudio(); document.getElementById('shopModal').style.opacity = '0';
    setTimeout(() => document.getElementById('shopModal').style.display = 'none', 300);
});


document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        gameMode = btn.getAttribute('data-mode');
        initAudio(); playSfx(300, 500, 'sine', 0.1, 0.1);
    });
});

updateMenuCoins();


function todayStr() {
    let d = new Date();
    return d.getFullYear() + "-" + (d.getMonth()+1) + "-" + d.getDate();
}


let leaderboard = JSON.parse(localStorage.getItem('edward_leaderboard')) || [];

function addToLeaderboard(name, dist, mode) {
    if (dist <= 0) return;
    leaderboard.push({ name: name || "Player", distance: dist, mode: mode, date: todayStr() });
    leaderboard.sort((a, b) => b.distance - a.distance);
    leaderboard = leaderboard.slice(0, 10);
    localStorage.setItem('edward_leaderboard', JSON.stringify(leaderboard));
}

function renderLeaderboard() {
    const list = document.getElementById('leaderboardList');
    if (leaderboard.length === 0) {
        list.innerHTML = '<div class="empty-hint">Belum ada rekor. Mainkan untuk masuk papan skor!</div>';
        return;
    }
    list.innerHTML = leaderboard.map((entry, i) => {
        let rankClass = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
        return `<div class="lb-row">
            <div class="lb-rank ${rankClass}">${i+1}</div>
            <div class="lb-name">${entry.name}</div>
            <span class="lb-mode-tag ${entry.mode === 'hard' ? 'hard-tag' : ''}">${entry.mode === 'hard' ? 'SULIT' : 'NORMAL'}</span>
            <div class="lb-dist">${formatDist(entry.distance)}</div>
        </div>`;
    }).join('');
}

let onlinePlayers = JSON.parse(localStorage.getItem('edward_online_players')) || {};

function recordOnlinePlayer(id, name, dist, mode) {
    if (!id || dist <= 0) return;
    let existing = onlinePlayers[id];
    if (!existing || dist > existing.distance) {
        onlinePlayers[id] = { name: name || "Player", distance: dist, mode: mode, date: todayStr() };
        localStorage.setItem('edward_online_players', JSON.stringify(onlinePlayers));
    }
}

function renderOnlineLeaderboard() {
    const list = document.getElementById('onlineLeaderboardList');
    let entries = Object.values(onlinePlayers).sort((a, b) => b.distance - a.distance).slice(0, 10);
    if (entries.length === 0) {
        list.innerHTML = '<div class="empty-hint">Belum ada rekor pemain online. Main multiplayer dulu!</div>';
        return;
    }
    list.innerHTML = entries.map((entry, i) => {
        let rankClass = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
        return `<div class="lb-row">
            <div class="lb-rank ${rankClass}">${i+1}</div>
            <div class="lb-name">${entry.name}</div>
            <span class="lb-mode-tag ${entry.mode === 'hard' ? 'hard-tag' : ''}">${entry.mode === 'hard' ? 'SULIT' : 'NORMAL'}</span>
            <div class="lb-dist">${formatDist(entry.distance)}</div>
        </div>`;
    }).join('');
}

document.getElementById('openLeaderboardBtn').addEventListener('click', () => {
    initAudio(); renderLeaderboard(); renderOnlineLeaderboard();
    document.getElementById('tabMyScoreBtn').classList.add('selected');
    document.getElementById('tabOnlineBtn').classList.remove('selected');
    document.getElementById('leaderboardList').style.display = 'block';
    document.getElementById('onlineLeaderboardList').style.display = 'none';
    document.getElementById('leaderboardModal').style.display = 'flex';
});
document.getElementById('closeLeaderboardBtn').addEventListener('click', () => {
    initAudio(); document.getElementById('leaderboardModal').style.display = 'none';
});
document.getElementById('tabMyScoreBtn').addEventListener('click', () => {
    initAudio();
    document.getElementById('tabMyScoreBtn').classList.add('selected');
    document.getElementById('tabOnlineBtn').classList.remove('selected');
    document.getElementById('leaderboardList').style.display = 'block';
    document.getElementById('onlineLeaderboardList').style.display = 'none';
});
document.getElementById('tabOnlineBtn').addEventListener('click', () => {
    initAudio();
    document.getElementById('tabOnlineBtn').classList.add('selected');
    document.getElementById('tabMyScoreBtn').classList.remove('selected');
    document.getElementById('onlineLeaderboardList').style.display = 'block';
    document.getElementById('leaderboardList').style.display = 'none';
});


let playerStats = JSON.parse(localStorage.getItem('edward_stats')) || {
    totalDistance: 0, totalCoins: 0, totalKills: 0, totalGames: 0, totalMpWins: 0
};
function saveStats() { localStorage.setItem('edward_stats', JSON.stringify(playerStats)); }

let unlockedAchievements = JSON.parse(localStorage.getItem('edward_achievements')) || [];
function saveAchievements() { localStorage.setItem('edward_achievements', JSON.stringify(unlockedAchievements)); }

const achievementsData = [
    { id: 'first_steps', name: 'Langkah Pertama', desc: 'Capai jarak 100m dalam satu kali main', reward: 20, check: (run) => run.distance >= 100 },
    { id: 'marathon_500', name: 'Pelari Jarak Jauh', desc: 'Capai jarak 500m dalam satu kali main', reward: 50, check: (run) => run.distance >= 500 },
    { id: 'marathon_1000', name: 'Legenda Parkur', desc: 'Capai jarak 1000m dalam satu kali main', reward: 100, check: (run) => run.distance >= 1000 },
    { id: 'coin_collector', name: 'Kolektor Koin', desc: 'Kumpulkan total 500 koin sepanjang waktu', reward: 50, check: () => playerStats.totalCoins >= 500 },
    { id: 'enemy_slayer', name: 'Penakluk Musuh', desc: 'Kalahkan total 50 musuh', reward: 80, check: () => playerStats.totalKills >= 50 },
    { id: 'skin_collector', name: 'Kolektor Skin', desc: 'Miliki 5 skin berbeda', reward: 100, check: () => ownedSkins.length >= 5 },
    { id: 'multiplayer_win', name: 'Juara Duel', desc: 'Menangkan pertandingan multiplayer pertamamu', reward: 60, check: () => playerStats.totalMpWins >= 1 },
    { id: 'hardcore', name: 'Anti Takut Mati', desc: 'Tempuh 300m di mode SULIT', reward: 70, check: (run) => run.mode === 'hard' && run.distance >= 300 },
    { id: 'dedicated', name: 'Pemain Setia', desc: 'Mainkan game ini 10 kali', reward: 40, check: () => playerStats.totalGames >= 10 }
];

function checkAchievements(run) {
    achievementsData.forEach(a => {
        if (!unlockedAchievements.includes(a.id) && a.check(run)) {
            unlockedAchievements.push(a.id);
            totalCoins += a.reward;
            localStorage.setItem('edward_total_coins', totalCoins);
            showToast(`🏅 Pencapaian: ${a.name}! +${a.reward} 🪙`, true);
        }
    });
    saveAchievements();
}

function renderAchievements() {
    const list = document.getElementById('achievementsList');
    list.innerHTML = achievementsData.map(a => {
        const done = unlockedAchievements.includes(a.id);
        return `<div class="mission-item ${done ? 'completed' : ''}">
            <div class="mission-title"><span>${a.name}</span>${done ? '<span class="mission-check">✔</span>' : ''}</div>
            <div style="font-size:11px; color:#6b6152; margin-bottom:6px;">${a.desc}</div>
            <div class="mission-reward">${done ? 'Diperoleh' : 'Hadiah'}: ${a.reward} 🪙</div>
        </div>`;
    }).join('');
}


const dailyMissionPool = [
    { id: 'coins100', name: 'Kumpulkan 100 koin hari ini', target: 100, reward: 30, statKey: 'coinsToday' },
    { id: 'dist500', name: 'Tempuh jarak total 500m hari ini', target: 500, reward: 40, statKey: 'distanceToday' },
    { id: 'kills5', name: 'Kalahkan 5 musuh hari ini', target: 5, reward: 30, statKey: 'killsToday' },
    { id: 'games3', name: 'Mainkan 3 kali hari ini', target: 3, reward: 25, statKey: 'gamesToday' },
    { id: 'mpwin1', name: 'Menangkan 1 duel multiplayer hari ini', target: 1, reward: 50, statKey: 'mpWinsToday' }
];

let dailyData = JSON.parse(localStorage.getItem('edward_daily')) || null;
function seededPick3(seed, pool) {
    let rr = mulberry32(seed >>> 0);
    let arr = pool.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        let j = Math.floor(rr() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 3);
}
function dateSeed(str) {
    let h = 0; for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; } return h;
}
function ensureDailyMissions() {
    let t = todayStr();
    if (!dailyData || dailyData.date !== t) {
        let picks = seededPick3(dateSeed(t), dailyMissionPool);
        dailyData = {
            date: t,
            coinsToday: 0, distanceToday: 0, killsToday: 0, gamesToday: 0, mpWinsToday: 0,
            missions: picks.map(m => ({ id: m.id, progress: 0, claimed: false }))
        };
        localStorage.setItem('edward_daily', JSON.stringify(dailyData));
    }
}
function saveDailyData() { localStorage.setItem('edward_daily', JSON.stringify(dailyData)); }

function updateDailyProgress() {
    ensureDailyMissions();
    dailyData.missions.forEach(mState => {
        const def = dailyMissionPool.find(m => m.id === mState.id);
        if (!def) return;
        mState.progress = Math.min(def.target, dailyData[def.statKey] || 0);
        if (!mState.claimed && mState.progress >= def.target) {
            mState.claimed = true;
            totalCoins += def.reward;
            localStorage.setItem('edward_total_coins', totalCoins);
            showToast(`🎯 Misi selesai: ${def.name}! +${def.reward} 🪙`, true);
        }
    });
    saveDailyData();
}

function renderDailyMissions() {
    ensureDailyMissions();
    const list = document.getElementById('dailyMissionsList');
    list.innerHTML = dailyData.missions.map(mState => {
        const def = dailyMissionPool.find(m => m.id === mState.id);
        if (!def) return '';
        let pct = Math.min(100, Math.round((mState.progress / def.target) * 100));
        return `<div class="mission-item ${mState.claimed ? 'completed' : ''}">
            <div class="mission-title"><span>${def.name}</span>${mState.claimed ? '<span class="mission-check">✔</span>' : `<span style="font-size:11px; color:#a3722a;">${mState.progress}/${def.target}</span>`}</div>
            <div class="mission-progress-bar"><div class="mission-progress-fill" style="width:${pct}%;"></div></div>
            <div class="mission-reward">${mState.claimed ? 'Diperoleh' : 'Hadiah'}: ${def.reward} 🪙</div>
        </div>`;
    }).join('');
}

function recordRunProgress(run) {
    playerStats.totalDistance += run.distance;
    playerStats.totalCoins += run.coins;
    playerStats.totalKills += run.kills;
    playerStats.totalGames += 1;
    saveStats();

    ensureDailyMissions();
    dailyData.coinsToday += run.coins;
    dailyData.distanceToday += run.distance;
    dailyData.killsToday += run.kills;
    dailyData.gamesToday += 1;
    saveDailyData();

    addToLeaderboard(run.name, run.distance, run.mode);
    checkAchievements(run);
    updateDailyProgress();
    updateMenuCoins();
}


function recordMultiplayerWin() {
    playerStats.totalMpWins += 1; saveStats();
    ensureDailyMissions();
    dailyData.mpWinsToday += 1; saveDailyData();
    checkAchievements({ distance: 0, mode: gameMode });
    updateDailyProgress();
}

document.getElementById('openMissionsBtn').addEventListener('click', () => {
    initAudio(); renderDailyMissions(); renderAchievements();
    document.getElementById('missionsModal').style.display = 'flex';
});
document.getElementById('closeMissionsBtn').addEventListener('click', () => {
    initAudio(); document.getElementById('missionsModal').style.display = 'none';
});
document.getElementById('tabDailyBtn').addEventListener('click', () => {
    initAudio();
    document.getElementById('tabDailyBtn').classList.add('selected');
    document.getElementById('tabAchBtn').classList.remove('selected');
    document.getElementById('dailyMissionsList').style.display = 'block';
    document.getElementById('achievementsList').style.display = 'none';
});
document.getElementById('tabAchBtn').addEventListener('click', () => {
    initAudio();
    document.getElementById('tabAchBtn').classList.add('selected');
    document.getElementById('tabDailyBtn').classList.remove('selected');
    document.getElementById('achievementsList').style.display = 'block';
    document.getElementById('dailyMissionsList').style.display = 'none';
});

ensureDailyMissions();



let myId = localStorage.getItem('edward_peer_id');
if (!myId) {
    myId = 'EDW-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem('edward_peer_id', myId);
}

let peer = null;
let mpConn = null;
let isHost = false;
let isMultiplayer = false;
let mpMode = 'normal';
let mpSeed = null;
let mpRng = null; 
let opponentName = "Lawan";
let opponentPeerId = null;
let myReady = false, oppReady = false;
let opponent = {
    x: 0, y: 0, distance: 0, coins: 0, lives: 3, connected: false,
    renderX: 0, renderY: 0, targetX: 0, targetY: 0,
    facing: 1, skin: 'default', color: '#a855f7',
    flagged: false, _lastDist: 0, _lastCoins: 0, _lastTime: 0, _strikes: 0
};
let myFinalDistance = null, oppFinalDistance = null;
let mpStateInterval = null;
let inviteTimeoutId = null;
let pendingLinkRoom = null;  


function mulberry32(seed) {
    return function() {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function rnd() {
    return Math.random();
}

function initPeer() {
    if (peer && !peer.destroyed) {
        document.getElementById('myIdDisplay').innerText = myId;
        return;
    }
    document.getElementById('myIdDisplay').innerText = "Menghubungkan...";
    peer = new Peer(myId);
    peer.on('open', id => {
        document.getElementById('myIdDisplay').innerText = id;
        updateMyLinkDisplay();
        
        
        if (pendingLinkRoom && pendingLinkRoom !== myId) {
            let roomToJoin = pendingLinkRoom;
            pendingLinkRoom = null;
            showToast("Menghubungkan ke room dari link...");
            sendJoinRequest(roomToJoin, true);
        }
    });
    peer.on('disconnected', () => {
        
        if (peer && !peer.destroyed) {
            try { peer.reconnect(); } catch(e) {}
        }
    });
    peer.on('error', err => {
        console.error(err);
        clearTimeout(inviteTimeoutId);
        if (err && err.type === 'peer-unavailable') {
            
            let statusEl = document.getElementById('mpStatusJoin') || document.getElementById('mpStatus');
            if (statusEl) statusEl.innerText = "ID tidak ditemukan atau sedang offline.";
            if (mpConn) { try { mpConn.close(); } catch(e){} }
            mpConn = null;
            document.getElementById('myIdDisplay').innerText = myId;
        } else if (err && err.type === 'unavailable-id') {
            
            myId = 'EDW-' + Math.random().toString(36).substring(2, 8).toUpperCase();
            localStorage.setItem('edward_peer_id', myId);
            try { peer.destroy(); } catch(e){}
            peer = null;
            showToast("ID bentrok, membuat ID baru...");
            initPeer();
        } else {
            document.getElementById('myIdDisplay').innerText = myId;
            showToast("Masalah koneksi multiplayer");
        }
    });
    peer.on('connection', conn => {
        if (mpConn) { conn.close(); return; }
        conn.once('data', data => handleIncomingBeforeAccept(conn, data));
        conn.on('close', () => handleDisconnect());
        conn.on('error', () => handleDisconnect());
    });
}

function updateMyLinkDisplay() {
    let linkEl = document.getElementById('myLinkDisplay');
    if (linkEl) linkEl.innerText = getInviteLink();
}
function getInviteLink() {
    return window.location.origin + window.location.pathname + '?room=' + myId;
}

function handleIncomingBeforeAccept(conn, data) {
    if (data && data.type === 'invite') {
        
        mpConn = conn;
        isHost = false;
        opponentName = data.name || "Lawan";
        document.getElementById('inviterName').innerText = opponentName;
        document.getElementById('inviteBanner').style.display = 'flex';
        setupMpConnHandlers();
    } else if (data && data.type === 'joinroom') {
        
        mpConn = conn;
        isHost = false;
        opponentName = data.name || "Lawan";
        setupMpConnHandlers();
        mpConn.send({ type: 'accept', name: (playerName && playerName !== "Tanpa Nama") ? playerName : "Player" });
        showToast(opponentName + " bergabung lewat link!", true);
        document.getElementById('mpModal').style.display = 'flex';
        enterLobby();
    }
}

function setupMpConnHandlers() {
    opponentPeerId = mpConn.peer;
    mpConn.on('data', data => handleMpData(data));
    mpConn.on('close', () => handleDisconnect());
    mpConn.on('error', () => handleDisconnect());
}

 
const ANTICHEAT_STRIKE_LIMIT = 3;
const ANTICHEAT_MAX_DIST_PER_SEC = 60;
const ANTICHEAT_MAX_COIN_PER_SEC = 40;

function validateAndApplyOpponentState(data) {
    let now = Date.now();
    let incomingDist = Math.max(0, Math.floor(data.distance || 0));
    let incomingCoins = Math.max(0, Math.floor(data.coins || 0));

    if (opponent._lastTime === 0 || incomingDist < opponent._lastDist - 10) {
        opponent._lastDist = incomingDist; opponent._lastCoins = incomingCoins;
        opponent._lastTime = now; opponent._strikes = 0;
        opponent.distance = incomingDist; opponent.coins = incomingCoins;
        return;
    }

    let dt = Math.max(0.05, (now - opponent._lastTime) / 1000);
    let deltaDist = incomingDist - opponent._lastDist;
    let deltaCoins = incomingCoins - opponent._lastCoins;
    let maxDist = dt * ANTICHEAT_MAX_DIST_PER_SEC;
    let maxCoins = dt * ANTICHEAT_MAX_COIN_PER_SEC;

    let suspicious = (deltaDist > maxDist + 5) || (deltaCoins > maxCoins + 20);

    if (suspicious) {
        opponent._strikes++;
        if (opponent._strikes >= ANTICHEAT_STRIKE_LIMIT && !opponent.flagged) {
            opponent.flagged = true;
            showToast("⚠️ Aktivitas lawan mencurigakan terdeteksi", false);
        }
        
        opponent.distance = Math.min(incomingDist, opponent._lastDist + Math.max(0, maxDist));
        opponent.coins = Math.min(incomingCoins, opponent._lastCoins + Math.max(0, maxCoins));
    } else {
        opponent._strikes = Math.max(0, opponent._strikes - 1);
        opponent.distance = incomingDist;
        opponent.coins = incomingCoins;
    }
    opponent._lastDist = opponent.distance;
    opponent._lastCoins = opponent.coins;
    opponent._lastTime = now;
}

function validateAndApplyOpponentGameOver(data) {
    let claimed = Math.max(0, Math.floor(data.distance || 0));
    let plausibleMax = opponent.distance + 50;
    if (claimed > plausibleMax) {
        if (!opponent.flagged) {
            opponent.flagged = true;
            showToast("⚠️ Skor akhir lawan tidak dapat diverifikasi sepenuhnya", false);
        }
        oppFinalDistance = plausibleMax;
    } else {
        oppFinalDistance = claimed;
    }
    recordOnlinePlayer(opponentPeerId, opponentName, oppFinalDistance, mpMode);
}

function handleMpData(data) {
    if (!data || !data.type) return;
    switch (data.type) {
        case 'accept':
            opponentName = data.name || "Lawan";
            document.getElementById('mpStatus').innerText = "";
            document.getElementById('mpStatusJoin').innerText = "";
            enterLobby();
            break;
        case 'decline':
            document.getElementById('mpStatusJoin').innerText = "Undangan ditolak.";
            if (mpConn) { mpConn.close(); }
            mpConn = null;
            break;
        case 'ready':
            oppReady = !!data.value;
            updateLobbyUI();
            break;
        case 'start':
            mpMode = data.mode;
            mpSeed = data.seed;
            beginMultiplayerMatch();
            break;
        case 'playerinfo':
            opponent.skin = data.skin || 'default';
            opponent.color = data.color || '#a855f7';
            break;
        case 'state':
            opponent.targetX = data.x;
            opponent.targetY = (viewportH - 60) - data.groundY;
            validateAndApplyOpponentState(data);
            opponent.lives = data.lives; opponent.facing = data.facing || 1; opponent.connected = true;
            break;
        case 'gameover':
            validateAndApplyOpponentGameOver(data);
            checkMpResult();
            break;
        case 'leave':
            handleDisconnect();
            break;
    }
}

function handleDisconnect() {
    clearTimeout(inviteTimeoutId);
    if (isMultiplayer && gameRunning) {
        showToast("Lawan terputus dari permainan!");
        triggerGameOver();
    } else if (document.getElementById('lobbyModal').style.display === 'flex') {
        showToast("Lawan meninggalkan lobby.");
        document.getElementById('lobbyModal').style.display = 'none';
        document.getElementById('mpModal').style.display = 'flex';
        showMpChoicePanel();
    } else if (document.getElementById('mpModal').style.display === 'flex') {
        let statusEl = document.getElementById('mpStatusJoin').offsetParent ? document.getElementById('mpStatusJoin') : document.getElementById('mpStatus');
        statusEl.innerText = "Koneksi terputus atau ditolak.";
    }
    mpConn = null; myReady = false; oppReady = false; opponentPeerId = null;
}

function showMpChoicePanel() {
    document.getElementById('mpChoicePanel').style.display = 'block';
    document.getElementById('mpCreatePanel').style.display = 'none';
    document.getElementById('mpJoinPanel').style.display = 'none';
}
function showMpCreatePanel() {
    document.getElementById('mpChoicePanel').style.display = 'none';
    document.getElementById('mpCreatePanel').style.display = 'block';
    document.getElementById('mpJoinPanel').style.display = 'none';
    document.getElementById('mpStatus').innerText = "Menunggu teman bergabung...";
    initPeer();
    updateMyLinkDisplay();
}
function showMpJoinPanel() {
    document.getElementById('mpChoicePanel').style.display = 'none';
    document.getElementById('mpCreatePanel').style.display = 'none';
    document.getElementById('mpJoinPanel').style.display = 'block';
    document.getElementById('mpStatusJoin').innerText = "";
    initPeer();
}

document.getElementById('openMpBtn').addEventListener('click', () => {
    initAudio();
    let selectedModeBtn = document.querySelector('.mode-btn.selected');
    if (selectedModeBtn) gameMode = selectedModeBtn.getAttribute('data-mode');
    document.getElementById('mpModal').style.display = 'flex';
    showMpChoicePanel();
    initPeer();
});
document.getElementById('closeMpBtn').addEventListener('click', () => {
    document.getElementById('mpModal').style.display = 'none';
});
document.getElementById('showCreateRoomBtn').addEventListener('click', () => { initAudio(); showMpCreatePanel(); });
document.getElementById('showJoinRoomBtn').addEventListener('click', () => { initAudio(); showMpJoinPanel(); });
document.getElementById('backFromCreateBtn').addEventListener('click', () => { initAudio(); showMpChoicePanel(); });
document.getElementById('backFromJoinBtn').addEventListener('click', () => { initAudio(); showMpChoicePanel(); });

document.getElementById('copyIdBtn').addEventListener('click', () => {
    initAudio();
    if (navigator.clipboard) {
        navigator.clipboard.writeText(myId).then(() => showToast("ID disalin!", true)).catch(() => showToast("Gagal menyalin ID"));
    } else {
        showToast("ID: " + myId);
    }
});
document.getElementById('copyLinkBtn').addEventListener('click', () => {
    initAudio();
    let link = getInviteLink();
    if (navigator.clipboard) {
        navigator.clipboard.writeText(link).then(() => showToast("Link disalin!", true)).catch(() => showToast("Gagal menyalin link"));
    } else {
        showToast("Link: " + link);
    }
});

function sendJoinRequest(targetId, viaLink) {
    if (mpConn) return;
    let statusEl = viaLink ? document.getElementById('mpStatus') : document.getElementById('mpStatusJoin');
    if (statusEl) statusEl.innerText = "Menghubungkan ke " + targetId + "...";
    isHost = true;
    let conn = peer.connect(targetId, { reliable: true });
    mpConn = conn;

    clearTimeout(inviteTimeoutId);
    inviteTimeoutId = setTimeout(() => {
        if (mpConn === conn && !conn.open) {
            if (statusEl) statusEl.innerText = "Gagal terhubung. Pastikan ID benar & teman sedang online.";
            try { conn.close(); } catch(e){}
            if (mpConn === conn) mpConn = null;
        }
    }, 10000);

    conn.on('open', () => {
        clearTimeout(inviteTimeoutId);
        let myName = (playerName && playerName !== "Tanpa Nama") ? playerName : "Player";
        conn.send({ type: viaLink ? 'joinroom' : 'invite', name: myName });
        if (statusEl) statusEl.innerText = viaLink ? "Bergabung ke room..." : ("Menunggu " + targetId + " menerima undangan...");
        setupMpConnHandlers();
        if (viaLink) {
            document.getElementById('mpModal').style.display = 'flex';
        }
    });
    conn.on('error', () => {
        clearTimeout(inviteTimeoutId);
        if (statusEl) statusEl.innerText = "ID tidak ditemukan atau sedang offline.";
        if (mpConn === conn) mpConn = null;
    });
}

document.getElementById('inviteBtn').addEventListener('click', () => {
    initAudio();
    let targetId = document.getElementById('targetIdInput').value.trim().toUpperCase();
    if (!targetId) { showToast("Masukkan ID room dulu!"); return; }
    if (targetId === myId) { showToast("Tidak bisa bergabung ke room sendiri!"); return; }
    if (mpConn) { showToast("Sedang terhubung dengan pemain lain."); return; }
    if (!peer || peer.destroyed) initPeer();

    if (!peer.open) {
        document.getElementById('mpStatusJoin').innerText = "Menyiapkan koneksi, tunggu sebentar...";
        peer.once('open', () => sendJoinRequest(targetId, false));
        return;
    }
    sendJoinRequest(targetId, false);
});

document.getElementById('acceptInviteBtn').addEventListener('click', () => {
    initAudio();
    document.getElementById('inviteBanner').style.display = 'none';
    if (!mpConn || !mpConn.open) {
        showToast("Koneksi dengan pengundang sudah terputus.");
        mpConn = null;
        return;
    }
    document.getElementById('mpModal').style.display = 'flex';
    mpConn.send({ type: 'accept', name: (playerName && playerName !== "Tanpa Nama") ? playerName : "Player" });
    enterLobby();
});
document.getElementById('declineInviteBtn').addEventListener('click', () => {
    initAudio();
    document.getElementById('inviteBanner').style.display = 'none';
    if (mpConn) { mpConn.send({ type: 'decline' }); mpConn.close(); mpConn = null; }
});

(function checkRoomLinkParam() {
    try {
        let params = new URLSearchParams(window.location.search);
        let roomParam = params.get('room');
        if (roomParam) pendingLinkRoom = roomParam.trim().toUpperCase();
    } catch(e) {}
})();

initPeer();

function enterLobby() {
    document.getElementById('mpModal').style.display = 'none';
    document.getElementById('lobbyModal').style.display = 'flex';
    myReady = false; oppReady = false;
    document.getElementById('lobbyMeName').innerText = "👤 " + ((playerName && playerName !== "Tanpa Nama") ? playerName : "Kamu");
    document.getElementById('lobbyOppName').innerText = "👤 " + opponentName;
    document.getElementById('readyBtn').innerText = "SIAP!";
    document.getElementById('readyBtn').classList.remove('active');
    updateLobbyUI();
}

function updateLobbyUI() {
    let meTag = document.getElementById('lobbyMeReady');
    let oppTag = document.getElementById('lobbyOppReady');
    meTag.innerText = myReady ? "SIAP " : "Belum Siap";
    meTag.classList.toggle('on', myReady);
    oppTag.innerText = oppReady ? "SIAP " : "Belum Siap";
    oppTag.classList.toggle('on', oppReady);

    if (myReady && oppReady && isHost && mpConn) {
        let seed = Math.floor(Math.random() * 2147483647);
        mpMode = gameMode;
        mpSeed = seed;
        mpConn.send({ type: 'start', seed: seed, mode: mpMode });
        beginMultiplayerMatch();
    }
}

document.getElementById('readyBtn').addEventListener('click', () => {
    initAudio();
    myReady = !myReady;
    document.getElementById('readyBtn').innerText = myReady ? "BATAL SIAP" : "SIAP!";
    document.getElementById('readyBtn').classList.toggle('active', myReady);
    if (mpConn) mpConn.send({ type: 'ready', value: myReady });
    updateLobbyUI();
});
document.getElementById('leaveLobbyBtn').addEventListener('click', () => {
    initAudio();
    if (mpConn) { mpConn.send({ type: 'leave' }); mpConn.close(); }
    mpConn = null; myReady = false; oppReady = false;
    document.getElementById('lobbyModal').style.display = 'none';
    document.getElementById('mpModal').style.display = 'flex';
    showMpChoicePanel();
});

function beginMultiplayerMatch() {
    document.getElementById('lobbyModal').style.display = 'none';
    document.getElementById('mpModal').style.display = 'none';
    let overlay = document.getElementById('loginOverlay');
    overlay.style.opacity = '0';
    setTimeout(() => overlay.style.display = 'none', 400);

    gameMode = mpMode;
    isMultiplayer = true;
    opponent = {
        x: 0, y: 0, distance: 0, coins: 0, lives: 3, connected: true,
        renderX: 100, renderY: viewportH - 300, targetX: 100, targetY: viewportH - 300,
        facing: 1, skin: 'default', color: '#a855f7',
        flagged: false, _lastDist: 0, _lastCoins: 0, _lastTime: 0, _strikes: 0
    };
    oppFinalDistance = null; myFinalDistance = null;
    document.getElementById('oppHud').style.display = 'flex';
    if (mpConn && mpConn.open) {
        mpConn.send({ type: 'playerinfo', skin: selectedSkin, color: playerColor });
    }

    document.getElementById('displayPlayerName').innerText = (playerName && playerName !== "Tanpa Nama") ? playerName : "Player";
    initAudio(); playSfx(400, 800, 'sine', 0.15, 0.1);

    resetGame(); cancelAnimationFrame(animId); gameLoop();

    if (mpStateInterval) clearInterval(mpStateInterval);
    mpStateInterval = setInterval(() => {
        if (mpConn && mpConn.open && gameRunning) {
            mpConn.send({ type: 'state', x: p.x, groundY: (viewportH - 60) - p.y, distance: distance, coins: runCoins, lives: lives, facing: p.facing });
        }
    }, 100);
}

function checkMpResult() {
    if (myFinalDistance !== null && oppFinalDistance !== null) {
        let resultText;
        if (myFinalDistance > oppFinalDistance) {
            resultText = "🏆 KAMU MENANG!";
            recordMultiplayerWin();
        }
        else if (myFinalDistance < oppFinalDistance) resultText = "😢 KAMU KALAH";
        else resultText = "🤝 SERI!";
        if (opponent.flagged) resultText += " (skor lawan tak sepenuhnya terverifikasi)";
        document.querySelector('#gameOverModal h2').innerText = resultText;
    }
}

/* ========================================================= */


let playerName = "Tanpa Nama";
let playerColor = "#ff4500";
let animId, lives = 3, maxLives = 3, distance = 0, heartAngle = 0, lastMilestone = 0, killsThisRun = 0;

function updateLivesUI() {
    let livesEl = document.getElementById('lives');
    if (livesEl) livesEl.innerText = lives;
}

window.addEventListener('load', () => {
    let bar = document.getElementById('progressBar');
    let status = document.getElementById('loadingStatus');
    let progress = 0;
    let interval = setInterval(() => {
        progress += Math.floor(Math.random() * 25) + 15;
        if(progress > 100) progress = 100; bar.style.width = progress + '%';
        if (progress === 100) {
            clearInterval(interval); status.innerText = "Siap!";
            setTimeout(() => {
                document.getElementById('loadingOverlay').style.opacity = '0';
                setTimeout(() => document.getElementById('loadingOverlay').style.display = 'none', 500);
                let loginOverlay = document.getElementById('loginOverlay');
                loginOverlay.style.display = 'flex';
                setTimeout(() => loginOverlay.style.opacity = '1', 50);
            }, 300);
        }
    }, 120);
});

document.querySelectorAll('.color-opt').forEach(opt => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('.color-opt').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected'); playerColor = opt.getAttribute('data-color');
    });
});

function startGame() {
    let nameInputEl = document.getElementById('playerNameInput');
    let input = nameInputEl.value.trim();
    if (!input) {
        initAudio(); playSfx(150, 100, 'sawtooth', 0.2, 0.1);
        showToast("Isi nama dulu sebelum main!");
        nameInputEl.focus();
        return;
    }
    playerName = input;
    document.getElementById('displayPlayerName').innerText = playerName;

    let selectedModeBtn = document.querySelector('.mode-btn.selected');
    if (selectedModeBtn) gameMode = selectedModeBtn.getAttribute('data-mode');

    isMultiplayer = false;
    document.getElementById('oppHud').style.display = 'none';
    if (mpStateInterval) { clearInterval(mpStateInterval); mpStateInterval = null; }
    
    initAudio(); playSfx(400, 800, 'sine', 0.15, 0.1);
    let overlay = document.getElementById('loginOverlay');
    overlay.style.opacity = '0';
    setTimeout(() => overlay.style.display = 'none', 400);

    resetGame(); cancelAnimationFrame(animId); gameLoop();
}
document.getElementById('startBtn').addEventListener('click', startGame);

document.getElementById('changeUserBtn').addEventListener('click', () => {
    document.getElementById('gameOverModal').classList.remove('active');
    let overlay = document.getElementById('loginOverlay');
    overlay.style.display = 'flex';
    setTimeout(() => overlay.style.opacity = '1', 10);
    updateMenuCoins();
    isMultiplayer = false;
    document.getElementById('oppHud').style.display = 'none';
    if (mpStateInterval) { clearInterval(mpStateInterval); mpStateInterval = null; }
});

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let dpr = 1, viewportW = window.innerWidth, viewportH = window.innerHeight;

function resizeCanvas() {
    viewportW = window.innerWidth; viewportH = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2); 
    canvas.width = viewportW * dpr; canvas.height = viewportH * dpr;
    canvas.style.width = viewportW + 'px'; canvas.style.height = viewportH + 'px';
    ctx.scale(dpr, dpr);
}
window.addEventListener('resize', resizeCanvas); resizeCanvas();

let p, platforms, enemies, particles, floatingTexts, keys, cameraX, gameRunning;
let bgElements = [], stars = [], clouds = [];
let currentDimension = 0, dimensionFlash = 0;
let platformIndex = 0;

const themes = [
    { type: 'earth', plat: "#1e293b", top: "#00d2d3", lava: "#ff4500", sky1: "#38bdf8", sky2: "#bae6fd" }, 
    { type: 'cyber', plat: "#2f002c", top: "#ff007f", lava: "#00ffff", sky1: "#240046", sky2: "#10002b" },
    { type: 'alien', plat: "#1a3622", top: "#00e676", lava: "#c51162", sky1: "#3b0764", sky2: "#180325" }  
];

function resetGame() {
    maxLives = (gameMode === 'hard') ? 1 : 3;
    lives = maxLives; updateLivesUI();
    runCoins = 0; document.getElementById('hudCoins').innerText = runCoins;

    p = { 
        x: 100, y: viewportH - 300, lastY: viewportH - 300, 
        w: 26, h: 44, vx: 0, vy: 0, 
        grounded: false, scaleX: 1, scaleY: 1, 
        walkCycle: 0, facing: 1, coyoteTimer: 0, jumpsLeft: (gameMode === 'hard') ? 1 : 2,
        isDashing: false, dashTimer: 0, dashCooldown: 0,
        isInvulnerable: 0 
    };
    
    platforms = [
        { x: 50, y: viewportH - 180, w: 280, h: 25, coin: false, heart: false, crumble: false, crumbleTimer: undefined, broken: false },
        { x: 370, y: viewportH - 240, w: 160, h: 25, coin: true, heart: false, crumble: false, crumbleTimer: undefined, broken: false }
    ];
    
    enemies = []; killsThisRun = 0;
    platformIndex = 0;
    
    stars = [];
    for(let i=0; i<180; i++) stars.push({ x: Math.random() * viewportW * 1.5, y: Math.random() * viewportH * 0.7, size: Math.random() * 1.8, alpha: Math.random() });

    bgElements = []; let startX = 100;
    for(let i=0; i<8; i++){
        startX += 250 + Math.random() * 150;
        bgElements.push({ x: startX, scale: 0.5 + Math.random()*0.5, seed: Math.floor(Math.random() * 1000) });
    }

    clouds = [];
    for(let i=0; i<8; i++) clouds.push({ x: Math.random() * viewportW * 1.5, y: 40 + Math.random() * (viewportH * 0.4), scale: 0.6 + Math.random() * 0.9, speed: 0.12 + Math.random() * 0.2 });

    particles = []; floatingTexts = [];
    keys = { left: false, right: false, jumpPressed: false };
    cameraX = 0; gameRunning = true; currentDimension = 0; dimensionFlash = 0;
    distance = 0; lastMilestone = 0;
    document.getElementById('distanceHUD').innerText = formatDist(distance);
    if (isMultiplayer) document.getElementById('oppDistanceHUD').innerText = "0m";
    document.getElementById('gameOverModal').classList.remove('active');
    document.getElementById('dashBtn').classList.remove('cooldown');
}

function triggerDash() {
    if (!p.isDashing && p.dashCooldown <= 0) {
        p.isDashing = true; p.dashTimer = 14; p.dashCooldown = (gameMode === 'hard') ? 95 : 65; 
        p.vy = 0; if (p.facing === 0) p.facing = 1;
        playSfx(600, 200, 'square', 0.25, 0.15);
        createDust(p.x + p.w/2, p.y + p.h, 12, true);
        document.getElementById('dashBtn').classList.add('cooldown');
    }
}

function createDust(x, y, count = 5, isBurst = false) {
    for(let i=0; i<count; i++) {
        particles.push({
            type: 'dust', x: x + (Math.random()*14 - 7), y: y + (isBurst ? -20 : 0),
            vx: Math.random()*3.5 - 1.75, vy: isBurst ? (Math.random()*3) : (-Math.random()*1.8 - 0.5),
            size: Math.random()*3.5 + 2, alpha: 1
        });
    }
    if (particles.length > 220) particles.splice(0, particles.length - 220);
}

function ensureHeartsOnPlatforms() {
    if (lives >= maxLives) return;
    let availablePlats = platforms.filter(pt => pt.x > p.x + 60 && !pt.coin && !pt.heart);
    if (availablePlats.length > 0) {
        let countToSpawn = Math.min(2, availablePlats.length);
        for (let i = 0; i < countToSpawn; i++) availablePlats[i].heart = true;
    }
}

function updateWorldElements() {
    let lastPlat = platforms[platforms.length - 1];
    let isHard = gameMode === 'hard';

    while (lastPlat.x < cameraX + viewportW + 350) {
        let rr = isMultiplayer ? mulberry32((mpSeed + platformIndex * 7919) >>> 0) : Math.random;

        let diffMultiplier = isHard
            ? Math.min(3.0, 1.3 + (platformIndex / 45))
            : Math.min(2.4, 1 + (platformIndex / 60));

        let gap = (65 + rr() * 125) * diffMultiplier;
        let newX = lastPlat.x + lastPlat.w + gap; 
        
        let maxJumpUp = gap > (120 * diffMultiplier) ? 35 : (95 * diffMultiplier); 
        let yOffset = (rr() * (maxJumpUp + 110)) - maxJumpUp;
        let newY = Math.max(170, Math.min(viewportH - 140, lastPlat.y + yOffset));
        
        let platWidth = (75 + rr() * 95) / Math.min(1.4, diffMultiplier);
        if (isHard) platWidth *= 0.85;

        let isCoin = rr() > 0.28;
        let isHeart = !isCoin && (lives < maxLives) && (rr() < 0.4);

        let isCrumble = isHard && !isCoin && !isHeart && platformIndex > 3 && rr() < 0.3;

        platforms.push({ x: newX, y: newY, w: platWidth, h: 22, coin: isCoin, heart: isHeart, crumble: isCrumble, crumbleTimer: undefined, broken: false });
        lastPlat = platforms[platforms.length - 1];

        if (isHard && !isHeart && !isCoin && platformIndex > 2) {
            let maxActiveEnemies = 6;
            let spawnChance = Math.min(0.5, 0.22 + platformIndex / 220);
            if (enemies.length < maxActiveEnemies && rr() < spawnChance) {
                let randPick = rr();
                let type, tier, ew, eh, ex, ey, evx;
                let speedMul = 1 + Math.min(0.6, platformIndex / 260);

                if (randPick < 0.3) {
                    type = 'empty'; tier = 'low'; ew = 24; eh = 36;
                    ex = newX + platWidth/2; ey = newY - eh; evx = -1.2 * speedMul;
                } else if (randPick < 0.6) {
                    type = 'sword'; tier = 'mid'; ew = 26; eh = 40;
                    ex = newX + platWidth/2; ey = newY - eh; evx = -1.8 * speedMul;
                } else if (randPick < 0.8) {
                    type = 'bomb'; tier = 'mid'; ew = 28; eh = 28;
                    ex = newX + platWidth/2; ey = newY - eh; evx = -0.8 * speedMul;
                } else {
                    type = 'plane'; tier = 'high'; ew = 44; eh = 22;
                    ex = newX + platWidth/2; ey = newY - 140 - rr()*60; evx = -2.5 * speedMul;
                }

                enemies.push({ type, tier, x: ex, y: ey, w: ew, h: eh, vx: evx, vy: 0, plat: lastPlat, state: 'normal' });
            }
        }

        platformIndex++;
    }
    platforms = platforms.filter(pt => pt.x + pt.w > cameraX - 250);
   
    enemies = enemies.filter(e => e.x + e.w > cameraX - 300 && e.y < viewportH + 100 && e.state !== 'dead');

    let lastBg = bgElements.length > 0 ? bgElements[bgElements.length - 1] : { x: cameraX * 0.3 };
    while (lastBg.x < (cameraX * 0.3) + viewportW + 450) { 
        bgElements.push({ x: lastBg.x + 250 + Math.random() * 200, scale: 0.5 + Math.random() * 0.5, seed: Math.floor(Math.random() * 1000) });
        lastBg = bgElements[bgElements.length - 1];
    }
    bgElements = bgElements.filter(bg => bg.x > (cameraX * 0.3) - 350);

    let camParallaxX = cameraX * 0.1;
    clouds.forEach(c => { c.x += c.speed; if (c.x < camParallaxX - 250) c.x = camParallaxX + viewportW + 250; });
}

window.addEventListener('keydown', e => {
    initAudio();
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
    if (e.code === 'Space' || e.code === 'KeyW' || e.code === 'ArrowUp') keys.jumpPressed = true;
    if (e.code === 'KeyE' || e.code === 'ShiftLeft') triggerDash();
});
window.addEventListener('keyup', e => {
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
});

const setupTouch = (id, key) => {
    const el = document.getElementById(id);
    el.addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); keys[key] = true; });
    el.addEventListener('pointerup', e => { e.preventDefault(); keys[key] = false; });
    el.addEventListener('pointerleave', e => { e.preventDefault(); keys[key] = false; });
};
setupTouch('leftBtn', 'left'); setupTouch('rightBtn', 'right');

document.getElementById('jumpBtn').addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); keys.jumpPressed = true; });
document.getElementById('dashBtn').addEventListener('pointerdown', e => { e.preventDefault(); initAudio(); triggerDash(); });

let coinAngle = 0;

function drawPlayerAura(ctx, skinId, baseColor) {
    if (!skinId.startsWith('bbb_')) return;
    let aura = getAuraColors(skinId, baseColor);
    let pulse = Math.sin(Date.now() * 0.008) * 5;
    ctx.save();
    let grad = ctx.createRadialGradient(0, -20, 5, 0, -20, 32 + pulse);
    grad.addColorStop(0, aura.p); grad.addColorStop(0.5, aura.s); grad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grad; ctx.globalAlpha = 0.65 + Math.sin(Date.now() * 0.01) * 0.2;
    ctx.beginPath(); ctx.arc(0, -20, 35 + pulse, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawBoboiboyCap(ctx, capColor, visorColor, emblem = "B") {
    ctx.fillStyle = capColor; ctx.beginPath(); ctx.arc(0, -43, 11.5, Math.PI, Math.PI * 2); ctx.fill();
    ctx.fillStyle = visorColor; ctx.beginPath(); ctx.fillRect(-15, -45, 8, 4); ctx.fill(); 
    if (emblem) { ctx.fillStyle = "#ffffff"; ctx.font = "900 8px system-ui"; ctx.textAlign = "center"; ctx.fillText(emblem, 4, -45); }
}

function drawPlayerSkin(ctx, p, legSwing, skinId, baseColor) {
    const isJumpingUp = !p.grounded && p.vy < 0;
    const drawLegs = (c) => {
        ctx.strokeStyle = c; ctx.lineWidth = 4.5; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(-4 + legSwing, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4, -12); ctx.lineTo(4 - legSwing, 0); ctx.stroke();
    };
    const drawArm = (c, isBack) => {
        ctx.strokeStyle = c; ctx.lineWidth = 4; ctx.lineCap = "round"; ctx.beginPath();
        let startX = isBack ? -2 : 2, startY = -30;
        ctx.moveTo(startX, startY);
        let endX, endY;
        if (p.isDashing) { endX = startX - 12; endY = -26; } 
        else if (isJumpingUp) { endX = isBack ? -9 : 9; endY = -52; } 
        else { let swing = isBack ? -legSwing * 1.5 : legSwing * 1.5; endX = startX + swing; endY = -16; }
        ctx.lineTo(endX, endY); ctx.stroke();
    };
    const drawBody = (c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.roundRect(-11, -36, 22, 24, 7); ctx.fill(); };
    const drawHead = (c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(0, -42, 11, 0, Math.PI * 2); ctx.fill(); };
    const drawEye = (x, y, r, c="#000") => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill(); };
    const drawCape = (c) => {
        ctx.fillStyle = c; ctx.beginPath(); let capeSwing = p.isDashing ? 15 : legSwing;
        ctx.moveTo(-8, -36); ctx.lineTo(-20 - capeSwing, -10); ctx.lineTo(-12 - capeSwing, -8); ctx.fill();
    };

    switch(skinId) {
        case 'bbb_biasa': drawLegs("#1e293b"); drawArm("#334155", true); drawBody("#ff5722"); drawArm("#334155", false); drawHead("#ffdbac"); drawBoboiboyCap(ctx, "#000000", "#ff5722", "B"); drawEye(4, -42, 2, "#000"); break;
        case 'bbb_petir': drawLegs("#111827"); drawArm("#111827", true); drawBody("#dc2626"); drawArm("#111827", false); drawHead("#ffdbac"); drawBoboiboyCap(ctx, "#111827", "#facc15", "⚡"); drawEye(4, -42, 2, "#facc15"); break;
        case 'bbb_angin': drawLegs("#1e293b"); drawArm("#334155", true); drawBody("#0288d1"); drawArm("#334155", false); drawHead("#ffdbac"); drawBoboiboyCap(ctx, "#0288d1", "#ffffff", "🌀"); drawEye(4, -42, 2, "#38bdf8"); break;
        case 'bbb_tanah': drawLegs("#3f2e1a"); drawArm("#1c1917", true); drawBody("#78350f"); drawArm("#1c1917", false); drawHead("#ffdbac"); drawBoboiboyCap(ctx, "#78350f", "#b45309", "🪨"); drawEye(4, -42, 2, "#d97706"); break;
        case 'bbb_daun': drawLegs("#14532d"); drawArm("#064e3b", true); drawBody("#16a34a"); drawArm("#064e3b", false); drawHead("#ffdbac"); drawBoboiboyCap(ctx, "#16a34a", "#86efac", "🍃"); drawEye(4, -42, 2, "#22c55e"); break;
        case 'bbb_api': drawLegs("#450a0a"); drawArm("#450a0a", true); drawBody("#ff4500"); drawArm("#450a0a", false); drawHead("#ffdbac"); drawBoboiboyCap(ctx, "#ea580c", "#facc15", "🔥"); drawEye(4, -42, 2, "#ff2200"); break;
        case 'bbb_air': drawLegs("#083344"); drawArm("#0f172a", true); drawBody("#06b6d4"); drawArm("#0f172a", false); drawHead("#ffdbac"); drawBoboiboyCap(ctx, "#06b6d4", "#ffffff", "💧"); drawEye(4, -42, 2, "#38bdf8"); break;
        case 'bbb_cahaya': drawLegs("#fef08a"); drawArm("#334155", true); drawBody("#ffffff"); drawArm("#334155", false); drawHead("#ffdbac"); drawBoboiboyCap(ctx, "#ffffff", "#facc15", "✨"); drawEye(4, -42, 2, "#eab308"); break;
        case 'bbb_halilintar': drawCape("#dc2626"); drawLegs("#000000"); drawArm("#000000", true); drawBody("#991b1b"); drawArm("#000000", false); drawHead("#ffdbac"); drawBoboiboyCap(ctx, "#000000", "#dc2626", "⚡"); drawEye(4, -42, 2, "#ef4444"); break;
        case 'bbb_taufan': drawLegs("#0c4a6e"); drawArm("#0f172a", true); drawBody("#0288d1"); drawArm("#0f172a", false); drawHead("#ffdbac"); drawBoboiboyCap(ctx, "#0288d1", "#00ffff", "🌪️"); drawEye(4, -42, 2, "#00ffff"); break;
        case 'bbb_gempa': drawLegs("#451a03"); drawArm("#1c1917", true); drawBody("#b45309"); drawArm("#1c1917", false); drawHead("#ffdbac"); drawBoboiboyCap(ctx, "#78350f", "#f59e0b", "💎"); drawEye(4, -42, 2, "#f59e0b"); break;
        case 'bbb_blaze': drawLegs("#7c2d12"); drawArm("#262626", true); drawBody("#dc2626"); drawArm("#262626", false); drawHead("#ffdbac"); drawBoboiboyCap(ctx, "#ea580c", "#ff3d00", "💥"); drawEye(4, -42, 2, "#ffea00"); break;
        case 'bbb_ice': drawLegs("#164e63"); drawArm("#111827", true); drawBody("#0891b2"); drawArm("#111827", false); drawHead("#ffdbac"); drawBoboiboyCap(ctx, "#0891b2", "#a5f3fc", "❄️"); drawEye(4, -42, 2, "#a5f3fc"); break;
        case 'bbb_solar': drawLegs("#1e293b"); drawArm("#94a3b8", true); drawBody("#ffffff"); ctx.fillStyle = "#facc15"; ctx.fillRect(-11, -30, 22, 5); drawArm("#94a3b8", false); drawHead("#ffdbac"); drawBoboiboyCap(ctx, "#ffffff", "#facc15", "☀️"); ctx.fillStyle = "#000"; ctx.fillRect(2, -44, 8, 4); break;
        case 'bbb_frostfire': drawLegs("#1e1b4b"); drawArm("#0f172a", true); drawBody("#ff4500"); ctx.fillStyle = "#06b6d4"; ctx.fillRect(0, -36, 11, 24); drawArm("#0f172a", false); drawHead("#ffdbac"); drawBoboiboyCap(ctx, "#ea580c", "#06b6d4", "🔥❄️"); drawEye(4, -42, 2, "#00ffff"); break;
        case 'bbb_supra': drawCape("#a855f7"); drawLegs("#0f172a"); drawArm("#1e293b", true); drawBody("#38bdf8"); ctx.fillStyle = "#a855f7"; ctx.fillRect(-11, -30, 22, 6); drawArm("#1e293b", false); drawHead("#ffdbac"); drawBoboiboyCap(ctx, "#a855f7", "#ffffff", "👑"); drawEye(4, -42, 2, "#c084fc"); break;

       
        case 'spongebob': drawLegs("#facc15"); drawArm("#facc15", true); ctx.fillStyle = "#facc15"; ctx.fillRect(-11, -40, 22, 22); ctx.fillStyle = "#fff"; ctx.fillRect(-11, -18, 22, 6); ctx.fillStyle = "#8b4513"; ctx.fillRect(-11, -12, 22, 6); ctx.fillStyle = "#ef4444"; ctx.fillRect(-2, -18, 4, 8); drawArm("#facc15", false); drawEye(0, -30, 4, "#fff"); drawEye(8, -30, 4, "#fff"); drawEye(1, -30, 1.5, "#3b82f6"); drawEye(9, -30, 1.5, "#3b82f6"); break;
        case 'patrick': drawLegs("#84cc16"); drawArm("#f472b6", true); ctx.fillStyle = "#84cc16"; ctx.fillRect(-11, -18, 22, 8); ctx.fillStyle = "#a855f7"; ctx.fillRect(-6, -16, 4, 4); ctx.fillRect(4, -14, 4, 4); ctx.fillStyle = "#f472b6"; ctx.beginPath(); ctx.moveTo(-11, -18); ctx.lineTo(11, -18); ctx.lineTo(0, -44); ctx.fill(); drawArm("#f472b6", false); drawEye(2, -30, 3, "#fff"); drawEye(8, -30, 3, "#fff"); drawEye(3, -30, 1, "#000"); drawEye(9, -30, 1, "#000"); break;
        case 'ninja': drawLegs("#1e293b"); drawArm("#0f172a", true); drawBody("#1e293b"); drawArm("#0f172a", false); drawHead("#1e293b"); ctx.fillStyle = "#ffdbac"; ctx.fillRect(0, -47, 8, 6); ctx.fillStyle = "#ef4444"; ctx.fillRect(-11, -49, 22, 3); drawEye(4, -44, 1.5, "#000"); break;
        case 'mario': drawLegs("#3b82f6"); drawArm("#ef4444", true); drawBody("#3b82f6"); drawArm("#ef4444", false); drawHead("#ffdbac"); ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(0, -44, 11, 0, Math.PI, true); ctx.fill(); drawEye(4, -44, 1.5); break;
        case 'luigi': drawLegs("#3b82f6"); drawArm("#22c55e", true); drawBody("#3b82f6"); drawArm("#22c55e", false); drawHead("#ffdbac"); ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.arc(0, -44, 11, 0, Math.PI, true); ctx.fill(); drawEye(4, -44, 1.5); break;
        case 'pikachu': drawLegs("#facc15"); drawBody("#facc15"); drawHead("#facc15"); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.moveTo(-4, -50); ctx.lineTo(-13, -63); ctx.lineTo(0, -50); ctx.fill(); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.moveTo(4, -50); ctx.lineTo(13, -63); ctx.lineTo(0, -50); ctx.fill(); drawArm("#eab308", false); drawEye(4, -44, 2); ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(0, -40, 2.5, 0, Math.PI*2); ctx.fill(); break;
        case 'zombie': drawLegs("#4b5563"); drawArm("#4f46e5", true); drawBody("#6366f1"); drawArm("#4f46e5", false); drawHead("#4ade80"); drawEye(2, -44, 2, "#fff"); drawEye(2, -44, 0.5, "#ef4444"); break;
        case 'astronaut': drawLegs("#e2e8f0"); drawArm("#cbd5e1", true); drawBody("#f8fafc"); drawArm("#cbd5e1", false); drawHead("#f8fafc"); ctx.fillStyle = "#38bdf8"; ctx.beginPath(); ctx.roundRect(0, -48, 13, 11, 4); ctx.fill(); break;
        case 'batman': drawCape("#111827"); drawLegs("#111827"); drawArm("#475569", true); drawBody("#64748b"); drawArm("#475569", false); drawHead("#111827"); ctx.fillStyle = "#ffdbac"; ctx.fillRect(-3, -40, 8, 4); drawEye(3, -44, 1.5, "#fff"); break;
        case 'superman': drawCape("#ef4444"); drawLegs("#1d4ed8"); drawArm("#1d4ed8", true); drawBody("#3b82f6"); drawArm("#1d4ed8", false); drawHead("#ffdbac"); drawEye(4, -44, 1.5); break;
        case 'spiderman': drawLegs("#1d4ed8"); drawArm("#ef4444", true); drawBody("#1d4ed8"); ctx.fillStyle = "#ef4444"; ctx.fillRect(-5, -36, 10, 24); drawArm("#ef4444", false); drawHead("#ef4444"); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(5, -44, 4.5, 6.5, Math.PI/8, 0, Math.PI*2); ctx.fill(); break;
        case 'ironman': drawLegs("#b91c1c"); drawArm("#b91c1c", true); drawBody("#ef4444"); drawArm("#b91c1c", false); drawHead("#ef4444"); ctx.fillStyle = "#facc15"; ctx.fillRect(-7, -48, 14, 13); drawEye(4, -44, 1.5, "#38bdf8"); break;

        case 'amongus': drawLegs("#991b1b"); drawArm("#b91c1c", true); ctx.fillStyle = "#b91c1c"; ctx.beginPath(); ctx.roundRect(-10, -52, 20, 34, 10); ctx.fill(); ctx.fillStyle = "#7f1d1d"; ctx.fillRect(-13, -40, 5, 14); drawArm("#b91c1c", false); ctx.fillStyle = "#7dd3fc"; ctx.beginPath(); ctx.ellipse(4, -42, 7, 5, 0.3, 0, Math.PI * 2); ctx.fill(); break;
        case 'angrybird': drawLegs("#f97316"); ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.arc(0, -38, 14, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.moveTo(-8, -40); ctx.lineTo(6, -46); ctx.lineTo(8, -38); ctx.fill(); ctx.fillStyle = "#f97316"; ctx.beginPath(); ctx.moveTo(6, -36); ctx.lineTo(14, -34); ctx.lineTo(6, -30); ctx.fill(); drawEye(3, -40, 2.5, "#fff"); drawEye(3, -40, 1, "#000"); break;
        case 'creeper': drawLegs("#166534"); drawArm("#166534", true); drawBody("#22c55e"); drawArm("#166534", false); ctx.fillStyle = "#22c55e"; ctx.fillRect(-11, -53, 22, 22); ctx.fillStyle = "#000"; ctx.fillRect(-6, -49, 4, 6); ctx.fillRect(2, -49, 4, 6); ctx.fillRect(-3, -42, 6, 8); break;
        case 'minion': drawLegs("#1e3a8a"); drawArm("#facc15", true); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.roundRect(-10, -54, 20, 36, 9); ctx.fill(); drawArm("#facc15", false); ctx.fillStyle = "#94a3b8"; ctx.beginPath(); ctx.arc(2, -44, 6, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(2, -44, 4, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(2, -44, 2, 0, Math.PI * 2); ctx.fill(); break;
        case 'shinchan': drawLegs("#facc15"); drawArm("#dc2626", true); drawBody("#dc2626"); drawArm("#dc2626", false); drawHead("#ffdbac"); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.moveTo(-8, -49); ctx.lineTo(-2, -56); ctx.lineTo(2, -50); ctx.lineTo(6, -55); ctx.lineTo(8, -48); ctx.fill(); drawEye(2, -43, 1.2, "#000"); drawEye(7, -43, 1.2, "#000"); break;
        case 'doraemon': drawLegs("#1e3a8a"); drawArm("#1d4ed8", true); drawBody("#1d4ed8"); drawArm("#1d4ed8", false); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, -44, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#dc2626"; ctx.fillRect(-11, -38, 22, 3); drawEye(-3, -47, 2.5, "#fff"); drawEye(3, -47, 2.5, "#fff"); drawEye(-3, -47, 0.8, "#000"); drawEye(3, -47, 0.8, "#000"); ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.arc(0, -40, 1.5, 0, Math.PI * 2); ctx.fill(); break;
        case 'skeleton': ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 4.5; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(-4, -12); ctx.lineTo(-4 + legSwing, 0); ctx.stroke(); ctx.beginPath(); ctx.moveTo(4, -12); ctx.lineTo(4 - legSwing, 0); ctx.stroke(); drawArm("#e5e7eb", true); ctx.fillStyle = "#f3f4f6"; ctx.beginPath(); ctx.roundRect(-9, -36, 18, 24, 6); ctx.fill(); ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-9, -30 + i * 6); ctx.lineTo(9, -30 + i * 6); ctx.stroke(); } drawArm("#e5e7eb", false); ctx.fillStyle = "#f3f4f6"; ctx.beginPath(); ctx.arc(0, -42, 11, 0, Math.PI * 2); ctx.fill(); drawEye(-3, -43, 2, "#000"); drawEye(4, -43, 2, "#000"); break;
        case 'pirate': drawLegs("#292524"); drawArm("#1c1917", true); drawBody("#78350f"); drawArm("#1c1917", false); drawHead("#ffdbac"); ctx.fillStyle = "#1c1917"; ctx.beginPath(); ctx.moveTo(-11, -49); ctx.quadraticCurveTo(0, -58, 11, -49); ctx.quadraticCurveTo(0, -53, -11, -49); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(-3, -56); ctx.lineTo(1, -56); ctx.lineTo(-1, -53); ctx.fill(); ctx.fillStyle = "#000"; ctx.fillRect(1, -45, 6, 3); drawEye(-3, -44, 1.5, "#000"); break;
        case 'naruto': drawLegs("#ea580c"); drawArm("#1e3a8a", true); drawBody("#ea580c"); drawArm("#1e3a8a", false); drawHead("#ffdbac"); ctx.fillStyle = "#facc15"; ctx.fillRect(-11, -47, 22, 4); ctx.fillStyle = "#1e3a8a"; ctx.fillRect(-11, -45, 22, 3); drawEye(4, -42, 1.5, "#000"); ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-2, -40); ctx.lineTo(0, -39); ctx.stroke(); break;
        case 'robot': drawLegs("#475569"); drawArm("#64748b", true); ctx.fillStyle = "#94a3b8"; ctx.beginPath(); ctx.roundRect(-11, -36, 22, 24, 4); ctx.fill(); drawArm("#64748b", false); ctx.fillStyle = "#cbd5e1"; ctx.beginPath(); ctx.roundRect(-9, -52, 18, 14, 3); ctx.fill(); ctx.fillStyle = "#22d3ee"; ctx.fillRect(-6, -47, 5, 3); ctx.fillRect(2, -47, 5, 3); ctx.fillStyle = "#ef4444"; ctx.fillRect(-1, -56, 2, 4); break;
        case 'vampire': drawCape("#111827"); drawLegs("#111827"); drawArm("#1f2937", true); drawBody("#374151"); drawArm("#1f2937", false); drawHead("#e2e8f0"); drawEye(4, -44, 1.5, "#dc2626"); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(1, -38); ctx.lineTo(2, -35); ctx.lineTo(3, -38); ctx.fill(); break;
        case 'wizard': drawLegs("#4c1d95"); drawArm("#6d28d9", true); drawBody("#7c3aed"); drawArm("#6d28d9", false); drawHead("#ffdbac"); ctx.fillStyle = "#4c1d95"; ctx.beginPath(); ctx.moveTo(-9, -49); ctx.lineTo(9, -49); ctx.lineTo(0, -68); ctx.fill(); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(0, -63, 1.5, 0, Math.PI * 2); ctx.fill(); drawEye(4, -44, 1.5); break;
        case 'knight': drawLegs("#475569"); drawArm("#64748b", true); drawBody("#94a3b8"); drawArm("#64748b", false); ctx.fillStyle = "#cbd5e1"; ctx.beginPath(); ctx.arc(0, -42, 11, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#1e293b"; ctx.fillRect(-8, -45, 16, 4); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.moveTo(-2, -58); ctx.lineTo(2, -58); ctx.lineTo(0, -52); ctx.fill(); break;
        case 'flash': drawLegs("#7f1d1d"); drawArm("#7f1d1d", true); drawBody("#dc2626"); drawArm("#7f1d1d", false); drawHead("#dc2626"); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.moveTo(-2, -48); ctx.lineTo(2, -42); ctx.lineTo(-1, -42); ctx.lineTo(3, -36); ctx.lineTo(-3, -40); ctx.lineTo(0, -40); ctx.fill(); break;
        case 'deadpool': drawLegs("#7f1d1d"); drawArm("#111827", true); drawBody("#dc2626"); drawArm("#111827", false); drawHead("#dc2626"); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(2, -43, 3, 2, 0.3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(7, -45, 2.5, 1.8, 0.1, 0, Math.PI * 2); ctx.fill(); break;
        case 'capamerica': drawLegs("#1e3a8a"); drawArm("#1e3a8a", true); drawBody("#3b82f6"); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, -24, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.arc(0, -24, 1.3, 0, Math.PI * 2); ctx.fill(); drawArm("#1e3a8a", false); drawHead("#1e3a8a"); drawEye(4, -44, 1.5, "#fff"); break;
        case 'thor': drawCape("#dc2626"); drawLegs("#1e293b"); drawArm("#94a3b8", true); drawBody("#cbd5e1"); drawArm("#94a3b8", false); drawHead("#ffdbac"); ctx.fillStyle = "#facc15"; ctx.fillRect(-3, -52, 6, 6); drawEye(4, -44, 1.5); break;
        case 'goku': drawLegs("#1d4ed8"); drawArm("#ea580c", true); drawBody("#ea580c"); drawArm("#ea580c", false); drawHead("#ffdbac"); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.moveTo(-9, -48); ctx.lineTo(-4, -60); ctx.lineTo(0, -50); ctx.lineTo(4, -62); ctx.lineTo(8, -49); ctx.lineTo(0, -52); ctx.fill(); drawEye(4, -42, 1.5); break;
        case 'hulk': drawLegs("#6d28d9"); drawArm("#15803d", true); drawBody("#22c55e"); drawArm("#15803d", false); drawHead("#22c55e"); drawEye(4, -44, 1.8, "#fff"); break;
        case 'venom': drawLegs("#0f172a"); drawArm("#0f172a", true); drawBody("#000000"); drawArm("#0f172a", false); drawHead("#000000"); drawEye(1, -43, 3, "#fff"); drawEye(7, -45, 2.5, "#fff"); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(-11, -36); ctx.lineTo(-3, -30); ctx.lineTo(-11, -24); ctx.fill(); break;

        case 'default':
        default:
            ctx.fillStyle = "#e11d48"; ctx.beginPath(); ctx.moveTo(-2, -32);
            ctx.quadraticCurveTo(-15 - p.vx * 2.5, -26 + Math.sin(Date.now()*0.01)*3, -19 - p.vx * 3.5, -13);
            ctx.quadraticCurveTo(-9, -22, -2, -28); ctx.fill();
            drawLegs("#0f172a"); drawArm("#334155", true); drawBody(baseColor); drawArm("#334155", false); drawHead("#ffdbac"); drawEye(3, -43, 2.5, "#0f172a"); break;
    }
}

function takePlayerDamage() {
    if (p.isInvulnerable > 0) return; 
    if (lives > 1) {
        lives--; updateLivesUI();
        playSfx(150, 50, 'sawtooth', 0.25, 0.2);
        floatingTexts.push({ x: p.x + p.w/2, y: p.y - 40, text: "-1 ❤️", alpha: 1 });
        p.isInvulnerable = 90; 
        p.vy = -7; p.vx = -4 * p.facing; 
        ensureHeartsOnPlatforms();
    } else { triggerGameOver(); }
}

function triggerGameOver() {
    lives = 0; updateLivesUI(); gameRunning = false; 
    playSfx(220, 50, 'sawtooth', 0.35, 0.15);
    if (distance > highDistance) {
        highDistance = distance; 
        localStorage.setItem('edward_high_dist', highDistance);
        document.getElementById('loginHighScore').innerText = formatDist(highDistance);
    }
    document.getElementById('finalScore').innerText = formatDist(distance);
    document.getElementById('bestScore').innerText = formatDist(highDistance);

    recordRunProgress({
        name: (playerName && playerName !== "Tanpa Nama") ? playerName : "Player",
        distance: distance, coins: runCoins, kills: killsThisRun, mode: gameMode
    });

    if (isMultiplayer) {
        myFinalDistance = distance;
        if (mpConn && mpConn.open) mpConn.send({ type: 'gameover', distance: distance });
        if (oppFinalDistance !== null) {
            checkMpResult();
        } else {
            document.querySelector('#gameOverModal h2').innerText = "MENUNGGU LAWAN...";
        }
        if (mpStateInterval) { clearInterval(mpStateInterval); mpStateInterval = null; }
    } else {
        document.querySelector('#gameOverModal h2').innerText = "KAMU KALAH";
    }

    document.getElementById('gameOverModal').classList.add('active');
    updateMenuCoins();
}

function gameLoop() {
    if (!gameRunning) return;

    if (p.dashCooldown > 0) p.dashCooldown--;
    if (p.dashCooldown <= 0) document.getElementById('dashBtn').classList.remove('cooldown');
    if (p.isInvulnerable > 0) p.isInvulnerable--;

    const accel = p.grounded ? 0.65 : 0.38; 
    const friction = p.grounded ? 0.82 : 0.91; 

  
    if (p.isDashing) {
        p.vx = p.facing * 12; p.vy = 0; p.dashTimer--;
        if (p.dashTimer % 3 === 0) createDust(p.x + (p.facing === 1 ? 0 : p.w), p.y + p.h - 10, 2);
        if (p.dashTimer <= 0) { p.isDashing = false; p.vx = p.facing * 5; }
    } else {
        if (keys.left) { p.vx -= accel; p.facing = -1; } 
        else if (keys.right) { p.vx += accel; p.facing = 1; } 
        else { p.vx *= friction; }
        
     
        if (p.isInvulnerable === 0 || p.grounded) p.vx = Math.max(-6.5, Math.min(6.5, p.vx));
        p.vy += 0.78; 
    }
    
    p.x += p.vx; p.lastY = p.y; p.y += p.vy;

    if (p.grounded) { p.coyoteTimer = 7; p.jumpsLeft = (gameMode === 'hard') ? 1 : 2; } 
    else { p.coyoteTimer--; }

    if (keys.jumpPressed) {
        if (p.coyoteTimer > 0 || p.jumpsLeft > 0) {
            p.vy = -15; p.isDashing = false;
            if (p.coyoteTimer <= 0) {
                p.jumpsLeft--; createDust(p.x + p.w/2, p.y + p.h, 10, true); playSfx(250, 600, 'square', 0.1, 0.08);
            } else {
                p.jumpsLeft--; createDust(p.x + p.w/2, p.y + p.h, 6, false); playSfx(180, 450, 'square', 0.12, 0.08);
            }
            p.coyoteTimer = 0; p.scaleY = 1.35; p.scaleX = 0.72;
        }
        keys.jumpPressed = false; 
    }

    p.scaleX += (1 - p.scaleX) * 0.18; p.scaleY += (1 - p.scaleY) * 0.18;

    let targetCamX = p.x - viewportW * 0.35;
    cameraX += (targetCamX - cameraX) * 0.08;

    let currentDist = Math.max(0, Math.floor((p.x - 100) / 10));
    if (currentDist > distance) {
        distance = currentDist;
        document.getElementById('distanceHUD').innerText = formatDist(distance);
        
        if (distance > 0 && distance % 500 === 0 && distance !== lastMilestone) {
            lastMilestone = distance;
            let milestoneCoins = 100; runCoins += milestoneCoins; totalCoins += milestoneCoins;
            localStorage.setItem('edward_total_coins', totalCoins); document.getElementById('hudCoins').innerText = runCoins;
            playSfx(500, 1200, 'sine', 0.4, 0.2);
            floatingTexts.push({ x: p.x + p.w/2, y: p.y - 60, text: `🎉 +${milestoneCoins} 🪙`, alpha: 1.5 });
            showToast(`Luar Biasa! ${distance}m Tercapai! Bonus ${milestoneCoins} Koin!`, true);
        }
    }
    if (isMultiplayer) {
        document.getElementById('oppDistanceHUD').innerText = formatDist(opponent.distance) + (opponent.flagged ? " ⚠️" : "");
    }

    updateWorldElements();

    let wasGrounded = p.grounded; p.grounded = false;

    let dimCheck = Math.floor(distance / 250);
    if(dimCheck > currentDimension && distance > 0) {
        currentDimension = dimCheck; dimensionFlash = 1;
        playSfx(800, 150, 'sawtooth', 0.6, 0.3);
        floatingTexts.push({ x: p.x + p.w/2, y: p.y - 30, text: "DIMENSI BARU!", alpha: 1 });
    }
    let curTheme = themes[currentDimension % themes.length];

    platforms.forEach(pt => {
        if (pt.broken) return;

        let isInsideX = p.x + p.w > pt.x && p.x < pt.x + pt.w;
        let isFalling = p.vy > 0;
        if (isInsideX && isFalling && p.lastY + p.h <= pt.y + 12 && p.y + p.h >= pt.y) {
            p.y = pt.y - p.h; p.vy = 0; p.grounded = true;
            if (!wasGrounded) { p.scaleY = 0.72; p.scaleX = 1.28; createDust(p.x + p.w/2, p.y + p.h, 7); playSfx(100, 50, 'sine', 0.08, 0.05); }
            if (pt.crumble && pt.crumbleTimer === undefined) {
                pt.crumbleTimer = 22;
                playSfx(200, 80, 'sawtooth', 0.15, 0.08);
            }
        }
        if (pt.crumble && pt.crumbleTimer !== undefined && !pt.broken) {
            pt.crumbleTimer--;
            if (pt.crumbleTimer <= 0) {
                pt.broken = true;
                createDust(pt.x + pt.w/2, pt.y + pt.h/2, 10, true);
            }
        }

        if (pt.coin) {
            let cx = pt.x + pt.w / 2, cy = pt.y - 24, dx = (p.x + p.w/2) - cx, dy = (p.y + p.h/2) - cy;
            if (Math.sqrt(dx*dx + dy*dy) < 28) {
                pt.coin = false; runCoins += 10; totalCoins += 10;
                localStorage.setItem('edward_total_coins', totalCoins); document.getElementById('hudCoins').innerText = runCoins;
                playSfx(750, 1100, 'sine', 0.18, 0.12); floatingTexts.push({ x: cx, y: cy, text: "+10 🪙", alpha: 1 });
            }
        }
        if (pt.heart) {
            let hx = pt.x + pt.w / 2, hy = pt.y - 24, dx = (p.x + p.w/2) - hx, dy = (p.y + p.h/2) - hy;
            if (Math.sqrt(dx*dx + dy*dy) < 28) {
                pt.heart = false;
                if (lives < maxLives) {
                    lives++; updateLivesUI(); playSfx(500, 950, 'sine', 0.22, 0.15);
                    floatingTexts.push({ x: hx, y: hy, text: "+1 ❤️", alpha: 1 });
                }
            }
        }
    });

   
    enemies.forEach(e => {
        if (e.state === 'dead') return;

        
        if (e.type === 'plane') {
            e.x += e.vx; e.y += e.vy;
         
            if (Math.abs(e.x - p.x) < 300 && e.state === 'normal' && e.x > p.x) {
                e.state = 'diving';
                let dx = p.x - e.x, dy = p.y - e.y, angle = Math.atan2(dy, dx);
                let speed = 7.5 * (gameMode === 'hard' ? 1.15 : 1);
                e.vx = Math.cos(angle) * speed; e.vy = Math.sin(angle) * speed;
            }
            if (e.state === 'diving' && e.y > viewportH) e.state = 'dead';
        } else {
            e.x += e.vx; e.y += e.vy;
       
            if (e.x < e.plat.x) { e.x = e.plat.x; e.vx = Math.abs(e.vx); }
            if (e.x + e.w > e.plat.x + e.plat.w) { e.x = e.plat.x + e.plat.w - e.w; e.vx = -Math.abs(e.vx); }
        }

   
        let hitX = (p.x < e.x + e.w && p.x + p.w > e.x);
        let hitY = (p.y < e.y + e.h && p.y + p.h > e.y);

        if (hitX && hitY) {
            let playerWins = false;
            
      
            if (p.isDashing) {
                playerWins = true;
            } else if (p.vy > 0 && p.lastY + p.h <= e.y + 20) {
                playerWins = true;
                p.vy = -12; 
                p.grounded = false;
            }

            if (playerWins) {
                e.state = 'dead'; killsThisRun++;
                playSfx(300, 100, 'square', 0.2, 0.1); 
                runCoins += 15; 
                document.getElementById('hudCoins').innerText = runCoins;
                floatingTexts.push({ x: e.x + e.w/2, y: e.y - 15, text: "BAM!", alpha: 1 });
                
                if (e.type === 'bomb') {
                    createDust(e.x + e.w/2, e.y + e.h/2, 20, true);
                    playSfx(100, 50, 'sawtooth', 0.4, 0.2);
                } else {
                    createDust(e.x + e.w/2, e.y + e.h/2, 10, true);
                }
            } else {
                takePlayerDamage();
            }
        }
    });

    if (p.grounded && Math.abs(p.vx) > 0.5 && Math.random() < 0.25) createDust(p.x + (p.facing === 1 ? 0 : p.w), p.y + p.h, 1);

    if (p.y > viewportH - 60) {
        if (lives > 1) {
            lives--; updateLivesUI(); playSfx(150, 50, 'sawtooth', 0.25, 0.2);
            floatingTexts.push({ x: p.x + p.w/2, y: viewportH - 120, text: "-1 ❤️", alpha: 1 });
            let safePlat = platforms.find(pt => pt.x + pt.w > cameraX + 80 && pt.x < cameraX + viewportW - 100 && !pt.broken);
            if (!safePlat) safePlat = platforms[0];
            p.x = safePlat.x + safePlat.w / 2 - p.w / 2; p.y = safePlat.y - p.h - 30;
            p.vx = 0; p.vy = 0; p.grounded = false; p.isDashing = false;
            ensureHeartsOnPlatforms();
        } else { triggerGameOver(); return; }
    }

   
    ctx.clearRect(0, 0, viewportW, viewportH);

    let nowTime = new Date(), h = nowTime.getHours(), m = nowTime.getMinutes(), s = nowTime.getSeconds();
    let tDecimal = h + m/60 + s/3600;
    let isDay = tDecimal >= 6 && tDecimal < 18;
    let arcProgress = isDay ? (tDecimal - 6) / 12 : (tDecimal >= 18 ? (tDecimal - 18) / 12 : (tDecimal + 6) / 12);
    let celX = viewportW * 0.1 + (viewportW * 0.8 * arcProgress); 
    let celY = (viewportH * 0.15) + (viewportH * 0.4) * (1 - Math.sin(arcProgress * Math.PI));

    let currentSky1 = curTheme.sky1, currentSky2 = curTheme.sky2, starAlphaMult = 1;

    if (curTheme.type === 'earth') {
        let phases = [
            { h: 0, s1: "#020617", s2: "#0f172a" }, { h: 5, s1: "#0f172a", s2: "#1e1b4b" }, { h: 6, s1: "#f97316", s2: "#fde047" },
            { h: 7, s1: "#38bdf8", s2: "#bae6fd" }, { h: 12, s1: "#0ea5e9", s2: "#7dd3fc" }, { h: 16, s1: "#38bdf8", s2: "#bae6fd" },
            { h: 17.5, s1: "#f97316", s2: "#fde047" }, { h: 18.5, s1: "#1e1b4b", s2: "#0f172a" }, { h: 24, s1: "#020617", s2: "#0f172a" }
        ];
        let p1 = phases[0], p2 = phases[1];
        for (let i = 0; i < phases.length - 1; i++) { if (tDecimal >= phases[i].h && tDecimal <= phases[i+1].h) { p1 = phases[i]; p2 = phases[i+1]; break; } }
        let t = (p2.h === p1.h) ? 0 : (tDecimal - p1.h) / (p2.h - p1.h);
        currentSky1 = lerpColor(p1.s1, p2.s1, t); currentSky2 = lerpColor(p1.s2, p2.s2, t);
        if (isDay && tDecimal > 7 && tDecimal < 17) starAlphaMult = 0; else if (isDay) starAlphaMult = Math.abs(tDecimal - 12) / 6;
    }

    let skyGrad = ctx.createLinearGradient(0, 0, 0, viewportH);
    skyGrad.addColorStop(0, currentSky1); skyGrad.addColorStop(1, currentSky2);
    ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, viewportW, viewportH);

    stars.forEach(s => {
        s.alpha += (Math.random() * 0.04 - 0.02); s.alpha = Math.max(0.2, Math.min(1, s.alpha));
        if (starAlphaMult > 0) { ctx.fillStyle = `rgba(255, 255, 255, ${s.alpha * starAlphaMult})`; ctx.fillRect(s.x - cameraX * 0.05, s.y, s.size, s.size); }
    });

    let timeOsc = Math.sin(Date.now() * 0.002);
    if (curTheme.type === 'earth') {
        if (isDay) { ctx.fillStyle = "#ffefad"; ctx.beginPath(); ctx.arc(celX, celY, 60 + timeOsc*4, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "#ffdd59"; ctx.beginPath(); ctx.arc(celX, celY, 45, 0, Math.PI*2); ctx.fill(); } 
        else { ctx.fillStyle = "#e2e8f0"; ctx.beginPath(); ctx.arc(celX, celY, 45, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "#cbd5e1"; ctx.beginPath(); ctx.arc(celX - 15, celY - 10, 8, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(celX + 10, celY + 15, 12, 0, Math.PI*2); ctx.fill(); }
    } else if (curTheme.type === 'cyber') {
        if (isDay) { ctx.fillStyle = "#ff007f"; ctx.beginPath(); ctx.arc(celX, celY, 50, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = currentSky2; for(let i=0; i<5; i++) ctx.fillRect(celX - 55, celY + 5 + i*8, 110, 3); } 
        else { ctx.fillStyle = "#00ffff"; ctx.beginPath(); ctx.arc(celX, celY, 40, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = currentSky1; ctx.beginPath(); ctx.arc(celX - 12, celY - 8, 35, 0, Math.PI*2); ctx.fill(); }
    } else if (curTheme.type === 'alien') {
        if (isDay) { ctx.fillStyle = "#eb4d4b"; ctx.beginPath(); ctx.arc(celX, celY, 45, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = "rgba(240, 147, 43, 0.6)"; ctx.lineWidth = 14; ctx.beginPath(); ctx.ellipse(celX, celY, 70, 20, Math.PI/8, 0, Math.PI*2); ctx.stroke(); } 
        else { ctx.fillStyle = "#6ab04c"; ctx.beginPath(); ctx.arc(celX, celY, 35, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "rgba(186, 220, 88, 0.4)"; ctx.beginPath(); ctx.arc(celX, celY, 50 + timeOsc*5, 0, Math.PI*2); ctx.fill(); }
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    clouds.forEach(c => {
        let drawX = c.x - cameraX * 0.12; 
        ctx.beginPath(); ctx.arc(drawX, c.y, 25*c.scale, Math.PI, Math.PI*2); ctx.arc(drawX + 15*c.scale, c.y - 10*c.scale, 20*c.scale, Math.PI, Math.PI*2); ctx.arc(drawX + 35*c.scale, c.y, 25*c.scale, Math.PI, Math.PI*2); ctx.fill();
    });

    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    bgElements.forEach(bg => {
        let drawX = bg.x - cameraX * 0.3;
        ctx.beginPath(); ctx.moveTo(drawX, viewportH - 60); ctx.lineTo(drawX + 150*bg.scale, viewportH - 60 - 240*bg.scale - (bg.seed%50)); ctx.lineTo(drawX + 300*bg.scale, viewportH - 60); ctx.fill();
    });

    ctx.save();
    ctx.translate(-cameraX, 0);

    platforms.forEach(pt => {
        if (pt.broken) return;

        let isCrumbling = pt.crumble && pt.crumbleTimer !== undefined;
        let shake = isCrumbling ? (Math.random()*4 - 2) : 0;

        ctx.fillStyle = curTheme.plat; ctx.beginPath(); ctx.roundRect(pt.x + shake, pt.y, pt.w, pt.h + 600, 8); ctx.fill(); 
        ctx.fillStyle = isCrumbling ? "#a4462f" : curTheme.top; ctx.beginPath(); ctx.roundRect(pt.x + shake, pt.y, pt.w, pt.h, 8); ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.18)"; ctx.beginPath(); ctx.roundRect(pt.x + shake, pt.y + pt.h, pt.w, 8, 0); ctx.fill();

        if (pt.crumble && !isCrumbling) {
            ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(pt.x + pt.w*0.3, pt.y); ctx.lineTo(pt.x + pt.w*0.45, pt.y + pt.h*0.6); ctx.lineTo(pt.x + pt.w*0.65, pt.y + pt.h); ctx.stroke();
        }

        if (pt.coin) {
            coinAngle += 0.05; let cy = pt.y - 24 + Math.sin(coinAngle + pt.x)*4; let cx = pt.x + pt.w/2;
            ctx.fillStyle = "#ffd700"; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "#b45309"; ctx.font = "900 13px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("E", cx, cy);
        }

        if (pt.heart) {
            heartAngle += 0.08; let hy = pt.y - 24 + Math.sin(heartAngle + pt.x) * 4; let hx = pt.x + pt.w / 2;
            ctx.save(); ctx.translate(hx, hy); ctx.scale(1 + Math.sin(heartAngle*1.5)*0.1, 1 + Math.sin(heartAngle*1.5)*0.1); ctx.fillStyle = "#ff4757"; ctx.beginPath(); ctx.moveTo(0, -3); ctx.bezierCurveTo(0, -9, 8, -9, 8, -3); ctx.bezierCurveTo(8, 2, 0, 8, 0, 10); ctx.bezierCurveTo(0, 8, -8, 2, -8, -3); ctx.bezierCurveTo(-8, -9, 0, -9, 0, -3); ctx.fill(); ctx.restore();
        }
    });

    if (isMultiplayer && opponent.connected) {
        opponent.renderX += (opponent.targetX - opponent.renderX) * 0.25;
        opponent.renderY += (opponent.targetY - opponent.renderY) * 0.25;

        ctx.save();
        ctx.globalAlpha = 0.88;
        let oppFakeP = {
            x: opponent.renderX, y: opponent.renderY, w: 26, h: 44,
            vx: 0, vy: 0, grounded: true, isDashing: false,
            facing: opponent.facing || 1, isInvulnerable: 0
        };
        let oppLegSwing = Math.sin(Date.now() * 0.012 + opponent.renderX) * 6;
        ctx.translate(oppFakeP.x + oppFakeP.w / 2, oppFakeP.y + oppFakeP.h / 2);
        ctx.scale(oppFakeP.facing, 1);
        ctx.translate(0, oppFakeP.h / 2);
        drawPlayerAura(ctx, opponent.skin || 'default', opponent.color || '#a855f7');
        drawPlayerSkin(ctx, oppFakeP, oppLegSwing, opponent.skin || 'default', opponent.color || '#a855f7');
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff"; ctx.font = "900 11px system-ui"; ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 3;
        ctx.fillText(opponentName, opponent.renderX + 13, opponent.renderY - 34);
        ctx.shadowBlur = 0;
        ctx.restore();
    }

   
    enemies.forEach(e => {
        if (e.state === 'dead') return;
        ctx.save();
        ctx.translate(e.x, e.y);
        
        let direction = e.vx < 0 ? -1 : 1;

        if (e.type === 'empty') {
            ctx.fillStyle = '#64748b'; 
            ctx.fillRect(0, 0, e.w, e.h);
            ctx.fillStyle = '#ef4444'; 
            ctx.fillRect(direction < 0 ? 4 : e.w - 8, 8, 4, 4);
        } 
        else if (e.type === 'sword') {
            ctx.fillStyle = '#334155'; 
            ctx.fillRect(0, 0, e.w, e.h);
            ctx.fillStyle = '#ef4444'; 
            ctx.fillRect(direction < 0 ? 4 : e.w - 8, 8, 4, 4);
            ctx.fillStyle = '#e2e8f0'; 
            if (direction < 0) ctx.fillRect(-12, 20, 20, 6);
            else ctx.fillRect(e.w - 8, 20, 20, 6);
        }
        else if (e.type === 'bomb') {
            ctx.fillStyle = '#111827'; 
            ctx.beginPath(); ctx.arc(e.w/2, e.h/2 + 5, e.w/2, 0, Math.PI*2); ctx.fill();
           
            ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(e.w/2, 5); 
            let sway = Math.sin(Date.now()*0.01 + e.x)*6;
            ctx.quadraticCurveTo(e.w/2 + 10, -10, e.w/2 + 5 + sway, -15); ctx.stroke();
          
            ctx.fillStyle = '#facc15';
            ctx.beginPath(); ctx.arc(e.w/2 + 5 + sway, -15, 3 + Math.random()*2, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(direction < 0 ? 6 : e.w - 10, 15, 4, 4);
        }
        else if (e.type === 'plane') {
           
            if (e.state === 'diving') {
                ctx.translate(e.w/2, e.h/2);
                ctx.rotate(Math.atan2(e.vy, e.vx));
                ctx.translate(-e.w/2, -e.h/2);
            }
            ctx.fillStyle = '#475569'; 
            ctx.beginPath(); ctx.moveTo(0, e.h/2); ctx.lineTo(e.w, 0); ctx.lineTo(e.w, e.h); ctx.fill();
            ctx.fillStyle = '#38bdf8'; 
            ctx.fillRect(e.w/4, e.h/2 - 4, 8, 8);
            ctx.fillStyle = '#f97316'; 
            ctx.beginPath(); ctx.arc(e.w + Math.random()*6, e.h/2, 6, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
    });

    ctx.save();
    
    let legSwing = p.grounded ? Math.sin(p.walkCycle) * 7.5 : (p.vy > 0 ? -4 : 6);
    if(p.grounded && Math.abs(p.vx) > 0.5) p.walkCycle += 0.38; else legSwing = 0;
    
    let bounce = p.grounded ? Math.abs(Math.sin(p.walkCycle)) * 2 : 0;
    if (p.isDashing) bounce = 0;

    
    if (p.isInvulnerable > 0 && Math.floor(Date.now() / 120) % 2 === 0) {
        ctx.globalAlpha = 0.4;
    }

    ctx.translate(p.x + p.w/2, p.y + p.h/2); 
    ctx.scale(p.scaleX * p.facing, p.scaleY); 
    ctx.translate(0, p.h/2 + bounce);

    drawPlayerAura(ctx, selectedSkin, playerColor);
    drawPlayerSkin(ctx, p, legSwing, selectedSkin, playerColor);

    ctx.globalAlpha = 1.0;
    ctx.restore();

    particles.forEach((pt, i) => {
        pt.x += pt.vx; pt.y += pt.vy; pt.alpha -= 0.025; pt.size *= 0.95;
        ctx.fillStyle = `rgba(255,255,255,${pt.alpha})`;
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI*2); ctx.fill();
        if(pt.alpha <= 0) particles.splice(i, 1);
    });

    floatingTexts.forEach((ft, i) => {
        ft.y -= 1.2; ft.alpha -= 0.015;
        ctx.fillStyle = `rgba(255, 215, 0, ${ft.alpha})`;
        if (ft.text.includes("❤️")) ctx.fillStyle = `rgba(255, 71, 87, ${ft.alpha})`;
        if (ft.text.includes("DIMENSI") || ft.text.includes("BAM!")) ctx.fillStyle = `rgba(56, 189, 248, ${ft.alpha})`;
        ctx.font = "900 16px system-ui"; ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 4;
        ctx.fillText(ft.text, ft.x, ft.y); ctx.shadowBlur = 0;
        if(ft.alpha <= 0) floatingTexts.splice(i, 1);
    });

    ctx.restore(); 

    ctx.fillStyle = curTheme.lava; ctx.fillRect(0, viewportH - 60, viewportW, 60);
    ctx.fillStyle = "rgba(255, 255, 255, 0.2)"; ctx.beginPath();
    for(let i=0; i<=viewportW; i+=20) ctx.lineTo(i, viewportH - 60 + Math.sin(i*0.04 + Date.now()*0.003)*12);
    ctx.lineTo(viewportW, viewportH); ctx.lineTo(0, viewportH); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, viewportH - 30, viewportW, 30);

    if (dimensionFlash > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${dimensionFlash})`; ctx.fillRect(0, 0, viewportW, viewportH); dimensionFlash -= 0.03;
    }

    if (gameRunning) animId = requestAnimationFrame(gameLoop);
}
