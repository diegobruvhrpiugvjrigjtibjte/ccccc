window.addEventListener('DOMContentLoaded', () => {
const STEP_COUNT = 16;
    const STEP_DIVISION = 4;
    const DEFAULT_BPM = 120;

    const instrumentPalette = [
      { id: 'kick', name: 'Kick Drum', color: '#ef4444', layers: ['kick', 'click', 'sub'] },
      { id: 'snare', name: 'Snare Trap', color: '#60a5fa', layers: ['snare'] },
      { id: 'hihat', name: 'Hi-Hat Closed', color: '#facc15', layers: ['hihat'] },
      { id: 'clap', name: 'Clap 808', color: '#a855f7', layers: ['clap'] },
      { id: 'perc', name: 'Percussion', color: '#4ade80', layers: ['perc'] },
      { id: 'tom', name: 'Tom Fill', color: '#34d399', layers: ['perc'] },
      { id: 'rim', name: 'Rim Shot', color: '#f472b6', layers: ['clap'] },
      { id: 'snap', name: 'Snap', color: '#e879f9', layers: ['clap'] },
      { id: 'openhat', name: 'Open Hat', color: '#fbbf24', layers: ['hihat'] },
      { id: 'shaker', name: 'Shaker', color: '#fb923c', layers: ['hihat'] },
      { id: 'ride', name: 'Ride', color: '#a3e635', layers: ['hihat'] },
      { id: 'crash', name: 'Crash', color: '#22d3ee', layers: ['hihat'] },
      { id: 'synth1', name: 'Synth Lead', color: '#2dd4bf', layers: ['pad'] },
      { id: 'synth2', name: 'Synth Pluck', color: '#38bdf8', layers: ['pad'] },
      { id: 'pad', name: 'Pad Atmos', color: '#818cf8', layers: ['pad'] },
      { id: 'bass', name: 'Sub Bass', color: '#a78bfa', layers: ['808'] },
      { id: 'keys', name: 'Keys', color: '#93c5fd', layers: ['pad'] },
      { id: 'arp', name: 'Arp', color: '#fda4af', layers: ['pad'] },
      { id: 'fx', name: 'FX Hit', color: '#94a3b8', layers: ['fx'] },
      { id: 'vox', name: 'Vox Chop', color: '#fcd34d', layers: ['pad'] },
      { id: 'gtr', name: 'Guitar', color: '#6ee7b7', layers: ['pad'] },
      { id: 'strings', name: 'Strings', color: '#67e8f9', layers: ['pad'] },
      { id: 'brass', name: 'Brass', color: '#fdba74', layers: ['pad'] },
      { id: 'pluck', name: 'Pluck', color: '#c4b5fd', layers: ['pad'] },
      { id: 'bell', name: 'Bell', color: '#bef264', layers: ['pad'] },
      { id: 'chord', name: 'Chord Stab', color: '#5eead4', layers: ['pad'] },
      { id: 'seq', name: 'Seq', color: '#f0abfc', layers: ['pad'] },
      { id: 'noise', name: 'Noise', color: '#a1a1aa', layers: ['fx'] },
      { id: 'fx2', name: 'Transition', color: '#a8a29e', layers: ['fx'] },
      { id: 'fx3', name: 'Riser', color: '#fde047', layers: ['fx'] },
    ];

    const timelineTracks = [
      { id: 1, name: 'Arrangiamento', volume: 80, color: '#10b981', clips: [] },
      { id: 2, name: 'Vocals', volume: 70, color: '#3b82f6', clips: [] },
      { id: 3, name: 'Drums', volume: 75, color: '#ef4444', clips: [] },
      { id: 4, name: 'Bass', volume: 72, color: '#a855f7', clips: [] },
      { id: 5, name: 'Synth', volume: 68, color: '#eab308', clips: [] },
      { id: 6, name: 'FX', volume: 65, color: '#f97316', clips: [] },
      { id: 7, name: 'Pads', volume: 66, color: '#14b8a6', clips: [] },
      { id: 8, name: 'Master Bus', volume: 90, color: '#94a3b8', clips: [] },
    ];

    const libraryItems = ['808 Kit', 'Lo-Fi Piano', 'Hard Trap Kick', 'Ambient Pad'];
    const featureItems = [
      'Mixer a 32 canali',
      'EQ a 8 bande',
      'Compressori multibanda',
      'Limiter master',
      'Automazioni clip',
      'Warping tempo',
      'Pitch editor',
      'Audio slicing',
      'Riconoscimento BPM',
      'Loop browser',
      'MIDI learn',
      'Gestione preset',
    ];

    const sampleCatalog = ['kick', 'click', 'sub', 'snare', 'hihat', 'clap', '808', 'pad', 'fx', 'perc', 'tom', 'ride'];

    const makeStep = () => ({ active: false, velocity: 0.8, pitch: 0 });

    let sequencerTracks = instrumentPalette.map((instrument) => ({
      ...instrument,
      layers: [...instrument.layers],
      patterns: {
        A: Array.from({ length: STEP_COUNT }, makeStep),
        B: Array.from({ length: STEP_COUNT }, makeStep),
        C: Array.from({ length: STEP_COUNT }, makeStep),
      },
      volume: 80,
      pan: 0,
      muted: false,
      solo: false,
      fx: {
        eq: true,
        comp: false,
        dist: false,
        delay: false,
        reverb: false,
      },
    }));

    let isPlaying = false;
    let currentTime = 0;
    let stepIndex = 0;
    let lastFrame = 0;
    let lastRenderedStep = -1;
    let bpm = DEFAULT_BPM;
    let targetTrackId = 1;
    let currentPattern = 'A';
    let audioCtx;
    let masterGain;
    let samplesLoaded = false;
    let samplesLoading = null;
    const samples = {};
    const GRID = 20;

    const pianoNotes = [];
    let selectedStep = null;
    let selectedNoteId = null;
    const pianoKeys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    let currentKey = 'C';
    let currentScale = 'major';
    let scaleLocked = true;

    const playBtn = document.getElementById('playBtn');
    const timeDisplay = document.getElementById('timeDisplay');
    const bpmInput = document.getElementById('bpmInput');
    const rack = document.getElementById('rack');
    const targetSelect = document.getElementById('targetSelect');
    const addPatternBtn = document.getElementById('addPatternBtn');
    const patternSwitch = document.getElementById('patternSwitch');
    const timelineHeader = document.getElementById('timelineHeader');
    const timelineBody = document.getElementById('timelineBody');
    const playhead = document.getElementById('playhead');
    const libraryGrid = document.getElementById('libraryGrid');
    const featureGrid = document.getElementById('featureGrid');
    const layerList = document.getElementById('layerList');
    const layerSelect = document.getElementById('layerSelect');
    const addLayerBtn = document.getElementById('addLayerBtn');
    const stepEditor = document.getElementById('stepEditor');
    const pianoGrid = document.getElementById('pianoGrid');
    const keySelect = document.getElementById('keySelect');
    const scaleSelect = document.getElementById('scaleSelect');
    const scaleLock = document.getElementById('scaleLock');
    const arpMode = document.getElementById('arpMode');
    const arpRate = document.getElementById('arpRate');
    const noteEditor = document.getElementById('noteEditor');
    const generateMelodyBtn = document.getElementById('generateMelodyBtn');
    const generateBeatBtn = document.getElementById('generateBeatBtn');
    const importSampleTarget = document.getElementById('importSampleTarget');
    const audioImport = document.getElementById('audioImport');
    const midiImport = document.getElementById('midiImport');
    const exportMidiBtn = document.getElementById('exportMidiBtn');
    const exportWavBtn = document.getElementById('exportWavBtn');
    const exportProjectBtn = document.getElementById('exportProjectBtn');

    function initAudio() {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.9;
        const limiter = audioCtx.createDynamicsCompressor();
        limiter.threshold.value = -6;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.1;
        masterGain.connect(limiter);
        limiter.connect(audioCtx.destination);
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      if (!samplesLoaded && !samplesLoading) {
        samplesLoading = loadSamples().finally(() => {
          samplesLoaded = true;
        });
      }
    }

    async function loadSample(name, url) {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      samples[name] = await audioCtx.decodeAudioData(arrayBuffer);
    }

    async function loadSamples() {
      await Promise.all([
        loadSample('kick', 'https://cdn.jsdelivr.net/gh/terkelg/beatbox/samples/kick.wav'),
        loadSample('click', 'https://cdn.jsdelivr.net/gh/terkelg/beatbox/samples/click.wav'),
        loadSample('sub', 'https://cdn.jsdelivr.net/gh/terkelg/beatbox/samples/subkick.wav'),
        loadSample('snare', 'https://cdn.jsdelivr.net/gh/terkelg/beatbox/samples/snare.wav'),
        loadSample('hihat', 'https://cdn.jsdelivr.net/gh/terkelg/beatbox/samples/hihat.wav'),
        loadSample('clap', 'https://cdn.jsdelivr.net/gh/terkelg/beatbox/samples/clap.wav'),
        loadSample('808', 'https://cdn.jsdelivr.net/gh/terkelg/beatbox/samples/808.wav'),
        loadSample('pad', 'https://cdn.jsdelivr.net/gh/terkelg/beatbox/samples/pad.wav'),
        loadSample('fx', 'https://cdn.jsdelivr.net/gh/terkelg/beatbox/samples/perc.wav'),
        loadSample('perc', 'https://cdn.jsdelivr.net/gh/terkelg/beatbox/samples/perc.wav'),
        loadSample('tom', 'https://cdn.jsdelivr.net/gh/terkelg/beatbox/samples/tom.wav'),
        loadSample('ride', 'https://cdn.jsdelivr.net/gh/terkelg/beatbox/samples/ride.wav'),
      ]);
    }

    function playSample(type, options = {}) {
      if (!audioCtx) return;
      const buffer = samples[type];
      if (!buffer) {
        playFallbackOscillator(type, options);
        return;
      }
      const track = options.track || sequencerTracks.find((item) => item.id === type);
      if (!track) return;

      const soloActive = sequencerTracks.some((item) => item.solo);
      if (track.muted) return;
      if (soloActive && !track.solo) return;

      const source = audioCtx.createBufferSource();
      const gain = audioCtx.createGain();

      const velocity = typeof options.velocity === 'number' ? options.velocity : 0.8;
      gain.gain.value = Math.max(0, Math.min(1, (track.volume / 100) * velocity));
      const pitch = typeof options.pitch === 'number' ? options.pitch : 0;
      source.playbackRate.value = Math.pow(2, pitch / 12);
      source.buffer = buffer;
      const chain = buildTrackChain(audioCtx, track, masterGain);
      source.connect(gain);
      gain.connect(chain.input);
      source.start();
    }

    function playFallbackOscillator(type, options = {}) {
      if (!audioCtx) return;
      const track = options.track || { volume: 80, pan: 0, muted: false, solo: false };
      const soloActive = sequencerTracks.some((item) => item.solo);
      if (track.muted) return;
      if (soloActive && !track.solo) return;

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type === 'kick' || type === 'sub' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(type === 'kick' ? 140 : 440, audioCtx.currentTime);
      const velocity = typeof options.velocity === 'number' ? options.velocity : 0.8;
      gain.gain.value = Math.max(0, Math.min(1, (track.volume / 100) * velocity));

      const chain = buildTrackChain(audioCtx, track, masterGain);
      osc.connect(gain);
      gain.connect(chain.input);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    }

    function buildTrackChain(context, track, destination) {
      const input = context.createGain();
      let current = input;

      if (track.fx.eq) {
        const low = context.createBiquadFilter();
        low.type = 'lowshelf';
        low.frequency.value = 120;
        low.gain.value = 3;
        const high = context.createBiquadFilter();
        high.type = 'highshelf';
        high.frequency.value = 8000;
        high.gain.value = 2;
        current.connect(low);
        low.connect(high);
        current = high;
      }

      if (track.fx.comp) {
        const comp = context.createDynamicsCompressor();
        comp.threshold.value = -24;
        comp.ratio.value = 4;
        comp.attack.value = 0.01;
        comp.release.value = 0.12;
        current.connect(comp);
        current = comp;
      }

      if (track.fx.dist) {
        const shaper = context.createWaveShaper();
        shaper.curve = createDistortionCurve(24);
        shaper.oversample = '2x';
        current.connect(shaper);
        current = shaper;
      }

      const mix = context.createGain();
      mix.gain.value = 1;
      current.connect(mix);

      if (track.fx.delay) {
        const delay = context.createDelay(1.0);
        delay.delayTime.value = 0.25;
        const feedback = context.createGain();
        feedback.gain.value = 0.3;
        const wet = context.createGain();
        wet.gain.value = 0.3;
        current.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(wet);
        wet.connect(mix);
      }

      if (track.fx.reverb) {
        const convolver = context.createConvolver();
        convolver.buffer = createImpulseResponse(context, 1.2, 2.2);
        const wet = context.createGain();
        wet.gain.value = 0.35;
        current.connect(convolver);
        convolver.connect(wet);
        wet.connect(mix);
      }

      const panner = context.createStereoPanner ? context.createStereoPanner() : null;
      if (panner) {
        panner.pan.value = Math.max(-1, Math.min(1, track.pan / 50));
        mix.connect(panner);
        panner.connect(destination);
      } else {
        mix.connect(destination);
      }

      return { input };
    }

    function createDistortionCurve(amount = 20) {
      const samples = 44100;
      const curve = new Float32Array(samples);
      const deg = Math.PI / 180;
      for (let i = 0; i < samples; i += 1) {
        const x = (i * 2) / samples - 1;
        curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
      }
      return curve;
    }

    function createImpulseResponse(context, duration = 1.2, decay = 2.0) {
      const rate = context.sampleRate;
      const length = rate * duration;
      const impulse = context.createBuffer(2, length, rate);
      for (let channel = 0; channel < 2; channel += 1) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i += 1) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
      }
      return impulse;
    }

    function stepDurationMs() {
      const safeBpm = Math.max(40, Math.min(240, Number(bpm) || DEFAULT_BPM));
      return (60000 / safeBpm) / STEP_DIVISION;
    }

    function updateTimeDisplay() {
      const display = Math.floor(currentTime / 100).toString().padStart(2, '0');
      const remainder = (currentTime % 100).toString().padStart(2, '0');
      timeDisplay.textContent = `${display}:${remainder}`;
    }

    function renderRack() {
      rack.innerHTML = '';
      sequencerTracks.forEach((track, trackIndex) => {
        const stepsForPattern = track.patterns[currentPattern];
        const row = document.createElement('div');
        row.className = 'track-row';

        const info = document.createElement('div');
        info.className = 'track-info';

        const name = document.createElement('div');
        name.className = 'track-name';
        const dot = document.createElement('span');
        dot.className = 'track-dot';
        dot.style.color = track.color;
        dot.style.background = track.color;
        name.appendChild(dot);
        name.append(track.name);

        const controls = document.createElement('div');
        controls.className = 'track-controls';
        controls.innerHTML = `VOL <input type="range" min="0" max="100" value="${track.volume}" /> PAN <input type="range" min="-50" max="50" value="${track.pan}" />`;

        const muteBtn = document.createElement('button');
        muteBtn.className = `track-toggle ${track.muted ? 'active' : ''}`;
        muteBtn.textContent = 'M';
        muteBtn.addEventListener('click', () => {
          sequencerTracks[trackIndex].muted = !sequencerTracks[trackIndex].muted;
          renderRack();
        });

        const soloBtn = document.createElement('button');
        soloBtn.className = `track-toggle ${track.solo ? 'active' : ''}`;
        soloBtn.textContent = 'S';
        soloBtn.addEventListener('click', () => {
          sequencerTracks[trackIndex].solo = !sequencerTracks[trackIndex].solo;
          renderRack();
        });

        const [volInput, panInput] = controls.querySelectorAll('input');
        volInput.addEventListener('input', (event) => {
          sequencerTracks[trackIndex].volume = Number(event.target.value);
        });
        panInput.addEventListener('input', (event) => {
          sequencerTracks[trackIndex].pan = Number(event.target.value);
        });

        const fxRow = document.createElement('div');
        fxRow.style.display = 'flex';
        fxRow.style.gap = '6px';
        fxRow.style.marginTop = '6px';
        ['eq', 'comp', 'dist', 'delay', 'reverb'].forEach((fxKey) => {
          const fxBtn = document.createElement('button');
          fxBtn.className = `fx-toggle ${track.fx[fxKey] ? 'active' : ''}`;
          fxBtn.textContent = fxKey;
          fxBtn.addEventListener('click', () => {
            track.fx[fxKey] = !track.fx[fxKey];
            renderRack();
          });
          fxRow.appendChild(fxBtn);
        });

        controls.append(muteBtn, soloBtn);
        info.append(name, controls, fxRow);

        const steps = document.createElement('div');
        steps.className = 'steps';
        stepsForPattern.forEach((active, stepIdx) => {
          const btn = document.createElement('button');
          btn.className = 'step';
          if (active.active) btn.classList.add('active');
          if (stepIdx === stepIndex && isPlaying) btn.classList.add('playhead');
          btn.addEventListener('click', () => {
            initAudio();
            stepsForPattern[stepIdx].active = !stepsForPattern[stepIdx].active;
            selectedStep = { trackIndex, stepIndex: stepIdx };
            if (stepsForPattern[stepIdx].active) {
              track.layers.forEach((layer) => {
                playSample(layer, {
                  track,
                  velocity: stepsForPattern[stepIdx].velocity,
                  pitch: stepsForPattern[stepIdx].pitch,
                });
              });
            }
            renderRack();
            renderStepEditor();
            renderLayers();
          });
          steps.appendChild(btn);
        });

        row.append(info, steps);
        rack.appendChild(row);
      });
    }

    function renderTimeline() {
      timelineHeader.innerHTML = '';
      for (let i = 0; i < 40; i += 1) {
        const bar = document.createElement('div');
        bar.textContent = `BAR ${i + 1}`;
        timelineHeader.appendChild(bar);
      }

      timelineBody.querySelectorAll('.timeline-track').forEach((el) => el.remove());
      timelineTracks.forEach((track) => {
        const trackRow = document.createElement('div');
        trackRow.className = 'timeline-track';

        const label = document.createElement('div');
        label.className = 'track-label';
        const dot = document.createElement('span');
        dot.className = 'track-dot';
        dot.style.color = track.color;
        dot.style.background = track.color;
        label.appendChild(dot);
        label.append(track.name);

        const meter = document.createElement('div');
        meter.className = 'meter';
        meter.innerHTML = `<span>${track.volume} dB</span><div class="meter-bar"><div class="meter-fill" style="width:${Math.min(100, track.volume)}%"></div></div>`;

        trackRow.append(label, meter);

        track.clips.forEach((clip) => {
          const clipEl = document.createElement('div');
          clipEl.className = 'clip';
          clipEl.style.left = `${clip.start}px`;
          clipEl.style.width = `${clip.duration}px`;
          clipEl.style.background = clip.color || 'var(--accent)';
          clipEl.textContent = clip.name;
          trackRow.appendChild(clipEl);
        });

        timelineBody.appendChild(trackRow);
      });
    }

    function renderLibrary() {
      libraryGrid.innerHTML = '';
      libraryItems.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'library-card';
        card.innerHTML = `<div style="width:36px; height:36px; border-radius:12px; background:rgba(255,255,255,0.08); display:flex; align-items:center; justify-content:center; font-size:16px;">♪</div><h4>${item}</h4><p>Free Sample</p>`;
        libraryGrid.appendChild(card);
      });

      featureGrid.innerHTML = '';
      featureItems.forEach((item) => {
        const chip = document.createElement('div');
        chip.className = 'feature-chip';
        chip.textContent = item;
        featureGrid.appendChild(chip);
      });
    }

    function updatePlayhead() {
      playhead.style.left = `${currentTime}px`;
    }

    function renderStepEditor() {
      if (!selectedStep) {
        stepEditor.innerHTML = `Step Editor<div style="margin-top:10px; font-size:9px; color:rgba(229,231,235,0.5);">Seleziona uno step per modificare velocity e pitch.</div>`;
        return;
      }
      const track = sequencerTracks[selectedStep.trackIndex];
      const step = track.patterns[currentPattern][selectedStep.stepIndex];
      stepEditor.innerHTML = `
        Step Editor
        <div style="margin-top:10px; font-size:9px; color:rgba(229,231,235,0.5);">
          ${track.name} · Step ${selectedStep.stepIndex + 1}
        </div>
        <label>Velocity</label>
        <input type="range" id="stepVelocity" min="0" max="1" step="0.05" value="${step.velocity}" />
        <label>Pitch (semitoni)</label>
        <input type="range" id="stepPitch" min="-24" max="24" step="1" value="${step.pitch}" />
      `;
      const velocityInput = document.getElementById('stepVelocity');
      const pitchInput = document.getElementById('stepPitch');
      velocityInput.addEventListener('input', (event) => {
        step.velocity = Number(event.target.value);
      });
      pitchInput.addEventListener('input', (event) => {
        step.pitch = Number(event.target.value);
      });
    }

    function renderLayers() {
      layerList.innerHTML = '';
      layerSelect.innerHTML = '';
      const track = selectedStep ? sequencerTracks[selectedStep.trackIndex] : sequencerTracks[0];
      sampleCatalog.forEach((sample) => {
        const pill = document.createElement('button');
        pill.className = `layer-pill ${track.layers.includes(sample) ? 'active' : ''}`;
        pill.textContent = sample;
        pill.addEventListener('click', () => {
          if (track.layers.includes(sample)) {
            track.layers = track.layers.filter((item) => item !== sample);
          } else {
            track.layers.push(sample);
          }
          renderLayers();
        });
        layerList.appendChild(pill);
      });

      sampleCatalog.forEach((sample) => {
        const option = document.createElement('option');
        option.value = sample;
        option.textContent = sample;
        layerSelect.appendChild(option);
      });
    }

    function noteInScale(noteIndex) {
      const scalePatterns = {
        major: [0, 2, 4, 5, 7, 9, 11],
        minor: [0, 2, 3, 5, 7, 8, 10],
        dorian: [0, 2, 3, 5, 7, 9, 10],
        phrygian: [0, 1, 3, 5, 7, 8, 10],
      };
      const keyIndex = pianoKeys.indexOf(currentKey);
      const scale = scalePatterns[currentScale] || scalePatterns.major;
      const pitchClass = (noteIndex - keyIndex + 12) % 12;
      return scale.includes(pitchClass);
    }

    function renderPianoGrid() {
      pianoGrid.innerHTML = '';
      const totalRows = pianoKeys.length;
      for (let row = totalRows - 1; row >= 0; row -= 1) {
        const label = document.createElement('div');
        label.className = 'piano-row-label';
        label.textContent = `${pianoKeys[row]}4`;
        pianoGrid.appendChild(label);

        for (let step = 0; step < STEP_COUNT; step += 1) {
          const cell = document.createElement('div');
          cell.className = 'piano-cell';
          cell.dataset.step = step;
          cell.dataset.pitch = row;

          const isScaleNote = noteInScale(row);
          if (scaleLocked && !isScaleNote) {
            cell.classList.add('locked');
          }

          const note = pianoNotes.find((n) => n.step === step && n.pitch === row);
          if (note) {
            const noteBlock = document.createElement('div');
            noteBlock.className = 'piano-note';
            noteBlock.style.opacity = `${note.velocity}`;
            noteBlock.style.width = `${note.length * 100}%`;
            cell.appendChild(noteBlock);
          }

          cell.addEventListener('click', () => {
            if (scaleLocked && !noteInScale(row)) {
              return;
            }
            const existingIndex = pianoNotes.findIndex((n) => n.step === step && n.pitch === row);
            if (existingIndex >= 0) {
              selectedNoteId = pianoNotes[existingIndex].id;
              pianoNotes.splice(existingIndex, 1);
            } else {
              const newNote = {
                id: `note-${Date.now()}-${Math.random()}`,
                step,
                pitch: row,
                length: 1,
                velocity: 0.8,
              };
              pianoNotes.push(newNote);
              selectedNoteId = newNote.id;
            }
            renderPianoGrid();
            renderNoteEditor();
          });

          pianoGrid.appendChild(cell);
        }
      }
      updatePianoPlayhead();
    }

    function updatePianoPlayhead() {
      pianoGrid.querySelectorAll('.piano-cell').forEach((cell) => {
        cell.classList.toggle('playhead', Number(cell.dataset.step) === stepIndex && isPlaying);
      });
    }

    function renderNoteEditor() {
      const note = pianoNotes.find((n) => n.id === selectedNoteId);
      if (!note) {
        noteEditor.innerHTML = `Note Editor<div style="margin-top:10px; font-size:9px; color:rgba(229,231,235,0.5);">Clicca una nota per modificare velocity e durata.</div>`;
        return;
      }
      noteEditor.innerHTML = `
        Note Editor
        <div style="margin-top:10px; font-size:9px; color:rgba(229,231,235,0.5);">
          Step ${note.step + 1} · ${pianoKeys[note.pitch]}4
        </div>
        <label>Velocity</label>
        <input type="range" id="noteVelocity" min="0" max="1" step="0.05" value="${note.velocity}" />
        <label>Length (steps)</label>
        <input type="range" id="noteLength" min="1" max="8" step="1" value="${note.length}" />
      `;
      document.getElementById('noteVelocity').addEventListener('input', (event) => {
        note.velocity = Number(event.target.value);
        renderPianoGrid();
      });
      document.getElementById('noteLength').addEventListener('input', (event) => {
        note.length = Number(event.target.value);
        renderPianoGrid();
      });
    }
    function loop(timestamp) {
      if (!lastFrame) {
        lastFrame = timestamp;
      }
      const delta = timestamp - lastFrame;
      lastFrame = timestamp;
      currentTime += delta;

      const duration = stepDurationMs();
        const nextStep = Math.floor(currentTime / duration) % STEP_COUNT;
        if (nextStep !== stepIndex) {
          stepIndex = nextStep;
          sequencerTracks.forEach((track) => {
            const steps = track.patterns[currentPattern];
            const step = steps && steps[stepIndex];
            if (step && step.active) {
              track.layers.forEach((layer) => {
                playSample(layer, {
                  track,
                  velocity: step.velocity,
                  pitch: step.pitch,
                });
              });
            }
          });

          const arpSetting = arpMode.value;
          if (arpSetting !== 'off') {
            const rate = Number(arpRate.value);
            if (rate > 0 && stepIndex % rate === 0) {
              const notes = [...pianoNotes].sort((a, b) => a.pitch - b.pitch);
              if (notes.length > 0) {
                let selectedNote = notes[0];
                if (arpSetting === 'down') {
                  selectedNote = notes[notes.length - 1];
                } else if (arpSetting === 'random') {
                  selectedNote = notes[Math.floor(Math.random() * notes.length)];
                } else {
                  selectedNote = notes[stepIndex % notes.length];
                }
                playSample('pad', {
                  track: { volume: 90, pan: 0, muted: false, solo: false },
                  velocity: selectedNote.velocity,
                  pitch: selectedNote.pitch - 3,
                });
              }
            }
          } else {
            pianoNotes.forEach((note) => {
              if (note.step === stepIndex) {
                playSample('pad', {
                  track: { volume: 90, pan: 0, muted: false, solo: false },
                  velocity: note.velocity,
                  pitch: note.pitch - 3,
                });
              }
            });
          }
        }

        currentTime = currentTime % (STEP_COUNT * duration);
        updateTimeDisplay();
        updatePlayhead();

        if (stepIndex !== lastRenderedStep) {
          renderRack();
          updatePianoPlayhead();
          lastRenderedStep = stepIndex;
        }

      if (isPlaying) {
        requestAnimationFrame(loop);
      }
    }

    function togglePlay() {
      isPlaying = !isPlaying;
      playBtn.classList.toggle('active', isPlaying);
      playBtn.textContent = isPlaying ? '■' : '▶';
      if (isPlaying) {
        initAudio();
        requestAnimationFrame(loop);
      } else {
        renderRack();
      }
    }

    function addPatternToTimeline() {
      const hasSteps = sequencerTracks.some((track) => track.patterns[currentPattern].some((step) => step.active));
      if (!hasSteps) return;

      const duration = STEP_COUNT * stepDurationMs();
      const clip = {
        id: `pattern-${Date.now()}`,
        start: Math.round(currentTime / GRID) * GRID,
        duration,
        name: 'Beat Pattern',
        pattern: currentPattern,
      };

      const track = timelineTracks.find((item) => item.id === targetTrackId);
      if (track) {
        track.clips.push(clip);
      }
      renderTimeline();
      switchTab('tracks');
    }

    function switchTab(tab) {
      document.querySelectorAll('.nav-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
      });
      document.getElementById('sequencerPanel').classList.toggle('hidden', tab !== 'sequencer');
      document.getElementById('tracksPanel').classList.toggle('hidden', tab !== 'tracks');
      document.getElementById('pianoPanel').classList.toggle('hidden', tab !== 'piano');
      document.getElementById('libraryPanel').classList.toggle('hidden', tab !== 'library');
    }

    playBtn.addEventListener('click', togglePlay);
    bpmInput.addEventListener('input', (event) => {
      bpm = Number(event.target.value) || DEFAULT_BPM;
    });
    addPatternBtn.addEventListener('click', addPatternToTimeline);

    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    patternSwitch.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        currentPattern = btn.dataset.pattern;
        patternSwitch.querySelectorAll('button').forEach((inner) => {
          inner.classList.toggle('active', inner.dataset.pattern === currentPattern);
        });
        renderRack();
        renderStepEditor();
      });
    });

    keySelect.addEventListener('change', (event) => {
      currentKey = event.target.value;
      renderPianoGrid();
    });
    scaleSelect.addEventListener('change', (event) => {
      currentScale = event.target.value;
      renderPianoGrid();
    });
    scaleLock.addEventListener('change', (event) => {
      scaleLocked = event.target.checked;
      renderPianoGrid();
    });

    addLayerBtn.addEventListener('click', () => {
      const track = selectedStep ? sequencerTracks[selectedStep.trackIndex] : sequencerTracks[0];
      const sample = layerSelect.value;
      if (sample && !track.layers.includes(sample)) {
        track.layers.push(sample);
        renderLayers();
      }
    });

    audioImport.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      initAudio();
      const arrayBuffer = await file.arrayBuffer();
      samples[importSampleTarget.value] = await audioCtx.decodeAudioData(arrayBuffer);
      audioImport.value = '';
    });

    midiImport.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file || !window.Midi) return;
      const arrayBuffer = await file.arrayBuffer();
      const midi = new window.Midi(arrayBuffer);
      pianoNotes.length = 0;
      const track = midi.tracks[0];
      if (track) {
        const ticksPerStep = midi.header.ppq / STEP_DIVISION;
        track.notes.forEach((note) => {
          const step = Math.floor(note.ticks / ticksPerStep) % STEP_COUNT;
          const pitchIndex = note.midi % 12;
          pianoNotes.push({
            id: `note-${Date.now()}-${Math.random()}`,
            step,
            pitch: pitchIndex,
            length: Math.max(1, Math.round(note.durationTicks / ticksPerStep)),
            velocity: note.velocity,
          });
        });
      }
      renderPianoGrid();
      renderNoteEditor();
      midiImport.value = '';
    });

    exportMidiBtn.addEventListener('click', () => {
      if (!window.Midi) return;
      const midi = new window.Midi();
      const track = midi.addTrack();
      pianoNotes.forEach((note) => {
        track.addNote({
          midi: 60 + note.pitch,
          time: note.step / STEP_DIVISION,
          duration: note.length / STEP_DIVISION,
          velocity: note.velocity,
        });
      });
      const blob = new Blob([midi.toArray()], { type: 'audio/midi' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'musiclab.mid';
      link.click();
      URL.revokeObjectURL(url);
    });

    exportWavBtn.addEventListener('click', async () => {
      initAudio();
      const duration = STEP_COUNT * stepDurationMs();
      const offline = new OfflineAudioContext(2, Math.ceil(audioCtx.sampleRate * (duration / 1000)), audioCtx.sampleRate);
      const master = offline.createGain();
      master.gain.value = 0.9;
      const limiter = offline.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.1;
      master.connect(limiter);
      limiter.connect(offline.destination);

      sequencerTracks.forEach((track) => {
        const soloActive = sequencerTracks.some((item) => item.solo);
        if (track.muted || (soloActive && !track.solo)) return;
        const steps = track.patterns[currentPattern];
        steps.forEach((step, index) => {
          if (!step.active) return;
          const time = (index * stepDurationMs()) / 1000;
          track.layers.forEach((layer) => {
            const buffer = samples[layer];
            if (!buffer) return;
            const source = offline.createBufferSource();
            const gain = offline.createGain();
            source.buffer = buffer;
            source.playbackRate.value = Math.pow(2, step.pitch / 12);
            gain.gain.value = Math.max(0, Math.min(1, (track.volume / 100) * step.velocity));
            const chain = buildTrackChain(offline, track, master);
            source.connect(gain);
            gain.connect(chain.input);
            source.start(time);
          });
        });
      });

      pianoNotes.forEach((note) => {
        const buffer = samples.pad;
        if (!buffer) return;
        const source = offline.createBufferSource();
        const gain = offline.createGain();
        source.buffer = buffer;
        source.playbackRate.value = Math.pow(2, (note.pitch - 3) / 12);
        gain.gain.value = note.velocity;
        source.connect(gain);
        gain.connect(master);
        source.start((note.step * stepDurationMs()) / 1000);
      });

      const rendered = await offline.startRendering();
      const wavBlob = bufferToWav(rendered);
      const url = URL.createObjectURL(wavBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'musiclab.wav';
      link.click();
      URL.revokeObjectURL(url);
    });

    exportProjectBtn.addEventListener('click', () => {
      const project = {
        bpm,
        pattern: currentPattern,
        tracks: sequencerTracks,
        pianoNotes,
      };
      const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'musiclab.json';
      link.click();
      URL.revokeObjectURL(url);
    });

    generateBeatBtn.addEventListener('click', () => {
      sequencerTracks.forEach((track) => {
        const steps = track.patterns[currentPattern];
        steps.forEach((step) => {
          step.active = Math.random() > 0.8;
          step.velocity = 0.6 + Math.random() * 0.4;
          step.pitch = 0;
        });
      });
      renderRack();
    });

    generateMelodyBtn.addEventListener('click', () => {
      pianoNotes.length = 0;
      for (let step = 0; step < STEP_COUNT; step += 2) {
        const pitch = Math.floor(Math.random() * pianoKeys.length);
        if (scaleLocked && !noteInScale(pitch)) continue;
        pianoNotes.push({
          id: `note-${Date.now()}-${Math.random()}`,
          step,
          pitch,
          length: 1,
          velocity: 0.7 + Math.random() * 0.3,
        });
      }
      renderPianoGrid();
      renderNoteEditor();
    });

    function initTargetSelect() {
      targetSelect.innerHTML = '';
      timelineTracks.forEach((track) => {
        const option = document.createElement('option');
        option.value = track.id;
        option.textContent = track.name;
        targetSelect.appendChild(option);
      });
      targetSelect.addEventListener('change', (event) => {
        targetTrackId = Number(event.target.value);
      });
    }

    function initSampleSelect() {
      importSampleTarget.innerHTML = '';
      sampleCatalog.forEach((sample) => {
        const option = document.createElement('option');
        option.value = sample;
        option.textContent = sample;
        importSampleTarget.appendChild(option);
      });
    }

    function bufferToWav(buffer) {
      const numOfChan = buffer.numberOfChannels;
      const length = buffer.length * numOfChan * 2 + 44;
      const bufferArray = new ArrayBuffer(length);
      const view = new DataView(bufferArray);
      let offset = 0;

      function writeString(str) {
        for (let i = 0; i < str.length; i += 1) {
          view.setUint8(offset + i, str.charCodeAt(i));
        }
        offset += str.length;
      }

      writeString('RIFF');
      view.setUint32(offset, length - 8, true);
      offset += 4;
      writeString('WAVE');
      writeString('fmt ');
      view.setUint32(offset, 16, true);
      offset += 4;
      view.setUint16(offset, 1, true);
      offset += 2;
      view.setUint16(offset, numOfChan, true);
      offset += 2;
      view.setUint32(offset, buffer.sampleRate, true);
      offset += 4;
      view.setUint32(offset, buffer.sampleRate * numOfChan * 2, true);
      offset += 4;
      view.setUint16(offset, numOfChan * 2, true);
      offset += 2;
      view.setUint16(offset, 16, true);
      offset += 2;
      writeString('data');
      view.setUint32(offset, length - offset - 4, true);
      offset += 4;

      for (let i = 0; i < buffer.length; i += 1) {
        for (let channel = 0; channel < numOfChan; channel += 1) {
          const sample = buffer.getChannelData(channel)[i];
          view.setInt16(offset, Math.max(-1, Math.min(1, sample)) * 0x7fff, true);
          offset += 2;
        }
      }
      return new Blob([view], { type: 'audio/wav' });
    }

    initTargetSelect();
    initSampleSelect();
    renderRack();
    renderTimeline();
    renderLibrary();
    renderLayers();
    renderStepEditor();
    renderPianoGrid();
    renderNoteEditor();
    updateTimeDisplay();
    updatePlayhead();
});
