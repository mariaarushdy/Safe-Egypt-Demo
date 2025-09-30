#!/usr/bin/env python3
"""
Test script for the AI service module.
This script demonstrates how to use the AI service to analyze videos.
"""

import os
from services.AI import analyze_incident_video, get_ai_service

def main():
    """Test the AI service with a sample video."""
    
    # Check if the video file exists
    video_path = "data/uploads/videos/fight.mp4"
    output_dir = "data/analysis_output"
    
    if not os.path.exists(video_path):
        print(f"❌ Video file not found: {video_path}")
        print("Please ensure you have a video file in the correct location.")
        return
    
    try:
        print("🎬 Starting AI video analysis...")
        print(f"📁 Video: {video_path}")
        print(f"📁 Output: {output_dir}")
        print("-" * 50)
        
        # Analyze the video
        results = analyze_incident_video(video_path, output_dir)
        
        print("\n✅ Analysis Complete!")
        print("-" * 50)
        
        # Display results summary
        incident = results.get("incident_analysis", {})
        events = results.get("timestamped_events", [])
        detections = results.get("frame_detections", [])
        
        print(f"🎯 Incident Category: {incident.get('category', 'N/A')}")
        print(f"📝 Title: {incident.get('title', 'N/A')}")
        print(f"🔴 Severity: {incident.get('severity', 'N/A')}")
        print(f"⏰ Events Found: {len(events)}")
        print(f"🖼️ Frames Processed: {len(detections)}")
        
        print("\n📊 Detailed Results:")
        print(f"└── Events JSON: {results['output_files']['events_json']}")
        print(f"└── Frames Folder: {results['output_files']['frames_folder']}")
        
    except Exception as e:
        print(f"❌ Error during analysis: {e}")
        print("\n💡 Make sure you have:")
        print("- GOOGLE_API_KEY set in your .env file")
        print("- All required dependencies installed")
        print("- Valid video file in the specified path")

if __name__ == "__main__":
    main()
