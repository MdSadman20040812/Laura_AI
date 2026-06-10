use serde::{Deserialize, Serialize};
use serde_json::json;
use crate::models::{DirectorPlan, EditorTimelineResponse};

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatCompletionRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub response_format: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatCompletionChoice {
    pub message: ChatMessage,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatCompletionResponse {
    pub choices: Vec<ChatCompletionChoice>,
}

pub struct CerebrasClient {
    api_key: String,
}

impl CerebrasClient {
    pub fn new(api_key: String) -> Self {
        Self { api_key }
    }

    /// Inference 1: "The Director"
    /// Expand query to create an editing storyboard mapping prompts to audio contexts/beats.
    pub async fn run_director(
        &self,
        prompt: &str,
        transcript_json: &str,
        beat_map_json: &str,
    ) -> Result<DirectorPlan, String> {
        if self.api_key.is_empty() || self.api_key == "mock" {
            return Ok(Self::mock_director(prompt));
        }

        let system_prompt = "You are a Master Video Director. Read the provided audio transcript and beat-drop metadata. The user has provided an editing prompt. Your job is to output a JSON storyboard. You must map specific, professional videography visual search queries to the exact timestamp of the audio beat drops or relevant spoken context. Output ONLY valid JSON matching the schema. No markdown wrapping.";
        
        let user_content = format!(
            "Prompt: {}\n\nTranscript: {}\n\nBeat Map/Spikes: {}",
            prompt, transcript_json, beat_map_json
        );

        let request_payload = ChatCompletionRequest {
            model: "zai-glm-4.7".to_string(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: user_content,
                },
            ],
            response_format: Some(json!({ "type": "json_object" })),
            temperature: Some(0.2),
        };

        let response_text = self.send_request(request_payload).await?;
        
        serde_json::from_str::<DirectorPlan>(&response_text)
            .map_err(|e| format!("Failed to parse Director plan JSON: {}. Response content: {}", e, response_text))
    }

    /// Inference 2: "The Editor"
    /// Compile visual search results (RAG step) and prompt into an absolute cut-list timeline.
    pub async fn run_editor(
        &self,
        director_plan: &DirectorPlan,
        vector_results_json: &str,
        fps: f32,
    ) -> Result<EditorTimelineResponse, String> {
        if self.api_key.is_empty() || self.api_key == "mock" {
            return Ok(Self::mock_editor(director_plan));
        }

        let system_prompt = "You are a Master Video Editor. Read the Director's editing plan and the list of matching local clips (returned from local vector retrieval). Generate the absolute mathematical cut-list matching the clip sources, in_points, out_points, and timeline_starts. Ensure clips snap together sequentially and there are no overlapping timeline intervals. Output ONLY valid JSON matching the schema.";

        let user_content = format!(
            "Director Plan: {}\n\nRetrieved Matches: {}\n\nTimeline FPS: {}",
            serde_json::to_string(director_plan).unwrap(),
            vector_results_json,
            fps
        );

        let request_payload = ChatCompletionRequest {
            model: "zai-glm-4.7".to_string(),
            messages: vec![
                ChatMessage {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                ChatMessage {
                    role: "user".to_string(),
                    content: user_content,
                },
            ],
            response_format: Some(json!({ "type": "json_object" })),
            temperature: Some(0.1),
        };

        let response_text = self.send_request(request_payload).await?;

        serde_json::from_str::<EditorTimelineResponse>(&response_text)
            .map_err(|e| format!("Failed to parse Editor timeline JSON: {}. Response content: {}", e, response_text))
    }

    async fn send_request(&self, payload: ChatCompletionRequest) -> Result<String, String> {
        let client = reqwest::Client::new();
        let res = client
            .post("https://api.cerebras.ai/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("HTTP request failed: {}", e))?;

        if !res.status().is_success() {
            let status = res.status();
            let err_text = res.text().await.unwrap_or_default();
            return Err(format!("Cerebras API error ({}): {}", status, err_text));
        }

        let resp_payload = res
            .json::<ChatCompletionResponse>()
            .await
            .map_err(|e| format!("Failed to deserialize Cerebras response: {}", e))?;

        if resp_payload.choices.is_empty() {
            return Err("Cerebras API returned no completion choices".to_string());
        }

        Ok(resp_payload.choices[0].message.content.clone())
    }

    fn mock_director(prompt: &str) -> DirectorPlan {
        println!("[MOCK CEREBRAS] Generating mock Director Plan for prompt: {}", prompt);
        DirectorPlan {
            editing_plan: vec![
                DirectorSegment {
                    time_range: "0.0 - 3.2".to_string(),
                    audio_anchor: "[Beat Spike 1.2s - Music Intro Building]".to_string(),
                    visual_search_query: "Wide establishing shot of sports car, slow motion cinematic".to_string(),
                },
                DirectorSegment {
                    time_range: "3.2 - 6.5".to_string(),
                    audio_anchor: "[Beat Drop 3.2s - Heavy bass kicks in]".to_string(),
                    visual_search_query: "Fast action close up shot of exhaust, glowing tailpipe, spinning wheel".to_string(),
                },
                DirectorSegment {
                    time_range: "6.5 - 10.0".to_string(),
                    audio_anchor: "[Beat Spike 7.8s - Vocal transition]".to_string(),
                    visual_search_query: "B-roll drone shot of car driving along mountain road at sunset".to_string(),
                },
            ],
        }
    }

    fn mock_editor(plan: &DirectorPlan) -> EditorTimelineResponse {
        println!("[MOCK CEREBRAS] Generating mock Editor Timeline matching plan");
        let clips = plan.editing_plan.iter().enumerate().map(|(i, seg)| {
            let times: Vec<&str> = seg.time_range.split('-').collect();
            let start: f32 = times[0].trim().parse().unwrap_or(0.0);
            let end: f32 = times[1].trim().parse().unwrap_or(5.0);
            let dur = end - start;
            
            crate::models::TimelineClip {
                // Return a mock local proxy file corresponding to the index
                source: format!("proxy_1080p_clip{}.mp4", i + 1),
                in_point: 10.0 + (i as f32 * 5.0),
                out_point: 10.0 + (i as f32 * 5.0) + dur,
                timeline_start: start,
            }
        }).collect();

        EditorTimelineResponse {
            timeline: crate::models::TimelineConfig {
                fps: 24.0,
                tracks: vec![
                    crate::models::TimelineTrack {
                        track_type: "video".to_string(),
                        clips,
                    }
                ],
                effects: vec![
                    crate::models::TimelineEffect {
                        effect_type: "color_grade".to_string(),
                        style: "cinematic_cool".to_string(),
                        apply_to_track: "all".to_string(),
                    }
                ],
            },
        }
    }
}
