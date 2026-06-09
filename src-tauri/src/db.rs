use std::sync::{Arc, Mutex};
use std::fs::File;
use std::io::{Read, Write};
use std::path::PathBuf;
use crate::models::LocalAsset;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct VectorRecord {
    pub asset_path: String,
    pub timestamp: f32,
    pub vector: Vec<f32>,
}

pub struct VectorDatabase {
    db_path: PathBuf,
    assets: Arc<Mutex<Vec<LocalAsset>>>,
    vectors: Arc<Mutex<Vec<VectorRecord>>>,
}

impl VectorDatabase {
    pub fn new(app_data_dir: PathBuf) -> Self {
        let db_path = app_data_dir.join("videorag.db");
        let assets_path = app_data_dir.join("assets.json");

        // Create directory if not exists
        let _ = std::fs::create_dir_all(&app_data_dir);

        let assets = if assets_path.exists() {
            let mut file = File::open(assets_path).unwrap();
            let mut data = String::new();
            file.read_to_string(&mut data).unwrap();
            serde_json::from_str::<Vec<LocalAsset>>(&data).unwrap_or_default()
        } else {
            Vec::new()
        };

        let vectors = if db_path.exists() {
            let mut file = File::open(&db_path).unwrap();
            let mut data = String::new();
            file.read_to_string(&mut data).unwrap();
            serde_json::from_str::<Vec<VectorRecord>>(&data).unwrap_or_default()
        } else {
            Vec::new()
        };

        Self {
            db_path,
            assets: Arc::new(Mutex::new(assets)),
            vectors: Arc::new(Mutex::new(vectors)),
        }
    }

    pub fn insert_asset(&self, asset: LocalAsset) {
        let mut lock = self.assets.lock().unwrap();
        // Remove existing asset with same path if exists
        lock.retain(|a| a.file_path != asset.file_path);
        lock.push(asset);

        // Save assets list
        let assets_path = self.db_path.parent().unwrap().join("assets.json");
        if let Ok(json_str) = serde_json::to_string_pretty(&*lock) {
            if let Ok(mut file) = File::create(assets_path) {
                let _ = file.write_all(json_str.as_bytes());
            }
        }
    }

    pub fn get_assets(&self) -> Vec<LocalAsset> {
        self.assets.lock().unwrap().clone()
    }

    /// Commit visual embeddings to our LanceDB simulated table.
    /// Memory mapping is emulated by reading index structures from disk lazily.
    pub fn insert_vector(&self, asset_path: String, timestamp: f32, vector: Vec<f32>) {
        let mut lock = self.vectors.lock().unwrap();
        lock.push(VectorRecord {
            asset_path,
            timestamp,
            vector,
        });

        // Write directly to disk (this simulates LanceDB mmap write commit)
        if let Ok(json_str) = serde_json::to_string(&*lock) {
            if let Ok(mut file) = File::create(&self.db_path) {
                let _ = file.write_all(json_str.as_bytes());
            }
        }
    }

    /// Perform K-Nearest Neighbors (KNN) cosine similarity search against local vectors.
    pub fn knn_search(&self, query_vector: &[f32], k: usize) -> Vec<(VectorRecord, f32)> {
        let vectors_lock = self.vectors.lock().unwrap();
        if vectors_lock.is_empty() {
            return Vec::new();
        }

        let mut results: Vec<(VectorRecord, f32)> = vectors_lock
            .iter()
            .map(|rec| {
                let similarity = cosine_similarity(query_vector, &rec.vector);
                (rec.clone(), similarity)
            })
            .collect();

        // Sort descending by similarity score
        results.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(k);
        results
    }
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let mut dot = 0.0;
    let mut norm_a = 0.0;
    let mut norm_b = 0.0;
    for i in 0..a.len() {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }
    if norm_a == 0.0 || norm_b == 0.0 {
        return 0.0;
    }
    dot / (norm_a.sqrt() * norm_b.sqrt())
}

// Generate simple mock embeddings (512 dimensions) for visual clips.
// This executes standard CPU ONNX-mock functions.
pub fn generate_text_embedding(query: &str) -> Vec<f32> {
    println!("[ONNX EMBEDDER] Generating 512d text embedding for query: '{}'", query);
    let mut v = vec![0.0; 512];
    // Simple hash-based deterministic mock vector
    for (i, c) in query.chars().enumerate() {
        let idx = i % 512;
        v[idx] += (c as u32 as f32) / 255.0;
    }
    // L2 Normalize
    let norm: f32 = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for x in v.iter_mut() {
            *x /= norm;
        }
    }
    v
}

pub fn generate_frame_embedding(frame_data: &[u8]) -> Vec<f32> {
    println!("[ONNX EMBEDDER] Generating 512d frame embedding (data size: {} bytes)", frame_data.len());
    let mut v = vec![0.0; 512];
    for i in 0..frame_data.len().min(512) {
        v[i] = (frame_data[i] as f32) / 255.0;
    }
    let norm: f32 = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for x in v.iter_mut() {
            *x /= norm;
        }
    }
    v
}
