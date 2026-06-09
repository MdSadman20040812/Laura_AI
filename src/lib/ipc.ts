import { invoke as tauriInvoke } from "@tauri-apps/api/core";

// Define Types to match Rust Structs
export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface LocalAsset {
  file_path: string;
  name: string;
  duration: number;
  has_audio: boolean;
  proxy_path?: string;
  transcript?: TranscriptSegment[];
  beats?: number[];
  scene_cuts?: number[];
}

export interface TimelineClip {
  source: string;
  in_point: number;
  out_point: number;
  timeline_start: number;
}

export interface TimelineTrack {
  type: string;
  clips: TimelineClip[];
}

export interface TimelineEffect {
  type: string;
  style: string;
  apply_to_track: string;
}

export interface TimelineConfig {
  fps: number;
  tracks: TimelineTrack[];
  effects: TimelineEffect[];
}

export interface QueryAIResult {
  timeline: TimelineConfig;
  warnings: string[];
  director_plan: {
    editing_plan: {
      time_range: string;
      audio_anchor: string;
      visual_search_query: string;
    }[];
  };
}

export interface IngestProgress {
  file_path: string;
  status: "queued" | "demuxing" | "proxy_gen" | "transcribing" | "beat_map" | "scene_cut" | "embedding" | "completed" | "failed";
  progress: number;
  message: string;
}

// Global listener store for browser mock events
const mockListeners: { [event: string]: ((payload: any) => void)[] } = {};

export function listenToMockEvent(event: string, callback: (payload: any) => void) {
  if (!mockListeners[event]) {
    mockListeners[event] = [];
  }
  mockListeners[event].push(callback);
  return () => {
    mockListeners[event] = mockListeners[event].filter(cb => cb !== callback);
  };
}

function triggerMockEvent(event: string, payload: any) {
  if (mockListeners[event]) {
    mockListeners[event].forEach(cb => cb(payload));
  }
}

// Mock Database State for Browser Mode
const mockAssets: LocalAsset[] = [
  {
    file_path: "C:\\Users\\VideoEdit\\raw_clips\\mustang_exhaust.mp4",
    name: "mustang_exhaust",
    duration: 15.0,
    has_audio: true,
    proxy_path: "C:\\Users\\VideoEdit\\raw_clips\\mustang_exhaust_proxy_1080p.mp4",
    transcript: [
      { start: 0.0, end: 3.5, text: "Listen to the rumble of this V8 engine as we rev it up." },
      { start: 3.6, end: 7.0, text: "The exhaust setup is completely custom, stainless steel." },
      { start: 7.2, end: 12.0, text: "Wait for it... here is the launch!" }
    ],
    beats: [0.0, 1.2, 2.4, 3.6, 4.8, 6.0, 7.2, 8.4, 9.6, 10.8, 12.0, 13.2, 14.4],
    scene_cuts: [0.0, 3.6, 7.2, 11.0]
  },
  {
    file_path: "C:\\Users\\VideoEdit\\raw_clips\\drift_car_sunset.mp4",
    name: "drift_car_sunset",
    duration: 12.5,
    has_audio: false,
    proxy_path: "C:\\Users\\VideoEdit\\raw_clips\\drift_car_sunset_proxy_1080p.mp4",
    transcript: [],
    beats: [],
    scene_cuts: [0.0, 4.2, 8.5]
  }
];

export const isTauriEnvironment = (): boolean => {
  return typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__ !== undefined;
};

// Unified Invoke Wrapper
export async function invokeCmd(cmd: string, args?: any): Promise<any> {
  if (isTauriEnvironment()) {
    return tauriInvoke(cmd, args);
  }

  // --- Browser Mock Fallback ---
  console.log(`[MOCK IPC] Invoke "${cmd}" with args:`, args);

  switch (cmd) {
    case "get_assets":
      return [...mockAssets];

    case "import_media": {
      const filePath = args.filePath || args.filePath === undefined ? "C:\\Users\\VideoEdit\\raw_clips\\new_footage.mp4" : args.filePath;
      const name = filePath.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, "") || "new_footage";

      // Simulate FIFO queue background processing progress
      const statuses: IngestProgress["status"][] = [
        "queued",
        "demuxing",
        "proxy_gen",
        "transcribing",
        "beat_map",
        "scene_cut",
        "embedding",
        "completed"
      ];

      let step = 0;
      const interval = setInterval(() => {
        const status = statuses[step];
        const progress = (step + 1) / statuses.length;
        const messages = {
          queued: "In FIFO worker queue...",
          demuxing: "Extracting audio track (16kHz PCM wav)...",
          proxy_gen: "Generating 1080p proxy using hardware acceleration...",
          transcribing: "Running speech-to-text transcription...",
          beat_map: "Analyzing audio beat drops and rhythmic spikes...",
          scene_cut: "Mapping visual scene transitions...",
          embedding: "Generating scene embeddings and storing in local DB...",
          completed: "Ingestion process completed successfully."
        };

        triggerMockEvent("ingest-progress", {
          file_path: filePath,
          status,
          progress,
          message: messages[status]
        } as IngestProgress);

        if (status === "completed") {
          clearInterval(interval);
          
          // Add newly ingested asset to mock list
          const newAsset: LocalAsset = {
            file_path: filePath,
            name,
            duration: 16.0,
            has_audio: true,
            proxy_path: filePath.replace(/\.[^/.]+$/, "_proxy_1080p.mp4"),
            transcript: [
              { start: 0.0, end: 4.0, text: "Testing out the new camera rig in slow motion." },
              { start: 4.5, end: 10.0, text: "The car looks beautiful under the city streetlights." }
            ],
            beats: [0.0, 1.5, 3.0, 4.5, 6.0, 7.5, 9.0, 10.5, 12.0, 13.5, 15.0],
            scene_cuts: [0.0, 4.5, 10.0]
          };
          mockAssets.push(newAsset);
          triggerMockEvent("ingest-success", newAsset);
        }
        step++;
      }, 800);

      return "Queued for processing";
    }

    case "query_ai": {
      // Simulate double inference delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const clips: TimelineClip[] = [
        {
          source: mockAssets[0].proxy_path || "",
          in_point: 0.0,
          out_point: 3.6,
          timeline_start: 0.0
        },
        {
          source: mockAssets[1].proxy_path || "",
          in_point: 0.0,
          out_point: 4.2,
          timeline_start: 3.6
        },
        {
          source: mockAssets[0].proxy_path || "",
          in_point: 7.2,
          out_point: 11.0,
          timeline_start: 7.8 // Conflict! Overlaps 7.8s vs previous clip end 3.6 + 4.2 = 7.8s
        }
      ];

      const res: QueryAIResult = {
        timeline: {
          fps: 24.0,
          tracks: [
            {
              type: "video",
              clips
            }
          ],
          effects: [
            {
              type: "color_grade",
              style: "cinematic_cool",
              apply_to_track: "all"
            }
          ]
        },
        warnings: [
          "Overlap of 0.200s resolved: snapped clip 'mustang_exhaust_proxy_1080p.mp4' from timeline 7.600s to 7.800s."
        ],
        director_plan: {
          editing_plan: [
            {
              time_range: "0.0 - 3.6",
              audio_anchor: "[Beat Spike 1.2s - Music Intro Building]",
              visual_search_query: "Cinematic wide shot of car, slow motion"
            },
            {
              time_range: "3.6 - 7.8",
              audio_anchor: "[Beat Drop 3.6s - Launch]",
              visual_search_query: "B-roll drone shot of car driving along sunset mountain road"
            },
            {
              time_range: "7.8 - 11.6",
              audio_anchor: "[Beat Spike 8.4s]",
              visual_search_query: "Fast motion close up shot of exhaust revving"
            }
          ]
        }
      };
      return res;
    }

    case "export_timeline": {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return `Successfully compiled video exported to: ${args.outputPath}`;
    }

    default:
      throw new Error(`Unknown mock command: ${cmd}`);
  }
}
