import React, { useEffect, useRef, useState } from "react";
import { useTimelineStore } from "../store/timeline";
import { Play, Pause, Maximize2, Volume2, Film } from "lucide-react";

export const Player: React.FC = () => {
  const { 
    timeline, 
    currentTime, 
    setCurrentTime, 
    isPlaying, 
    setIsPlaying, 
    selectedAsset 
  } = useTimelineStore();

  const videoRef = useRef<HTMLVideoElement>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(Date.now());
  
  const [currentClipSource, setCurrentClipSource] = useState<string>("");
  const [activeClipName, setActiveClipName] = useState<string>("No Clip Active");

  // Determine duration of timeline or active asset
  const getTimelineDuration = (): number => {
    if (!timeline) return selectedAsset ? selectedAsset.duration : 10;
    
    let maxTime = 0;
    timeline.tracks.forEach(track => {
      track.clips.forEach(clip => {
        const clipEnd = clip.timeline_start + (clip.out_point - clip.in_point);
        if (clipEnd > maxTime) maxTime = clipEnd;
      });
    });
    return maxTime;
  };

  const totalDuration = getTimelineDuration();

  // Find which clip corresponds to the given timeline time
  const findClipAtTime = (time: number) => {
    if (!timeline) return null;
    for (const track of timeline.tracks) {
      if (track.type === "video") {
        for (const clip of track.clips) {
          const clipEnd = clip.timeline_start + (clip.out_point - clip.in_point);
          if (time >= clip.timeline_start && time < clipEnd) {
            return clip;
          }
        }
      }
    }
    return null;
  };

  // Playback ticking loop with requestAnimationFrame (60fps locked)
  const playTick = () => {
    const now = Date.now();
    const delta = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;

    if (isPlaying) {
      setCurrentTime(Math.min(currentTime + delta, totalDuration));
      if (currentTime + delta >= totalDuration) {
        setIsPlaying(false);
        setCurrentTime(0);
      }
    }
    requestRef.current = requestAnimationFrame(playTick);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(playTick);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, currentTime, totalDuration]);

  // Synchronize HTML5 video element source & time with timeline
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (timeline) {
      // Timeline playback mode (stitching clips on the fly)
      const activeClip = findClipAtTime(currentTime);
      if (activeClip) {
        const clipName = activeClip.source.split(/[\\/]/).pop() || activeClip.source;
        setActiveClipName(clipName);

        // If source changes, swap it
        if (currentClipSource !== activeClip.source) {
          setCurrentClipSource(activeClip.source);
          video.src = activeClip.source;
          video.load();
        }

        // Calculate offset position inside the clip source
        const offsetInClip = activeClip.in_point + (currentTime - activeClip.timeline_start);
        
        // Sync video current time if it drifts beyond 0.15s
        if (Math.abs(video.currentTime - offsetInClip) > 0.15) {
          video.currentTime = offsetInClip;
        }

        if (isPlaying && video.paused) {
          video.play().catch(() => {});
        } else if (!isPlaying && !video.paused) {
          video.pause();
        }
      } else {
        // No active clip in this interval (render black screen/pause)
        setActiveClipName("Timeline Gap");
        video.pause();
        if (video.src) {
          video.src = "";
          setCurrentClipSource("");
        }
      }
    } else if (selectedAsset) {
      // Asset preview mode
      setActiveClipName(selectedAsset.name);
      if (currentClipSource !== selectedAsset.proxy_path) {
        const src = selectedAsset.proxy_path || selectedAsset.file_path;
        setCurrentClipSource(src);
        video.src = src;
        video.load();
      }

      if (Math.abs(video.currentTime - currentTime) > 0.15) {
        video.currentTime = currentTime;
      }

      if (isPlaying && video.paused) {
        video.play().catch(() => {});
      } else if (!isPlaying && !video.paused) {
        video.pause();
      }
    }
  }, [timeline, currentTime, selectedAsset, isPlaying]);

  const togglePlay = () => {
    lastTimeRef.current = Date.now();
    setIsPlaying(!isPlaying);
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    setCurrentTime(percent * totalDuration);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  return (
    <div className="glass-panel w-full aspect-video rounded-xl overflow-hidden flex flex-col glow-indigo">
      {/* Viewer Screen */}
      <div className="flex-1 bg-black relative flex items-center justify-center">
        {currentClipSource ? (
          <video 
            ref={videoRef}
            className="w-full h-full object-contain pointer-events-none"
            muted
            playsInline
          />
        ) : (
          <div className="flex flex-col items-center text-zinc-500 space-y-2">
            <Film className="w-12 h-12 text-zinc-600 animate-pulse" />
            <span className="text-sm">Ready to play media</span>
          </div>
        )}

        {/* Clip Name Overlay */}
        <div className="absolute top-3 left-3 bg-zinc-950/80 backdrop-blur border border-white/10 px-2.5 py-1 rounded-md text-xs font-mono tracking-wide flex items-center space-x-1.5 text-zinc-300">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping"></span>
          <span>{activeClipName}</span>
        </div>

        {/* Dynamic Canvas Shimmer (Psychological latency mask during AI updates) */}
        {useTimelineStore.getState().isAiProcessing && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center transition-all duration-300">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></div>
                <div className="absolute inset-3 border-4 border-indigo-500/20 border-b-indigo-500 rounded-full animate-spin animate-reverse"></div>
              </div>
              <span className="text-xs font-mono text-zinc-400 animate-pulse tracking-widest">
                CONFORMING VIEWER MATRIX...
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Control Board */}
      <div className="bg-zinc-950/90 border-t border-white/5 p-4 flex flex-col space-y-3">
        {/* Playback Progress Bar */}
        <div 
          className="h-1.5 bg-zinc-800 rounded-full overflow-hidden cursor-pointer relative"
          onClick={handleProgressBarClick}
        >
          <div 
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-75"
            style={{ width: `${(currentTime / totalDuration) * 100}%` }}
          />
        </div>

        {/* Playback Controls Panel */}
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <button 
              onClick={togglePlay}
              className="p-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-white transition-all transform hover:scale-105 active:scale-95"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white" />}
            </button>
            <div className="flex items-center space-x-1 text-xs font-mono text-zinc-400">
              <span className="text-zinc-200">{formatTime(currentTime)}</span>
              <span>/</span>
              <span>{formatTime(totalDuration)}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-zinc-400">
            <Volume2 className="w-4 h-4 hover:text-zinc-200 cursor-pointer" />
            <Maximize2 className="w-4 h-4 hover:text-zinc-200 cursor-pointer" />
          </div>
        </div>
      </div>
    </div>
  );
};
