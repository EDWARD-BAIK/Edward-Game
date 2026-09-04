
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

let gameSettings = Object.assign({
    musicOn: true, musicVolume: 0.55,
    sfxOn: true, sfxVolume: 1,
    particlesOn: true, screenShakeOn: true, vibrationOn: true
}, (() => { try { return JSON.parse(localStorage.getItem('edward_settings')) || {}; } catch(e){ return {}; } })());
function saveSettings() { localStorage.setItem('edward_settings', JSON.stringify(gameSettings)); }

let screenShakeMag = 0;
function triggerShake(mag) {
    if (gameSettings.screenShakeOn) screenShakeMag = Math.max(screenShakeMag, mag);
    if (gameSettings.vibrationOn && navigator.vibrate) {
        try { navigator.vibrate(Math.max(10, Math.min(40, Math.round(mag * 3)))); } catch(e){}
    }
}

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    if (gameSettings.musicOn) startMusic();
}
function playSfx(freqStart, freqEnd, type, duration, vol) {
    if (!audioCtx || !gameSettings.sfxOn) return;
    vol = vol * gameSettings.sfxVolume;
    if (vol <= 0) return;
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

// ===== MUSIK LATAR SANTAI (generative ambient pad, tanpa file eksternal) =====
let musicNodes = null;
function startMusic() {
    if (!audioCtx || musicNodes) return;
    try {
        const master = audioCtx.createGain();
        master.gain.value = 0.0001;
        master.connect(audioCtx.destination);
        master.gain.setTargetAtTime(gameSettings.musicVolume, audioCtx.currentTime, 1.5);

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 900;
        filter.connect(master);

        // LFO lembut yang "menghirup" pada filter, memberi rasa tenang & hidup
        const lfo = audioCtx.createOscillator();
        lfo.type = 'sine'; lfo.frequency.value = 0.045;
        const lfoGain = audioCtx.createGain(); lfoGain.gain.value = 350;
        lfo.connect(lfoGain); lfoGain.connect(filter.frequency); lfo.start();

        const chords = [
            [220.00, 261.63, 329.63],
            [174.61, 220.00, 261.63],
            [196.00, 246.94, 293.66],
            [220.00, 277.18, 329.63]
        ];
        let chordIndex = 0;
        let oscBank = [];
        function playChord() {
            oscBank.forEach(o => {
                try {
                    o.gain.gain.cancelScheduledValues(audioCtx.currentTime);
                    o.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 1.4);
                    o.osc.stop(audioCtx.currentTime + 4.5);
                } catch(e){}
            });
            oscBank = [];
            const notes = chords[chordIndex % chords.length];
            notes.forEach((freq, i) => {
                const osc = audioCtx.createOscillator();
                osc.type = i === 0 ? 'triangle' : 'sine';
                osc.frequency.value = freq * (i === 2 ? 2 : 1);
                const g = audioCtx.createGain();
                g.gain.value = 0.0001;
                osc.connect(g); g.connect(filter);
                osc.start();
                g.gain.setTargetAtTime(0.55 / notes.length, audioCtx.currentTime, 1.5);
                oscBank.push({ osc, gain: g });
            });
            chordIndex++;
        }
        playChord();
        const interval = setInterval(playChord, 7500);
        musicNodes = { master, filter, lfo, interval, get oscBank() { return oscBank; } };
    } catch(e){}
}
function stopMusic() {
    if (!musicNodes) return;
    try {
        clearInterval(musicNodes.interval);
        musicNodes.oscBank.forEach(o => {
            try { o.gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.6); o.osc.stop(audioCtx.currentTime + 1.2); } catch(e){}
        });
        musicNodes.lfo.stop();
        musicNodes.master.gain.setTargetAtTime(0, audioCtx.currentTime, 0.6);
        setTimeout(() => { try { musicNodes.master.disconnect(); } catch(e){} }, 1500);
    } catch(e){}
    musicNodes = null;
}
function applyMusicVolume() {
    if (musicNodes && audioCtx) musicNodes.master.gain.setTargetAtTime(gameSettings.musicOn ? gameSettings.musicVolume : 0, audioCtx.currentTime, 0.3);
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
    { id: 'bbb_supra', name: 'BBB Supra', price: 2000 },

    { id: 'cowboy', name: 'Koboi', price: 260 },
    { id: 'chef', name: 'Koki', price: 180 },
    { id: 'alien', name: 'Alien', price: 300 },
    { id: 'samurai', name: 'Samurai', price: 380 },
    { id: 'viking', name: 'Viking', price: 380 },
    { id: 'mummy', name: 'Mumi', price: 260 },
    { id: 'clown', name: 'Badut', price: 200 },
    { id: 'detective', name: 'Detektif', price: 240 },
    { id: 'surfer', name: 'Peselancar', price: 220 },
    { id: 'dj', name: 'DJ', price: 260 },
    { id: 'farmer', name: 'Petani', price: 180 },
    { id: 'firefighter', name: 'Pemadam Kebakaran', price: 260 },
    { id: 'police', name: 'Polisi', price: 240 },
    { id: 'doctor', name: 'Dokter', price: 220 },
    { id: 'angel', name: 'Malaikat', price: 500 },
    { id: 'devil', name: 'Iblis', price: 500 },
    { id: 'phoenix', name: 'Phoenix', price: 950 },
    { id: 'cyborg', name: 'Cyborg', price: 550 },
    { id: 'dino', name: 'Dinosaurus', price: 320 },
    { id: 'panda', name: 'Panda', price: 200 },
    { id: 'dragonrider', name: 'Penunggang Naga', price: 1000 },

    { id: 'koala', name: 'Koala', price: 200 },
    { id: 'foxy', name: 'Rubah', price: 220 },
    { id: 'wolf', name: 'Serigala', price: 280 },
    { id: 'bear', name: 'Beruang', price: 240 },
    { id: 'tiger', name: 'Harimau', price: 320 },
    { id: 'lion', name: 'Singa', price: 340 },
    { id: 'eagle', name: 'Elang', price: 300 },
    { id: 'shark', name: 'Hiu', price: 350 },
    { id: 'octopus', name: 'Gurita', price: 300 },
    { id: 'jellyfish', name: 'Ubur-ubur', price: 260 },
    { id: 'dragon', name: 'Naga', price: 900 },
    { id: 'unicorn', name: 'Unicorn', price: 650 },
    { id: 'mermaid', name: 'Duyung', price: 480 },
    { id: 'genie', name: 'Jin', price: 500 },
    { id: 'werewolf', name: 'Manusia Serigala', price: 420 },
    { id: 'frankenstein', name: 'Frankenstein', price: 300 },
    { id: 'ghost', name: 'Hantu', price: 220 },
    { id: 'reaper', name: 'Malaikat Maut', price: 700 },
    { id: 'ninjaturtle', name: 'Kura-kura Ninja', price: 380 },
    { id: 'godzilla', name: 'Godzilla', price: 850 },
    { id: 'kingkong', name: 'King Kong', price: 800 },
    { id: 'ultraman', name: 'Ultraman', price: 750 },
    { id: 'gladiator', name: 'Gladiator', price: 380 },
    { id: 'pharaoh', name: 'Firaun', price: 460 },
    { id: 'ninjawhite', name: 'Ninja Putih', price: 260 },
    { id: 'archer', name: 'Pemanah', price: 300 },
    { id: 'icemage', name: 'Penyihir Es', price: 420 },
    { id: 'paladin', name: 'Paladin', price: 520 },
    { id: 'assassin', name: 'Assassin', price: 480 },
    { id: 'berserker', name: 'Berserker', price: 520 },
    { id: 'alchemist', name: 'Alkemis', price: 340 },
    { id: 'bard', name: 'Bardik', price: 260 },
    { id: 'monk', name: 'Biksu', price: 300 },
    { id: 'ranger', name: 'Ranger Hutan', price: 320 },
    { id: 'shaman', name: 'Dukun', price: 340 },
    { id: 'valkyrie', name: 'Valkyrie', price: 680 },
    { id: 'cyclops', name: 'Cyclops', price: 380 },
    { id: 'golem', name: 'Golem Batu', price: 460 },
    { id: 'spacecat', name: 'Kucing Angkasa', price: 320 },
    { id: 'mecha', name: 'Mecha Raksasa', price: 720 }
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


document.querySelectorAll('#modePicker .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('#modePicker .mode-btn').forEach(b => b.classList.remove('selected'));
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

// ===== MENU PENGATURAN =====
function refreshSettingsUI() {
    document.querySelectorAll('#musicToggle .mode-btn').forEach(b => b.classList.toggle('selected', b.getAttribute('data-val') === (gameSettings.musicOn ? 'on' : 'off')));
    document.querySelectorAll('#sfxToggle .mode-btn').forEach(b => b.classList.toggle('selected', b.getAttribute('data-val') === (gameSettings.sfxOn ? 'on' : 'off')));
    document.querySelectorAll('#particleToggle .mode-btn').forEach(b => b.classList.toggle('selected', b.getAttribute('data-val') === (gameSettings.particlesOn ? 'on' : 'off')));
    document.querySelectorAll('#shakeToggle .mode-btn').forEach(b => b.classList.toggle('selected', b.getAttribute('data-val') === (gameSettings.screenShakeOn ? 'on' : 'off')));
    document.querySelectorAll('#vibrateToggle .mode-btn').forEach(b => b.classList.toggle('selected', b.getAttribute('data-val') === (gameSettings.vibrationOn ? 'on' : 'off')));
    document.getElementById('musicVolumeRange').value = Math.round(gameSettings.musicVolume * 100);
    document.getElementById('sfxVolumeRange').value = Math.round(gameSettings.sfxVolume * 100);
}

function openSettings(inGame = false) {
    initAudio(); refreshSettingsUI();
    document.getElementById('quitGameBtn').style.display = inGame ? 'block' : 'none';
    document.getElementById('settingsModal').style.display = 'flex';
}
function closeSettings() {
    initAudio(); document.getElementById('settingsModal').style.display = 'none';
}
document.getElementById('openSettingsBtn').addEventListener('click', () => openSettings(false));
document.getElementById('inGameSettingsBtn').addEventListener('click', () => openSettings(true));
document.getElementById('closeSettingsBtn').addEventListener('click', closeSettings);

// ===== MODAL KONFIRMASI KUSTOM (pengganti confirm() bawaan browser) =====
function showConfirm(title, message, onConfirm) {
    initAudio();
    document.getElementById('confirmModalTitle').innerText = title;
    document.getElementById('confirmModalMessage').innerText = message;
    const modal = document.getElementById('confirmModal');
    const okBtn = document.getElementById('confirmModalOkBtn');
    const cancelBtn = document.getElementById('confirmModalCancelBtn');
    modal.style.display = 'flex';
    okBtn.onclick = () => {
        initAudio();
        modal.style.display = 'none';
        onConfirm();
    };
    cancelBtn.onclick = () => {
        initAudio();
        modal.style.display = 'none';
    };
}

document.getElementById('quitGameBtn').addEventListener('click', () => {
    initAudio();
    showConfirm('KELUAR DARI PERMAINAN', 'Kamu yakin ingin keluar dari permainan?', () => {
        gameRunning = false;
        cancelAnimationFrame(animId);
        if (mpConn) { try { mpConn.send({ type: 'leave' }); mpConn.close(); } catch (e) {} }
        mpConn = null; isMultiplayer = false;
        if (mpStateInterval) { clearInterval(mpStateInterval); mpStateInterval = null; }
        document.getElementById('oppHud').style.display = 'none';
        document.getElementById('settingsModal').style.display = 'none';
        document.getElementById('gameOverModal').classList.remove('active');
        updateMenuCoins();
        let overlay = document.getElementById('loginOverlay');
        overlay.style.display = 'flex';
        setTimeout(() => overlay.style.opacity = '1', 10);
    });
});

document.querySelectorAll('#musicToggle .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        initAudio();
        gameSettings.musicOn = btn.getAttribute('data-val') === 'on';
        if (gameSettings.musicOn) startMusic(); else stopMusic();
        saveSettings(); refreshSettingsUI();
        playSfx(400, 600, 'square', 0.1, 0.05);
    });
});
document.getElementById('musicVolumeRange').addEventListener('input', (e) => {
    gameSettings.musicVolume = e.target.value / 100;
    applyMusicVolume(); saveSettings();
});

document.querySelectorAll('#sfxToggle .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        initAudio();
        gameSettings.sfxOn = btn.getAttribute('data-val') === 'on';
        saveSettings(); refreshSettingsUI();
        playSfx(400, 600, 'square', 0.1, 0.05);
    });
});
document.getElementById('sfxVolumeRange').addEventListener('input', (e) => {
    gameSettings.sfxVolume = e.target.value / 100;
    saveSettings();
});
document.getElementById('sfxVolumeRange').addEventListener('change', () => {
    initAudio(); playSfx(400, 700, 'sine', 0.12, 0.1);
});

document.querySelectorAll('#particleToggle .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        initAudio();
        gameSettings.particlesOn = btn.getAttribute('data-val') === 'on';
        saveSettings(); refreshSettingsUI();
        playSfx(400, 600, 'square', 0.1, 0.05);
    });
});

document.querySelectorAll('#shakeToggle .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        initAudio();
        gameSettings.screenShakeOn = btn.getAttribute('data-val') === 'on';
        saveSettings(); refreshSettingsUI();
        playSfx(400, 600, 'square', 0.1, 0.05);
    });
});

document.querySelectorAll('#vibrateToggle .mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        initAudio();
        gameSettings.vibrationOn = btn.getAttribute('data-val') === 'on';
        saveSettings(); refreshSettingsUI();
        playSfx(400, 600, 'square', 0.1, 0.05);
        if (gameSettings.vibrationOn && navigator.vibrate) { try { navigator.vibrate(25); } catch(e){} }
    });
});

document.getElementById('resetProgressBtn').addEventListener('click', () => {
    initAudio();
    showConfirm('KAMU YAKIN INGIN RESET PROGRES', 'Koin, skin, rekor jarak, misi, dan pencapaian akan dihapus permanen.', () => {
        ['edward_total_coins','edward_owned_skins','edward_selected_skin','edward_high_dist','edward_leaderboard','edward_stats','edward_achievements','edward_daily','edward_peer_id'].forEach(k => localStorage.removeItem(k));
        showToast('Progres berhasil direset!', true);
        setTimeout(() => location.reload(), 900);
    });
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
    flagged: false, _lastDist: 0, _lastCoins: 0, _lastTime: 0, _strikes: 0,
    walkCycle: 0, legSwing: 0, grounded: true
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
    let selectedModeBtn = document.querySelector('#modePicker .mode-btn.selected');
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
        flagged: false, _lastDist: 0, _lastCoins: 0, _lastTime: 0, _strikes: 0,
        walkCycle: 0, legSwing: 0, grounded: true
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

    let selectedModeBtn = document.querySelector('#modePicker .mode-btn.selected');
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
let enemyProjectiles = [];
let bgElements = [], stars = [], clouds = [];
let currentDimension = 0, dimensionFlash = 0;
let platformIndex = 0;
let ambientField = [];

const themes = [
    { type: 'earth', name: "Bumi", plat: "#1e293b", top: "#00d2d3", lava: "#ff4500", sky1: "#38bdf8", sky2: "#bae6fd",
      mountain: "rgba(15, 23, 42, 0.4)", ambientColor: "255,255,255", ambientMode: 'rise', ambientShape: 'circle' },
    { type: 'cyber', name: "Kota Neon", plat: "#2f002c", top: "#ff007f", lava: "#00ffff", sky1: "#240046", sky2: "#10002b",
      mountain: "rgba(20, 0, 40, 0.55)", ambientColor: "0,255,255", ambientMode: 'glitch', ambientShape: 'square' },
    { type: 'alien', name: "Planet Asing", plat: "#1a3622", top: "#00e676", lava: "#c51162", sky1: "#3b0764", sky2: "#180325",
      mountain: "rgba(10, 30, 15, 0.5)", ambientColor: "173,255,120", ambientMode: 'rise', ambientShape: 'circle' },
    { type: 'ice', name: "Kutub Beku", plat: "#1e3a4a", top: "#e0f7fa", lava: "#4fc3f7", sky1: "#7fd8f7", sky2: "#e8fbff",
      mountain: "rgba(200, 240, 255, 0.35)", ambientColor: "255,255,255", ambientMode: 'fall', ambientShape: 'circle' },
    { type: 'volcano', name: "Gunung Magma", plat: "#2b1a12", top: "#ff5722", lava: "#ff9100", sky1: "#3d0d0d", sky2: "#1a0505",
      mountain: "rgba(40, 5, 5, 0.55)", ambientColor: "255,140,60", ambientMode: 'rise', ambientShape: 'circle' },
    { type: 'ocean', name: "Lautan Dalam", plat: "#062f4a", top: "#26c6da", lava: "#014f86", sky1: "#012a4a", sky2: "#01497c",
      mountain: "rgba(1, 30, 50, 0.5)", ambientColor: "150,230,255", ambientMode: 'rise', ambientShape: 'circle' },
    { type: 'desert', name: "Gurun Pasir", plat: "#7a5230", top: "#ffca7a", lava: "#c1440e", sky1: "#ffb347", sky2: "#ffe1a8",
      mountain: "rgba(120, 70, 30, 0.4)", ambientColor: "255,224,150", ambientMode: 'fall', ambientShape: 'circle' },
    { type: 'galaxy', name: "Angkasa Luar", plat: "#12082e", top: "#b388ff", lava: "#651fff", sky1: "#050014", sky2: "#1a0940",
      mountain: "rgba(10, 5, 30, 0.6)", ambientColor: "200,180,255", ambientMode: 'drift', ambientShape: 'circle' },
    { type: 'candy', name: "Dunia Permen", plat: "#ff8fab", top: "#ffe1f0", lava: "#ff5c8a", sky1: "#ffd6e8", sky2: "#fff0f7",
      mountain: "rgba(255, 180, 210, 0.4)", ambientColor: "255,255,255", ambientMode: 'fall', ambientShape: 'circle' },
    { type: 'glitch', name: "Dimensi Glitch", plat: "#0a0a0a", top: "#39ff14", lava: "#ff003c", sky1: "#000000", sky2: "#1a001a",
      mountain: "rgba(20, 0, 20, 0.6)", ambientColor: "57,255,20", ambientMode: 'glitch', ambientShape: 'square' },
    { type: 'crystal', name: "Kristal Ajaib", plat: "#2d1b4e", top: "#a78bfa", lava: "#7c3aed", sky1: "#4c1d95", sky2: "#ede9fe",
      mountain: "rgba(76, 29, 149, 0.4)", ambientColor: "200,180,255", ambientMode: 'drift', ambientShape: 'circle' },
    { type: 'toxic', name: "Rawa Beracun", plat: "#1a2e1a", top: "#84cc16", lava: "#4d7c0f", sky1: "#1a2e05", sky2: "#3f6212",
      mountain: "rgba(20, 40, 10, 0.5)", ambientColor: "190,255,80", ambientMode: 'rise', ambientShape: 'circle' },
    { type: 'sakura', name: "Sakura Musim Semi", plat: "#4a2c3a", top: "#ffb7c5", lava: "#ff69b4", sky1: "#ffe0ec", sky2: "#fff5f8",
      mountain: "rgba(255, 150, 180, 0.3)", ambientColor: "255,200,220", ambientMode: 'fall', ambientShape: 'circle' },
    { type: 'storm', name: "Badai Petir", plat: "#1f2937", top: "#fbbf24", lava: "#eab308", sky1: "#111827", sky2: "#374151",
      mountain: "rgba(30, 30, 40, 0.6)", ambientColor: "250,240,150", ambientMode: 'glitch', ambientShape: 'square' },
    { type: 'underworld', name: "Dunia Bawah", plat: "#1a0a0a", top: "#dc2626", lava: "#7f1d1d", sky1: "#000000", sky2: "#2d0a0a",
      mountain: "rgba(40, 0, 0, 0.6)", ambientColor: "255,80,80", ambientMode: 'rise', ambientShape: 'circle' },
    { type: 'coral', name: "Terumbu Karang", plat: "#023047", top: "#ff6b6b", lava: "#ee6c4d", sky1: "#006494", sky2: "#90e0ef",
      mountain: "rgba(0, 60, 80, 0.4)", ambientColor: "255,180,150", ambientMode: 'drift', ambientShape: 'circle' },
    { type: 'aurora', name: "Cahaya Aurora", plat: "#0d1b2a", top: "#56cfe1", lava: "#64dfdf", sky1: "#03071e", sky2: "#22223b",
      mountain: "rgba(10, 20, 40, 0.55)", ambientColor: "150,255,220", ambientMode: 'drift', ambientShape: 'circle' },
    { type: 'ruins', name: "Reruntuhan Kuno", plat: "#6b4423", top: "#d4a373", lava: "#9c6644", sky1: "#edc9a0", sky2: "#faedcd",
      mountain: "rgba(90, 60, 30, 0.4)", ambientColor: "230,200,150", ambientMode: 'fall', ambientShape: 'circle' },
    { type: 'mirror', name: "Dimensi Cermin", plat: "#e5e5e5", top: "#ffffff", lava: "#a1a1aa", sky1: "#f4f4f5", sky2: "#ffffff",
      mountain: "rgba(150, 150, 150, 0.3)", ambientColor: "200,200,255", ambientMode: 'glitch', ambientShape: 'square' },
    { type: 'jungle', name: "Hutan Terlarang", plat: "#14281d", top: "#2d6a4f", lava: "#40916c", sky1: "#081c15", sky2: "#1b4332",
      mountain: "rgba(10, 30, 20, 0.5)", ambientColor: "150,255,180", ambientMode: 'rise', ambientShape: 'circle' },
    { type: 'autumn', name: "Musim Gugur Emas", plat: "#5c3a21", top: "#d97706", lava: "#b45309", sky1: "#fb923c", sky2: "#fde68a",
      mountain: "rgba(120, 60, 20, 0.4)", ambientColor: "251,146,60", ambientMode: 'fall', ambientShape: 'circle' },
    { type: 'gold', name: "Kerajaan Emas", plat: "#78350f", top: "#facc15", lava: "#eab308", sky1: "#fef08a", sky2: "#fde047",
      mountain: "rgba(120, 90, 10, 0.4)", ambientColor: "255,223,100", ambientMode: 'drift', ambientShape: 'circle' },
    { type: 'nebula', name: "Nebula Ungu", plat: "#1e0a3c", top: "#c084fc", lava: "#9333ea", sky1: "#0f0326", sky2: "#3b0764",
      mountain: "rgba(40, 10, 70, 0.55)", ambientColor: "216,180,254", ambientMode: 'drift', ambientShape: 'circle' },
    { type: 'atlantis', name: "Reruntuhan Atlantis", plat: "#083344", top: "#22d3ee", lava: "#0e7490", sky1: "#012a3a", sky2: "#075985",
      mountain: "rgba(5, 40, 60, 0.5)", ambientColor: "125,211,252", ambientMode: 'rise', ambientShape: 'circle' },
    { type: 'bioluminescent', name: "Rimba Bercahaya", plat: "#052e16", top: "#4ade80", lava: "#15803d", sky1: "#01130a", sky2: "#022c14",
      mountain: "rgba(5, 40, 20, 0.55)", ambientColor: "134,239,172", ambientMode: 'drift', ambientShape: 'circle' },
    { type: 'timerift', name: "Celah Waktu", plat: "#111827", top: "#facc15", lava: "#eab308", sky1: "#0a0a0a", sky2: "#27272a",
      mountain: "rgba(20, 20, 20, 0.6)", ambientColor: "250,204,21", ambientMode: 'glitch', ambientShape: 'square' },
    { type: 'nightforest', name: "Hutan Kristal Malam", plat: "#0f172a", top: "#818cf8", lava: "#4f46e5", sky1: "#020617", sky2: "#1e1b4b",
      mountain: "rgba(10, 10, 40, 0.55)", ambientColor: "165,180,252", ambientMode: 'drift', ambientShape: 'circle' },
    { type: 'mars', name: "Gurun Merah Mars", plat: "#7c2d12", top: "#ea580c", lava: "#9a3412", sky1: "#450a0a", sky2: "#7c2d12",
      mountain: "rgba(90, 20, 10, 0.5)", ambientColor: "251,146,60", ambientMode: 'fall', ambientShape: 'circle' },
    { type: 'wasteland', name: "Kota Terbengkalai", plat: "#292524", top: "#78716c", lava: "#57534e", sky1: "#1c1917", sky2: "#44403c",
      mountain: "rgba(30, 30, 25, 0.6)", ambientColor: "168,162,158", ambientMode: 'fall', ambientShape: 'square' },
    { type: 'heaven', name: "Surga Awan", plat: "#e0f2fe", top: "#ffffff", lava: "#bae6fd", sky1: "#dbeafe", sky2: "#fff7ed",
      mountain: "rgba(255, 255, 255, 0.4)", ambientColor: "255,255,255", ambientMode: 'drift', ambientShape: 'circle' }
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
    
    enemies = []; enemyProjectiles = []; killsThisRun = 0;
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

    ambientField = [];
    for(let i=0; i<32; i++) ambientField.push({ baseX: Math.random() * viewportW * 1.5, baseY: Math.random() * viewportH, phase: Math.random() * 10, size: Math.random() * 2.2 + 1.2, speedMult: 0.5 + Math.random() * 0.9 });

    let dimBadge = document.getElementById('dimensionHUD');
    if (dimBadge) dimBadge.innerText = "🌀 " + themes[0].name;

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
    if (!gameSettings.particlesOn) count = Math.max(1, Math.ceil(count * 0.2));
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
            let maxActiveEnemies = 7;
            let spawnChance = Math.min(0.55, 0.22 + platformIndex / 200);
            if (enemies.length < maxActiveEnemies && rr() < spawnChance) {
                let randPick = rr();
                let type, tier, ew, eh, ex, ey, evx;
                let speedMul = 1 + Math.min(0.75, platformIndex / 220);
                let canChaser = platformIndex > 6;
                let canTurret = platformIndex > 9;

                if (randPick < 0.22) {
                    type = 'empty'; tier = 'low'; ew = 24; eh = 36;
                    ex = newX + platWidth/2; ey = newY - eh; evx = -1.2 * speedMul;
                } else if (randPick < 0.42) {
                    type = 'sword'; tier = 'mid'; ew = 26; eh = 40;
                    ex = newX + platWidth/2; ey = newY - eh; evx = -1.8 * speedMul;
                } else if (randPick < 0.58) {
                    type = 'bomb'; tier = 'mid'; ew = 28; eh = 28;
                    ex = newX + platWidth/2; ey = newY - eh; evx = -0.8 * speedMul;
                } else if (randPick < 0.74) {
                    type = 'plane'; tier = 'high'; ew = 44; eh = 22;
                    ex = newX + platWidth/2; ey = newY - 140 - rr()*60; evx = -2.5 * speedMul;
                } else if (randPick < 0.88 && canChaser) {
                    type = 'chaser'; tier = 'mid'; ew = 26; eh = 34;
                    ex = newX + platWidth/2; ey = newY - eh; evx = -2.2 * speedMul;
                } else if (canTurret) {
                    type = 'turret'; tier = 'high'; ew = 30; eh = 30;
                    ex = newX + platWidth/2; ey = newY - eh; evx = 0;
                } else {
                    type = 'sword'; tier = 'mid'; ew = 26; eh = 40;
                    ex = newX + platWidth/2; ey = newY - eh; evx = -1.8 * speedMul;
                }

                enemies.push({ type, tier, x: ex, y: ey, w: ew, h: eh, vx: evx, vy: 0, plat: lastPlat, state: 'normal', cooldown: 60 + rr()*40, chaseTimer: 0 });
            }
        }

        platformIndex++;
    }
    platforms = platforms.filter(pt => pt.x + pt.w > cameraX - 250);
   
    enemies = enemies.filter(e => e.x + e.w > cameraX - 300 && e.y < viewportH + 100 && e.state !== 'dead');
    enemyProjectiles = enemyProjectiles.filter(pr => pr.x > cameraX - 200 && pr.x < cameraX + viewportW + 200 && !pr.dead);

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
        else {
            // Ayunan tangan menyatu dengan gerak kaki (grounded/lompat/jatuh semua pakai kurva yang sama, jadi halus & tidak kaku).
            let swing = isBack ? -legSwing * 1.5 : legSwing * 1.5;
            let liftY = (!p.grounded && p.vy < 0) ? -6 : 0; // sedikit terangkat pas naik, tanpa pose kaku lurus ke atas
            endX = startX + swing; endY = -16 + liftY;
        }
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

        case 'cowboy': drawLegs("#78350f"); drawArm("#a16207", true); drawBody("#a16207"); drawArm("#a16207", false); drawHead("#ffdbac"); ctx.fillStyle = "#451a03"; ctx.beginPath(); ctx.ellipse(0, -50, 13, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.roundRect(-7, -58, 14, 10, 3); ctx.fill(); drawEye(4, -42, 1.5); break;
        case 'chef': drawLegs("#1e293b"); drawArm("#f8fafc", true); drawBody("#f8fafc"); drawArm("#f8fafc", false); drawHead("#ffdbac"); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(0, -56, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-9, -52, 18, 8); drawEye(4, -42, 1.5); break;
        case 'alien': drawLegs("#4ade80"); drawArm("#22c55e", true); drawBody("#22c55e"); drawArm("#22c55e", false); ctx.fillStyle = "#4ade80"; ctx.beginPath(); ctx.ellipse(0, -46, 10, 13, 0, 0, Math.PI * 2); ctx.fill(); drawEye(-3, -46, 3.5, "#000"); drawEye(5, -46, 3.5, "#000"); break;
        case 'samurai': drawLegs("#1c1917"); drawArm("#7f1d1d", true); drawBody("#7f1d1d"); drawArm("#7f1d1d", false); drawHead("#ffdbac"); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(0, -56, 3, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#dc2626"; ctx.fillRect(-11, -47, 22, 3); drawEye(4, -43, 1.3, "#000"); break;
        case 'viking': drawLegs("#57534e"); drawArm("#78716c", true); drawBody("#78716c"); drawArm("#78716c", false); drawHead("#ffdbac"); ctx.fillStyle = "#a8a29e"; ctx.beginPath(); ctx.roundRect(-9, -52, 18, 10, 4); ctx.fill(); ctx.fillStyle = "#e5e7eb"; ctx.beginPath(); ctx.moveTo(-9, -50); ctx.lineTo(-15, -60); ctx.lineTo(-6, -52); ctx.fill(); ctx.beginPath(); ctx.moveTo(9, -50); ctx.lineTo(15, -60); ctx.lineTo(6, -52); ctx.fill(); drawEye(4, -44, 1.5); break;
        case 'mummy': drawLegs("#e7e5e4"); drawArm("#d6d3d1", true); drawBody("#e7e5e4"); drawArm("#d6d3d1", false); drawHead("#e7e5e4"); ctx.strokeStyle = "#a8a29e"; ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-9, -38 + i * 7); ctx.lineTo(9, -40 + i * 7); ctx.stroke(); } drawEye(0, -43, 2, "#facc15"); drawEye(7, -43, 2, "#facc15"); break;
        case 'clown': drawLegs("#f59e0b"); drawArm("#3b82f6", true); drawBody("#3b82f6"); drawArm("#ef4444", false); drawHead("#ffdbac"); ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(4, -38, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#f97316"; ctx.beginPath(); ctx.moveTo(-10, -52); ctx.lineTo(-4, -60); ctx.lineTo(2, -52); ctx.fill(); drawEye(0, -44, 1.5); drawEye(8, -44, 1.5); break;
        case 'detective': drawLegs("#44403c"); drawArm("#57534e", true); drawBody("#78716c"); drawArm("#57534e", false); drawHead("#ffdbac"); ctx.fillStyle = "#292524"; ctx.beginPath(); ctx.ellipse(0, -50, 12, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.roundRect(-6, -58, 12, 9, 2); ctx.fill(); drawEye(4, -42, 1.5); break;
        case 'surfer': drawLegs("#facc15"); drawArm("#fb923c", true); ctx.fillStyle = "#fb923c"; ctx.fillRect(-11, -34, 22, 18); drawArm("#fb923c", false); drawHead("#f59e0b"); ctx.fillStyle = "#fef08a"; ctx.beginPath(); ctx.moveTo(-9, -50); ctx.quadraticCurveTo(0, -58, 9, -50); ctx.fill(); drawEye(4, -44, 1.5); break;
        case 'dj': drawLegs("#111827"); drawArm("#1f2937", true); drawBody("#1f2937"); drawArm("#1f2937", false); drawHead("#ffdbac"); ctx.strokeStyle = "#111827"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -46, 10, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(-9, -42, 3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(9, -42, 3, 0, Math.PI * 2); ctx.fill(); drawEye(4, -42, 1.5); break;
        case 'farmer': drawLegs("#1d4ed8"); drawArm("#dc2626", true); ctx.fillStyle = "#1d4ed8"; ctx.beginPath(); ctx.roundRect(-11, -36, 22, 24, 7); ctx.fill(); ctx.fillStyle = "#dc2626"; ctx.fillRect(-11, -36, 22, 8); drawArm("#dc2626", false); drawHead("#ffdbac"); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.ellipse(0, -50, 13, 4, 0, 0, Math.PI * 2); ctx.fill(); drawEye(4, -42, 1.5); break;
        case 'firefighter': drawLegs("#1e293b"); drawArm("#b91c1c", true); drawBody("#dc2626"); drawArm("#b91c1c", false); drawHead("#ffdbac"); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(0, -49, 10, Math.PI, 0); ctx.fill(); ctx.fillRect(-10, -49, 20, 3); drawEye(4, -43, 1.5); break;
        case 'police': drawLegs("#1e3a8a"); drawArm("#1e40af", true); drawBody("#1e40af"); drawArm("#1e40af", false); drawHead("#ffdbac"); ctx.fillStyle = "#1e3a8a"; ctx.beginPath(); ctx.roundRect(-10, -54, 20, 8, 3); ctx.fill(); ctx.fillStyle = "#facc15"; ctx.fillRect(-2, -52, 4, 4); drawEye(4, -43, 1.5); break;
        case 'doctor': drawLegs("#334155"); drawArm("#f8fafc", true); drawBody("#f8fafc"); drawArm("#f8fafc", false); drawHead("#ffdbac"); ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-4, -34); ctx.quadraticCurveTo(-8, -26, -2, -24); ctx.stroke(); drawEye(4, -43, 1.5); break;
        case 'angel': ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.beginPath(); ctx.ellipse(-13, -28, 9, 15, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(13, -28, 9, 15, 0.3, 0, Math.PI * 2); ctx.fill(); drawLegs("#f8fafc"); drawArm("#f1f5f9", true); drawBody("#f8fafc"); drawArm("#f1f5f9", false); drawHead("#ffdbac"); ctx.strokeStyle = "#facc15"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -57, 7, 2.5, 0, 0, Math.PI * 2); ctx.stroke(); drawEye(4, -43, 1.5); break;
        case 'devil': drawLegs("#450a0a"); drawArm("#7f1d1d", true); drawBody("#b91c1c"); drawArm("#7f1d1d", false); drawHead("#dc2626"); ctx.fillStyle = "#450a0a"; ctx.beginPath(); ctx.moveTo(-6, -50); ctx.lineTo(-9, -58); ctx.lineTo(-2, -52); ctx.fill(); ctx.beginPath(); ctx.moveTo(6, -50); ctx.lineTo(9, -58); ctx.lineTo(2, -52); ctx.fill(); drawEye(4, -43, 1.5, "#facc15"); break;
        case 'phoenix': ctx.fillStyle = "#f97316"; ctx.beginPath(); ctx.moveTo(-9, -34); ctx.quadraticCurveTo(-22, -20, -11, -10); ctx.quadraticCurveTo(-14, -24, -9, -34); ctx.fill(); drawLegs("#7c2d12"); drawArm("#ea580c", true); drawBody("#f97316"); drawArm("#ea580c", false); drawHead("#facc15"); ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.moveTo(-5, -52); ctx.lineTo(0, -60); ctx.lineTo(5, -52); ctx.fill(); drawEye(4, -44, 1.5, "#7c2d12"); break;
        case 'cyborg': drawLegs("#475569"); drawArm("#64748b", true); ctx.fillStyle = "#94a3b8"; ctx.beginPath(); ctx.roundRect(-11, -36, 22, 24, 7); ctx.fill(); drawArm("#334155", false); ctx.fillStyle = "#e2e8f0"; ctx.beginPath(); ctx.arc(-3, -42, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#334155"; ctx.beginPath(); ctx.arc(5, -42, 9, Math.PI * 1.5, Math.PI * 0.5); ctx.fill(); drawEye(-3, -43, 1.8, "#000"); drawEye(6, -43, 2, "#ef4444"); break;
        case 'dino': drawLegs("#15803d"); drawArm("#166534", true); drawBody("#22c55e"); drawArm("#166534", false); drawHead("#22c55e"); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.moveTo(-2, -53); ctx.lineTo(1, -59); ctx.lineTo(4, -53); ctx.fill(); drawEye(4, -44, 1.8, "#000"); break;
        case 'panda': drawLegs("#1e293b"); drawArm("#1e293b", true); drawBody("#f8fafc"); drawArm("#1e293b", false); drawHead("#f8fafc"); ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.arc(-7, -51, 4, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(7, -51, 4, 0, Math.PI * 2); ctx.fill(); drawEye(0, -43, 3, "#1e293b"); drawEye(8, -43, 3, "#1e293b"); drawEye(0, -43, 1, "#fff"); drawEye(8, -43, 1, "#fff"); break;
        case 'dragonrider': drawCape("#166534"); drawLegs("#1c1917"); drawArm("#292524", true); drawBody("#44403c"); drawArm("#292524", false); drawHead("#ffdbac"); ctx.fillStyle = "#166534"; ctx.beginPath(); ctx.moveTo(-9, -49); ctx.lineTo(0, -60); ctx.lineTo(9, -49); ctx.fill(); drawEye(4, -43, 1.5, "#facc15"); break;

        case 'koala': drawLegs("#64748b"); drawArm("#94a3b8", true); drawBody("#94a3b8"); drawArm("#94a3b8", false); drawHead("#cbd5e1"); ctx.fillStyle = "#64748b"; ctx.beginPath(); ctx.arc(-9, -50, 5, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(9, -50, 5, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "#1e293b"; ctx.beginPath(); ctx.ellipse(4, -40, 3, 4, 0, 0, Math.PI*2); ctx.fill(); drawEye(0, -44, 1.5); break;
        case 'foxy': drawLegs("#c2410c"); drawArm("#ea580c", true); drawBody("#f97316"); drawArm("#ea580c", false); drawHead("#fb923c"); ctx.fillStyle = "#f97316"; ctx.beginPath(); ctx.moveTo(-8, -50); ctx.lineTo(-12, -60); ctx.lineTo(-3, -52); ctx.fill(); ctx.beginPath(); ctx.moveTo(8, -50); ctx.lineTo(12, -60); ctx.lineTo(3, -52); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.ellipse(4, -40, 4, 3, 0, 0, Math.PI*2); ctx.fill(); drawEye(2, -44, 1.3); break;
        case 'wolf': drawLegs("#334155"); drawArm("#475569", true); drawBody("#475569"); drawArm("#475569", false); drawHead("#64748b"); ctx.fillStyle = "#334155"; ctx.beginPath(); ctx.moveTo(-7, -50); ctx.lineTo(-11, -59); ctx.lineTo(-3, -51); ctx.fill(); ctx.beginPath(); ctx.moveTo(7, -50); ctx.lineTo(11, -59); ctx.lineTo(3, -51); ctx.fill(); drawEye(1, -44, 1.5, "#facc15"); drawEye(7, -44, 1.5, "#facc15"); break;
        case 'bear': drawLegs("#5c3a21"); drawArm("#78471f", true); drawBody("#8b5e34"); drawArm("#78471f", false); drawHead("#8b5e34"); ctx.fillStyle = "#5c3a21"; ctx.beginPath(); ctx.arc(-8, -52, 4, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(8, -52, 4, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "#d2b48c"; ctx.beginPath(); ctx.ellipse(4, -40, 4, 3, 0, 0, Math.PI*2); ctx.fill(); drawEye(1, -44, 1.5); drawEye(7, -44, 1.5); break;
        case 'tiger': drawLegs("#c2410c"); drawArm("#ea580c", true); drawBody("#f97316"); drawArm("#ea580c", false); drawHead("#f97316"); ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-9 + i*3, -50); ctx.lineTo(-11 + i*3, -38); ctx.stroke(); } drawEye(1, -44, 1.5); drawEye(7, -44, 1.5); break;
        case 'lion': drawLegs("#b45309"); drawArm("#d97706", true); drawBody("#f59e0b"); drawArm("#d97706", false); ctx.fillStyle = "#92400e"; ctx.beginPath(); ctx.arc(0, -44, 15, 0, Math.PI*2); ctx.fill(); drawHead("#fbbf24"); drawEye(1, -44, 1.5); drawEye(7, -44, 1.5); break;
        case 'eagle': drawLegs("#78350f"); drawArm("#facc15", true); drawBody("#78350f"); drawArm("#facc15", false); drawHead("#fff"); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.moveTo(0, -42); ctx.lineTo(-6, -38); ctx.lineTo(0, -36); ctx.fill(); drawEye(1, -44, 1.5); break;
        case 'shark': drawLegs("#1e3a8a"); drawArm("#1e40af", true); drawBody("#3b82f6"); drawArm("#1e40af", false); drawHead("#60a5fa"); ctx.fillStyle = "#1e3a8a"; ctx.beginPath(); ctx.moveTo(0, -56); ctx.lineTo(-4, -48); ctx.lineTo(4, -48); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(-3, -40); ctx.lineTo(0, -36); ctx.lineTo(3, -40); ctx.fill(); drawEye(1, -44, 1.3, "#000"); break;
        case 'octopus': drawBody("#a855f7"); drawHead("#c084fc"); ctx.strokeStyle = "#a855f7"; ctx.lineWidth = 4; ctx.lineCap = "round"; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-8 + i*5, -12); ctx.quadraticCurveTo(-8 + i*5 + legSwing, -4, -6 + i*5, 2); ctx.stroke(); } drawEye(1, -44, 2); drawEye(7, -44, 2); break;
        case 'jellyfish': ctx.fillStyle = "rgba(56,189,248,0.7)"; ctx.beginPath(); ctx.arc(0, -42, 13, Math.PI, 0); ctx.fill(); ctx.strokeStyle = "rgba(56,189,248,0.6)"; ctx.lineWidth = 2; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-9 + i*6, -42); ctx.quadraticCurveTo(-9 + i*6 + legSwing, -25, -9 + i*6, -10); ctx.stroke(); } drawEye(1, -44, 1.5, "#fff"); drawEye(7, -44, 1.5, "#fff"); break;
        case 'dragon': drawCape("#166534"); drawLegs("#14532d"); drawArm("#166534", true); drawBody("#22c55e"); drawArm("#166534", false); drawHead("#22c55e"); drawEye(4, -44, 1.8, "#facc15"); ctx.fillStyle = "#14532d"; ctx.beginPath(); ctx.moveTo(-3, -53); ctx.lineTo(0, -60); ctx.lineTo(3, -53); ctx.fill(); ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.moveTo(6, -40); ctx.lineTo(12, -38); ctx.lineTo(6, -36); ctx.fill(); break;
        case 'unicorn': drawLegs("#fff"); drawArm("#f1f5f9", true); drawBody("#fff"); drawArm("#f1f5f9", false); drawHead("#fff"); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.moveTo(-1, -50); ctx.lineTo(-3, -62); ctx.lineTo(2, -50); ctx.fill(); ctx.fillStyle = "#f9a8d4"; ctx.beginPath(); ctx.moveTo(-9, -50); ctx.quadraticCurveTo(-16, -42, -9, -34); ctx.quadraticCurveTo(-12, -44, -9, -50); ctx.fill(); drawEye(2, -44, 1.5); break;
        case 'mermaid': drawArm("#fbbf24", true); drawBody("#ffdbac"); drawArm("#fbbf24", false); drawHead("#ffdbac"); ctx.fillStyle = "#06b6d4"; ctx.beginPath(); ctx.moveTo(-6, -12); ctx.quadraticCurveTo(0, 4 + legSwing, 6, -12); ctx.lineTo(0, -14); ctx.fill(); ctx.fillStyle = "#f472b6"; ctx.fillRect(-8, -38, 16, 6); drawEye(4, -44, 1.5); break;
        case 'genie': ctx.fillStyle = "#0891b2"; ctx.beginPath(); ctx.moveTo(-9, -12); ctx.quadraticCurveTo(-14, -30, -4, -36); ctx.lineTo(4, -36); ctx.quadraticCurveTo(14, -30, 9, -12); ctx.fill(); drawArm("#0e7490", true); drawBody("#06b6d4"); drawArm("#0e7490", false); drawHead("#ffdbac"); ctx.fillStyle = "#facc15"; ctx.fillRect(-9, -49, 18, 4); drawEye(4, -43, 1.5); break;
        case 'werewolf': drawLegs("#3f3f46"); drawArm("#52525b", true); drawBody("#52525b"); drawArm("#52525b", false); drawHead("#71717a"); ctx.fillStyle = "#3f3f46"; ctx.beginPath(); ctx.moveTo(-7, -50); ctx.lineTo(-10, -58); ctx.lineTo(-3, -51); ctx.fill(); ctx.beginPath(); ctx.moveTo(7, -50); ctx.lineTo(10, -58); ctx.lineTo(3, -51); ctx.fill(); drawEye(1, -44, 1.8, "#facc15"); drawEye(7, -44, 1.8, "#facc15"); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(1, -38); ctx.lineTo(2, -35); ctx.lineTo(3, -38); ctx.fill(); break;
        case 'frankenstein': drawLegs("#1e293b"); drawArm("#166534", true); drawBody("#4b5563"); drawArm("#166534", false); ctx.fillStyle = "#166534"; ctx.beginPath(); ctx.roundRect(-9, -52, 18, 20, 3); ctx.fill(); ctx.fillStyle = "#374151"; ctx.fillRect(-11, -38, 22, 4); ctx.fillStyle = "#9ca3af"; ctx.fillRect(-13, -42, 4, 3); ctx.fillRect(9, -42, 4, 3); drawEye(-3, -44, 1.5); drawEye(5, -44, 1.5); break;
        case 'ghost': ctx.globalAlpha = 0.75; ctx.fillStyle = "#e0f2fe"; ctx.beginPath(); ctx.arc(0, -36, 13, Math.PI, 0); ctx.lineTo(11, -14); for (let i = 0; i < 3; i++) ctx.quadraticCurveTo(11 - i*7 - 3.5, -14 + (i%2===0 ? 6 : -2), 11 - (i+1)*7, -14); ctx.fill(); drawEye(-3, -38, 2, "#0f172a"); drawEye(4, -38, 2, "#0f172a"); ctx.globalAlpha = 1; break;
        case 'reaper': drawCape("#0f172a"); drawLegs("#000"); drawArm("#111827", true); drawBody("#1e293b"); drawArm("#111827", false); ctx.fillStyle = "#000"; ctx.beginPath(); ctx.moveTo(-9, -36); ctx.quadraticCurveTo(0, -60, 9, -36); ctx.fill(); drawEye(1, -45, 1.5, "#facc15"); drawEye(7, -45, 1.5, "#facc15"); ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-14, -30); ctx.lineTo(-14, -55); ctx.stroke(); break;
        case 'ninjaturtle': drawLegs("#166534"); drawArm("#16a34a", true); drawBody("#22c55e"); drawArm("#16a34a", false); drawHead("#22c55e"); ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.roundRect(-13, -52, 26, 14, 4); ctx.fill(); ctx.fillStyle = "#16a34a"; ctx.fillRect(-11, -47, 22, 3); drawEye(1, -44, 1.5); drawEye(7, -44, 1.5); break;
        case 'godzilla': drawLegs("#1e3a2e"); drawArm("#166534", true); drawBody("#22c55e"); drawArm("#166534", false); drawHead("#22c55e"); ctx.fillStyle = "#a3e635"; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-4 + i*4, -50); ctx.lineTo(-2 + i*4, -58); ctx.lineTo(0 + i*4, -50); ctx.fill(); } drawEye(4, -44, 2, "#ef4444"); break;
        case 'kingkong': drawLegs("#3f2e1a"); drawArm("#57432a", true); drawBody("#6b4f2f"); drawArm("#57432a", false); drawHead("#6b4f2f"); ctx.fillStyle = "#3f2e1a"; ctx.beginPath(); ctx.ellipse(4, -40, 5, 4, 0, 0, Math.PI*2); ctx.fill(); drawEye(1, -44, 1.8); drawEye(7, -44, 1.8); break;
        case 'ultraman': drawLegs("#dc2626"); drawArm("#e5e7eb", true); drawBody("#e5e7eb"); drawArm("#e5e7eb", false); drawHead("#f3f4f6"); ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.arc(0, -42, 11, 0, Math.PI); ctx.fill(); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.ellipse(4, -44, 4, 2, 0, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "#dc2626"; ctx.fillRect(-2, -56, 8, 4); break;
        case 'gladiator': drawLegs("#78716c"); drawArm("#a8a29e", true); drawBody("#d6d3d1"); drawArm("#a8a29e", false); drawHead("#ffdbac"); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.roundRect(-9, -52, 18, 9, 3); ctx.fill(); ctx.fillStyle = "#dc2626"; ctx.beginPath(); ctx.moveTo(-2, -60); ctx.lineTo(2, -60); ctx.lineTo(0, -52); ctx.fill(); drawEye(4, -43, 1.5); break;
        case 'pharaoh': drawLegs("#facc15"); drawArm("#eab308", true); drawBody("#fde047"); drawArm("#eab308", false); drawHead("#ffdbac"); ctx.fillStyle = "#1d4ed8"; ctx.beginPath(); ctx.moveTo(-10, -52); ctx.lineTo(10, -52); ctx.lineTo(6, -36); ctx.lineTo(-6, -36); ctx.fill(); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(0, -56, 4, 0, Math.PI*2); ctx.fill(); drawEye(4, -43, 1.5); break;
        case 'ninjawhite': drawLegs("#e5e7eb"); drawArm("#f3f4f6", true); drawBody("#f8fafc"); drawArm("#f3f4f6", false); drawHead("#f8fafc"); ctx.fillStyle = "#ffdbac"; ctx.fillRect(0, -47, 8, 6); ctx.fillStyle = "#94a3b8"; ctx.fillRect(-11, -49, 22, 3); drawEye(4, -44, 1.5, "#000"); break;
        case 'archer': drawLegs("#166534"); drawArm("#15803d", true); drawBody("#16a34a"); drawArm("#15803d", false); drawHead("#ffdbac"); ctx.strokeStyle = "#78350f"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12, -38); ctx.quadraticCurveTo(-16, -24, -12, -10); ctx.stroke(); drawEye(4, -43, 1.5); break;
        case 'icemage': drawLegs("#0c4a6e"); drawArm("#0284c7", true); drawBody("#0ea5e9"); drawArm("#0284c7", false); drawHead("#ffdbac"); ctx.fillStyle = "#e0f2fe"; ctx.beginPath(); ctx.moveTo(-9, -49); ctx.lineTo(9, -49); ctx.lineTo(0, -66); ctx.fill(); ctx.fillStyle = "#a5f3fc"; ctx.beginPath(); ctx.arc(0, -62, 1.5, 0, Math.PI*2); ctx.fill(); drawEye(4, -44, 1.5, "#a5f3fc"); break;
        case 'paladin': drawLegs("#94a3b8"); drawArm("#cbd5e1", true); drawBody("#f1f5f9"); drawArm("#cbd5e1", false); ctx.fillStyle = "#e2e8f0"; ctx.beginPath(); ctx.arc(0, -42, 11, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "#facc15"; ctx.fillRect(-2, -58, 4, 10); ctx.fillRect(-6, -52, 12, 3); break;
        case 'assassin': drawCape("#111827"); drawLegs("#0f172a"); drawArm("#1f2937", true); drawBody("#1e293b"); drawArm("#1f2937", false); drawHead("#111827"); ctx.fillStyle = "#ffdbac"; ctx.fillRect(2, -46, 6, 5); drawEye(4, -43, 1.3, "#dc2626"); break;
        case 'berserker': drawLegs("#78350f"); drawArm("#92400e", true); drawBody("#b91c1c"); drawArm("#92400e", false); drawHead("#ffdbac"); ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-2, -46); ctx.lineTo(2, -40); ctx.stroke(); drawEye(4, -43, 1.8, "#ef4444"); break;
        case 'alchemist': drawLegs("#4c1d95"); drawArm("#6d28d9", true); drawBody("#7c3aed"); drawArm("#6d28d9", false); drawHead("#ffdbac"); ctx.fillStyle = "#22c55e"; ctx.beginPath(); ctx.arc(-10, -20, 4, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = "#4c1d95"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-10, -24); ctx.lineTo(-10, -16); ctx.stroke(); drawEye(4, -44, 1.5); break;
        case 'bard': drawLegs("#7e22ce"); drawArm("#9333ea", true); drawBody("#a855f7"); drawArm("#9333ea", false); drawHead("#ffdbac"); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.moveTo(-9, -49); ctx.lineTo(9, -49); ctx.lineTo(0, -58); ctx.fill(); ctx.strokeStyle = "#78350f"; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(-10, -20, 5, 7, 0.3, 0, Math.PI*2); ctx.stroke(); drawEye(4, -43, 1.5); break;
        case 'monk': drawLegs("#c2410c"); drawArm("#ea580c", true); drawBody("#fb923c"); drawArm("#ea580c", false); drawHead("#ffdbac"); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(0, -42, 11, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "#ffdbac"; ctx.beginPath(); ctx.arc(0, -44, 8, 0, Math.PI*2); ctx.fill(); drawEye(3, -44, 1.3); break;
        case 'ranger': drawLegs("#166534"); drawArm("#15803d", true); drawBody("#166534"); drawArm("#15803d", false); drawHead("#ffdbac"); ctx.fillStyle = "#4d7c0f"; ctx.beginPath(); ctx.ellipse(0, -50, 13, 4, 0, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.roundRect(-7, -58, 14, 10, 3); ctx.fill(); drawEye(4, -43, 1.5); break;
        case 'shaman': drawLegs("#78350f"); drawArm("#92400e", true); drawBody("#a16207"); drawArm("#92400e", false); drawHead("#ffdbac"); ctx.fillStyle = "#facc15"; ctx.beginPath(); ctx.arc(0, -38, 2, 0, Math.PI*2); ctx.fill(); ctx.strokeStyle = "#78350f"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-9, -49); ctx.lineTo(-4, -58); ctx.lineTo(1, -49); ctx.stroke(); drawEye(4, -43, 1.5); break;
        case 'valkyrie': drawCape("#fbbf24"); drawLegs("#78716c"); drawArm("#a8a29e", true); drawBody("#e2e8f0"); drawArm("#a8a29e", false); drawHead("#ffdbac"); ctx.fillStyle = "#e2e8f0"; ctx.beginPath(); ctx.moveTo(-9, -52); ctx.lineTo(9, -52); ctx.lineTo(0, -64); ctx.fill(); ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.moveTo(-9, -50); ctx.lineTo(-18, -58); ctx.lineTo(-9, -46); ctx.fill(); drawEye(4, -43, 1.5); break;
        case 'cyclops': drawLegs("#4c1d95"); drawArm("#6d28d9", true); drawBody("#7c3aed"); drawArm("#6d28d9", false); drawHead("#c4b5fd"); drawEye(3, -44, 4, "#fff"); drawEye(3, -44, 1.8, "#0f172a"); break;
        case 'golem': drawLegs("#57534e"); drawArm("#78716c", true); ctx.fillStyle = "#a8a29e"; ctx.beginPath(); ctx.roundRect(-13, -38, 26, 26, 4); ctx.fill(); drawArm("#78716c", false); ctx.fillStyle = "#78716c"; ctx.beginPath(); ctx.roundRect(-9, -52, 18, 14, 3); ctx.fill(); ctx.fillStyle = "#4ade80"; ctx.fillRect(-6, -47, 5, 3); ctx.fillRect(2, -47, 5, 3); break;
        case 'spacecat': drawLegs("#1e293b"); drawArm("#334155", true); drawBody("#475569"); drawArm("#334155", false); drawHead("#94a3b8"); ctx.fillStyle = "#94a3b8"; ctx.beginPath(); ctx.moveTo(-8, -50); ctx.lineTo(-11, -58); ctx.lineTo(-4, -51); ctx.fill(); ctx.beginPath(); ctx.moveTo(8, -50); ctx.lineTo(11, -58); ctx.lineTo(4, -51); ctx.fill(); ctx.fillStyle = "#38bdf8"; ctx.beginPath(); ctx.roundRect(-2, -49, 10, 9, 3); ctx.fill(); drawEye(1, -44, 1.3); break;
        case 'mecha': drawLegs("#334155"); drawArm("#475569", true); ctx.fillStyle = "#64748b"; ctx.beginPath(); ctx.roundRect(-13, -38, 26, 26, 5); ctx.fill(); drawArm("#475569", false); ctx.fillStyle = "#94a3b8"; ctx.beginPath(); ctx.roundRect(-11, -54, 22, 16, 4); ctx.fill(); ctx.fillStyle = "#ef4444"; ctx.beginPath(); ctx.arc(0, -46, 3, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = "#22d3ee"; ctx.fillRect(-8, -50, 4, 3); ctx.fillRect(4, -50, 4, 3); break;

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
    triggerShake(10);
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
        let enteredTheme = themes[currentDimension % themes.length];
        playSfx(800, 150, 'sawtooth', 0.6, 0.3);
        floatingTexts.push({ x: p.x + p.w/2, y: p.y - 30, text: "✨ " + enteredTheme.name.toUpperCase() + "!", alpha: 1 });
        let dimBadge = document.getElementById('dimensionHUD');
        if (dimBadge) dimBadge.innerText = "🌀 " + enteredTheme.name;
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
        } else if (e.type === 'turret') {
            // Diam di tempat, menembak proyektil terarah secara berkala
            e.cooldown -= 1;
            let dist = Math.abs(p.x - e.x);
            if (e.cooldown <= 0 && dist < 480) {
                let dx = (p.x + p.w/2) - (e.x + e.w/2), dy = (p.y + p.h/2) - (e.y + e.h/2);
                let ang = Math.atan2(dy, dx);
                let spd = 4.6 + Math.min(2, platformIndex / 200);
                enemyProjectiles.push({ x: e.x + e.w/2, y: e.y + e.h/2, vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd, r: 6, dead: false });
                playSfx(500, 250, 'sawtooth', 0.15, 0.08);
                e.cooldown = 95 - Math.min(40, platformIndex / 6);
            }
        } else if (e.type === 'chaser') {
            let dist = Math.abs(p.x - e.x);
            let sameLevel = Math.abs((p.y + p.h) - (e.y + e.h)) < 90;
            if (dist < 230 && sameLevel) {
                e.chaseTimer = Math.min(30, e.chaseTimer + 1);
                let dir = p.x > e.x ? 1 : -1;
                let boosted = (Math.abs(e.vx) / (e.vx < 0 ? -1 : 1)) * 1.8;
                e.vx = dir * Math.max(2.4, Math.abs(e.vx) * 1.9);
            } else {
                e.chaseTimer = Math.max(0, e.chaseTimer - 1);
            }
            e.x += e.vx; e.y += e.vy;
            if (e.x < e.plat.x) { e.x = e.plat.x; e.vx = Math.abs(e.vx); }
            if (e.x + e.w > e.plat.x + e.plat.w) { e.x = e.plat.x + e.plat.w - e.w; e.vx = -Math.abs(e.vx); }
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
                    triggerShake(8);
                } else {
                    createDust(e.x + e.w/2, e.y + e.h/2, 10, true);
                }
            } else {
                takePlayerDamage();
                triggerShake(6);
            }
        }
    });

    enemyProjectiles.forEach(pr => {
        if (pr.dead) return;
        pr.x += pr.vx; pr.y += pr.vy;
        let hitX = (p.x < pr.x + pr.r && p.x + p.w > pr.x - pr.r);
        let hitY = (p.y < pr.y + pr.r && p.y + p.h > pr.y - pr.r);
        if (hitX && hitY) {
            if (p.isDashing) {
                pr.dead = true;
                createDust(pr.x, pr.y, 6, true);
                playSfx(600, 900, 'sine', 0.1, 0.08);
            } else {
                pr.dead = true;
                takePlayerDamage();
                triggerShake(5);
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

    let shakeX = 0, shakeY = 0;
    if (screenShakeMag > 0.1) {
        shakeX = (Math.random()*2 - 1) * screenShakeMag;
        shakeY = (Math.random()*2 - 1) * screenShakeMag;
        screenShakeMag *= 0.88;
    } else { screenShakeMag = 0; }
    ctx.save(); ctx.translate(shakeX, shakeY);

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
    } else if (curTheme.type === 'ice') {
        ctx.fillStyle = "#f0fbff"; ctx.beginPath(); ctx.arc(celX, celY, 42, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.lineWidth = 3;
        for (let i = 0; i < 6; i++) { let ang = (i / 6) * Math.PI * 2 + timeOsc * 0.2; ctx.beginPath(); ctx.moveTo(celX, celY); ctx.lineTo(celX + Math.cos(ang) * 62, celY + Math.sin(ang) * 62); ctx.stroke(); }
    } else if (curTheme.type === 'volcano') {
        let flick = 6 + timeOsc * 5;
        ctx.fillStyle = "rgba(255, 87, 34, 0.35)"; ctx.beginPath(); ctx.arc(celX, celY, 60 + flick, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#ff9100"; ctx.beginPath(); ctx.arc(celX, celY, 42, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#ffe082"; ctx.beginPath(); ctx.arc(celX, celY, 20, 0, Math.PI*2); ctx.fill();
    } else if (curTheme.type === 'ocean') {
        ctx.fillStyle = "rgba(150, 230, 255, 0.5)"; ctx.beginPath(); ctx.arc(celX, celY, 55 + timeOsc*6, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#8ff0ff"; ctx.beginPath(); ctx.arc(celX, celY, 34, 0, Math.PI*2); ctx.fill();
    } else if (curTheme.type === 'desert') {
        ctx.fillStyle = "#ff7043"; ctx.beginPath(); ctx.arc(celX, celY, 55, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(0, celY + 90 + i*14 + Math.sin(Date.now()*0.002 + i)*4); ctx.lineTo(viewportW, celY + 90 + i*14 + Math.sin(Date.now()*0.002 + i + 1)*4); ctx.stroke(); }
    } else if (curTheme.type === 'galaxy') {
        ctx.fillStyle = "#fff9c4"; ctx.beginPath(); ctx.arc(celX, celY, 30 + timeOsc*3, 0, Math.PI*2); ctx.fill();
        for (let i = 0; i < 8; i++) { let ang = (i / 8) * Math.PI * 2; ctx.strokeStyle = "rgba(255,249,196,0.5)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(celX + Math.cos(ang)*36, celY + Math.sin(ang)*36); ctx.lineTo(celX + Math.cos(ang)*52, celY + Math.sin(ang)*52); ctx.stroke(); }
        ctx.fillStyle = "#b388ff"; ctx.beginPath(); ctx.arc(celX - 120, celY - 60, 16, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "rgba(179,136,255,0.7)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(celX - 120, celY - 60, 26, 8, Math.PI/6, 0, Math.PI*2); ctx.stroke();
    } else if (curTheme.type === 'candy') {
        ctx.fillStyle = "#fff0f7"; ctx.beginPath(); ctx.arc(celX, celY, 40, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "#ff8fab"; ctx.lineWidth = 5;
        ctx.beginPath(); for (let a = 0; a < Math.PI*4; a += 0.3) { let r = a * 3.2; ctx.lineTo(celX + Math.cos(a)*r*0.28, celY + Math.sin(a)*r*0.28); } ctx.stroke();
    } else if (curTheme.type === 'glitch') {
        let jitter = Math.floor(Date.now()/80) % 2 === 0 ? 4 : -4;
        ctx.fillStyle = "#39ff14"; ctx.fillRect(celX - 24 + jitter, celY - 24, 48, 48);
        ctx.fillStyle = "#ff003c"; ctx.fillRect(celX - 20 - jitter, celY - 20, 40, 40);
        ctx.fillStyle = "#000"; ctx.fillRect(celX - 10, celY - 10, 20, 20);
    } else {
        // Bola cahaya generik untuk dimensi-dimensi baru, warnanya menyesuaikan tema
        ctx.fillStyle = curTheme.lava; ctx.globalAlpha = 0.32;
        ctx.beginPath(); ctx.arc(celX, celY, 58 + timeOsc*5, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = curTheme.top;
        ctx.beginPath(); ctx.arc(celX, celY, 38, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(celX, celY, 48 + timeOsc*3, 0, Math.PI*2); ctx.stroke();
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    clouds.forEach(c => {
        let drawX = c.x - cameraX * 0.12; 
        ctx.beginPath(); ctx.arc(drawX, c.y, 25*c.scale, Math.PI, Math.PI*2); ctx.arc(drawX + 15*c.scale, c.y - 10*c.scale, 20*c.scale, Math.PI, Math.PI*2); ctx.arc(drawX + 35*c.scale, c.y, 25*c.scale, Math.PI, Math.PI*2); ctx.fill();
    });

    ctx.fillStyle = curTheme.mountain || "rgba(0, 0, 0, 0.35)";
    bgElements.forEach(bg => {
        let drawX = bg.x - cameraX * 0.3;
        ctx.beginPath(); ctx.moveTo(drawX, viewportH - 60); ctx.lineTo(drawX + 150*bg.scale, viewportH - 60 - 240*bg.scale - (bg.seed%50)); ctx.lineTo(drawX + 300*bg.scale, viewportH - 60); ctx.fill();
    });

    let ambT = Date.now() * 0.001;
    let ambFieldW = viewportW * 1.5, ambParX = cameraX * 0.18;
    ambientField.forEach(a => {
        let t = ambT * a.speedMult + a.phase;
        let ax = (((a.baseX - ambParX) % ambFieldW) + ambFieldW) % ambFieldW;
        let ay, alpha = 0.75;
        if (curTheme.ambientMode === 'fall') {
            ay = (a.baseY + t * 45) % (viewportH - 60);
            ax += Math.sin(t * 1.4) * 18;
        } else if (curTheme.ambientMode === 'rise') {
            ay = (viewportH - 60) - ((t * 40 + a.baseY) % (viewportH - 60));
            ax += Math.sin(t * 1.2) * 16;
        } else if (curTheme.ambientMode === 'glitch') {
            ay = a.baseY + Math.cos(t * 4) * 5;
            ax += Math.sin(t * 3) * 5;
            alpha = (Math.floor(t * 6 + a.phase) % 4 === 0) ? 1 : 0.15;
        } else {
            ay = a.baseY + Math.cos(t * 0.5) * 14;
            ax += Math.sin(t * 0.6) * 14;
            alpha = 0.4 + Math.sin(t * 2) * 0.3;
        }
        if (ax < -20 || ax > viewportW + 20) return;
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = `rgb(${curTheme.ambientColor})`;
        if (curTheme.ambientShape === 'square') ctx.fillRect(ax, ay, a.size * 2.2, a.size * 2.2);
        else { ctx.beginPath(); ctx.arc(ax, ay, a.size, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
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
        let prevRenderX = opponent.renderX, prevRenderY = opponent.renderY;
        opponent.renderX += (opponent.targetX - opponent.renderX) * 0.25;
        opponent.renderY += (opponent.targetY - opponent.renderY) * 0.25;

        // Kecepatan nyata lawan diturunkan dari perubahan posisi antar-frame,
        // bukan dari gelombang waktu tetap -> tangan/kaki tidak lagi goyang sendiri saat lawan diam.
        let oppVx = opponent.renderX - prevRenderX;
        let oppVy = opponent.renderY - prevRenderY;
        opponent.grounded = Math.abs(oppVy) < 0.35;

        let oppTargetLegSwing;
        if (opponent.grounded) {
            if (Math.abs(oppVx) > 0.15) { opponent.walkCycle += 0.38; oppTargetLegSwing = Math.sin(opponent.walkCycle) * 7.5; }
            else { oppTargetLegSwing = Math.sin(opponent.walkCycle) * 1.5; }
        } else {
            opponent.walkCycle += 0.28;
            oppTargetLegSwing = Math.sin(opponent.walkCycle) * (oppVy < 0 ? 5 : 3.5);
        }
        opponent.legSwing += (oppTargetLegSwing - opponent.legSwing) * 0.35;

        ctx.save();
        ctx.globalAlpha = 0.88;
        let oppFakeP = {
            x: opponent.renderX, y: opponent.renderY, w: 26, h: 44,
            vx: oppVx, vy: oppVy, grounded: opponent.grounded, isDashing: false,
            facing: opponent.facing || 1, isInvulnerable: 0
        };
        let oppLegSwing = opponent.legSwing;
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
        else if (e.type === 'chaser') {
            let pulse = e.chaseTimer > 0 ? (0.5 + Math.sin(Date.now()*0.03)*0.5) : 0;
            ctx.fillStyle = `rgb(${Math.round(51 + pulse*180)}, ${Math.round(65 - pulse*40)}, ${Math.round(85 - pulse*40)})`;
            ctx.beginPath(); ctx.roundRect(0, 0, e.w, e.h, 6); ctx.fill();
            ctx.fillStyle = '#facc15';
            ctx.fillRect(direction < 0 ? 3 : e.w - 9, 7, 6, 6);
            ctx.fillRect(direction < 0 ? 3 : e.w - 9, e.h - 15, 6, 4);
        }
        else if (e.type === 'turret') {
            ctx.fillStyle = '#4b1d3f';
            ctx.beginPath(); ctx.roundRect(0, e.h*0.35, e.w, e.h*0.65, 6); ctx.fill();
            ctx.fillStyle = e.cooldown < 15 ? '#ff003c' : '#c084fc';
            ctx.beginPath(); ctx.arc(e.w/2, e.h*0.35, e.w*0.4, Math.PI, 0); ctx.fill();
            ctx.fillStyle = '#1a0a17';
            ctx.beginPath(); ctx.arc(e.w/2, e.h*0.35, e.w*0.16, 0, Math.PI*2); ctx.fill();
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

    enemyProjectiles.forEach(pr => {
        if (pr.dead) return;
        ctx.save();
        ctx.fillStyle = curTheme.lava;
        ctx.shadowColor = curTheme.lava; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
    });

    ctx.save();
    
    let targetLegSwing;
    if (p.grounded) {
        if (Math.abs(p.vx) > 0.5) { p.walkCycle += 0.38; targetLegSwing = Math.sin(p.walkCycle) * 7.5; }
        else { targetLegSwing = Math.sin(p.walkCycle) * 1.5; }
    } else {
        p.walkCycle += 0.28; // kaki tetap "berlari" pelan di udara, tidak membeku saat lompat
        targetLegSwing = Math.sin(p.walkCycle) * (p.vy < 0 ? 5 : 3.5);
    }
    // Di-ease supaya perpindahan gerak (lari -> lompat -> jatuh) mulus, tidak patah/kaku
    p.legSwing = (p.legSwing || 0) + (targetLegSwing - (p.legSwing || 0)) * 0.35;
    let legSwing = p.legSwing;
    
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
        if (ft.text.includes("✨") || ft.text.includes("BAM!")) ctx.fillStyle = `rgba(56, 189, 248, ${ft.alpha})`;
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
