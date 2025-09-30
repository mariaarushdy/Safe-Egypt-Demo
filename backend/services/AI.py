"""
AI Service Module

This module provides AI-powered analysis capabilities for incident detection,
including video analysis, frame extraction, and object detection using Google's Gemini AI.
"""

import os
import cv2
import json
import time
from enum import Enum
from typing import Optional, List
from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image
from pydantic import BaseModel

# Load environment variables
load_dotenv()


# ============================================================================
# CUSTOM EXCEPTIONS
# ============================================================================

class APIKeyError(Exception):
    """Custom exception for missing API Key."""
    pass


class VideoProcessingError(Exception):
    """Custom exception for video processing errors."""
    pass


# ============================================================================
# DATA MODELS
# ============================================================================

class Severity(str, Enum):
    low = "Low"
    medium = "Medium"
    high = "High"


class Verified(str, Enum):
    real = "Real"
    false = "False"


class ViolenceType(str, Enum):
    theft = "theft"
    assaults = "assaults"
    harassment = "harassment"
    suspicious_activity = "suspicious activity"
    kidnapping = "kidnapping"


class AccidentType(str, Enum):
    traffic = "traffic"
    fire = "fire"
    drowning = "drowning"
    fall = "fall"
    explosion = "explosion"
    medical_emergency = "medical emergency"


class UtilityType(str, Enum):
    electricity_outage = "electricity_outage"
    water_leakage = "water_leakage"
    gas_leak = "gas_leak"
    internet_disruption = "internet_disruption"
    road_damage = "road_damage"


class IllegalType(str, Enum):
    drug_dealing = "drug_dealing"
    smuggling = "smuggling"
    vandalism = "vandalism"
    fraud = "fraud"
    cybercrime = "cybercrime"
    trespassing = "trespassing"


class EventType(str, Enum):
    weapon = "weapon"
    person = "person"


class Incident(BaseModel):
    """Comprehensive incident data model."""
    # Common fields
    category: str  # Violence, Accident, Utility, Illegal Activity
    title: str  # 3 words max
    description: str  # 2 short sentences
    severity: Severity
    verified: Verified

    # Violence-specific
    violence_type: Optional[ViolenceType] = None
    weapon: Optional[str] = None  # only weapon name or "none"
    site_description: Optional[str] = None
    number_of_people: Optional[int] = None
    description_of_people: Optional[str] = None
    detailed_description_for_the_incident: Optional[str] = None

    # Accident-specific
    accident_type: Optional[AccidentType] = None
    vehicles_machines_involved: Optional[str] = None

    # Utility-specific
    utility_type: Optional[UtilityType] = None
    extent_of_impact: Optional[str] = None
    duration: Optional[str] = None

    # Illegal Activity-specific
    illegal_type: Optional[IllegalType] = None
    items_involved: Optional[str] = None


class TimeStampedEvent(BaseModel):
    """Model for timestamped events in video analysis."""
    event_type: EventType  
    first_second: float   # exact second when the important event happens
    confidence: float     # [0.0–1.0]
    description: str      # short description of why this frame is crucial
    suggested_frame_seconds: float  # single best frame to extract (3 decimals)


class Detection(BaseModel):
    """Model for object detection results."""
    box_2d: List[float]  # [ymin, xmin, ymax, xmax] normalized to 0-1000
    type: str  # "weapon" or "person"
    confidence: float


class FrameDetection(BaseModel):
    """Model for frame-level detection results."""
    image_index: int
    detections: List[Detection]


# ============================================================================
# PROMPTS
# ============================================================================

TIMESTAMP_PROMPT = """
You are an incident analysis system. Analyze the uploaded video and return ONLY a strict JSON object that follows the schema below.

Goals:
- Identify **critical timestamps** (to the nearest 0.001s) that may contain crucial evidence or details valuable for authorities.
- These include moments when:
  • A weapon becomes visible.
  • A person clearly initiates or escalates a fight.
  • A suspect's face is clearly visible (frontal or unobstructed).
- Ignore all other frames. Only return timestamps of high evidential value.
- Provide a confidence score [0.0–1.0] for each timestamp.
- `suggested_frame_seconds` must be the single best frame to extract for evidence (precise, clear visibility).

Schema (strict JSON):
{
    {
      "event_type": "weapon",
      "first_second": 12.345,
      "confidence": 0.87,
      "description": "Knife becomes clearly visible in right hand of suspect",
      "suggested_frame_seconds": 12.345
    },
    {
      "event_type": "person",
      "first_second": 11.876,
      "confidence": 0.92,
      "description": "Fight initiator shoves another person, clear face visible",
      "suggested_frame_seconds": 11.876
    }
}

Rules:
- Return ONLY the JSON object, no extra text or explanation.
- Times are in seconds with 3 decimal places.
- Confidence values range 0.0–1.0.
- Keep descriptions short but precise about why this frame is crucial.
- suggested_frame_seconds is mandatory for every event.
"""

INCIDENT_ANALYSIS_PROMPT = """
You are an advanced incident analysis system. 
Analyze the uploaded video and output ONLY a JSON object that matches the Incident schema below.

General Rules:
- Always output valid JSON, no extra text.
- category: one of [Violence, Accident, Utility, Illegal Activity].
- title: maximum 3 words, must summarize the event.
- description: exactly 2 short sentences summarizing what happened.
- severity: one of [Low, Medium, High].
- verified: one of [Real, False].
- All textual fields must be complete, precise, and consistent.

Violence fields:
- type: theft, assaults, harassment, suspicious activity, kidnapping.
- weapon: only the weapon name; if no weapon is present, return "none".
- site_description: give a detailed description of the exact place (e.g., "narrow street behind the train station with dim lighting and parked cars").
- number_of_people: integer count.
- description_of_people: concise but informative (gender, clothing, age group if visible).
- detailed_description_for_the_incident: full sentences giving the sequence of events in detail.

Accident fields:
- accident_type: traffic, fire, drowning, fall, explosion, medical emergency.
- site_description: detailed description of the exact place where it happened (e.g., "busy highway intersection with heavy evening traffic").
- vehicles_machines_involved: specify type and number clearly (e.g., "2 cars and 1 motorcycle").

Utility fields:
- utility_type: electricity_outage, water_leakage, gas_leak, internet_disruption, road_damage.
- site_description: detailed location (e.g., "residential neighborhood near downtown, affecting several apartment blocks").
- extent_of_impact: clear statement of scale (e.g., "approximately 200 households").
- duration: estimated or reported downtime.

Illegal Activity fields:
- illegal_type: drug_dealing, smuggling, vandalism, fraud, cybercrime, trespassing.
- site_description: detailed description of where the activity occurred (e.g., "abandoned warehouse on the outskirts of the city").
- items_involved: specify in detail (e.g., "large shipment of cocaine packaged in boxes").

Important:
- If a field is not relevant for the detected category, set it to null.
- Be consistent: descriptions of people, weapons, places, and actions must align logically with the video content.
"""

DETECTION_PROMPT = """
You are analyzing multiple extracted frames from an incident video. 
Return ONLY a strict JSON array, no explanations or extra text.

For each input image, return an object:
{
  "image_index": int (index in the input list, starting from 0),
  "detections": [
    {
      "box_2d": [ymin, xmin, ymax, xmax] with values normalized to 0–1000,
      "type": "weapon" or "person",
      "confidence": float
    }
  ]
}

Rules:
- Detect ONLY weapons and people.
- If a person's face is not clearly visible, do NOT return them.
"""


# ============================================================================
# AI SERVICE CLASS
# ============================================================================

class AIService:
    """Main AI service class for incident analysis and video processing."""
    
    def __init__(self):
        """Initialize the AI service with Gemini client."""
        self.client = self._get_gemini_client()
    
    def _get_gemini_client(self):
        """Initialize and return Gemini client with API key from environment."""
        api_key = os.getenv("GOOGLE_API_KEY")
        
        if not api_key:
            raise APIKeyError(
                "GOOGLE_API_KEY not found in environment variables. Please check your .env file."
            )
        
        try:
            client = genai.Client(api_key=api_key)
            return client
        except Exception as e:
            raise Exception(f"Failed to initialize Gemini client: {str(e)}")
    
    def analyze_video(self, video_path: str, output_dir: str = ".", cleanup: bool = True) -> tuple[Incident, List[TimeStampedEvent]]:
        """
        Analyze a video file and return incident analysis and timestamped events.
        
        Args:
            video_path (str): Path to the video file
            output_dir (str): Directory to save output files
            cleanup (bool): Whether to delete uploaded file after processing
            
        Returns:
            tuple: (Incident analysis, List of timestamped events)
        """
        try:
            print(f"Uploading video: {video_path}...")
            
            # Upload the file
            myfile = self.client.files.upload(file=video_path)
            print(f"File uploaded. File ID: {myfile.name}. Initial State: {myfile.state.name}")

            # Poll until file is active
            while myfile.state.name == "PROCESSING":
                print("File is still processing... Waiting 15 seconds.")
                time.sleep(15)
                myfile = self.client.files.get(name=myfile.name)
            
            if myfile.state.name != "ACTIVE":
                raise VideoProcessingError(f"File processing failed or finished in state: {myfile.state.name}")

            print("File is now ACTIVE. Proceeding to content generation.")

            # Generate incident analysis
            incident_response = self.client.models.generate_content(
                model="gemini-2.5-pro", 
                contents=[myfile, INCIDENT_ANALYSIS_PROMPT],
                config={
                    "response_mime_type": "application/json",
                    "response_schema": Incident
                }
            )
            
            # Generate timestamp analysis
            timestamp_response = self.client.models.generate_content(
                model="gemini-2.5-pro",
                contents=[myfile, TIMESTAMP_PROMPT],
                config={
                    "response_mime_type": "application/json",
                    "response_schema": list[TimeStampedEvent]
                }
            )
            
            print("\n--- Analysis Complete ---")
            print("Incident Analysis:", incident_response.text)
            print("Timestamp Events:", timestamp_response.text)
            
            # Parse responses
            incident: Incident = incident_response.parsed
            events: List[TimeStampedEvent] = timestamp_response.parsed

            # Save events to JSON file
            events_output_path = os.path.join(output_dir, "events_output.json")
            with open(events_output_path, "w", encoding="utf-8") as f:
                json.dump(
                    [event.model_dump() if hasattr(event, "model_dump") else event for event in events], 
                    f, ensure_ascii=False, indent=2
                )
            print(f"Events saved to: {events_output_path}")

            return incident, events
            
        except APIKeyError as e:
            print(f"API Key ERROR: {e}")
            raise
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            raise
        finally:
            # Cleanup uploaded file
            if cleanup and 'myfile' in locals() and myfile.name:
                print(f"Deleting file {myfile.name}...")
                self.client.files.delete(name=myfile.name)
                print("Cleanup complete.")
        time.sleep(10)
    
    def extract_frames_and_analyze(self, video_path: str, events_json_path: str, output_folder: str) -> List[FrameDetection]:
        """
        Extract frames based on timestamped events and perform object detection.
        
        Args:
            video_path (str): Path to the video file
            events_json_path (str): Path to the events JSON file
            output_folder (str): Folder to save extracted and annotated frames
            
        Returns:
            List[FrameDetection]: Detection results for each frame
        """
        try:
            # Load events from JSON
            with open(events_json_path, "r", encoding="utf-8") as f:
                events = json.load(f)

            if not events:
                print("No events found in JSON.")
                return []

            # Open video and extract frames
            cap = cv2.VideoCapture(video_path)
            fps = cap.get(cv2.CAP_PROP_FPS)

            # Create output folder
            if not os.path.exists(output_folder):
                os.makedirs(output_folder)

            frame_list = []
            frame_meta = []

            for idx, event in enumerate(events):
                frame_time = round(event.get("suggested_frame_seconds", 0), 3)
                frame_num = int(frame_time * fps)

                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
                ret, frame = cap.read()

                if not ret or frame is None:
                    print(f"[Warning] Could not read frame at {frame_time:.3f}s")
                    continue

                # Convert to PIL for Gemini
                frame_pil = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                frame_list.append(frame_pil)
                frame_meta.append({"idx": idx, "time": frame_time, "frame": frame})

            if not frame_list:
                print("No frames could be extracted.")
                return []

            # Send all frames for detection
            config = types.GenerateContentConfig(response_mime_type="application/json")
            
            detection_response = self.client.models.generate_content(
                model="gemini-2.5-pro",
                contents=[*frame_list, DETECTION_PROMPT],
                config=config
            )

            detections = json.loads(detection_response.text)

            # Annotate each frame
            for det_group in detections:
                image_index = det_group["image_index"]
                frame_info = frame_meta[image_index]
                frame = frame_info["frame"]
                frame_time = frame_info["time"]

                height, width = frame.shape[:2]

                for det in det_group["detections"]:
                    ymin, xmin, ymax, xmax = det["box_2d"]
                    abs_y1 = int(ymin / 1000 * height)
                    abs_x1 = int(xmin / 1000 * width)
                    abs_y2 = int(ymax / 1000 * height)
                    abs_x2 = int(xmax / 1000 * width)

                    color = (0, 255, 0) if det["type"] == "person" else (0, 0, 255)
                    cv2.rectangle(frame, (abs_x1, abs_y1), (abs_x2, abs_y2), color, 2)
                    cv2.putText(
                        frame,
                        f"{det['type']} ({det['confidence']:.2f})",
                        (abs_x1, abs_y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        color,
                        2,
                    )

                # Save annotated frame
                frame_filename = os.path.join(
                    output_folder, f"event_{frame_info['idx']+1}_at_{frame_time:.3f}s.jpg"
                )
                cv2.imwrite(frame_filename, frame)
                print(f"Saved: {frame_filename}")

            cap.release()
            
            # Parse detection results
            parsed_detections = [FrameDetection(**det_group) for det_group in detections]
            return parsed_detections
            
        except Exception as e:
            print(f"Error in frame extraction and analysis: {e}")
            raise
    
    def process_video_complete(self, video_path: str, output_dir: str = ".") -> dict:
        """
        Complete video processing pipeline: analyze video, extract frames, and perform detection.
        
        Args:
            video_path (str): Path to the video file
            output_dir (str): Directory for output files
            
        Returns:
            dict: Complete analysis results
        """
        try:
            # Step 1: Analyze video
            print("=== Starting Video Analysis ===")
            incident, events = self.analyze_video(video_path, output_dir)
            
            # Step 2: Extract frames and analyze
            print("\n=== Starting Frame Extraction and Detection ===")
            events_json_path = os.path.join(output_dir, "events_output.json")
            frames_output_dir = os.path.join(output_dir, "extracted_frames")
            
            detections = self.extract_frames_and_analyze(
                video_path, events_json_path, frames_output_dir
            )
            
            # Compile results
            results = {
                "incident_analysis": incident.model_dump() if hasattr(incident, "model_dump") else incident,
                "timestamped_events": [event.model_dump() if hasattr(event, "model_dump") else event for event in events],
                "frame_detections": [det.model_dump() if hasattr(det, "model_dump") else det for det in detections],
                "output_files": {
                    "events_json": events_json_path,
                    "frames_folder": frames_output_dir
                }
            }
            
            print("\n=== Processing Complete ===")
            return results
            
        except Exception as e:
            print(f"Error in complete video processing: {e}")
            raise


# ============================================================================
# CONVENIENCE FUNCTIONS
# ============================================================================

def analyze_incident_video(video_path: str, output_dir: str = ".") -> dict:
    """
    Convenience function to analyze a video file completely.
    
    Args:
        video_path (str): Path to the video file
        output_dir (str): Directory for output files
        
    Returns:
        dict: Complete analysis results
    """
    ai_service = AIService()
    return ai_service.process_video_complete(video_path, output_dir)


def get_ai_service() -> AIService:
    """
    Factory function to get an AIService instance.
    
    Returns:
        AIService: Configured AI service instance
    """
    return AIService()
results = analyze_incident_video("data/uploads/videos/fight.mp4", output_dir="data/analysis_output")
print(results)


