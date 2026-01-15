import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ChevronRight,
  Clock,
  Grid3X3,
  Layers,
  Music,
  Play,
  Search,
  Square,
  Zap,
} from 'lucide-react';

const STEP_COUNT = 16;
const STEP_DIVISION = 4; // 1/16 notes per 4/4 bar
const DEFAULT_BPM = 120;

const makeSteps = () => Array(STEP_COUNT).fill(false);

const instrumentPalette = [
  { id: 'kick', name: 'Kick Drum', color: 'bg-red-500' },
  { id: 'snare', name: 'Snare Trap', color: 'bg-blue-400' },
  { id: 'hihat', name: 'Hi-Hat Closed', color: 'bg-yellow-400' },
  { id: 'clap', name: 'Clap 808', color: 'bg-purple-500' },
  { id: 'perc', name: 'Percussion', color: 'bg-green-400' },
  { id: 'tom', name: 'Tom Fill', color: 'bg-emerald-400' },
  { id: 'rim', name: 'Rim Shot', color: 'bg-pink-400' },
  { id: 'snap', name: 'Snap', color: 'bg-fuchsia-400' },
  { id: 'openhat', name: 'Open Hat', color: 'bg-amber-400' },
  { id: 'shaker', name: 'Shaker', color: 'bg-orange-400' },
  { id: 'ride', name: 'Ride', color: 'bg-lime-400' },
  { id: 'crash', name: 'Crash', color: 'bg-cyan-400' },
  { id: 'synth1', name: 'Synth Lead', color: 'bg-teal-400' },
  { id: 'synth2', name: 'Synth Pluck', color: 'bg-sky-400' },
  { id: 'pad', name: 'Pad Atmos', color: 'bg-indigo-400' },
  { id: 'bass', name: 'Sub Bass', color: 'bg-violet-400' },
  { id: 'keys', name: 'Keys', color: 'bg-blue-300' },
  { id: 'arp', name: 'Arp', color: 'bg-rose-400' },
  { id: 'fx', name: 'FX Hit', color: 'bg-slate-400' },
  { id: 'vox', name: 'Vox Chop', color: 'bg-amber-300' },
  { id: 'gtr', name: 'Guitar', color: 'bg-emerald-300' },
  { id: 'strings', name: 'Strings', color: 'bg-cyan-300' },
  { id: 'brass', name: 'Brass', color: 'bg-orange-300' },
  { id: 'pluck', name: 'Pluck', color: 'bg-purple-300' },
  { id: 'bell', name: 'Bell', color: 'bg-lime-300' },
  { id: 'chord', name: 'Chord Stab', color: 'bg-teal-300' },
  { id: 'seq', name: 'Seq', color: 'bg-fuchsia-300' },
  { id: 'noise', name: 'Noise', color: 'bg-zinc-400' },
  { id: 'fx2', name: 'Transition', color: 'bg-stone-400' },
  { id: 'fx3', name: 'Riser', color: 'bg-yellow-300' },
];

const App = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [bpm, setBpm] = useState(DEFAULT_BPM);
  const [activeTab, setActiveTab] = useState('sequencer');

  const [sequencerTracks, setSequencerTracks] = useState(
    instrumentPalette.map((instrument) => ({
      ...instrument,
      steps: makeSteps(),
      volume: 80,
      pan: 0,
    }))
  );

  const [tracks, setTracks] = useState([
    { id: 1, name: 'Arrangiamento', volume: 80, color: 'bg-emerald-500', clips: [] },
    { id: 2, name: 'Vocals', volume: 70, color: 'bg-blue-500', clips: [] },
    { id: 3, name: 'Drums', volume: 75, color: 'bg-red-500', clips: [] },
    { id: 4, name: 'Bass', volume: 72, color: 'bg-purple-500', clips: [] },
    { id: 5, name: 'Synth', volume: 68, color: 'bg-yellow-500', clips: [] },
    { id: 6, name: 'FX', volume: 65, color: 'bg-orange-500', clips: [] },
    { id: 7, name: 'Pads', volume: 66, color: 'bg-teal-500', clips: [] },
    { id: 8, name: 'Master Bus', volume: 90, color: 'bg-slate-400', clips: [] },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [targetTrackId, setTargetTrackId] = useState(1);
  const audioCtx = useRef(null);
  const animationRef = useRef(null);
  const transportRef = useRef({
    lastFrame: 0,
    playheadMs: 0,
    stepIndex: 0,
  });

  const stepDurationMs = useMemo(() => {
    const safeBpm = Math.max(40, Math.min(240, Number(bpm) || DEFAULT_BPM));
    return (60_000 / safeBpm) / STEP_DIVISION;
  }, [bpm]);

  const initAudio = async () => {
    if (!audioCtx.current) {
      audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.current.state === 'suspended') {
      await audioCtx.current.resume();
    }
  };

  const playSample = (type) => {
    if (!audioCtx.current) return;
    const osc = audioCtx.current.createOscillator();
    const gain = audioCtx.current.createGain();

    if (type === 'kick') {
      osc.frequency.setValueAtTime(150, audioCtx.current.currentTime);
      osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.current.currentTime + 0.1);
      gain.gain.setValueAtTime(0.5, audioCtx.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.current.currentTime + 0.1);
    } else if (type === 'snare') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(250, audioCtx.current.currentTime);
      gain.gain.setValueAtTime(0.3, audioCtx.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.current.currentTime + 0.1);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, audioCtx.current.currentTime);
      gain.gain.setValueAtTime(0.1, audioCtx.current.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.current.currentTime + 0.05);
    }

    osc.connect(gain);
    gain.connect(audioCtx.current.destination);
    osc.start();
    osc.stop(audioCtx.current.currentTime + 0.1);
  };

  const toggleStep = (trackId, stepIndex) => {
    setSequencerTracks((prev) =>
      prev.map((track) => {
        if (track.id !== trackId) return track;
        const nextSteps = track.steps.map((step, i) => (i === stepIndex ? !step : step));
        if (!track.steps[stepIndex]) {
          playSample(trackId);
        }
        return { ...track, steps: nextSteps };
      })
    );
  };

  useEffect(() => {
    if (!isPlaying) {
      cancelAnimationFrame(animationRef.current);
      transportRef.current.lastFrame = 0;
      return undefined;
    }

    const loop = (timestamp) => {
      if (!transportRef.current.lastFrame) {
        transportRef.current.lastFrame = timestamp;
      }
      const delta = timestamp - transportRef.current.lastFrame;
      transportRef.current.lastFrame = timestamp;
      transportRef.current.playheadMs += delta;

      const nextStepIndex = Math.floor(transportRef.current.playheadMs / stepDurationMs) % STEP_COUNT;
      if (nextStepIndex !== transportRef.current.stepIndex) {
        transportRef.current.stepIndex = nextStepIndex;
        sequencerTracks.forEach((track) => {
          if (track.steps[nextStepIndex]) {
            playSample(track.id);
          }
        });
      }

      setCurrentTime(transportRef.current.playheadMs % (STEP_COUNT * stepDurationMs));
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [isPlaying, sequencerTracks, stepDurationMs]);

  const updateTrackControl = (trackId, key, value) => {
    setSequencerTracks((prev) =>
      prev.map((track) => (track.id === trackId ? { ...track, [key]: value } : track))
    );
  };

  const addPatternToTimeline = () => {
    const activeSteps = sequencerTracks.some((track) => track.steps.some(Boolean));
    if (!activeSteps) return;

    const newClip = {
      id: `pattern-${Date.now()}`,
      start: currentTime,
      duration: STEP_COUNT * stepDurationMs,
      isLive: false,
      name: 'BEAT PATTERN 1',
      isPattern: true,
    };

    setTracks((prev) =>
      prev.map((track) =>
        track.id === targetTrackId ? { ...track, clips: [...track.clips, newClip] } : track
      )
    );
    setActiveTab('tracks');
  };

  const safeBpm = Math.max(40, Math.min(240, Number(bpm) || DEFAULT_BPM));

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-gray-200 select-none overflow-hidden font-sans">
      <header className="h-16 flex items-center justify-between px-6 bg-[#0c0c0c] border-b border-white/5 z-50">
        <div className="flex items-center gap-4">
          <div className="bg-orange-600 p-2 rounded-lg shadow-lg shadow-orange-600/20">
            <Music size={20} className="text-white" />
          </div>
          <div className="leading-none">
            <h1 className="text-xs font-black uppercase tracking-widest text-white">
              MusicLab <span className="text-orange-500">PRO</span>
            </h1>
            <p className="text-[8px] text-gray-500 font-bold tracking-[0.3em]">BEATMAKER EDITION</p>
          </div>
        </div>

        <div className="flex items-center gap-6 bg-black/60 px-8 py-2 rounded-xl border border-white/5">
          <button
            onClick={() => {
              initAudio();
              setIsPlaying((prev) => !prev);
            }}
            className={`p-2 rounded-full transition-all ${
              isPlaying ? 'text-orange-500' : 'text-gray-500 hover:text-white'
            }`}
          >
            {isPlaying ? <Square size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>
          <div className="w-px h-6 bg-white/10"></div>
          <div className="font-mono text-xl text-orange-500 tracking-tighter w-20 text-center">
            {Math.floor(currentTime / 100).toString().padStart(2, '0')}:{(currentTime % 100)
              .toString()
              .padStart(2, '0')}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
            <Clock size={14} className="text-gray-500" />
            <input
              type="number"
              min={40}
              max={240}
              value={safeBpm}
              onChange={(event) => setBpm(Number(event.target.value))}
              className="bg-transparent w-10 text-xs font-bold outline-none text-orange-500"
            />
            <span className="text-[10px] font-bold text-gray-600">BPM</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="w-16 bg-[#0c0c0c] border-r border-white/5 flex flex-col items-center py-6 gap-8">
          <button
            onClick={() => setActiveTab('sequencer')}
            className={`p-3 rounded-xl transition-all ${
              activeTab === 'sequencer'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/40'
                : 'text-gray-600 hover:text-gray-300'
            }`}
          >
            <Grid3X3 size={20} />
          </button>
          <button
            onClick={() => setActiveTab('tracks')}
            className={`p-3 rounded-xl transition-all ${
              activeTab === 'tracks'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/40'
                : 'text-gray-600 hover:text-gray-300'
            }`}
          >
            <Layers size={20} />
          </button>
          <button
            onClick={() => setActiveTab('library')}
            className={`p-3 rounded-xl transition-all ${
              activeTab === 'library'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/40'
                : 'text-gray-600 hover:text-gray-300'
            }`}
          >
            <Search size={20} />
          </button>
        </div>

        <div className="flex-1 flex flex-col bg-[#080808]">
          {activeTab === 'sequencer' && (
            <div className="p-8 max-w-5xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-end mb-8">
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Channel Rack</h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">
                    Step Sequencer 16 Beats
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 bg-black/50 px-3 py-2 rounded-xl border border-white/10">
                    <span className="text-[9px] font-black uppercase text-gray-500">Target</span>
                    <select
                      value={targetTrackId}
                      onChange={(event) => setTargetTrackId(Number(event.target.value))}
                      className="bg-transparent text-[10px] font-bold text-orange-500 outline-none"
                    >
                      {tracks.map((track) => (
                        <option key={track.id} value={track.id} className="text-black">
                          {track.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={addPatternToTimeline}
                    className="bg-orange-600 hover:bg-orange-500 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-orange-600/20 transition-all"
                  >
                    Invia a Timeline <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-4 bg-zinc-900/30 p-6 rounded-3xl border border-white/5 backdrop-blur-sm">
                {sequencerTracks.map((track) => (
                  <div key={track.id} className="flex items-center gap-6">
                    <div className="w-44 flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-3 h-3 rounded-full ${track.color} shadow-[0_0_10px_currentColor]`}
                        ></div>
                        <span className="text-[10px] font-black uppercase text-gray-400 truncate">
                          {track.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[8px] uppercase font-bold text-gray-500">
                        <span>VOL</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={track.volume}
                          onChange={(event) =>
                            updateTrackControl(track.id, 'volume', Number(event.target.value))
                          }
                          className="w-20 accent-orange-500"
                        />
                        <span>PAN</span>
                        <input
                          type="range"
                          min={-50}
                          max={50}
                          value={track.pan}
                          onChange={(event) =>
                            updateTrackControl(track.id, 'pan', Number(event.target.value))
                          }
                          className="w-16 accent-orange-500"
                        />
                      </div>
                    </div>
                    <div className="flex-1 grid grid-cols-16 gap-1.5">
                      {track.steps.map((active, index) => (
                        <button
                          key={index}
                          onClick={() => toggleStep(track.id, index)}
                          className={`h-10 rounded-md transition-all border-b-4 ${
                            active
                              ? `${track.color} border-black/20 scale-95 shadow-inner`
                              : `bg-zinc-800/50 border-zinc-900 hover:bg-zinc-700/50`
                          } ${Math.floor(index / 4) % 2 === 0 ? 'opacity-100' : 'opacity-70'}
                          ${(Math.floor(currentTime / stepDurationMs) % STEP_COUNT) === index ? 'ring-2 ring-white ring-inset' : ''}
                          `}
                        ></button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-12 grid grid-cols-4 gap-6">
                <div className="bg-zinc-900/40 p-6 rounded-2xl border border-white/5">
                  <p className="text-[9px] font-black text-gray-500 uppercase mb-4">Swing Amount</p>
                  <input
                    type="range"
                    className="w-full accent-orange-500 bg-black h-1 rounded-full appearance-none cursor-pointer"
                  />
                </div>
                <div className="bg-zinc-900/40 p-6 rounded-2xl border border-white/5">
                  <p className="text-[9px] font-black text-gray-500 uppercase mb-4">Velocity Global</p>
                  <input
                    type="range"
                    className="w-full accent-orange-500 bg-black h-1 rounded-full appearance-none cursor-pointer"
                  />
                </div>
                <div className="bg-zinc-900/40 p-6 rounded-2xl border border-white/5">
                  <p className="text-[9px] font-black text-gray-500 uppercase mb-4">Master Gain</p>
                  <input
                    type="range"
                    className="w-full accent-orange-500 bg-black h-1 rounded-full appearance-none cursor-pointer"
                  />
                </div>
                <div className="bg-orange-600/10 p-6 rounded-2xl border border-orange-500/20 flex flex-col justify-center text-center">
                  <p className="text-[10px] font-black text-orange-500 uppercase">Auto-Quantize</p>
                  <p className="text-[8px] text-orange-500/60 font-bold uppercase">ON / 1/16 STEPS</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'tracks' && (
            <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-300">
              <div className="h-10 bg-black/40 border-b border-white/5 flex items-center px-4 gap-4 overflow-x-auto scrollbar-hide">
                {Array.from({ length: 40 }).map((_, index) => (
                  <div key={index} className="min-w-[100px] text-[9px] font-mono font-black text-gray-600">
                    BAR {index + 1}
                  </div>
                ))}
              </div>

              <div className="flex-1 overflow-auto relative custom-scroll">
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-orange-500 z-40 pointer-events-none shadow-[0_0_15px_rgba(249,115,22,0.5)]"
                  style={{ left: `${currentTime}px` }}
                >
                  <div className="w-3 h-3 bg-orange-500 -ml-[5.5px] rounded-full"></div>
                </div>

                {tracks.map((track) => (
                  <div key={track.id} className="h-32 border-b border-white/5 relative bg-zinc-900/10 group">
                    <div className="absolute left-4 top-4 z-10 flex items-center gap-2 opacity-30 group-hover:opacity-100 transition-opacity">
                      <div className={`w-2 h-2 rounded-full ${track.color}`}></div>
                      <span className="text-[9px] font-black uppercase text-gray-400">{track.name}</span>
                    </div>
                    <div className="absolute right-4 top-4 flex items-center gap-2 text-[8px] font-black uppercase text-gray-500">
                      <span>{track.volume} dB</span>
                      <div className="h-2 w-20 bg-black/40 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full bg-orange-500/70"
                          style={{ width: `${Math.min(100, track.volume)}%` }}
                        ></div>
                      </div>
                    </div>

                    {track.clips.map((clip) => (
                      <div
                        key={clip.id}
                        className={`absolute top-6 h-20 rounded-xl ${
                          clip.isPattern ? 'bg-orange-600' : track.color
                        } border border-white/10 shadow-xl overflow-hidden`}
                        style={{ left: `${clip.start}px`, width: `${clip.duration}px` }}
                      >
                        <div className="p-2 flex items-center gap-2">
                          <Zap size={10} className="text-white" />
                          <span className="text-[8px] font-black uppercase text-white tracking-tighter">{clip.name}</span>
                        </div>
                        <div className="flex items-end gap-0.5 h-10 px-2 opacity-40">
                          {Array.from({ length: 16 }).map((_, index) => (
                            <div key={index} className="bg-white flex-1" style={{ height: `${Math.random() * 100}%` }}></div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'library' && (
            <div className="p-8 animate-in fade-in duration-300">
              <div className="relative max-w-2xl mb-8">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <input
                  type="text"
                  placeholder="Cerca Drum Kits, Loop o One-Shots..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 text-sm outline-none focus:ring-2 ring-orange-500/20 transition-all"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
              <div className="grid grid-cols-4 gap-4">
                {['808 Kit', 'Lo-Fi Piano', 'Hard Trap Kick', 'Ambient Pad'].map((item) => (
                  <div
                    key={item}
                    className="bg-zinc-900/40 p-6 rounded-2xl border border-white/5 hover:border-orange-500/50 cursor-pointer group transition-all"
                  >
                    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mb-4 group-hover:bg-orange-600 transition-colors">
                      <Music size={20} />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest">{item}</p>
                    <p className="text-[8px] text-gray-600 font-bold uppercase mt-1">Free Sample</p>
                  </div>
                ))}
              </div>
              <div className="mt-10">
                <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.3em] mb-4">
                  Funzionalità Pro (100+)
                </p>
                <div className="grid grid-cols-3 gap-4">
                  {[
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
                  ].map((feature) => (
                    <div
                      key={feature}
                      className="bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-[9px] font-black uppercase text-gray-300"
                    >
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="h-10 bg-[#0c0c0c] border-t border-white/5 flex items-center px-6 justify-between text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">
        <div className="flex gap-8">
          <span className="flex items-center gap-2 text-orange-500">
            <Activity size={12} /> CPU: 12%
          </span>
          <span>LATENCY: 5ms</span>
          <span>SAMPLE RATE: 48000 HZ</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/40">MUSICLAB v2.0 - FL CLONE</span>
        </div>
      </footer>

      <style>{`
        .grid-cols-16 { grid-template-columns: repeat(16, minmax(0, 1fr)); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .custom-scroll::-webkit-scrollbar { height: 4px; width: 4px; }
        .custom-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default App;
