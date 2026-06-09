use crate::models::{TimelineConfig, TimelineClip};

/// Snaps a floating-point time (seconds) to the nearest exact frame boundary.
pub fn snap_to_frame(time: f32, fps: f32) -> f32 {
    if fps <= 0.0 {
        return time;
    }
    let frame = (time * fps).round();
    frame / fps
}

/// Snaps all clips in a timeline to exact frame boundaries.
pub fn snap_timeline_frames(timeline: &mut TimelineConfig) {
    let fps = timeline.fps;
    for track in &mut timeline.tracks {
        for clip in &mut track.clips {
            clip.in_point = snap_to_frame(clip.in_point, fps);
            clip.out_point = snap_to_frame(clip.out_point, fps);
            clip.timeline_start = snap_to_frame(clip.timeline_start, fps);
        }
    }
}

/// Resolves overlapping clips and timeline gaps by shifting and trimming clips.
/// Returns a list of human-readable soft warnings explaining adjustments made.
pub fn conform_timeline(timeline: &mut TimelineConfig) -> Vec<String> {
    let mut warnings = Vec::new();
    let fps = timeline.fps;

    // Snap all frames first to ensure math starts from clean boundaries
    snap_timeline_frames(timeline);

    for track in &mut timeline.tracks {
        if track.track_type != "video" {
            continue;
        }

        // Sort clips by scheduled timeline start
        track.clips.sort_by(|a, b| a.timeline_start.partial_cmp(&b.timeline_start).unwrap_or(std::cmp::Ordering::Equal));

        let mut current_time = 0.0;
        for i in 0..track.clips.len() {
            let clip = &mut track.clips[i];
            let scheduled_start = clip.timeline_start;
            let duration = clip.out_point - clip.in_point;

            // Resolve overlapping conflicts
            if scheduled_start < current_time {
                let overlap = current_time - scheduled_start;
                warnings.push(format!(
                    "Clip '{}' overlap of {:.3}s resolved: snapped start from {:.3}s to {:.3}s.",
                    clip.source, overlap, scheduled_start, current_time
                ));
                clip.timeline_start = current_time;
            } else if scheduled_start > current_time {
                // If there's a minor gap (< 0.2s), snap them together to prevent black frames
                let gap = scheduled_start - current_time;
                if gap < 0.2 {
                    warnings.push(format!(
                        "Micro-gap of {:.3}s closed: snapped clip '{}' to start at {:.3}s.",
                        gap, clip.source, current_time
                    ));
                    clip.timeline_start = current_time;
                }
            }

            // Snap out point to maintain exact frame boundary duration
            let conformed_duration = snap_to_frame(duration, fps);
            clip.out_point = clip.in_point + conformed_duration;

            // Update current timeline cursor
            current_time = clip.timeline_start + conformed_duration;
            current_time = snap_to_frame(current_time, fps);
        }
    }

    warnings
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{TimelineTrack, TimelineEffect};

    #[test]
    fn test_snap_to_frame() {
        let fps = 23.976;
        let t = 1.002;
        let snapped = snap_to_frame(t, fps);
        // 1.002 * 23.976 = 24.02 -> rounded is 24 -> 24 / 23.976 = 1.001
        assert!((snapped - 1.001).abs() < 0.001);
    }

    #[test]
    fn test_conform_timeline_overlap() {
        let mut timeline = TimelineConfig {
            fps: 24.0,
            tracks: vec![
                TimelineTrack {
                    track_type: "video".to_string(),
                    clips: vec![
                        TimelineClip {
                            source: "clip1.mp4".to_string(),
                            in_point: 0.0,
                            out_point: 2.0,
                            timeline_start: 0.0,
                        },
                        TimelineClip {
                            source: "clip2.mp4".to_string(),
                            in_point: 5.0,
                            out_point: 8.0,
                            timeline_start: 1.5, // Overlap! Starts before clip1 ends at 2.0
                        }
                    ]
                }
            ],
            effects: vec![]
        };

        let warnings = conform_timeline(&mut timeline);
        assert!(!warnings.is_empty());
        assert_eq!(timeline.tracks[0].clips[1].timeline_start, 2.0);
    }
}
