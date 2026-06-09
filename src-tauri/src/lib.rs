mod models;
mod ai;
mod ingestion;
mod db;
mod conform;

use std::sync::Arc;
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager, State, Emitter};
use models::{LocalAsset, TimelineConfig};
use db::VectorDatabase;
use ingestion::IngestionManager;

// IPC command to greet
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// IPC command to query database assets
#[tauri::command]
async fn get_assets(db: State<'_, Arc<VectorDatabase>>) -> Result<Vec<LocalAsset>, String> {
    Ok(db.get_assets())
}

// IPC command to import a media asset (runs asynchronously in serial FIFO queue)
#[tauri::command]
async fn import_media(
    file_path: String,
    ingestion: State<'_, Arc<IngestionManager>>,
) -> Result<String, String> {
    let path = PathBuf::from(&file_path);
    if !path.exists() {
        return Err(format!("File does not exist: {}", file_path));
    }

    ingestion.queue_job(path)?;
    Ok("Queued for processing".to_string())
}

// IPC command to query Cerebras Cloud Double-Inference RAG Pipeline
#[tauri::command]
async fn query_ai(
    prompt: String,
    api_key: String,
    db: State<'_, Arc<VectorDatabase>>,
) -> Result<serde_json::Value, String> {
    println!("[AI PIPELINE] Starting double inference RAG pipeline...");

    // Get all assets and formats for transcripts/beats to pass to Cerebras
    let assets = db.get_assets();
    if assets.is_empty() {
        return Err("No media files have been ingested. Please import videos first.".to_string());
    }

    // Format transcripts and beats for the Director
    let mut transcripts = Vec::new();
    let mut beat_maps = Vec::new();
    for asset in &assets {
        if let Some(trans) = &asset.transcript {
            let trans_str = trans.iter()
                .map(|t| format!("[{:.1}s-{:.1}s] {}", t.start, t.end, t.text))
                .collect::<Vec<String>>()
                .join(" | ");
            transcripts.push(format!("File: {} -> {}", asset.name, trans_str));
        }
        if let Some(beats) = &asset.beats {
            beat_maps.push(format!("File: {} -> Beats: {:?}", asset.name, beats));
        }
    }

    let transcripts_joined = transcripts.join("\n");
    let beat_maps_joined = beat_maps.join("\n");

    // Initialize Cerebras Client
    let client = ai::CerebrasClient::new(api_key);

    // --- PHASE 2: Inference 1 - "The Director" (Query Expansion) ---
    let director_plan = client.run_director(
        &prompt,
        &transcripts_joined,
        &beat_maps_joined
    ).await?;
    println!("[AI PIPELINE] Inference 1 (Director Plan) successfully returned: {:?}", director_plan);

    // --- PHASE 3: Local Vector Retrieval (RAG Step) ---
    let mut retrieval_results = Vec::new();
    for seg in &director_plan.editing_plan {
        // Embed the videography query
        let query_vector = db::generate_text_embedding(&seg.visual_search_query);
        // KNN search on LanceDB / Local DB
        let knn_matches = db.knn_search(&query_vector, 3);
        
        let mut matches_formatted = Vec::new();
        for (i, (rec, score)) in knn_matches.into_iter().enumerate() {
            // Find corresponding local asset proxy path
            let asset_name = PathBuf::from(&rec.asset_path)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            
            matches_formatted.push(json_val(
                &rec.asset_path,
                &asset_name,
                rec.timestamp,
                score
            ));
        }

        retrieval_results.push(serde_json::json!({
            "segment_query": seg.visual_search_query,
            "target_time_range": seg.time_range,
            "local_matches": matches_formatted
        }));
    }

    let retrieval_results_str = serde_json::to_string_pretty(&retrieval_results).unwrap();

    // --- PHASE 4: Inference 2 - "The Editor" ---
    let mut editor_response = client.run_editor(
        &director_plan,
        &retrieval_results_str,
        24.0 // Target framerate
    ).await?;
    println!("[AI PIPELINE] Inference 2 (Editor Timeline) successfully returned.");

    // --- PHASE 5: Conform snappings & soft-warning resolver ---
    let warnings = conform::conform_timeline(&mut editor_response.timeline);
    println!("[AI PIPELINE] Timeline conformed. Warnings generated: {:?}", warnings);

    // Return combined result of timeline and warnings to client
    Ok(serde_json::json!({
        "timeline": editor_response.timeline,
        "warnings": warnings,
        "director_plan": director_plan
    }))
}

// Helper to format match json
fn json_val(full_path: &str, name: &str, timestamp: f32, score: f32) -> serde_json::Value {
    serde_json::json!({
        "file_path": full_path,
        "asset_name": name,
        "timestamp": timestamp,
        "score": score,
        // Propose a segment starting 1.5s before and ending 1.5s after the frame timestamp
        "in_point": (timestamp - 1.5).max(0.0),
        "out_point": timestamp + 1.5
    })
}

// IPC command to export/compile final timeline
#[tauri::command]
async fn export_timeline(
    timeline_json: String,
    output_path: String,
    db: State<'_, Arc<VectorDatabase>>
) -> Result<String, String> {
    println!("[EXPORT] Starting video timeline compilation...");
    let timeline: TimelineConfig = serde_json::from_str(&timeline_json)
        .map_err(|e| format!("Invalid timeline schema: {}", e))?;

    // Create FFmpeg filter commands
    // We swap proxy files for raw footage paths by matching filenames
    let assets = db.get_assets();
    
    // We construct the ffmpeg export command.
    // In our simplified editor backend, we execute an FFmpeg concat or filter complex
    // that stitches together the cuts from the raw files.
    let mut inputs = Vec::new();
    let mut filter_complex = String::new();
    
    for (i, track) in timeline.tracks.iter().enumerate() {
        if track.track_type != "video" { continue; }
        for (j, clip) in track.clips.iter().enumerate() {
            // Find the original raw file matching the proxy filename
            let source_name = PathBuf::from(&clip.source).file_name().unwrap_or_default().to_string_lossy().to_string();
            let mut raw_path = clip.source.clone();
            
            for asset in &assets {
                let asset_proxy_name = asset.proxy_path.as_ref()
                    .and_then(|p| PathBuf::from(p).file_name())
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                
                if asset_proxy_name == source_name || asset.name == source_name.replace("_proxy_1080p.mp4", "") {
                    raw_path = asset.file_path.clone();
                    break;
                }
            }

            inputs.push(format!("-ss {} -to {} -i \"{}\"", clip.in_point, clip.out_point, raw_path));
            filter_complex.push_str(&format!("[{}:v][{}:a]", j, j));
        }
        
        if !track.clips.is_empty() {
            filter_complex.push_str(&format!("concat=n={}:v=1:a=1[outv][outa]", track.clips.len()));
        }
    }

    if inputs.is_empty() {
        return Err("Timeline does not contain any clips to export".to_string());
    }

    // Execute FFmpeg compile command
    let mut command_args = Vec::new();
    for input in &inputs {
        let parts: Vec<&str> = input.splitn(5, ' ').collect();
        // parts should be e.g.: ["-ss", "10", "-to", "15", "-i", "path"]
        for p in parts {
            let cleaned = p.replace("\"", "");
            if !cleaned.is_empty() {
                command_args.push(cleaned);
            }
        }
    }

    if !filter_complex.is_empty() {
        command_args.push("-filter_complex".to_string());
        command_args.push(filter_complex);
        command_args.push("-map".to_string());
        command_args.push("[outv]".to_string());
        command_args.push("-map".to_string());
        command_args.push("[outa]".to_string());
    }

    command_args.push("-y".to_string());
    command_args.push(output_path.clone());

    println!("[EXPORT] Running FFmpeg compile with args: {:?}", command_args);
    let status = Command::new("ffmpeg")
        .args(&command_args)
        .status()
        .map_err(|e| format!("FFmpeg failed to run: {}", e))?;

    if !status.success() {
        return Err("FFmpeg export process failed. Verify inputs and timelines.".to_string());
    }

    Ok(format!("Successfully compiled video exported to: {}", output_path))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            
            // Resolve app data directory
            let app_data = handle.path().app_data_dir()
                .unwrap_or_else(|_| std::env::current_dir().unwrap().join("videorag_data"));
            
            // Initialize Database and Ingestion queues
            let db = Arc::new(VectorDatabase::new(app_data));
            let ingestion = Arc::new(IngestionManager::new(handle.clone()));
            
            // Manage state in Tauri
            app.manage(db);
            app.manage(ingestion);
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_assets,
            import_media,
            query_ai,
            export_timeline
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
