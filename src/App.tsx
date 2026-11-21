import { useEffect, useMemo, useRef, useState } from "react";
import {
  Home, Compass, Search, Library, ListMusic, Heart, Clock3, Plus, Play, Pause,
  SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX, Music2, Radio,
  Disc3, AudioLines, FolderOpen, Settings, Sparkles, ChevronDown, Trash2,
  ListPlus, X, MoreHorizontal
} from "lucide-react";

type Track = { name: string; path: string; url: string; size: number };
type Playlist = { id: string; name: string; paths: string[] };
const fmt = (n: number) => `${Math.floor((n || 0) / 60)}:${String(Math.floor((n || 0) % 60)).padStart(2, "0")}`;
const readStore = <T,>(key: string, fallback: T): T => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
};

export default function App() {
  const [tracks, setTracks] = useState<Track[]>(() => readStore("hb.tracks", []));
  const [liked, setLiked] = useState<string[]>(() => readStore("hb.liked", []));
  const [recent, setRecent] = useState<string[]>(() => readStore("hb.recent", []));
  const [playlists, setPlaylists] = useState<Playlist[]>(() => readStore("hb.playlists", []));
  const [active, setActive] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Home");
  const [source, setSource] = useState("Local music");
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState("");
  const audio = useRef<HTMLAudioElement>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const filters = useRef<BiquadFilterNode[]>([]);
  const analyser = useRef<AnalyserNode | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const graphReady = useRef(false);
  const [eqEnabled, setEqEnabled] = useState(() => readStore("hb.eqEnabled", true));
  const [eqGains, setEqGains] = useState<number[]>(() => readStore("hb.eqGains", [3, 2, 0, 2, 3]));
  const [eqPreset, setEqPreset] = useState(() => readStore("hb.eqPreset", "Custom"));
  const [visualizerOn, setVisualizerOn] = useState(() => readStore("hb.visualizer", true));
  const [playbackRate, setPlaybackRate] = useState<number>(() => readStore("hb.playbackRate", 1));
  const [sleepMinutes, setSleepMinutes] = useState<number>(0);
  const [sleepRemaining, setSleepRemaining] = useState<number>(0);
  const [miniOpen, setMiniOpen] = useState(false);
  const [immersiveOpen, setImmersiveOpen] = useState(false);
  const [lyricsByPath, setLyricsByPath] = useState<Record<string, {time:number;text:string}[]>>(() => readStore("hb.lyrics", {}));
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lyricsStatus, setLyricsStatus] = useState("Lyrics not searched");
  const [updateStatus, setUpdateStatus] = useState<{state:string;message:string;version?:string;percent?:number}>({state:"idle",message:"Updates are checked automatically."});
  const sleepTimeout = useRef<number | null>(null);
  const current = tracks[active];
  const sleepLabel = sleepRemaining ? `${Math.floor(sleepRemaining / 60)}:${String(sleepRemaining % 60).padStart(2, "0")}` : "";

  useEffect(() => { localStorage.setItem("hb.tracks", JSON.stringify(tracks)); }, [tracks]);
  useEffect(() => { localStorage.setItem("hb.liked", JSON.stringify(liked)); }, [liked]);
  useEffect(() => { localStorage.setItem("hb.recent", JSON.stringify(recent)); }, [recent]);
  useEffect(() => { localStorage.setItem("hb.playlists", JSON.stringify(playlists)); }, [playlists]);
  useEffect(() => { localStorage.setItem("hb.eqEnabled", JSON.stringify(eqEnabled)); }, [eqEnabled]);
  useEffect(() => { localStorage.setItem("hb.eqGains", JSON.stringify(eqGains)); }, [eqGains]);
  useEffect(() => { localStorage.setItem("hb.eqPreset", JSON.stringify(eqPreset)); }, [eqPreset]);
  useEffect(() => { localStorage.setItem("hb.visualizer", JSON.stringify(visualizerOn)); }, [visualizerOn]);
  useEffect(() => { localStorage.setItem("hb.playbackRate", JSON.stringify(playbackRate)); }, [playbackRate]);
  useEffect(() => { localStorage.setItem("hb.lyrics", JSON.stringify(lyricsByPath)); }, [lyricsByPath]);
  useEffect(() => { if (audio.current) audio.current.playbackRate = playbackRate; }, [playbackRate, active]);

  useEffect(() => {
    if (sleepTimeout.current !== null) window.clearTimeout(sleepTimeout.current);
    if (!sleepMinutes) { setSleepRemaining(0); return; }
    const deadline = Date.now() + sleepMinutes * 60 * 1000;
    setSleepRemaining(sleepMinutes * 60);
    const tick = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSleepRemaining(left);
      if (left <= 0) {
        window.clearInterval(tick);
        audio.current?.pause();
        setPlaying(false);
        setSleepMinutes(0);
      }
    }, 1000);
    sleepTimeout.current = window.setTimeout(() => {
      window.clearInterval(tick);
      audio.current?.pause();
      setPlaying(false);
      setSleepMinutes(0);
      setSleepRemaining(0);
    }, sleepMinutes * 60 * 1000);
    return () => { window.clearInterval(tick); if (sleepTimeout.current !== null) window.clearTimeout(sleepTimeout.current); };
  }, [sleepMinutes]);

  const currentLyrics = current ? (lyricsByPath[current.path] || []) : [];
  const activeLyricIndex = currentLyrics.reduce((found, line, index) => line.time <= time ? index : found, -1);

  // Automatically look up timestamped lyrics for the current local track.
  useEffect(() => {
    if (!current || lyricsByPath[current.path]?.length) return;
    let cancelled = false;
    const raw = current.name;
    const parts = raw.split(/\\s[-–]\\s/);
    const title = parts.length > 1 ? parts[0] : raw;
    const artist = parts.length > 1 ? parts.slice(1).join(" - ") : "";
    setLyricsStatus("Searching LRCLIB…");
    const timer = window.setTimeout(async () => {
      const result = await window.echo.findLyrics({ title, artist });
      if (cancelled) return;
      if (result?.syncedLyrics) {
        const parsed = result.syncedLyrics.split(/\\r?\\n/).flatMap(line => {
          const matches = [...line.matchAll(/\\[(\\d{1,2}):(\\d{2}(?:\\.\\d{1,3})?)\\]/g)];
          const text = line.replace(/\\[(\\d{1,2}):(\\d{2}(?:\\.\\d{1,3})?)\\]/g, "").trim();
          return matches.map(match => ({ time: Number(match[1]) * 60 + Number(match[2]), text })).filter(item => item.text);
        }).sort((a,b) => a.time-b.time);
        if (parsed.length) {
          setLyricsByPath(old => ({...old, [current.path]: parsed}));
          setLyricsStatus("Synced lyrics found · LRCLIB");
          return;
        }
      }
      setLyricsStatus(result?.plainLyrics ? "Plain lyrics found (not time-synced)" : "No synced lyrics found");
    }, 450);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [current?.path]);

  // Listen for automatic update checks and background download progress.
  useEffect(() => window.echo.onUpdateStatus(status => setUpdateStatus(status)), []);
  useEffect(() => window.echo.onMiniExpand(() => setImmersiveOpen(true)), []);
  useEffect(() => window.echo.onMiniStateRequest(() => window.echo.miniState({ title: current?.name || "", playing, time, duration })), [current?.name, playing, time, duration]);
  useEffect(() => { if (immersiveOpen) document.body.classList.add("hb-immersive"); else document.body.classList.remove("hb-immersive"); return () => document.body.classList.remove("hb-immersive"); }, [immersiveOpen]);

  async function checkForUpdates() {
    const status = await window.echo.checkForUpdates();
    setUpdateStatus(status);
  }

  // Keep the independent native mini-player updated with the real audio clock.
  useEffect(() => {
    window.echo.miniState({ title: current?.name || "", playing, time, duration });
  }, [current?.name, playing, time, duration]);
  useEffect(() => window.echo.onMiniControl(action => {
    if (action === "toggle") toggle();
    if (action === "next") next();
    if (action === "previous") previous();
  }), [playing, active, tracks, shuffle, repeat, time]);


  async function importLyrics() {
    if (!current) return;
    const result = await window.echo.pickLyrics();
    if (!result) return;
    const parsed = result.content.split(/\\r?\\n/).flatMap(line => {
      const matches = [...line.matchAll(/\\[(\\d{1,2}):(\\d{2}(?:\\.\\d{1,3})?)\\]/g)];
      const text = line.replace(/\\[(\\d{1,2}):(\\d{2}(?:\\.\\d{1,3})?)\\]/g, "").trim();
      return matches.map(match => ({ time: Number(match[1]) * 60 + Number(match[2]), text })).filter(item => item.text);
    }).sort((a,b) => a.time-b.time);
    if (!parsed.length) { window.alert("No timestamped LRC lyrics were found in that file."); return; }
    setLyricsByPath(old => ({...old, [current.path]: parsed}));
    setLyricsStatus("Synced lyrics loaded from file");
    setLyricsOpen(true);
  }

  function setupAudioGraph() {
    const el = audio.current;
    if (!el || graphReady.current) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    const sourceNode = ctx.createMediaElementSource(el);
    const frequencies = [60, 250, 1000, 4000, 12000];
    const types: BiquadFilterType[] = ["lowshelf", "peaking", "peaking", "peaking", "highshelf"];
    const nodes = frequencies.map((frequency, i) => {
      const node = ctx.createBiquadFilter(); node.type = types[i]; node.frequency.value = frequency;
      node.Q.value = i === 0 || i === 4 ? 0.7 : 1;
      node.gain.value = eqEnabled ? eqGains[i] : 0; return node;
    });
    const meter = ctx.createAnalyser(); meter.fftSize = 128;
    sourceNode.connect(nodes[0]);
    nodes.forEach((node, i) => node.connect(nodes[i + 1] || meter));
    meter.connect(ctx.destination);
    audioContext.current = ctx; filters.current = nodes; analyser.current = meter; graphReady.current = true;
  }
  useEffect(() => { filters.current.forEach((f, i) => { f.gain.value = eqEnabled ? (eqGains[i] || 0) : 0; }); }, [eqEnabled, eqGains]);
  useEffect(() => {
    if (!visualizerOn || !canvas.current) return;
    let frame = 0; const c = canvas.current; const ctx = c.getContext("2d"); if (!ctx) return;
    const draw = () => {
      const w = c.clientWidth, h = c.clientHeight, dpr = window.devicePixelRatio || 1;
      if (c.width !== Math.floor(w*dpr) || c.height !== Math.floor(h*dpr)) { c.width = Math.floor(w*dpr); c.height = Math.floor(h*dpr); }
      ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
      const bins = new Uint8Array(analyser.current?.frequencyBinCount || 32);
      analyser.current?.getByteFrequencyData(bins);
      const count = 34, gap = 4, barW = Math.max(2,(w-gap*(count-1))/count);
      for(let i=0;i<count;i++) { const v = bins[Math.floor(i*bins.length/count)] || (playing ? 18 + (i*7%28) : 4); const bh = Math.max(3,(v/255)*h*0.95); const grad=ctx.createLinearGradient(0,h-bh,0,h); grad.addColorStop(0,"#e2b6ff"); grad.addColorStop(1,"#8a4bc4"); ctx.fillStyle=grad; ctx.beginPath(); ctx.roundRect(i*(barW+gap),h-bh,barW,bh,3); ctx.fill(); }
      frame = requestAnimationFrame(draw);
    }; draw(); return () => cancelAnimationFrame(frame);
  }, [visualizerOn, playing, tab]);
  useEffect(() => {
    const el = audio.current; if (!el) return;
    const tick = () => setTime(el.currentTime || 0);
    const meta = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const ended = () => { if (repeat) { el.currentTime = 0; void el.play(); } else next(); };
    el.addEventListener("timeupdate", tick); el.addEventListener("loadedmetadata", meta); el.addEventListener("ended", ended);
    return () => { el.removeEventListener("timeupdate", tick); el.removeEventListener("loadedmetadata", meta); el.removeEventListener("ended", ended); };
  }, [active, tracks, shuffle, repeat]);
  useEffect(() => { if (audio.current) audio.current.volume = muted ? 0 : volume; }, [volume, muted]);
  useEffect(() => {
    if (!current || !audio.current) return;
    setupAudioGraph();
    audio.current.src = current.url;
    audio.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    setRecent(old => [current.path, ...old.filter(p => p !== current.path)].slice(0, 50));
  }, [active]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); toggle(); }
      if (e.code === "ArrowRight" && audio.current) audio.current.currentTime = Math.min(duration, time + 5);
      if (e.code === "ArrowLeft" && audio.current) audio.current.currentTime = Math.max(0, time - 5);
    };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  });

  async function addFiles() {
    const picked = await window.echo.pickAudio();
    if (!picked.length) return;
    setTracks(old => {
      const known = new Set(old.map(t => t.path));
      const fresh = picked.filter(t => !known.has(t.path));
      const next = [...old, ...fresh];
      if (active < 0 && next.length) setTimeout(() => setActive(0), 0);
      return next;
    });
    setSource("Local music"); setTab("Your Library");
  }
  function toggle() {
    if (!current) { void addFiles(); return; }
    const el = audio.current; if (!el) return;
    setupAudioGraph(); void audioContext.current?.resume();
    if (playing) { el.pause(); setPlaying(false); }
    else el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }
  function applyPreset(name: string) {
    const presets: Record<string, number[]> = { Flat:[0,0,0,0,0], Bass:[7,5,1,-1,0], Treble:[0,-1,1,5,7], Vocal:[-2,1,4,3,-1], Rock:[4,2,-1,3,5], Electronic:[5,3,0,4,5] };
    if (presets[name]) setEqGains(presets[name]); setEqPreset(name);
  }
  function next() {
    if (!tracks.length) return;
    const idx = shuffle ? Math.floor(Math.random() * tracks.length) : (active + 1) % tracks.length;
    setActive(idx);
  }
  function previous() {
    if (audio.current && time > 3) { audio.current.currentTime = 0; return; }
    setActive(i => Math.max(0, i - 1));
  }
  function toggleLike(track: Track) { setLiked(old => old.includes(track.path) ? old.filter(p => p !== track.path) : [...old, track.path]); }
  function createPlaylist() {
    const name = window.prompt("Name your playlist:"); if (!name?.trim()) return;
    const p = { id: crypto.randomUUID(), name: name.trim(), paths: [] };
    setPlaylists(old => [...old, p]); setSelectedPlaylist(p.id); setTab("Playlists");
  }
  function addToPlaylist(track: Track) {
    if (!playlists.length) { createPlaylist(); return; }
    const choice = window.prompt(`Add to which playlist?\n${playlists.map((p, i) => `${i + 1}. ${p.name}`).join("\n")}\nEnter playlist number:`);
    const p = playlists[Number(choice) - 1]; if (!p) return;
    setPlaylists(old => old.map(x => x.id === p.id ? { ...x, paths: [...new Set([...x.paths, track.path])] } : x));
  }
  function removeTrack(track: Track) {
    setTracks(old => old.filter(t => t.path !== track.path));
    setLiked(old => old.filter(p => p !== track.path));
    setPlaylists(old => old.map(p => ({ ...p, paths: p.paths.filter(x => x !== track.path) })));
    if (current?.path === track.path) { audio.current?.pause(); setPlaying(false); setActive(-1); }
  }

  const visible = useMemo(() => {
    let list = tracks;
    if (tab === "Liked Songs") list = list.filter(t => liked.includes(t.path));
    else if (tab === "Recently Played") list = recent.map(p => tracks.find(t => t.path === p)).filter(Boolean) as Track[];
    else if (tab === "Playlists" && selectedPlaylist) {
      const p = playlists.find(x => x.id === selectedPlaylist); list = p ? p.paths.map(path => tracks.find(t => t.path === path)).filter(Boolean) as Track[] : [];
    }
    return list.filter(t => t.name.toLowerCase().includes(query.toLowerCase()));
  }, [tracks, liked, recent, tab, query, playlists, selectedPlaylist]);

  return <div className="app">
    <audio ref={audio} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><AudioLines size={23}/></div><div><b>heart beats</b><span>DESKTOP PLAYER</span></div></div>
      <div className="profile"><div className="avatar">H</div><div><b>Your space</b><small>Personal music library</small></div><ChevronDown size={15}/></div>
      <div className="nav-label">DISCOVER</div>
      {[[Home,"Home"],[Compass,"Explore"],[Search,"Search"],[Library,"Your Library"]].map(([Icon,label]: any)=><button className={`nav-item ${tab===label?"selected":""}`} onClick={()=>setTab(label)} key={label}><Icon size={18}/>{label}</button>)}
      <div className="nav-label playlist-label">YOUR COLLECTION <button onClick={createPlaylist}><Plus size={15}/></button></div>
      {[[Heart,"Liked Songs"],[Clock3,"Recently Played"],[ListMusic,"Playlists"]].map(([Icon,label]: any)=><button className={`nav-item ${tab===label?"selected":""}`} onClick={()=>{setTab(label); if(label==="Playlists" && playlists[0])setSelectedPlaylist(playlists[0].id);}} key={label}><Icon size={18}/>{label}</button>)}
      <div className="playlist-links">{playlists.slice(0,5).map(p=><button key={p.id} onClick={()=>{setSelectedPlaylist(p.id);setTab("Playlists");}}>{p.name}</button>)}</div>
      <div className="sidebar-bottom"><div className="upgrade"><Sparkles size={17}/><b>Make it yours</b><p>Your music stays on your device.</p><button onClick={addFiles}>Import music <Plus size={14}/></button></div><button className="nav-item" onClick={()=>setTab("Settings")}><Settings size={18}/>Settings</button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="crumb">Your music universe <span>/</span> <b>{tab}</b></div><div className="top-actions"><div className="searchbox"><Search size={17}/><input placeholder="Search your library..." value={query} onChange={e=>{setQuery(e.target.value);setTab("Search");}}/><kbd>Ctrl / Space</kbd></div><div className="user-dot">H</div></div></header>
      <div className="content">
        <section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="pulse"/> YOUR SOUND. YOUR SPACE.</div><h1>Feel every<br/><em>heartbeat.</em></h1><p>One home for your personal music collection. Import your tracks, build playlists and make every listen yours.</p><div className="hero-buttons"><button className="primary" onClick={addFiles}><FolderOpen size={17}/> Import music</button><button className="secondary" onClick={()=>setTab("Your Library")}><Library size={17}/> Open library</button></div></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-disc"><div className="disc-center"><AudioLines size={38}/></div></div><div className="floating-note note-one"><Music2 size={19}/></div><div className="floating-note note-two"><Disc3 size={19}/></div><div className="sound-bars">{Array.from({length:22},(_,i)=><i key={i} style={{height:`${15+((i*17)%48)}px`}}/>)}</div></div></section>
        <section className="sources-section"><div className="section-heading"><div><div className="eyebrow muted">YOUR MUSIC SOURCES</div><h2>Choose where to listen</h2></div><span className="subtle">Local playback · EQ · Visualiser</span></div><div className="source-grid">
          <button className={`source-card youtube ${source==="YouTube Music"?"active":""}`} onClick={()=>{setSource("YouTube Music");setTab("Explore");}}><div className="source-logo"><Radio size={25}/></div><div><b>YouTube Music</b><small>Provider integration planned</small></div><span className="source-status">Coming soon</span></button>
          <button className={`source-card spotify ${source==="Spotify"?"active":""}`} onClick={()=>{setSource("Spotify");setTab("Explore");}}><div className="source-logo"><Radio size={25}/></div><div><b>Spotify</b><small>Official account connection planned</small></div><span className="source-status">Coming soon</span></button>
          <button className={`source-card local ${source==="Local music"?"active":""}`} onClick={addFiles}><div className="source-logo"><Disc3 size={25}/></div><div><b>Local music</b><small>{tracks.length} tracks in your library</small></div><span className="source-status connected">Ready</span></button>
        </div></section>
        <section className="music-section"><div className="section-heading"><div><div className="eyebrow muted">{tab==="Liked Songs"?"YOUR FAVOURITES":tab==="Recently Played"?"LISTEN AGAIN":tab==="Playlists"?"YOUR MIXES":"YOUR COLLECTION"}</div><h2>{tab==="Search"?"Search results":tab==="Liked Songs"?"Liked songs":tab==="Recently Played"?"Recently played":tab==="Playlists"?"Your playlists":tab==="Settings"?"Settings":"Your music"}</h2></div><div className="heading-actions">{tab==="Playlists"&&<button className="text-button" onClick={createPlaylist}><Plus size={15}/> New playlist</button>}<button className="text-button" onClick={addFiles}><Plus size={15}/> Import tracks</button></div></div>
          {tab==="Settings" ? <div className="settings-card"><div className="settings-title"><div><b>Audio equaliser</b><p>Five-band tone control for local audio playback.</p></div><label className="switch-label"><input type="checkbox" checked={eqEnabled} onChange={e=>setEqEnabled(e.target.checked)}/> Enabled</label></div><div className="eq-presets">{["Flat","Bass","Treble","Vocal","Rock","Electronic"].map(name=><button className={eqPreset===name?"preset-active":""} key={name} onClick={()=>applyPreset(name)}>{name}</button>)}</div><div className="eq-sliders">{["60 Hz","250 Hz","1 kHz","4 kHz","12 kHz"].map((label,i)=><label key={label}><span>{label}</span><input type="range" min="-12" max="12" value={eqGains[i]||0} disabled={!eqEnabled} onChange={e=>{const next=[...eqGains];next[i]=Number(e.target.value);setEqGains(next);setEqPreset("Custom");}}/><small>{(eqGains[i]>0?"+":"")+(eqGains[i]||0)} dB</small></label>)}</div><div className="settings-title visualizer-title"><div><b>Audio visualiser</b><p>Live frequency bars from the local player.</p></div><label className="switch-label"><input type="checkbox" checked={visualizerOn} onChange={e=>setVisualizerOn(e.target.checked)}/> Show</label></div>{visualizerOn&&<canvas className="visualizer-canvas" ref={canvas}/>}<div className="settings-divider"/><b>Playback shortcuts</b><p><kbd>Space</kbd> Play / pause &nbsp; <kbd>←</kbd> Rewind 5 seconds &nbsp; <kbd>→</kbd> Forward 5 seconds</p>
            <div className="settings-divider"/>
            <div className="settings-title"><div><b>Sleep timer</b><p>Stop playback automatically after the selected time.</p></div>
              <div className="timer-controls"><select value={sleepMinutes} onChange={e=>setSleepMinutes(Number(e.target.value))}><option value={0}>Off</option><option value={5}>5 minutes</option><option value={10}>10 minutes</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>60 minutes</option><option value={90}>90 minutes</option></select>{sleepLabel&&<span className="timer-countdown">{sleepLabel} left</span>}</div>
            </div>
            <div className="settings-divider"/>
            <b>Library storage</b><p>Your imported file locations, favourites and playlists are saved locally in this Windows user profile. Moving or deleting the original audio files can break their library entries.</p>
            <div className="settings-divider"/>
            <div className="settings-title"><div><b>Heart Beats updates</b><p>{updateStatus.message}</p>{typeof updateStatus.percent === "number" && <small>{updateStatus.percent}% downloaded</small>}</div><div className="timer-controls">{updateStatus.state === "downloaded" ? <button className="primary" onClick={()=>void window.echo.installUpdate()}>Restart &amp; install</button> : <button className="secondary" onClick={()=>void checkForUpdates()} disabled={updateStatus.state === "checking" || updateStatus.state === "downloading"}>Check for updates</button>}</div></div>
            </div> : tab==="Playlists" && playlists.length===0 ? <div className="empty-state"><div className="empty-icon"><ListMusic size={25}/></div><b>No playlists yet</b><p>Create a playlist and add tracks from your library.</p><button className="secondary" onClick={createPlaylist}><Plus size={16}/> Create playlist</button></div> : visible.length ? <div className="track-list">{visible.map((t,i)=><div className={`track-row ${current?.path===t.path?"playing-row":""}`} key={t.path}><button className="track-cover" onClick={()=>setActive(tracks.indexOf(t))}>{current?.path===t.path&&playing?<AudioLines size={18}/>:<Music2 size={18}/>}</button><div className="track-info" onDoubleClick={()=>setActive(tracks.indexOf(t))}><b>{t.name}</b><small>Local audio file</small></div><span className="track-album">{(t.size/1048576).toFixed(1)} MB</span><button className="row-action" title="Add to playlist" onClick={()=>addToPlaylist(t)}><ListPlus size={16}/></button><button className={`row-action ${liked.includes(t.path)?"liked":""}`} title="Like" onClick={()=>toggleLike(t)}><Heart size={16} fill={liked.includes(t.path)?"currentColor":"none"}/></button><button className="row-action" title="Remove from library" onClick={()=>removeTrack(t)}><Trash2 size={15}/></button><button className="row-play" onClick={()=>setActive(tracks.indexOf(t))}><Play size={16}/></button></div>)}</div> : <div className="empty-state"><div className="empty-icon"><FolderOpen size={25}/></div><b>{query?"No matching tracks":"Your library starts here"}</b><p>{query?"Try another search term.":"Import audio files from your PC. Your music stays on your device."}</p><button className="secondary" onClick={addFiles}><Plus size={16}/> Browse audio files</button></div>}
        </section>
        <footer>HEART BEATS <span>•</span> MADE FOR THE WAY YOU LISTEN <span className="version">PREVIEW 0.8.0</span></footer>
      </div>
    </main>
    <div className="player"><div className="now-playing">{current?<><div className="mini-cover"><Music2 size={20}/></div><div className="now-meta"><b>{current.name}</b><small>Local audio</small></div><button className={`icon-btn ${liked.includes(current.path)?"liked":""}`} onClick={()=>toggleLike(current)}><Heart size={17} fill={liked.includes(current.path)?"currentColor":"none"}/></button></>:<><div className="mini-cover idle"><AudioLines size={20}/></div><div className="now-meta"><b>Nothing playing</b><small>Choose a track to begin</small></div></>}</div>
      <div className="player-center"><div className="controls"><button className={shuffle?"control-on":"icon-btn"} onClick={()=>setShuffle(!shuffle)} title="Shuffle"><Shuffle size={16}/></button><button className="icon-btn" onClick={previous}><SkipBack size={19}/></button><button className="play-button" onClick={toggle}>{playing?<Pause size={19} fill="currentColor"/>:<Play size={19} fill="currentColor"/>}</button><button className="icon-btn" onClick={next}><SkipForward size={19}/></button><button className={repeat?"control-on":"icon-btn"} onClick={()=>setRepeat(!repeat)} title="Repeat current track"><Repeat size={16}/></button></div><div className="progress-line"><span>{fmt(time)}</span><input type="range" min="0" max={duration||100} value={Math.min(time,duration||100)} onChange={e=>{if(audio.current)audio.current.currentTime=Number(e.target.value);}}/><span>{fmt(duration)}</span></div></div>
      <div className="player-right"><button className="icon-btn" onClick={()=>setLyricsOpen(v=>!v)} title="Lyrics"><AudioLines size={18}/></button><button className="icon-btn" onClick={()=>void window.echo.openMini()} title="Open floating mini player"><Disc3 size={18}/></button><button className="icon-btn" onClick={()=>setTab("Playlists")} title="Playlists"><ListPlus size={18}/></button><select className="speed-select" aria-label="Playback speed" title="Playback speed" value={playbackRate} onChange={e=>setPlaybackRate(Number(e.target.value))}><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option><option value={1.5}>1.5×</option><option value={1.75}>1.75×</option><option value={2}>2×</option></select><button className="icon-btn" onClick={()=>setMuted(!muted)}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button><input className="volume" type="range" min="0" max="1" step=".01" value={muted?0:volume} onChange={e=>{setVolume(Number(e.target.value));setMuted(false);}}/></div>
    </div>
    {lyricsOpen && <section className="lyrics-panel">
      <div className="panel-head"><div><span className="eyebrow muted">SYNCHRONISED LYRICS</span><b>{current?.name || "No track selected"}</b></div><button className="icon-btn" onClick={()=>setLyricsOpen(false)}><X size={17}/></button></div>
      {currentLyrics.length ? <div className="lyrics-lines">{currentLyrics.map((line,i)=><div key={`${line.time}-${i}`} className={i===activeLyricIndex?"lyric-active":""} onClick={()=>{if(audio.current)audio.current.currentTime=line.time;}}>{line.text}</div>)}</div> : <div className="lyrics-empty"><AudioLines size={25}/><b>No synced lyrics loaded</b><p>{lyricsStatus}. Heart Beats searches for timestamped lyrics automatically; you can also load an .LRC file.</p><button className="secondary" onClick={importLyrics}>Import .LRC lyrics</button></div>}
    </section>}


    {immersiveOpen && <div className="hb-immersive-screen">
      <div className="immersive-top"><div className="brand-mini"><span>♫</span><b>HEART BEATS</b><small>NOW PLAYING</small></div><button className="immersive-close" onClick={()=>{setImmersiveOpen(false);window.echo.exitPlayerFullscreen();}}><X size={19}/> Close full player</button></div>
      <div className="immersive-grid">
        <section className="immersive-left">
          <div className={`immersive-art ${playing?"immersive-art-playing":""}`}><div className="art-orbit"/><Disc3 size={104}/><span>♫</span></div>
          <div className="immersive-track"><h1>{current?.name || "Nothing playing"}</h1><p>Local audio · Heart Beats library</p></div>
          <div className="immersive-progress"><span>{fmt(time)}</span><input type="range" min="0" max={duration||100} value={Math.min(time,duration||100)} onChange={e=>{if(audio.current)audio.current.currentTime=Number(e.target.value);}}/><span>{fmt(duration)}</span></div>
          <div className="immersive-controls"><button className={shuffle?"control-on":"icon-btn"} onClick={()=>setShuffle(!shuffle)} title="Shuffle"><Shuffle/></button><button className="icon-btn" onClick={previous}><SkipBack size={23}/></button><button className="immersive-play" onClick={toggle}>{playing?<Pause size={25}/>:<Play size={25}/>}</button><button className="icon-btn" onClick={next}><SkipForward size={23}/></button><button className={repeat?"control-on":"icon-btn"} onClick={()=>setRepeat(!repeat)} title="Repeat"><Repeat/></button></div>
          <div className="immersive-settings">
            <div className="immersive-setting"><label>Volume</label><input type="range" min="0" max="1" step=".01" value={muted?0:volume} onChange={e=>{setVolume(Number(e.target.value));setMuted(false);}}/><span>{Math.round((muted?0:volume)*100)}%</span></div>
            <div className="immersive-setting"><label>Playback speed</label><select value={playbackRate} onChange={e=>setPlaybackRate(Number(e.target.value))}><option value={0.75}>0.75×</option><option value={1}>1×</option><option value={1.25}>1.25×</option><option value={1.5}>1.5×</option><option value={1.75}>1.75×</option><option value={2}>2×</option></select></div>
            <div className="immersive-setting"><label>Equaliser</label><label className="immersive-check"><input type="checkbox" checked={eqEnabled} onChange={e=>setEqEnabled(e.target.checked)}/> Enabled</label></div>
            <div className="immersive-setting"><label>Visualiser</label><label className="immersive-check"><input type="checkbox" checked={visualizerOn} onChange={e=>setVisualizerOn(e.target.checked)}/> Show animation</label></div>
            <div className="immersive-setting"><label>Sleep timer</label><select value={sleepMinutes} onChange={e=>setSleepMinutes(Number(e.target.value))}><option value={0}>Off</option><option value={5}>5 min</option><option value={10}>10 min</option><option value={15}>15 min</option><option value={30}>30 min</option><option value={45}>45 min</option><option value={60}>60 min</option><option value={90}>90 min</option></select></div>
            <div className="immersive-setting"><label>Lyrics source</label><button className="secondary" onClick={importLyrics}>Import .LRC</button></div>
          </div>
        </section>
        <section className="immersive-lyrics"><div className="lyrics-heading"><span className="eyebrow">LIVE LYRICS</span><h2>{current?.name || "Lyrics"}</h2><p>{lyricsStatus}</p></div>
          {currentLyrics.length ? <div className="immersive-lyrics-list">{currentLyrics.map((line,i)=><button key={`${line.time}-${i}`} className={i===activeLyricIndex?"immersive-lyric-active":""} onClick={()=>{if(audio.current)audio.current.currentTime=line.time;}}>{line.text}</button>)}</div> : <div className="immersive-no-lyrics"><AudioLines size={35}/><h3>No synced lyrics yet</h3><p>Heart Beats searches LRCLIB automatically. You can import a timestamped .LRC file.</p><button className="secondary" onClick={importLyrics}>Import lyrics</button></div>}
        </section>
      </div>
    </div>}
  </div>;
}
