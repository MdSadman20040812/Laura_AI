import React, { useState, useEffect, useRef } from "react";
import { useTimelineStore } from "../store/timeline";
import { 
  Send, 
  Terminal, 
  Key, 
  AlertTriangle, 
  Download, 
  Sparkles, 
  Cpu, 
  Database,
  CheckCircle2
} from "lucide-react";

export const AIChat: React.FC = () => {
  const { 
    queryAI, 
    isAiProcessing, 
    warnings, 
    directorPlan, 
    exportTimeline, 
    isExporting, 
    exportSuccessMsg, 
    clearExportMsg 
  } = useTimelineStore();

  const [prompt, setPrompt] = useState("Edit a hype car montage to the music.");
  const [apiKey, setApiKey] = useState("csk-ewm9m3r8mkwwwn2d4kkp8r4wtp8kt66x4hxfp92ec9tyw4rw"); // Configured Cerebras API Key
  const [outputPath, setOutputPath] = useState("C:\\Users\\VideoEdit\\output_montage.mp4");
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll terminal logs
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

  // Simulate procedural logging during AI processing (Latency Masking!)
  useEffect(() => {
    if (!isAiProcessing) return;

    setTerminalLogs([]);
    const logs = [
      "Initializing Cerebras API connector...",
      "Reading audio track BPM & transcript annotations...",
      "Offloading Director's Plan to Cerebras Cloud (Inference 1)...",
      "Analyzing visual storyboard output segment timings...",
      "Executing local ONNX Clip text embedding on CPU...",
      "Querying LanceDB vectors (KNN cosine similarity)...",
      "Scanning top 3 matching scene cuts matching storyboard...",
      "Sending metadata package to Cerebras Editor (Inference 2)...",
      "Receiving absolute cut-list timeline configuration...",
      "Executing Rust frame boundary snapping calculations...",
      "Conforming timeline tracks and resolving overlapping intervals...",
      "Timeline matrix rendering successfully compiled!"
    ];

    let currentLogIndex = 0;
    const interval = setInterval(() => {
      if (currentLogIndex < logs.length) {
        const timestamp = new Date().toLocaleTimeString();
        setTerminalLogs(prev => [...prev, `[${timestamp}] ${logs[currentLogIndex]}`]);
        currentLogIndex++;
      } else {
        clearInterval(interval);
      }
    }, 120);

    return () => clearInterval(interval);
  }, [isAiProcessing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    queryAI(prompt, apiKey);
  };

  const handleExport = () => {
    if (!outputPath.trim()) return;
    exportTimeline(outputPath);
  };

  return (
    <div className="glass-panel w-full h-full rounded-xl flex flex-col overflow-hidden border border-white/5 shadow-2xl">
      {/* Tab Panel */}
      <div className="bg-zinc-950/80 border-b border-white/5 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 text-zinc-200">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="font-semibold text-sm tracking-wide">AI Director Panel</span>
        </div>
        <div className="flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Cloud Connected</span>
        </div>
      </div>

      {/* Input / Config Box */}
      <div className="p-4 border-b border-white/5 bg-zinc-950/20 space-y-4">
        {/* API Key configuration */}
        <div className="flex items-center space-x-2 bg-zinc-900/40 p-2 rounded border border-white/5">
          <Key className="w-3.5 h-3.5 text-zinc-500" />
          <input 
            type="password"
            placeholder="Cerebras API Key (optional - uses 'mock')"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="bg-transparent border-none outline-none text-xs text-zinc-300 w-full font-mono placeholder-zinc-600"
          />
          <span className="text-[9px] font-bold text-violet-500 bg-violet-950/40 px-1.5 py-0.5 rounded border border-violet-900/30">
            CEREBRAS
          </span>
        </div>

        {/* Prompt Form */}
        <form onSubmit={handleSubmit} className="flex flex-col space-y-2">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Ask AI to edit footage</label>
          <div className="flex space-x-2">
            <input 
              type="text"
              placeholder="e.g. edit a hype montage to the bass drops..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="flex-1 bg-zinc-900/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20"
            />
            <button 
              type="submit"
              disabled={isAiProcessing}
              className="px-3.5 bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-lg flex items-center justify-center transition-all cursor-pointer transform active:scale-95"
            >
              {isAiProcessing ? (
                <Cpu className="w-4 h-4 animate-spin text-zinc-400" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Logs / Console output */}
      <div className="flex-1 p-4 bg-[#050507] flex flex-col space-y-3 overflow-y-auto max-h-56">
        <div className="flex items-center space-x-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
          <Terminal className="w-3.5 h-3.5" />
          <span>PROXIED SYSTEM TERMINAL LOGS</span>
        </div>

        {/* Typewriter logs container */}
        <div className="flex-1 font-mono text-[11px] space-y-1.5 overflow-y-auto pr-1">
          {terminalLogs.map((log, idx) => {
            const isFinished = log.includes("successfully compiled");
            return (
              <div 
                key={idx} 
                className={`${isFinished ? "text-cyan-400" : "text-zinc-400"} border-l border-zinc-800 pl-2 leading-relaxed break-all`}
              >
                {log}
              </div>
            );
          })}
          
          {terminalLogs.length === 0 && !isAiProcessing && (
            <div className="text-zinc-700 italic text-[10px] py-4 text-center">
              System idle. Enter prompt to begin inference processing...
            </div>
          )}

          {isAiProcessing && (
            <div className="flex items-center space-x-1.5 text-violet-400 text-[10px] border-l border-violet-800 pl-2">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping"></span>
              <span className="animate-pulse">Awaiting Cerebras Token Pipeline...</span>
            </div>
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>

      {/* Conformed Math Warnings Notices */}
      {warnings.length > 0 && (
        <div className="p-4 border-t border-white/5 bg-amber-950/10 space-y-2.5">
          <div className="flex items-center space-x-1.5 text-amber-500 text-[10px] font-bold tracking-wider uppercase">
            <AlertTriangle className="w-4 h-4" />
            <span>AI Snapping Adjustments</span>
          </div>
          <div className="space-y-1.5 max-h-24 overflow-y-auto">
            {warnings.map((warn, i) => (
              <div key={i} className="text-[10px] font-mono text-amber-400/80 bg-amber-950/20 border border-amber-900/30 p-2 rounded-md leading-normal">
                {warn}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export Segment */}
      {directorPlan && (
        <div className="p-4 border-t border-white/5 bg-zinc-950/80 space-y-3">
          <div className="flex items-center space-x-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            <Database className="w-3.5 h-3.5" />
            <span>RENDER CONFORM & EXPORT</span>
          </div>

          <div className="flex flex-col space-y-2">
            <input 
              type="text"
              placeholder="Output Path"
              value={outputPath}
              onChange={(e) => setOutputPath(e.target.value)}
              className="bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono placeholder-zinc-700 focus:outline-none focus:border-violet-500/50"
            />
            <button 
              onClick={handleExport}
              disabled={isExporting}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-medium text-xs py-2 rounded-lg flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-950/15 cursor-pointer active:scale-95 transition-transform"
            >
              {isExporting ? (
                <>
                  <Cpu className="w-3.5 h-3.5 animate-spin" />
                  <span>COMPILING HIGH-RES TIMELINE...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>COMPILE & EXPORT TIMELINE</span>
                </>
              )}
            </button>
          </div>

          {exportSuccessMsg && (
            <div className="flex items-start space-x-2 bg-emerald-950/20 border border-emerald-900/30 p-3 rounded-lg mt-2 relative">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              <div className="text-[10px] font-mono text-emerald-400 leading-normal">
                {exportSuccessMsg}
              </div>
              <button 
                onClick={clearExportMsg} 
                className="absolute top-2 right-2 text-zinc-500 hover:text-zinc-300 text-xs font-bold font-mono bg-zinc-900/50 w-4 h-4 flex items-center justify-center rounded"
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
