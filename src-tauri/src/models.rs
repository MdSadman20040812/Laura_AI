use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DirectorSegment {
    pub time_range: String,
    pub audio_anchor: String,
    pub visual_search_query: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DirectorPlan {
    pub editing_plan: Vec<DirectorSegment>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimelineClip {
    pub source: String,
    pub in_point: f32,
    pub out_point: f32,
    pub timeline_start: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimelineTrack {
    #[serde(rename = "type")]
    pub track_type: String, // "video" or "audio"
    pub clips: Vec<TimelineClip>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimelineEffect {
    #[serde(rename = "type")]
    pub effect_type: String, // "color_grade", etc.
    pub style: String,
    pub apply_to_track: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimelineConfig {
    pub fps: f32,
    pub tracks: Vec<TimelineTrack>,
    pub effects: Vec<TimelineEffect>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EditorTimelineResponse {
    pub timeline: TimelineConfig,
}

// Structs for the local asset store database
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocalAsset {
    pub file_path: String,
    pub name: String,
    pub duration: f32,
    pub has_audio: bool,
    pub proxy_path: Option<String>,
    pub transcript: Option<Vec<TranscriptSegment>>,
    pub beats: Option<Vec<f32>>,
    pub scene_cuts: Option<Vec<f32>>, // list of cut timestamps
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TranscriptSegment {
    pub start: f32,
    pub end: f32,
    pub text: String,
}
