# MusicLab Pro — Web App musicale professionale (offline-first)

> Documento di progettazione per una web app musicale professionale, moderna e leggera, eseguita interamente nel browser con HTML/CSS/JS e Web Audio API, distribuita come sito statico (es. Cloudflare Pages). Salvataggio progetto solo via file locale, nessun cloud audio.

---

## SEZIONE 1 — ARCHITETTURA GENERALE

### Struttura del progetto (file e cartelle)
```
/
├─ index.html              # Shell UI (static)
├─ styles/
│  ├─ base.css             # Reset, typography, tokens
│  ├─ layout.css           # Grid, panels, docking
│  └─ theme-cyber.css       # Dark/punk theme
├─ src/
│  ├─ app.js               # Bootstrap, routing tabs
│  ├─ state/
│  │  ├─ projectStore.js    # Stato progetto + undo/redo
│  │  └─ io.js              # Import/export file locale
│  ├─ audio/
│  │  ├─ engine.js          # Audio graph, transport
│  │  ├─ instruments.js     # Synth/sampler definitions
│  │  ├─ effects.js         # FX graph + presets
│  │  └─ worklets/
│  │     ├─ pitch.worklet.js
│  │     ├─ compressor.worklet.js
│  │     └─ bitcrusher.worklet.js
│  ├─ ui/
│  │  ├─ timeline.js        # Arrange view
│  │  ├─ pianoRoll.js       # Note editor
│  │  ├─ mixer.js           # Mixer channels
│  │  └─ browser.js         # Sample pack browser
│  └─ utils/
│     ├─ dsp.js             # Utility DSP
│     ├─ file.js            # File helpers
│     └─ perf.js            # Performance metrics
└─ assets/
   ├─ icons/
   └─ presets/
```

### Flusso audio nel browser
- **Input**: microfono via `getUserMedia()` → `MediaStreamAudioSourceNode`.
- **Track strip**: `AudioBufferSourceNode` / `OscillatorNode` → `GainNode` (volume) → `StereoPannerNode` (pan) → FX chain per traccia → Bus.
- **Master**: sub-mix bus → limiter → meter → `AudioDestinationNode`.
- **Registrazione**: `MediaStreamAudioDestinationNode` + `MediaRecorder` o `OfflineAudioContext` per export offline.

### Come funziona l’editor
- **Stato centralizzato**: `projectStore` con versioning e undo/redo (patch-based).
- **Editor realtime**: timeline e piano roll lavorano su pattern/clip con snap e quantizzazione.
- **Audio engine**: in memoria, con scheduling a blocchi (look-ahead scheduler).

### Cloudflare serve solo HTML/CSS/JS
- Hosting statico con **cache** e **versioning** del bundle.
- Nessun endpoint audio. La logica è tutta nel client.

### Browser fa tutto il lavoro audio
- Web Audio API per synth, playback, effetti.
- AudioWorklet per DSP pesante (pitch, limiter, compressor).

---

## SEZIONE 2 — FILE PROGETTO (ALTERNATIVA AL CLOUD)

### Formato proprietario `.musicproj`
File JSON compresso (opzionale: `.zip`) con:
```json
{
  "version": "1.0.0",
  "meta": {
    "title": "My Beat",
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-02T12:00:00Z"
  },
  "transport": { "bpm": 140, "swing": 0.12 },
  "tracks": [
    {
      "id": "t1",
      "name": "Drums",
      "type": "drum",
      "volume": 0.9,
      "pan": -0.1,
      "mute": false,
      "solo": false,
      "fx": ["eq8", "compressor"],
      "patterns": {
        "A": [ {"step":0, "vel":0.9, "pitch":0, "layers":["kick","click"]} ],
        "B": []
      }
    }
  ],
  "clips": [
    { "trackId": "t1", "pattern": "A", "start": 0, "length": 16 }
  ],
  "notes": [
    { "trackId": "t2", "pitch": 60, "start": 4, "length": 2, "velocity": 0.8 }
  ],
  "automation": [
    { "trackId": "t1", "param": "filter.cutoff", "points": [[0,0.2],[8,0.9]] }
  ],
  "samples": [
    { "id": "kick", "source": "local", "file": "kick.wav" }
  ]
}
```

### Cosa viene salvato
- BPM, swing, tempo map
- Tracce, mixer, FX, note, pattern, automazioni
- Metadata su sample (per reimport locale)

### Import/Export
- **Export**: `FileSystem Access API` o download classico.
- **Import**: file picker, validazione schema, migrazione automatica.

### Versioning
- `version` semver + `migrations` per garantire compatibilità futura.

---

## SEZIONE 3 — EDITOR MUSICALE (CORE)

### Timeline
- Clip-based, con pattern e loop.
- Tracce illimitate, grouping e color coding.

### Pattern/Loop
- Pattern A/B/C/D per traccia.
- Chaining + scene launcher in stile Ableton.

### Grid / Snap
- Quantizzazione 1/4–1/64, swing MPC, snap BPM.

### Zoom
- Orizzontale (tempo) e verticale (track height).

### Mute / Solo
- A livello traccia e a livello clip.

### Automazioni
- Volume, pan, filter, FX send, pitch.

### Playback Engine
- Scheduler look-ahead (50–100 ms) per precisione.
- Sync lock su BPM e stop/start senza drift.

---

## SEZIONE 4 — STRUMENTI VIRTUALI (GENERATI VIA CODICE)

### Drum Machine
- **Oscillatori**: sine/triangle/noise
- **Envelope**: attack 0–20ms, decay 50–400ms
- **Parametri**: tone, pitch, snap
- **Preset**: 808, trap, punk

### Sampler
- **Sample**: AudioBuffer + start/end/loop
- **Envelope**: ADSR
- **Parametri**: pitch ±24, velocity curve

### Synth analogico
- **Oscillatori**: saw + pulse
- **Filter**: ladder low-pass
- **Envelope**: ADSR + filter env

### Bass Synth
- **Oscillatore**: sine + sub
- **Drive**: soft clip
- **Preset**: sub 808, growl

### Lead Synth
- **Oscillatori**: saw detuned
- **LFO**: vibrato

### Pad
- **Oscillatori**: triangle + noise
- **Filter**: low-pass lento

### Noise Generator
- White/pink noise, con envelope breve

### Punk Guitar Simulator
- Karplus-Strong + distortion
- Envelope molto corto

### Distortion Guitar
- Overdrive + cabinet filter

### 808 Engine
- Sine + pitch drop, controlli decay

### Kick Designer
- Pitch envelope + click transient

### Hi-hat Generator
- Noise bandpass + fast decay

---

## SEZIONE 5 — STILI MUSICALI PREDEFINITI

### Trap
- BPM: 140
- Strumenti: 808, hi-hat, clap
- FX: compressor, limiter
- Sound design: low end intenso

### Drill
- BPM: 142
- Strumenti: 808 glides, hats syncopati
- FX: distortion leggera

### Punk
- BPM: 170
- Strumenti: guitar sim, live drums
- FX: tape saturation

### Punk Rap
- BPM: 150
- Strumenti: 808 + guitar
- FX: distortion vocal

### Lo-fi
- BPM: 85
- Strumenti: Rhodes pad, vinyl noise
- FX: tape, wow/flutter

### Experimental
- BPM: variabile
- Strumenti: noise + FX
- FX: granular, glitch

### Hyperpop
- BPM: 160
- Strumenti: bright lead, vocal chop
- FX: OTT, pitch shift

### Dark Trap
- BPM: 138
- Strumenti: bass, pad scuro
- FX: reverb profondo

---

## SEZIONE 6 — AUTOTUNE / VOICE FX

### Pitch correction locale
- `AudioWorklet` per detection (YIN/FFT)
- Quantizzazione su scala selezionata

### Parametri
- Speed (0–100ms)
- Amount (0–100%)
- Hard tune mode
- Robot voice: quantizzazione estrema
- Punk distortion vocal: clip + filter

### FX vocal
- Delay sync BPM
- Reverb plate

---

## SEZIONE 7 — EFFETTI AUDIO (20+)
1. EQ 8 bande
2. Compressor
3. Limiter
4. Distortion
5. Overdrive
6. Bitcrusher
7. Reverb
8. Delay
9. Chorus
10. Flanger
11. Phaser
12. Filter (LP/HP/BP)
13. Tape saturation
14. Vinyl noise
15. Stereo widener
16. Glitch
17. Reverse
18. Stutter
19. Noise gate
20. Multiband compressor
21. Autopan
22. Pitch shifter

---

## SEZIONE 8 — REGISTRAZIONE AUDIO
- Mic via `getUserMedia()`.
- Direct monitoring con `GainNode` dedicato.
- Overdub su traccia audio.
- Salvataggio locale via file.

---

## SEZIONE 9 — ESPORTAZIONE
- **WAV**: offline rendering.
- **MP3**: WASM encoder (es. lame.js).
- **Stem**: render per traccia.
- **Bounce realtime**: per low-end.
- **Bounce offline**: qualità migliore.

---

## SEZIONE 10 — UI / UX
- Dark mode cyber/punk.
- Preset one-click.
- Layout a pannelli (timeline, piano roll, mixer).
- Mobile-friendly (view ridotta, gesture base).

---

## SEZIONE 11 — GAMIFICATION / WOW FACTOR
- 1-click beat generator.
- Randomizer loop.
- Freestyle mode.
- Punk chaos mode.
- Demo beat per TikTok/YouTube.

---

## SEZIONE 12 — MODELLO DI BUSINESS
- **Free**: base editor, export WAV limitato.
- **Lifetime 50€**: tutto sbloccato, pack preset, export stem.
- **No cloud**: valore = velocità + privacy.

---

## SEZIONE 13 — PERFORMANCE
- Scheduler look-ahead.
- AudioWorklet per DSP pesante.
- Fallback low-end: meno FX, fewer tracks.
- Metering a bassa frequenza.

---

## SEZIONE 14 — FUTURO (SCALABILE)
- Plugin system locale.
- Add-on strumenti.
- AI locale per generare pattern.
- Community file sharing (solo file, no cloud).

---

## Sintesi
Questa web app non copia BandLab: è **più leggera**, **offline-first**, **più economica**, con focus su velocità e workflow locale.
