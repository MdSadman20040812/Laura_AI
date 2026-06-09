import React, { useEffect, useState, useRef } from "react";
import { useTimelineStore } from "./store/timeline";
import { Player } from "./components/Player";
import { Timeline } from "./components/Timeline";
import { AIChat } from "./components/AIChat";
import { isTauriEnvironment } from "./lib/ipc";
import { 
  Film, 
  Cpu, 
  Layers, 
  Sparkles, 
  Plus, 
  CheckCircle, 
  Loader2 
} from "lucide-react";

function App() {
  const { 
    assets, 
    fetchAssets, 
    importMedia, 
    ingestJobs, 
    selectedAsset, 
    setSelectedAsset,
    timeline,
    initEventListener 
  } = useTimelineStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch initial database assets and bind Tauri/Browser listeners
  useEffect(() => {
    fetchAssets();
    const cleanUp = initEventListener();
    return () => cleanUp();
  }, []);

  const handleImportMediaClick = async () => {
    if (isTauriEnvironment()) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({
          multiple: false,
          filters: [{
            name: "Media Files",
            extensions: ["mp4", "mov", "avi", "mkv", "wav", "mp3", "png", "jpg", "jpeg"]
          }]
        });
        if (selected && typeof selected === "string") {
          importMedia(selected);
        }
      } catch (err) {
        console.error("Tauri dialog error:", err);
      }
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Browser fallback: simulate raw path using name
      const fakePath = `C:\\Users\\VideoEdit\\raw_clips\\${file.name}`;
      importMedia(fakePath);
    }
  };

  // Determine if queue is active
  const isQueueActive = Object.values(ingestJobs).some(
    job => job.status !== "completed" && job.status !== "failed"
  );

  return (
    <div className="h-screen bg-[#030303] text-zinc-100 flex flex-col font-sans relative overflow-hidden moving-grid">
      {/* Background Neon Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/10 rounded-full blur-[160px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-900/10 rounded-full blur-[160px] pointer-events-none"></div>
      <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] bg-cyan-900/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Main Window Header Bar */}
      <header className="glass-panel-heavy border-b border-white/5 px-6 py-4 flex justify-between items-center z-10">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Layers className="w-6 h-6 text-violet-500" />
            <div className="absolute inset-0 bg-violet-500 rounded-full blur-md opacity-40 animate-pulse"></div>
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-widest text-zinc-100 flex items-center space-x-2">
              <span>NEXUS EDIT</span>
              <span className="text-[10px] font-mono font-medium text-violet-400 bg-violet-950/40 border border-violet-850 px-1.5 py-0.5 rounded">
                v2.0 Beta
              </span>
            </h1>
            <p className="text-[10px] font-mono text-zinc-500 mt-0.5">HYBRID EDGE-CLOUD RAG ARCHITECTURE</p>
          </div>
        </div>

        {/* Global AI Processing Status (Glowing Brain Icon!) */}
        <div className="flex items-center space-x-4">
          {isQueueActive || useTimelineStore.getState().isAiProcessing ? (
            <div className="flex items-center space-x-2.5 bg-violet-950/20 border border-violet-800/30 px-3.5 py-1.5 rounded-full glow-violet-accent animate-pulse">
              <Cpu className="w-4 h-4 text-violet-400 animate-spin" />
              <span className="text-[10px] font-mono font-bold tracking-widest text-violet-300 uppercase">
                AI COGNITIVE THREAD BUSY
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-2.5 bg-zinc-900/40 border border-white/5 px-3.5 py-1.5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                COGNITIVE ENGINE READY
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Workspace Dashboard */}
      <main className="flex-1 p-6 grid grid-cols-12 gap-6 items-start overflow-y-auto">
        {/* Left Column: Media Pool & Chat Terminal */}
        <div className="col-span-4 flex flex-col space-y-6 h-full">
          {/* Media Asset Ingester Pool */}
          <div className="glass-panel rounded-xl p-4 flex flex-col space-y-3.5 border border-white/5 flex-1 min-h-[220px]">
            <h2 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider flex items-center space-x-1.5">
              <Film className="w-3.5 h-3.5 text-zinc-500" />
              <span>Ingested Local Media Pool</span>
            </h2>

            {/* Ingestion Selection Button */}
            <div className="flex flex-col space-y-2">
              <button
                type="button"
                onClick={handleImportMediaClick}
                className="w-full bg-violet-600/10 hover:bg-violet-600/20 text-violet-300 border border-violet-500/20 font-semibold text-xs py-2.5 rounded-lg flex items-center justify-center space-x-2 transition-all cursor-pointer transform active:scale-95 glow-indigo"
              >
                <Plus className="w-4.5 h-4.5" />
                <span>SELECT & IMPORT LOCAL MEDIA</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInputChange}
                accept="video/*,audio/*,image/*"
                className="hidden"
              />
            </div>

            {/* Assets & Jobs list */}
            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-48 pr-1">
              {/* Render Active Jobs first */}
              {Object.values(ingestJobs).map((job, idx) => {
                if (job.status === "completed" || job.status === "failed") return null;
                const fileName = job.file_path.split(/[\\/]/).pop() || job.file_path;

                return (
                  <div key={idx} className="bg-zinc-900/60 border border-violet-500/10 p-3 rounded-lg space-y-2 animate-pulse">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-zinc-300 truncate max-w-[180px]">{fileName}</span>
                        <span className="text-[9px] font-mono text-violet-400 mt-0.5">{job.message}</span>
                      </div>
                      <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                    </div>
                    {/* Linear progress glow */}
                    <div className="w-full h-1 bg-zinc-850 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-violet-500 transition-all duration-300"
                        style={{ width: `${job.progress * 100}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}

              {/* Ingested Library list */}
              {assets.map((asset, i) => {
                const isSelected = selectedAsset?.file_path === asset.file_path;
                return (
                  <div 
                    key={i}
                    onClick={() => {
                      // Prevent preview switching if timeline is active
                      setSelectedAsset(asset);
                    }}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected 
                        ? "bg-violet-950/15 border-violet-500/35 hover:bg-violet-950/25" 
                        : "bg-zinc-900/40 border-white/5 hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`p-2 rounded ${isSelected ? "bg-violet-900/30 text-violet-400" : "bg-zinc-800 text-zinc-400"}`}>
                        <Film className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-zinc-200 truncate">{asset.name}</span>
                        <span className="text-[9px] text-zinc-500 mt-0.5 font-mono">
                          Duration: {asset.duration.toFixed(1)}s • Beats: {asset.beats?.length || 0}
                        </span>
                      </div>
                    </div>

                    {asset.transcript && asset.transcript.length > 0 && (
                      <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 ml-2" title="Speech & beats extracted" />
                    )}
                  </div>
                );
              })}

              {assets.length === 0 && !isQueueActive && (
                <div className="text-center py-6 text-xs text-zinc-600 italic">
                  No video imported. Add a path and click '+' to run FIFO demux pipeline.
                </div>
              )}
            </div>
          </div>

          {/* AI Chat Command Terminal */}
          <div className="flex-1 min-h-[260px]">
            <AIChat />
          </div>
        </div>

        {/* Right Column: Player & Timeline */}
        <div className="col-span-8 flex flex-col space-y-6 h-full justify-between">
          {/* Hardware-Accelerated Video Player Preview */}
          <div className="flex-1">
            <Player />
          </div>

          {/* Audio-Master Timeline */}
          <div>
            <Timeline />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
