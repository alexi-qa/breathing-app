const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let isRunning = false;
let currentMode = 'pink';
let currentSound = 'pink';
let binauralFreq = 10;
let binauralEnabled = false;
const masterGain = audioCtx.createGain();
masterGain.connect(audioCtx.destination);
masterGain.gain.value = 0.22;
const noiseGain = audioCtx.createGain();
noiseGain.connect(masterGain);
noiseGain.gain.value = 0;
const filter = audioCtx.createBiquadFilter();
filter.type = 'lowpass';
filter.frequency.value = 1000;
const toneGain = audioCtx.createGain();
toneGain.connect(masterGain);
toneGain.gain.value = 0;
let noiseSource = null;
let binauralNodes = null;
let phaseTimer;
let countdownInterval;
let currentToneOsc = null;
function switchPage(pageId, el) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
}
function createNoise(type) {
    const bufferSize = audioCtx.sampleRate * 2;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    if (type === 'pink') {
        let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
        for (let i=0; i<bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        }
    } else if (type === 'brown') {
        let lastOut = 0;
        for (let i=0; i<bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = data[i];
            data[i] *= 3.5;
        }
    } else {
        for (let i=0; i<bufferSize; i++) data[i] = Math.random() * 2 - 1;
    }
    if (noiseSource) noiseSource.stop();
    noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;
    noiseSource.connect(filter).connect(noiseGain);
    noiseSource.start();
}
function startBinaural() {
    stopBinaural();
    const oscL = audioCtx.createOscillator();
    const oscR = audioCtx.createOscillator();
    const gL = audioCtx.createGain();
    const gR = audioCtx.createGain();
    const merger = audioCtx.createChannelMerger(2);
    oscL.frequency.value = 200;
    oscR.frequency.value = 200 + binauralFreq;
    gL.gain.value = gR.gain.value = 0.05;
    oscL.connect(gL).connect(merger, 0, 0);
    oscR.connect(gR).connect(merger, 0, 1);
    merger.connect(masterGain);
    oscL.start(); oscR.start();
    binauralNodes = { oscL, oscR };
}
function stopBinaural() {
    if (binauralNodes) {
        binauralNodes.oscL.stop(); binauralNodes.oscR.stop();
        binauralNodes = null;
    }
}
function stopAllSounds() {
    const now = audioCtx.currentTime;
    noiseGain.gain.setTargetAtTime(0, now, 0.1);
    toneGain.gain.setTargetAtTime(0, now, 0.1);
    if (currentToneOsc) {
        setTimeout(() => {
            if (currentToneOsc) currentToneOsc.stop();
            currentToneOsc = null;
        }, 200);
    }
}
function setPreset(type, el) {
    document.querySelectorAll('#breathePage .chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    const vals = { box: [4,4,4,4], relax: [4,7,8,0], focus: [3,0,3,0] }[type];
    ['in','h1','out','h2'].forEach((id, i) => document.getElementById(id).value = vals[i]);
}
function setMode(mode, el) {
    currentMode = mode;
    document.querySelectorAll('#breathePage .chip').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('softnessRow').classList.toggle('hidden', mode === 'clicks' || mode === 'solfeggio' || mode === 'ocean');
    document.getElementById('clickSpeedRow').classList.toggle('hidden', mode !== 'clicks');
}
function selectSound(sound, el) {
    if (el.classList.contains('active')) {
        el.classList.remove('active');
        currentSound = null;
        stopAllSounds();
        return;
    }
    document.querySelectorAll('.tone-card').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.sound-pill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    currentSound = sound;
    playStandaloneSound();
}
function selectTone(tone, el) {
    if (el.classList.contains('active')) {
        el.classList.remove('active');
        currentSound = null;
        stopAllSounds();
        return;
    }
    document.querySelectorAll('.sound-pill').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tone-card').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    currentSound = tone;
    playStandaloneSound();
}
function selectBinaural(type, el) {
    if (el.classList.contains('active')) {
        el.classList.remove('active');
        binauralFreq = null;
        stopBinaural();
        return;
    }
    document.querySelectorAll('.binaural-pill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');
    binauralFreq = { theta: 6, alpha: 10, gamma: 40 }[type];
    if (binauralEnabled) startBinaural();
}
function toggleBinauralOptions() {
    binauralEnabled = document.getElementById('binauralToggleSounds').checked;
    document.getElementById('binauralOptions').classList.toggle('hidden', !binauralEnabled);
    if (binauralEnabled) {
        if (binauralFreq) startBinaural();
    } else {
        stopBinaural();
    }
}
function playStandaloneSound() {
    if (!currentSound) {
        stopAllSounds();
        return;
    }
    audioCtx.resume();
    const now = audioCtx.currentTime;
    noiseGain.gain.setTargetAtTime(0, now, 0.1);
    toneGain.gain.setTargetAtTime(0, now, 0.1);
    if (currentToneOsc) { currentToneOsc.stop(); currentToneOsc = null; }
    if (['pink','brown','white','ocean'].includes(currentSound)) {
        createNoise(currentSound === 'ocean' ? 'pink' : currentSound);
        noiseGain.gain.setTargetAtTime(0.3, now, 0.5);
        filter.frequency.value = currentSound === 'ocean' ? 800 : 2000;
    } else {
        const freq = { solfeggio: 528, '432hz': 432, '440hz': 440 }[currentSound];
        currentToneOsc = audioCtx.createOscillator();
        currentToneOsc.frequency.value = freq;
        currentToneOsc.connect(toneGain);
        toneGain.gain.setTargetAtTime(0.1, now, 0.5);
        currentToneOsc.start();
    }
}
function startBreathe() {
    if (isRunning) return;
    isRunning = true;
    audioCtx.resume();
    if (document.getElementById('binauralToggle').checked) startBinaural();
    createNoise(currentMode === 'clicks' || currentMode === 'solfeggio' ? 'pink' : currentMode);
    runCycle();
}
function stopBreathe() {
    isRunning = false;
    clearTimeout(phaseTimer);
    clearInterval(countdownInterval);
    noiseGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
    toneGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
    stopBinaural();
    document.getElementById('phaseText').textContent = "Ready";
    document.getElementById('timerText').textContent = "Tap start to begin";
    document.getElementById('sphere').style.transform = "scale(1)";
}
function runCycle() {
    if (!isRunning) return;
    const pattern = ['in','h1','out','h2'].map(id => parseInt(document.getElementById(id).value));
    const phases = [
        { name: 'Breathe In', dur: pattern[0], scale: 1.8 },
        { name: 'Hold', dur: pattern[1], scale: 1.8 },
        { name: 'Breathe Out', dur: pattern[2], scale: 1.0 },
        { name: 'Hold', dur: pattern[3], scale: 1.0 }
    ].filter(p => p.dur > 0);
    let idx = 0;
    const next = () => {
        if (!isRunning) return;
        const p = phases[idx];
        const timerEl = document.getElementById('timerText');
        document.getElementById('phaseText').textContent = p.name;
        document.getElementById('sphere').style.transition = `transform ${p.scale === 1.8 ? p.dur : p.dur}s linear`;
        document.getElementById('sphere').style.transform = `scale(${p.scale})`;
        handleBreatheAudio(p.name, p.dur);
        clearInterval(countdownInterval);
        let remaining = p.dur;
        const step = 0.1;
        timerEl.textContent = remaining.toFixed(1) + ' s';
        countdownInterval = setInterval(() => {
            if (!isRunning) { clearInterval(countdownInterval); return; }
            remaining -= step;
            if (remaining <= 0) { clearInterval(countdownInterval); timerEl.textContent = '0.0 s'; return; }
            timerEl.textContent = remaining.toFixed(1) + ' s';
        }, step * 1000);
        phaseTimer = setTimeout(() => {
            idx = (idx + 1) % phases.length;
            next();
        }, p.dur * 1000);
    };
    next();
}
function handleBreatheAudio(phase, dur) {
    const now = audioCtx.currentTime;
    if (phase === 'Hold') {
        noiseGain.gain.setTargetAtTime(0, now, 0.1);
        toneGain.gain.setTargetAtTime(0, now, 0.1);
        return;
    }
    if (currentMode === 'clicks') {
        const count = Math.floor(dur * (document.getElementById('clickSpeed').value / 10));
        for(let i=0; i<count; i++) {
            setTimeout(() => {
            if (!isRunning) return;
            const osc = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            osc.frequency.value = phase === 'Breathe In' ? 400 + (i/count)*400 : 800 - (i/count)*400;
            g.gain.value = 0.1;
            g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
            osc.connect(g).connect(masterGain);
            osc.start(); osc.stop(audioCtx.currentTime + 0.05);
            }, (i * (dur/count)) * 1000);
        }
    } else if (currentMode === 'solfeggio') {
        const osc = audioCtx.createOscillator();
        osc.frequency.value = 528;
        toneGain.gain.cancelScheduledValues(now);
        toneGain.gain.setValueAtTime(0, now);
        toneGain.gain.linearRampToValueAtTime(0.1, now + 0.5);
        toneGain.gain.linearRampToValueAtTime(0, now + dur);
        osc.connect(toneGain);
        osc.start(); osc.stop(now + dur);
    } else {
        noiseGain.gain.setTargetAtTime(0.3, now, 0.5);
        filter.frequency.setTargetAtTime(phase === 'Breathe In' ? 2000 : 400, now, 0.5);
    }
}
document.getElementById('startBtn').onclick = startBreathe;
document.getElementById('stopBtn').onclick = stopBreathe;
document.getElementById('masterVolume').oninput = (e) => {
    masterGain.gain.value = e.target.value / 100;
    document.getElementById('masterVolVal').textContent = e.target.value + '%';
};
document.getElementById('volume').oninput = (e) => {
    masterGain.gain.value = e.target.value / 100;
    document.getElementById('volVal').textContent = e.target.value + '%';
};
document.getElementById('softness').oninput = (e) => {
    filter.frequency.value = 200 + (e.target.value/100)*3800;
    document.getElementById('softVal').textContent = e.target.value + '%';
};
document.getElementById('clickSpeed').oninput = (e) => {
    document.getElementById('speedVal').textContent = (e.target.value/10).toFixed(1) + 'x';
};
document.getElementById('binauralToggle').onchange = (e) => {
    if (e.target.checked) startBinaural();
    else stopBinaural();
};