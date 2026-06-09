import React, { useEffect, useRef, useState } from "react";
import { useTimelineStore } from "../store/timeline";
import { Music, Video, Sparkles, ChevronDown } from "lucide-react";

export const Timeline: React.FC = () => {
  const { 
    timeline, 
    currentTime, 
    setCurrentTime, 
    selectedAsset 
  } = useTimelineStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const waveformRef = useRef<HTMLCanvasElement>(null);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);

  // Constants
  const PIXELS_PER_SECOND = 40; // Zoom factor
  const TRACK_HEIGHT = 56;

  // Determine total duration
  const getDuration = (): number => {
    if (!timeline) return selectedAsset ? selectedAsset.duration : 10;
    
    let maxTime = 0;
    timeline.tracks.forEach(track => {
      track.clips.forEach(clip => {
        const clipEnd = clip.timeline_start + (clip.out_point - clip.in_point);
        if (clipEnd > maxTime) maxTime = clipEnd;
      });
    });
    return Math.max(maxTime, selectedAsset ? selectedAsset.duration : 10);
  };

  const duration = getDuration();
  const width = duration * PIXELS_PER_SECOND;

  // Draw Audio Waveform on Canvas
  useEffect(() => {
    const canvas = waveformRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI screens
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;

    // Clear background
    ctx.fillStyle = "rgba(10, 10, 12, 0.4)";
    ctx.fillRect(0, 0, w, h);

    // Draw grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += PIXELS_PER_SECOND) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }

    // Retrieve active beats
    const beats = selectedAsset?.beats || [];
    
    // Draw pseudo-waveform bars
    const barWidth = 3;
    const barGap = 2;
    const barCount = Math.floor(w / (barWidth + barGap));
    
    ctx.fillStyle = "rgba(99, 102, 241, 0.35)"; // Indigo wave
    
    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + barGap);
      const timeAtBar = x / PIXELS_PER_SECOND;
      
      // Calculate amplitude
      let amplitude = 0.2 + 0.3 * Math.sin(timeAtBar * 2.5) + 0.15 * Math.cos(timeAtBar * 6.2);
      
      // Spike amplitude near beat spikes
      const nearestBeat = beats.find(b => Math.abs(b - timeAtBar) < 0.15);
      if (nearestBeat !== undefined) {
        amplitude = 0.85; // Massive spikes on beats!
      }

      const barHeight = amplitude * (h - 16);
      const y = (h - barHeight) / 2;

      ctx.fillRect(x, y, barWidth, barHeight);
    }

    // Draw beat ticks (cyan dots / neon glows)
    beats.forEach(beat => {
      const x = beat * PIXELS_PER_SECOND;
      ctx.fillStyle = "#22d3ee"; // Cyan
      ctx.beginPath();
      ctx.arc(x, h - 8, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
  }, [selectedAsset, width, timeline]);

  // Handle playhead drag scrubs
  const handleTimelineMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const clientX = e.clientX - rect.left + scrollLeft;
    let time = clientX / PIXELS_PER_SECOND;
    time = Math.max(0, Math.min(time, duration));
    setCurrentTime(time);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDraggingPlayhead(true);
    handleTimelineMouse(e);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDraggingPlayhead(false);
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingPlayhead || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const scrollLeft = containerRef.current.scrollLeft;
      const clientX = e.clientX - rect.left + scrollLeft;
      let time = clientX / PIXELS_PER_SECOND;
      time = Math.max(0, Math.min(time, duration));
      setCurrentTime(time);
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  }, [isDraggingPlayhead, duration]);

  const snapToBeat = (beat: number) => {
    setCurrentTime(beat);
  };

  return (
    <div className="glass-panel w-full rounded-xl overflow-hidden flex flex-col border border-white/5 shadow-2xl">
      {/* Header bar */}
      <div className="bg-zinc-950/90 border-b border-white/5 px-4 py-2.5 flex justify-between items-center text-xs">
        <div className="flex items-center space-x-1.5 text-zinc-300 font-medium">
          <ChevronDown className="w-3.5 h-3.5" />
          <span className="uppercase tracking-widest font-semibold text-[10px] text-zinc-400">AUDIO-MASTER TIMELINE</span>
          <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800/30 text-[9px] font-mono font-bold uppercase tracking-wider">
            Beat-Lock Active
          </span>
        </div>
        <div className="flex items-center space-x-2 text-[10px] text-zinc-500 font-mono">
          <span>FPS: {timeline ? timeline.fps : "24.0"}</span>
          <span>•</span>
          <span>Zoom: 1.0x</span>
        </div>
      </div>

      {/* Tracks Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative bg-[#060608] select-none h-60"
        onMouseDown={handleMouseDown}
      >
        <div 
          className="relative h-full select-none"
          style={{ width: `${width}px` }}
        >
          {/* Timeline Ruler */}
          <div className="h-6 bg-zinc-950/60 border-b border-white/5 relative">
            {Array.from({ length: Math.ceil(duration) }).map((_, i) => (
              <div 
                key={i} 
                className="absolute text-[9px] font-mono text-zinc-600 border-l border-zinc-800/80 h-3 bottom-0 pl-1"
                style={{ left: `${i * PIXELS_PER_SECOND}px` }}
              >
                {i}s
              </div>
            ))}
          </div>

          {/* Video Track */}
          <div 
            className="flex items-center relative border-b border-white/5"
            style={{ height: `${TRACK_HEIGHT}px` }}
          >
            <div className="absolute left-2 text-[10px] uppercase font-bold tracking-wider text-zinc-500 flex items-center space-x-1 z-10 pointer-events-none bg-zinc-950/80 px-2.5 py-1 rounded border border-white/5">
              <Video className="w-3.5 h-3.5 text-violet-400" />
              <span>V1 Video</span>
            </div>

            {/* Render conformed AI timeline cuts */}
            {timeline?.tracks.find(t => t.type === "video")?.clips.map((clip, idx) => {
              const clipDur = clip.out_point - clip.in_point;
              const clipWidth = clipDur * PIXELS_PER_SECOND;
              const clipLeft = clip.timeline_start * PIXELS_PER_SECOND;
              const clipName = clip.source.split(/[\\/]/).pop() || clip.source;

              return (
                <div 
                  key={idx}
                  className="absolute h-10 rounded border border-violet-500/20 bg-gradient-to-r from-violet-950/60 to-indigo-950/60 flex items-center px-3 text-xs font-mono text-zinc-300 shadow-md group overflow-hidden shimmer-mask cursor-pointer"
                  style={{ 
                    left: `${clipLeft}px`, 
                    width: `${clipWidth}px` 
                  }}
                >
                  <div className="flex items-center space-x-1.5 truncate">
                    <Sparkles className="w-3 h-3 text-violet-400" />
                    <span className="truncate">{clipName}</span>
                  </div>
                  {/* Subtle marker showing clip cut timing boundaries */}
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-violet-500/30 group-hover:bg-violet-500/80 transition-all"></div>
                </div>
              );
            })}
          </div>

          {/* Audio Master Track / Waveform */}
          <div 
            className="flex items-center relative"
            style={{ height: `${TRACK_HEIGHT}px` }}
          >
            <div className="absolute left-2 text-[10px] uppercase font-bold tracking-wider text-zinc-500 flex items-center space-x-1 z-10 pointer-events-none bg-zinc-950/80 px-2.5 py-1 rounded border border-white/5">
              <Music className="w-3.5 h-3.5 text-indigo-400" />
              <span>A1 Master Audio</span>
            </div>

            {/* Audio Waveform Canvas */}
            <canvas 
              ref={waveformRef}
              className="absolute inset-x-0 h-12 top-1 pointer-events-none"
              style={{ width: "100%" }}
            />
          </div>

          {/* Interactive Beat Snap Markers Overlay (Clickable) */}
          <div className="absolute inset-x-0 bottom-0 h-4 flex items-center">
            {(selectedAsset?.beats || []).map((beat, idx) => {
              const x = beat * PIXELS_PER_SECOND;
              return (
                <button
                  key={idx}
                  title={`Snap to Beat Drop at ${beat.toFixed(2)}s`}
                  onClick={(e) => {
                    e.stopPropagation();
                    snapToBeat(beat);
                  }}
                  className="absolute w-5 h-5 -ml-2.5 flex items-center justify-center group cursor-pointer focus:outline-none"
                  style={{ left: `${x}px` }}
                >
                  <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full group-hover:scale-150 transition-all border border-cyan-800"></span>
                </button>
              );
            })}
          </div>

          {/* Red Playhead Indicator */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 pointer-events-none z-30"
            style={{ left: `${currentTime * PIXELS_PER_SECOND}px` }}
          >
            {/* Playhead Cap */}
            <div className="absolute -top-1 -left-1.5 w-3.5 h-3 bg-rose-500 rounded border border-zinc-950 flex items-center justify-center">
              <div className="w-0.5 h-1.5 bg-white/50"></div>
            </div>
            {/* Pulsing light */}
            <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping opacity-45"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
