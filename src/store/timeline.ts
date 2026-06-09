import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { 
  invokeCmd, 
  listenToMockEvent, 
  isTauriEnvironment, 
  LocalAsset, 
  TimelineConfig, 
  IngestProgress, 
  QueryAIResult 
} from "../lib/ipc";

interface TimelineState {
  assets: LocalAsset[];
  timeline: TimelineConfig | null;
  currentTime: number;
  isPlaying: boolean;
  warnings: string[];
  directorPlan: QueryAIResult["director_plan"] | null;
  ingestJobs: { [filePath: string]: IngestProgress };
  selectedAsset: LocalAsset | null;
  isAiProcessing: boolean;
  isExporting: boolean;
  exportSuccessMsg: string | null;
  
  // Actions
  fetchAssets: () => Promise<void>;
  importMedia: (filePath: string) => Promise<void>;
  queryAI: (prompt: string, apiKey: string) => Promise<void>;
  exportTimeline: (outputPath: string) => Promise<void>;
  setCurrentTime: (time: number) => void;
  setIsPlaying: (playing: boolean) => void;
  setSelectedAsset: (asset: LocalAsset | null) => void;
  clearExportMsg: () => void;
  initEventListener: () => (() => void);
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  assets: [],
  timeline: null,
  currentTime: 0,
  isPlaying: false,
  warnings: [],
  directorPlan: null,
  ingestJobs: {},
  selectedAsset: null,
  isAiProcessing: false,
  isExporting: false,
  exportSuccessMsg: null,

  fetchAssets: async () => {
    try {
      const assets = await invokeCmd("get_assets");
      set({ assets });
      if (assets.length > 0 && !get().selectedAsset) {
        set({ selectedAsset: assets[0] });
      }
    } catch (err) {
      console.error("Failed to fetch assets:", err);
    }
  },

  importMedia: async (filePath: string) => {
    // Add temporary queued status
    const initialJob: IngestProgress = {
      file_path: filePath,
      status: "queued",
      progress: 0.0,
      message: "Queuing ingestion job..."
    };
    set(state => ({
      ingestJobs: { ...state.ingestJobs, [filePath]: initialJob }
    }));

    try {
      await invokeCmd("import_media", { filePath });
    } catch (err) {
      console.error("Failed to start media import:", err);
      set(state => ({
        ingestJobs: { 
          ...state.ingestJobs, 
          [filePath]: { 
            file_path: filePath, 
            status: "failed", 
            progress: 1.0, 
            message: `Ingestion trigger failed: ${err}` 
          } 
        }
      }));
    }
  },

  queryAI: async (prompt: string, apiKey: string) => {
    set({ isAiProcessing: true, warnings: [], directorPlan: null });
    try {
      const result: QueryAIResult = await invokeCmd("query_ai", { prompt, apiKey });
      set({ 
        timeline: result.timeline, 
        warnings: result.warnings,
        directorPlan: result.director_plan,
        isAiProcessing: false 
      });
    } catch (err) {
      console.error("AI query failed:", err);
      set({ 
        isAiProcessing: false, 
        warnings: [`AI inference failed: ${err}`] 
      });
    }
  },

  exportTimeline: async (outputPath: string) => {
    const { timeline } = get();
    if (!timeline) return;

    set({ isExporting: true, exportSuccessMsg: null });
    try {
      const msg = await invokeCmd("export_timeline", {
        timelineJson: JSON.stringify(timeline),
        outputPath
      });
      set({ isExporting: false, exportSuccessMsg: msg });
    } catch (err) {
      console.error("Timeline export failed:", err);
      set({ 
        isExporting: false, 
        warnings: [...get().warnings, `Export failed: ${err}`] 
      });
    }
  },

  setCurrentTime: (time: number) => {
    // Snap playhead adjustments to exact boundaries (60fps animation frame ticks)
    set({ currentTime: time });
  },

  setIsPlaying: (playing: boolean) => {
    set({ isPlaying: playing });
  },

  setSelectedAsset: (asset: LocalAsset | null) => {
    set({ selectedAsset: asset });
  },

  clearExportMsg: () => {
    set({ exportSuccessMsg: null });
  },

  initEventListener: () => {
    const handleProgress = (job: IngestProgress) => {
      set(state => ({
        ingestJobs: { ...state.ingestJobs, [job.file_path]: job }
      }));
      if (job.status === "completed") {
        get().fetchAssets();
      }
    };

    const handleSuccess = (asset: LocalAsset) => {
      set(state => ({
        assets: [...state.assets.filter(a => a.file_path !== asset.file_path), asset]
      }));
      if (!get().selectedAsset) {
        set({ selectedAsset: asset });
      }
    };

    if (isTauriEnvironment()) {
      // Register native Tauri listeners
      let unlistenProgress: (() => void) | null = null;
      let unlistenSuccess: (() => void) | null = null;

      const setupTauri = async () => {
        const u1 = await listen<IngestProgress>("ingest-progress", (event) => {
          handleProgress(event.payload);
        });
        unlistenProgress = u1;

        const u2 = await listen<LocalAsset>("ingest-success", (event) => {
          handleSuccess(event.payload);
        });
        unlistenSuccess = u2;
      };

      setupTauri();

      return () => {
        if (unlistenProgress) unlistenProgress();
        if (unlistenSuccess) unlistenSuccess();
      };
    } else {
      // Register browser mock listeners
      const unsubProgress = listenToMockEvent("ingest-progress", handleProgress);
      const unsubSuccess = listenToMockEvent("ingest-success", handleSuccess);
      return () => {
        unsubProgress();
        unsubSuccess();
      };
    }
  }
}));
