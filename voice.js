(function () {
    'use strict';

    var ICE = {
        iceServers: [
            { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
        ]
    };

    var S = {
        ch: null, me: null,
        peers: {},
        track: null, stream: null,
        micOn: false, busy: false,
        pending: []
    };

    function iconSvg(id, on) {
        var cut = 'micCut_' + id;
        var body =
            '<rect x="17.5" y="0" width="21" height="36" rx="10.5" fill="currentColor"/>' +
            '<path d="M9.5 20.5V22.5A18.5 18.5 0 0 0 46.5 22.5V20.5" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>' +
            '<rect x="25.5" y="43" width="5" height="9" fill="currentColor"/>' +
            '<rect x="17.5" y="51.5" width="21" height="4" rx="2" fill="currentColor"/>';
        if (on) return '<svg class="mic-ico" viewBox="-5 -6 66 66" aria-hidden="true">' + body + '</svg>';
        return '<svg class="mic-ico" viewBox="-5 -6 66 66" aria-hidden="true">' +
            '<defs><mask id="' + cut + '" maskUnits="userSpaceOnUse" x="-5" y="-6" width="66" height="66">' +
            '<rect x="-5" y="-6" width="66" height="66" fill="#fff"/>' +
            '<line x1="-1.5" y1="-3.5" x2="58.5" y2="56" stroke="#000" stroke-width="10.5" stroke-linecap="round"/>' +
            '</mask></defs>' +
            '<g mask="url(#' + cut + ')">' + body + '</g>' +
            '<line x1="-1.5" y1="-3.5" x2="58.5" y2="56" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>' +
            '</svg>';
    }

    var BTN_IDS = ['voiceBtn', 'voiceHudBtn'];

    function renderButtons() {
        BTN_IDS.forEach(function (id) {
            var b = document.getElementById(id);
            if (!b) return;
            b.dataset.state = S.micOn ? 'on' : 'off';
            b.innerHTML = iconSvg(id, S.micOn);
            b.setAttribute('aria-label', S.micOn ? 'Mikrofon aktif' : 'Mikrofon mati');
            b.setAttribute('aria-pressed', S.micOn ? 'true' : 'false');
        });
    }

    function showHud(show) {
        var h = document.getElementById('voiceHudBtn');
        if (h) h.style.display = show ? 'flex' : 'none';
    }

    function toast(msg) {
        try { if (typeof showToast === 'function') showToast(msg); } catch (e) {}
    }

    function send(to, type, data) {
        if (!S.ch) return;
        try {
            S.ch.send({ type: 'broadcast', event: 'vsig', payload: { from: S.me, to: to, type: type, data: data } });
        } catch (e) {}
    }

    function attachRemote(peer, ev) {
        var stream = (ev.streams && ev.streams[0]) || new MediaStream([ev.track]);
        if (!peer.audio) {
            var a = document.createElement('audio');
            a.autoplay = true;
            a.setAttribute('playsinline', '');
            a.style.display = 'none';
            document.body.appendChild(a);
            peer.audio = a;
        }
        peer.audio.srcObject = stream;
        var p = peer.audio.play();
        if (p && p.catch) p.catch(function () {  });
    }

    function makeOffer(key, iceRestart) {
        var peer = S.peers[key];
        if (!peer) return;
        var pc = peer.pc;
        pc.createOffer(iceRestart ? { iceRestart: true } : undefined)
            .then(function (o) { return pc.setLocalDescription(o); })
            .then(function () { send(key, 'offer', pc.localDescription.toJSON ? pc.localDescription.toJSON() : { type: pc.localDescription.type, sdp: pc.localDescription.sdp }); })
            .catch(function () {});
    }

    function createPeer(key) {
        if (S.peers[key] || !S.ch) return S.peers[key];
        var pc = new RTCPeerConnection(ICE);
        var peer = { pc: pc, audio: null, initiator: S.me < key, queue: [], restartT: null };
        S.peers[key] = peer;

        var tr = pc.addTransceiver('audio', { direction: 'sendrecv' });
        peer.sender = tr.sender;
        if (S.track) { try { tr.sender.replaceTrack(S.track); } catch (e) {} }

        pc.onicecandidate = function (e) { if (e.candidate) send(key, 'ice', e.candidate.toJSON ? e.candidate.toJSON() : e.candidate); };
        pc.ontrack = function (e) { attachRemote(peer, e); };
        pc.onconnectionstatechange = function () {
            var st = pc.connectionState;
            if (st === 'connected') { clearTimeout(peer.restartT); return; }
            if ((st === 'failed' || st === 'disconnected') && peer.initiator && S.peers[key] === peer) {
                clearTimeout(peer.restartT);
                peer.restartT = setTimeout(function () {
                    if (S.peers[key] === peer && pc.connectionState !== 'connected' && pc.connectionState !== 'closed') makeOffer(key, true);
                }, st === 'failed' ? 300 : 4000);
            }
        };

        if (peer.initiator) makeOffer(key, false);
        return peer;
    }

    function closePeer(key) {
        var peer = S.peers[key];
        if (!peer) return;
        delete S.peers[key];
        clearTimeout(peer.restartT);
        try { peer.pc.onicecandidate = peer.pc.ontrack = peer.pc.onconnectionstatechange = null; peer.pc.close(); } catch (e) {}
        if (peer.audio) {
            try { peer.audio.pause(); peer.audio.srcObject = null; peer.audio.remove(); } catch (e) {}
        }
    }

    function flushQueue(peer) {
        var q = peer.queue; peer.queue = [];
        q.forEach(function (c) { peer.pc.addIceCandidate(c).catch(function () {}); });
    }

    function handleSignal(p) {
        if (!p || p.to !== S.me || !p.from || p.from === S.me) return;
        var peer = S.peers[p.from];
        if (p.type === 'offer') {
            if (!peer) peer = createPeer(p.from);
            if (!peer) return;
            var pc = peer.pc;
            pc.setRemoteDescription(p.data)
                .then(function () { flushQueue(peer); return pc.createAnswer(); })
                .then(function (a) { return pc.setLocalDescription(a); })
                .then(function () { send(p.from, 'answer', pc.localDescription.toJSON ? pc.localDescription.toJSON() : { type: pc.localDescription.type, sdp: pc.localDescription.sdp }); })
                .catch(function () {});
        } else if (p.type === 'answer') {
            if (!peer) return;
            peer.pc.setRemoteDescription(p.data).then(function () { flushQueue(peer); }).catch(function () {});
        } else if (p.type === 'ice') {
            if (!peer) return;
            if (peer.pc.remoteDescription && peer.pc.remoteDescription.type) peer.pc.addIceCandidate(p.data).catch(function () {});
            else peer.queue.push(p.data);
        }
    }

    function setSenderTrack(track) {
        Object.keys(S.peers).forEach(function (k) {
            var s = S.peers[k].sender;
            if (s) { try { s.replaceTrack(track); } catch (e) {} }
        });
    }

    function micOff(silent) {
        S.micOn = false;
        setSenderTrack(null);
        if (S.stream) { S.stream.getTracks().forEach(function (t) { try { t.onended = null; t.stop(); } catch (e) {} }); }
        S.stream = null; S.track = null;
        renderButtons();
        if (!silent) toast('Mikrofon dimatikan');
    }

    function micErrorText(e) {
        var n = e && e.name;
        if (n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError') return 'Izin mikrofon ditolak. Aktifkan lewat pengaturan browser.';
        if (n === 'NotFoundError' || n === 'DevicesNotFoundError') return 'Mikrofon tidak ditemukan.';
        if (n === 'NotReadableError' || n === 'TrackStartError') return 'Mikrofon sedang dipakai aplikasi lain.';
        return 'Gagal mengaktifkan mikrofon.';
    }

    function micOn() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            toast('Browser tidak mendukung mikrofon (perlu HTTPS).');
            return Promise.resolve();
        }
        S.busy = true;
        return navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false
        }).then(function (stream) {
            if (!S.ch) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
            S.stream = stream;
            S.track = stream.getAudioTracks()[0];
            if (S.track) S.track.onended = function () { if (S.micOn) micOff(false); };
            S.micOn = true;
            setSenderTrack(S.track);
            renderButtons();
            unlockAudio();
        }).catch(function (e) {
            toast(micErrorText(e));
        }).then(function () { S.busy = false; });
    }

    function toggle() {
        if (S.busy) return;
        unlockAudio();
        if (!S.ch) { toast('Masuk room multiplayer dulu'); return; }
        if (S.micOn) micOff(false); else micOn();
    }

    function unlockAudio() {
        Object.keys(S.peers).forEach(function (k) {
            var a = S.peers[k].audio;
            if (a && a.paused && a.srcObject) { var p = a.play(); if (p && p.catch) p.catch(function () {}); }
        });
    }
    document.addEventListener('pointerdown', unlockAudio, { passive: true });

    var API = {
        join: function (ch, me) {
            API.leave();
            S.ch = ch; S.me = me;
            showHud(true);
            renderButtons();
            var q = S.pending; S.pending = [];
            q.forEach(handleSignal);
        },
        sync: function (keys) {
            if (!S.ch || !S.me || !keys) return;
            keys.forEach(function (k) { if (k !== S.me) createPeer(k); });
            Object.keys(S.peers).forEach(function (k) { if (keys.indexOf(k) === -1) closePeer(k); });
        },
        onSignal: function (p) {
            if (!S.ch) { if (S.pending.length < 60) S.pending.push(p); return; }
            handleSignal(p);
        },
        leave: function () {
            Object.keys(S.peers).forEach(closePeer);
            if (S.stream) { S.stream.getTracks().forEach(function (t) { try { t.onended = null; t.stop(); } catch (e) {} }); }
            S.stream = null; S.track = null; S.micOn = false;
            S.ch = null; S.me = null; S.pending = []; S.busy = false;
            showHud(false);
            renderButtons();
        },
        toggle: toggle,
        isMicOn: function () { return S.micOn; }
    };
    window.EdVoice = API;

    function init() {
        BTN_IDS.forEach(function (id) {
            var b = document.getElementById(id);
            if (!b) return;
            b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); toggle(); });
        });
        renderButtons();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
