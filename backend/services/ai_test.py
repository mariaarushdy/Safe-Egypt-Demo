import os
import cv2
import json
import time
from enum import Enum
from typing import Optional, List
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import ClientError
from PIL import Image
from pydantic import BaseModel


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class Verified(str, Enum):
    real = "real"
    false = "fake"


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
    electricity_outage = "electricity outage"
    water_leakage = "water leakage"
    gas_leak = "gas leak"
    internet_disruption = "internet disruption"
    road_damage = "road damage"


class IllegalType(str, Enum):
    drug_dealing = "drug dealing"
    smuggling = "smuggling"
    vandalism = "vandalism"
    fraud = "fraud"
    cybercrime = "cybercrime"
    trespassing = "trespassing"


class Incident(BaseModel):
    # Common fields
    category: str  # العنف، الحوادث، الخدمات، النشاط غير القانوني
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


# --------------------------------------------------------------------------

class EventType(str, Enum):
    weapon = "weapon"
    person = "person"

class TimeStampedEvent(BaseModel):
    event_type: EventType  
    first_second: float   # exact second when the important event happens
    confidence: float     # [0.0–1.0]
    description: str      # short description of why this frame is crucial
    suggested_frame_seconds: float  # single best frame to extract (3 decimals)
TIMESTAMP_PROMPT = """
You are an incident analysis system. Analyze the uploaded video and return ONLY a strict JSON object that follows the schema below.

Goals:
- Identify **critical timestamps** (to the nearest 0.001s) that may contain crucial evidence or details valuable for authorities.
- These include moments when:
  • A weapon becomes visible.
  • A person clearly initiates or escalates a fight.
  • A suspect’s face is clearly visible (frontal or unobstructed).
- Ignore all other frames. Only return timestamps of high evidential value.
- Provide a confidence score [0.0–1.0] for each timestamp.
- `suggested_frame_seconds` must be the single best frame to extract for evidence (precise, clear visibility).
- description must be in Arabic language.

Schema (strict JSON):
{
    {
      "event_type": "weapon",
      "first_second": 12.345,
      "confidence": 0.87,
      "description": "يظهر السكين بوضوح في يد المشتبه به اليمنى",
      "suggested_frame_seconds": 12.345
    },
    {
      "event_type": "person",
      "first_second": 11.876,
      "confidence": 0.92,
      "description": "يدفع المبادر الشجار شخصًا آخر، وجه واضح مرئي",
      "suggested_frame_seconds": 11.876
    }
}

Rules:
- Return ONLY the JSON object, no extra text or explanation.
- Times are in seconds with 3 decimal places.
- Confidence values range 0.0–1.0.
- Keep descriptions short but precise about why this frame is crucial.
- suggested_frame_seconds is mandatory for every event.
- description must be in Arabic language.
"""

# --------------------------------------------------------------------------
def get_gemini_client():
    """Initialize and return Gemini client with API key from environment."""
    # os import is needed here
    api_key = os.getenv("GOOGLE_API_KEY")
    
# NOTE: The HTTPException is usually from a web framework like FastAPI/Starlette.
# We'll use a simple custom exception for this script's purpose.
class APIKeyError(Exception):
    """Custom exception for missing API Key."""
    pass

# Load environment variables
load_dotenv()

# --------------------------------------------------------------------------
# 1. Initialization Function
# --------------------------------------------------------------------------
def get_gemini_client():
    """Initialize and return Gemini client with API key from environment."""
    # os import is needed here
    api_key = os.getenv("GOOGLE_API_KEY")
    
    if not api_key:
        # Replaces HTTPException with a simple raised exception
        raise APIKeyError(
            "GOOGLE_API_KEY not found in environment variables. Please check your .env file."
        )
    
    try:
        # Initialize client directly
        client = genai.Client(api_key=api_key)
        return client
    except Exception as e:
        # Catch initialization issues (e.g., connectivity)
        raise Exception(
            f"Failed to initialize Gemini client: {str(e)}"
        )


# --------------------------------------------------------------------------
# 2. Main Logic
# --------------------------------------------------------------------------
# def analyze_video_with_polling(video_path: str):
#     """
#     Uploads a video, polls its status until active, and then analyzes it.
#     """
#     try:
#         # Initialize client
#         client = get_gemini_client()
        
#         print(f"Uploading file: {video_path}...")
#         # Upload the file
#         myfile = client.files.upload(file=video_path)
#         print(f"File uploaded. File ID: {myfile.name}. Initial State: {myfile.state.name}")

#         # --- FIX: Polling loop to wait for the file to be ACTIVE ---
#         # The FAILED_PRECONDITION error occurs if we proceed immediately.
#         while myfile.state.name == "PROCESSING":
#             print("File is still processing... Waiting 15 seconds.")
#             time.sleep(15) # Wait for a reasonable interval
#             # Refresh the file status by fetching the file again
#             myfile = client.files.get(name=myfile.name)
        
#         # if myfile.state.name != "ACTIVE":
#         #     raise ResourceNotActiveError(
#         #         f"File processing failed or finished in state: {myfile.state.name}"
#         #     )

#         print(f"File is now ACTIVE. Proceeding to content generation.")
        
#         # Prepare the prompt
#         prompt =""" 
#         descriptions must be in Arabic language.
#         You are an advanced incident analysis system. 
#         Analyze the uploaded video and output ONLY a JSON object that matches the Incident schema below.

#         General Rules:
#         - Always output valid JSON, no extra text.
#         - category: one of [Violence, Accident, Utility, Illegal Activity, Clear].
#         - title: maximum 3 words, must summarize the event.
#         - description: exactly 2 short sentences summarizing what happened.
#         - severity: one of [Low, Medium, High].
#         - verified: one of [Real, False].
#         - All textual fields must be complete, precise, and consistent.
#         - descriptions must be in Arabic language.
#         Violence fields:
#         - type: theft, assaults, harassment, suspicious activity, kidnapping.
#         - weapon: only the weapon name; if no weapon is present, return "none".
#         - site_description: give a detailed description of the exact place (e.g., "narrow street behind the train station with dim lighting and parked cars").
#         - number_of_people: integer count.
#         - description_of_people: concise but informative (gender, clothing, age group if visible).
#         - detailed_description_for_the_incident: full sentences giving the sequence of events in detail.

#         Accident fields:
#         - accident_type: traffic, fire, drowning, fall, explosion, medical emergency.
#         - site_description: detailed description of the exact place where it happened (e.g., "busy highway intersection with heavy evening traffic").
#         - vehicles_machines_involved: specify type and number clearly (e.g., "2 cars and 1 motorcycle").

#         Utility fields:
#         - utility_type: electricity_outage, water_leakage, gas_leak, internet_disruption, road_damage.
#         - site_description: detailed location (e.g., "residential neighborhood near downtown, affecting several apartment blocks").
#         - extent_of_impact: clear statement of scale (e.g., "approximately 200 households").
#         - duration: estimated or reported downtime.

#         Illegal Activity fields:
#         - illegal_type: drug_dealing, smuggling, vandalism, fraud, cybercrime, trespassing.
#         - site_description: detailed description of where the activity occurred (e.g., "abandoned warehouse on the outskirts of the city").
#         - items_involved: specify in detail (e.g., "large shipment of cocaine packaged in boxes").

#         Important:
#         - If a field is not relevant for the detected category, set it to null.
#         - Be consistent: descriptions of people, weapons, places, and actions must align logically with the video content.
#         """
        
#         # Generate content with the active file
#         response = client.models.generate_content(
#             model="gemini-2.5-pro", 
#             contents=[myfile, prompt],
#             config= {
#                 "response_mime_type": "application/json",
#                 "response_schema": Incident
#             }
#         )
#         response_timestamps = client.models.generate_content(
#             model="gemini-2.5-pro",
#             contents=[myfile, TIMESTAMP_PROMPT],
#             config={
#                 "response_mime_type": "application/json",
#                 "response_schema": list[TimeStampedEvent]
#             }
#         )
        
#         print("\n--- Analysis Response ---")
#         print(response.text)
#         # print("###########################")
#         print(response_timestamps.text)
#         # This line parses the response from the Gemini model and assigns the resulting list of TimeStampedEvent objects to the variable 'events'.
#         events: list[TimeStampedEvent] = response_timestamps.parsed

#         # Save the parsed JSON to a file
        
#         with open("events_output.json", "w", encoding="utf-8") as f:
#             json.dump([event.model_dump() if hasattr(event, "model_dump") else event for event in events], f, ensure_ascii=False, indent=2)

#     except APIKeyError as e:
#         print(f"ERROR: {e}")
#     except Exception as e:
#         print(f"An unexpected error occurred: {e}")
#     finally:
#         # Optional: Clean up the uploaded file after use
#         if 'myfile' in locals() and myfile.name:
#             print(f"\nDeleting file {myfile.name}...")
#             client.files.delete(name=myfile.name)
#             print("Cleanup complete.")

def analyze_video_with_polling_return_data(video_path: str, address: str, timestamp: str):
    """
    Uploads a video, polls its status until active, analyzes it, and returns the incident data.
    """
    try:
        # Initialize client
        client = get_gemini_client()
        
        print(f"Uploading file: {video_path}...")
        # Upload the file
        myfile = client.files.upload(file=video_path)
        print(f"File uploaded. File ID: {myfile.name}. Initial State: {myfile.state.name}")

        # Polling loop to wait for the file to be ACTIVE
        while myfile.state.name == "PROCESSING":
            print("File is still processing... Waiting 15 seconds.")
            time.sleep(15) # Wait for a reasonable interval
            # Refresh the file status by fetching the file again
            myfile = client.files.get(name=myfile.name)

        print(f"File is now ACTIVE. Proceeding to content generation.")

        # Prepare the prompt
        prompt =f""" 
        Any descriptions or titles must be in Arabic language.
        You are an advanced incident analysis system. 
        Analyze the uploaded video and output ONLY a JSON object that matches the Incident schema below.
        The address of the incident is: {address}.
        The timestamp of the incident is: {timestamp}.
        General Rules:
        - Always output valid JSON, no extra text.
        - category: one of [Violence, Accident, Utility, Illegal Activity, Clear].
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
        
        # Generate content with the active file
        response = client.models.generate_content(
            model="gemini-2.5-pro", 
            contents=[myfile, prompt.format(address=address, timestamp=timestamp)],
            config= {
                "response_mime_type": "application/json",
                "response_schema": Incident
            }
        )
        response_timestamps = client.models.generate_content(
            model="gemini-2.5-pro",
            contents=[myfile, TIMESTAMP_PROMPT],
            config={
                "response_mime_type": "application/json",
                "response_schema": list[TimeStampedEvent]
            }
        )
        
        print("\n--- Analysis Response ---")
        print(response.text)
        print(response_timestamps.text)
        
        # Parse responses
        incident_data = json.loads(response.text) if response.text else {}
        events: list[TimeStampedEvent] = response_timestamps.parsed if response_timestamps.parsed else []

        # Save the parsed JSON to a file (for compatibility)
        with open("events_output.json", "w", encoding="utf-8") as f:
            json.dump([event.model_dump() if hasattr(event, "model_dump") else event for event in events], f, ensure_ascii=False, indent=2)

        return incident_data

    except APIKeyError as e:
        print(f"ERROR: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return None
    finally:
        # Optional: Clean up the uploaded file after use
        if 'myfile' in locals() and myfile.name:
            print(f"\nDeleting file {myfile.name}...")
            client.files.delete(name=myfile.name)
            print("Cleanup complete.")

            
def extract_frames_from_json_with_retry(video_path, json_file, output_folder, max_retries=3, batch_size=2):
    """
    Extract frames with retry logic and batch processing to handle API overload
    """
    # Load JSON file (list of events)
    with open(json_file, "r", encoding="utf-8") as f:
        events = json.load(f)

    if not events:
        print("No events found in JSON.")
        return

    # Open video
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)

    if not os.path.exists(output_folder):
        os.makedirs(output_folder)

    frame_list = []
    frame_meta = []  # store index + timestamp + raw frame
    for idx, event in enumerate(events):
        frame_time = round(event.get("suggested_frame_seconds", 0), 3)  # 3 decimal places
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

    # Process frames in batches to reduce API load
    client = get_gemini_client()
    prompt = """
    
    You are analyzing multiple extracted frames from an incident video. 
    Return ONLY a strict JSON array, no explanations or extra text.

    For each input image, return an object:
    {
      "image_index": int (index in the input list, starting from 0),
      "detections": [
        {
          "box_2d": [ymin, xmin, ymax, xmax] with values normalized to 0-1000,
          "type": "weapon" or "person",
          "confidence": float
        }
      ]
    }

    Rules:
    - Detect ONLY weapons and people.
    - If a person's face is not clearly visible, do NOT return them.
    """

    config = types.GenerateContentConfig(
        response_mime_type="application/json"
    )

    all_detections = []
    
    # Process frames in batches
    for batch_start in range(0, len(frame_list), batch_size):
        batch_end = min(batch_start + batch_size, len(frame_list))
        batch_frames = frame_list[batch_start:batch_end]
        batch_meta = frame_meta[batch_start:batch_end]
        
        print(f"Processing batch {batch_start//batch_size + 1}/{(len(frame_list) + batch_size - 1)//batch_size} ({len(batch_frames)} frames)...")
        
        # Retry logic for API calls
        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=[*batch_frames, prompt],  # unpack images + prompt
                    config=config
                )
                
                batch_detections = json.loads(response.text)
                
                # Adjust image indices for the overall list
                for det_group in batch_detections:
                    det_group["image_index"] += batch_start
                
                all_detections.extend(batch_detections)
                print(f"✓ Batch processed successfully")
                break  # Success, break out of retry loop
                
            except ClientError as e:
                error_str = str(e).lower()
                # Check for common overload/rate limit indicators
                if any(indicator in error_str for indicator in ["overloaded", "quota", "rate limit", "503", "429", "resource exhausted"]):
                    if attempt < max_retries - 1:
                        wait_time = (2 ** attempt) * 10  # Exponential backoff: 10, 20, 40 seconds
                        print(f"⚠️ API overloaded/rate limited (attempt {attempt + 1}/{max_retries}). Waiting {wait_time} seconds before retry...")
                        print(f"   Error details: {e}")
                        time.sleep(wait_time)
                        continue
                    else:
                        print(f"❌ Failed after {max_retries} attempts. Skipping this batch.")
                        print(f"   Final error: {e}")
                        # Create empty detections for this batch to continue processing
                        for i, meta in enumerate(batch_meta):
                            all_detections.append({
                                "image_index": batch_start + i,
                                "detections": []
                            })
                        break
                else:
                    print(f"❌ API Error: {e}")
                    raise
            except Exception as e:
                print(f"❌ Unexpected error: {e}")
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) * 5
                    print(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                    continue
                else:
                    raise

    # Crop and save each detection
    detection_count = 0
    for det_group in all_detections:
        image_index = det_group["image_index"]
        if image_index >= len(frame_meta):
            continue
            
        frame_info = frame_meta[image_index]
        frame = frame_info["frame"]
        frame_time = frame_info["time"]

        height, width = frame.shape[:2]

        for det_idx, det in enumerate(det_group["detections"]):
            ymin, xmin, ymax, xmax = det["box_2d"]
            abs_y1 = int(ymin / 1000 * height)
            abs_x1 = int(xmin / 1000 * width)
            abs_y2 = int(ymax / 1000 * height)
            abs_x2 = int(xmax / 1000 * width)

            # Ensure coordinates are within frame bounds
            abs_y1 = max(0, abs_y1)
            abs_x1 = max(0, abs_x1)
            abs_y2 = min(height, abs_y2)
            abs_x2 = min(width, abs_x2)

            # Check if the bounding box is valid (has area)
            if abs_x2 > abs_x1 and abs_y2 > abs_y1:
                # Crop the detection from the frame
                cropped_detection = frame[abs_y1:abs_y2, abs_x1:abs_x2]
                
                # Create filename for the cropped detection
                detection_filename = os.path.join(
                    output_folder, 
                    f"event_{frame_info['idx']+1}_at_{frame_time:.3f}s_{det['type']}_det{det_idx+1}_conf{det['confidence']:.2f}.jpg"
                )
                
                # Save the cropped detection
                cv2.imwrite(detection_filename, cropped_detection)
                detection_count += 1
                print(f"Saved detection: {detection_filename}")
            else:
                print(f"[Warning] Invalid bounding box for detection at {frame_time:.3f}s: {det['type']}")

    print(f"✓ Cropped and saved {detection_count} detections. Check '{output_folder}' folder.")

    cap.release()
    print(f"✓ Frame extraction completed. Check '{output_folder}' folder.")


def extract_frames_with_comprehensive_output(video_path, json_file, output_folder, max_retries=3, batch_size=2):
    """
    Extract frames with comprehensive output including scene images with bounding boxes
    and cropped detections, returning paths and enhanced event data
    """
    # Load JSON file (list of events)
    with open(json_file, "r", encoding="utf-8") as f:
        events = json.load(f)

    if not events:
        print("No events found in JSON.")
        return []

    # Open video
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)

    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
    
    # Create subfolders for organized output
    scenes_folder = os.path.join(output_folder, "scenes")
    detections_folder = os.path.join(output_folder, "detections")
    os.makedirs(scenes_folder, exist_ok=True)
    os.makedirs(detections_folder, exist_ok=True)

    frame_list = []
    frame_meta = []  # store index + timestamp + raw frame
    enhanced_events = []
    
    for idx, event in enumerate(events):
        frame_time = round(event.get("suggested_frame_seconds", 0), 3)  # 3 decimal places
        frame_num = int(frame_time * fps)

        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_num)
        ret, frame = cap.read()

        if not ret or frame is None:
            print(f"[Warning] Could not read frame at {frame_time:.3f}s")
            continue

        # Convert to PIL for Gemini
        frame_pil = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        frame_list.append(frame_pil)
        frame_meta.append({
            "idx": idx, 
            "time": frame_time, 
            "frame": frame,
            "event": event
        })

    # Process frames in batches to reduce API load
    client = get_gemini_client()
    prompt = """
    Any descriptions must be in Arabic language.
    You are analyzing multiple extracted frames from an incident video. 
    Return ONLY a strict JSON array, no explanations or extra text.

    For each input image, return an object:
    {
      "image_index": int (index in the input list, starting from 0),
      "detections": [
        {
          "box_2d": [ymin, xmin, ymax, xmax] with values normalized to 0–1000,
          "type": "weapon" or "person",
          "confidence": float,
          "description": "detailed description of what is detected"
        }
      ]
    }

    Rules:
    - Detect ONLY weapons and people.
    - If a person's face is not clearly visible, do NOT return them.
    - Provide detailed descriptions for each detection.
    """

    config = types.GenerateContentConfig(
        response_mime_type="application/json"
    )

    all_detections = []
    
    # Process frames in batches
    for batch_start in range(0, len(frame_list), batch_size):
        batch_end = min(batch_start + batch_size, len(frame_list))
        batch_frames = frame_list[batch_start:batch_end]
        batch_meta = frame_meta[batch_start:batch_end]
        
        print(f"Processing batch {batch_start//batch_size + 1}/{(len(frame_list) + batch_size - 1)//batch_size} ({len(batch_frames)} frames)...")
        
        # Retry logic for API calls
        for attempt in range(max_retries):
            try:
                response = client.models.generate_content(
                    model="gemini-2.5-pro",
                    contents=[*batch_frames, prompt],  # unpack images + prompt
                    config=config
                )
                
                batch_detections = json.loads(response.text)
                
                # Adjust image indices for the overall list
                for det_group in batch_detections:
                    det_group["image_index"] += batch_start
                
                all_detections.extend(batch_detections)
                print(f"✓ Batch processed successfully")
                break  # Success, break out of retry loop
                
            except ClientError as e:
                error_str = str(e).lower()
                # Check for common overload/rate limit indicators
                if any(indicator in error_str for indicator in ["overloaded", "quota", "rate limit", "503", "429", "resource exhausted"]):
                    if attempt < max_retries - 1:
                        wait_time = (2 ** attempt) * 10  # Exponential backoff: 10, 20, 40 seconds
                        print(f"⚠️ API overloaded/rate limited (attempt {attempt + 1}/{max_retries}). Waiting {wait_time} seconds before retry...")
                        print(f"   Error details: {e}")
                        time.sleep(wait_time)
                        continue
                    else:
                        print(f"❌ Failed after {max_retries} attempts. Skipping this batch.")
                        print(f"   Final error: {e}")
                        # Create empty detections for this batch to continue processing
                        for i, meta in enumerate(batch_meta):
                            all_detections.append({
                                "image_index": batch_start + i,
                                "detections": []
                            })
                        break
                else:
                    print(f"❌ API Error: {e}")
                    raise
            except Exception as e:
                print(f"❌ Unexpected error: {e}")
                if attempt < max_retries - 1:
                    wait_time = (2 ** attempt) * 5
                    print(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                    continue
                else:
                    raise

    # Process each detection and create comprehensive output
    for det_group in all_detections:
        image_index = det_group["image_index"]
        if image_index >= len(frame_meta):
            continue
            
        frame_info = frame_meta[image_index]
        frame = frame_info["frame"]
        frame_time = frame_info["time"]
        original_event = frame_info["event"]

        height, width = frame.shape[:2]
        scene_frame = frame.copy()  # Copy for drawing bounding boxes

        # Extract weapon_type and person_attributes from detections
        weapon_type = None
        person_attributes = None
        detected_elements_paths = []

        for det_idx, det in enumerate(det_group["detections"]):
            ymin, xmin, ymax, xmax = det["box_2d"]
            abs_y1 = max(0, int(ymin / 1000 * height))
            abs_x1 = max(0, int(xmin / 1000 * width))
            abs_y2 = min(height, int(ymax / 1000 * height))
            abs_x2 = min(width, int(xmax / 1000 * width))

            # Check if the bounding box is valid (has area)
            if abs_x2 > abs_x1 and abs_y2 > abs_y1:
                # Draw bounding box on scene frame
                color = (0, 255, 0) if det["type"] == "person" else (0, 0, 255)
                cv2.rectangle(scene_frame, (abs_x1, abs_y1), (abs_x2, abs_y2), color, 2)
                
                # Add label
                label = f"{det['type']} ({det['confidence']:.2f})"
                cv2.putText(scene_frame, label, (abs_x1, abs_y1-10), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
                
                # Crop the detection from the frame
                cropped_detection = frame[abs_y1:abs_y2, abs_x1:abs_x2]
                
                # Create filename for the cropped detection
                detection_filename = os.path.join(
                    detections_folder, 
                    f"event_{frame_info['idx']+1}_at_{frame_time:.3f}s_{det['type']}_det{det_idx+1}_conf{det['confidence']:.2f}.jpg"
                )
                
                # Save the cropped detection
                cv2.imwrite(detection_filename, cropped_detection)
                detected_elements_paths.append(detection_filename)
                
                # Extract attributes based on type
                if det["type"] == "weapon":
                    weapon_type = extract_weapon_type(det.get("description", ""))
                elif det["type"] == "person":
                    person_attributes = det.get("description", "Person detected")
                
                print(f"Saved detection: {detection_filename}")

        # Save scene image with bounding boxes
        scene_filename = os.path.join(
            scenes_folder,
            f"scene_event_{frame_info['idx']+1}_at_{frame_time:.3f}s.jpg"
        )
        cv2.imwrite(scene_filename, scene_frame)

        # Create enhanced event data
        enhanced_event = {
            "event_type": original_event.get("event_type"),
            "first_second": original_event.get("first_second"),
            "confidence": original_event.get("confidence"),
            "description": original_event.get("description"),
            "suggested_frame_seconds": original_event.get("suggested_frame_seconds"),
            "weapon_type": weapon_type,
            "person_attributes": person_attributes,
            "image_path": scene_filename,
            "detected_elements_paths": detected_elements_paths
        }
        
        enhanced_events.append(enhanced_event)

    cap.release()
    print(f"✓ Comprehensive frame extraction completed. Check '{output_folder}' folder.")
    return enhanced_events


def extract_weapon_type(description: str) -> str:
    """Extract weapon type from description"""
    description_lower = description.lower()
    if any(word in description_lower for word in ["knife", "blade", "machete"]):
        return "knife/machete"
    elif any(word in description_lower for word in ["stick", "pole", "rod", "bat"]):
        return "stick/pole"
    elif any(word in description_lower for word in ["gun", "pistol", "firearm"]):
        return "firearm"
    else:
        return "unknown"


def create_comprehensive_analysis(incident_data: dict, detected_events: list) -> dict:
    """
    Combine incident analysis and detected events into comprehensive structure
    """
    if not incident_data:
        return {}
    
    # Start with the incident data
    comprehensive = dict(incident_data)
    
    # Add the detected events
    comprehensive["detected_events"] = detected_events
    
    return comprehensive


def run_full_ai_analysis(video_path: str,
                        address: str,
                        timestamp: str,
                        output_json: str = "data/comprehensive_analysis.json", 
                        output_folder: str = "data/extracted_frames",
                        max_retries: int = 3,
                        batch_size: int = 2) -> str:
    """
    Run the complete AI analysis sequence and create a comprehensive JSON output.
    1. Analyze video and extract incidents/timestamps
    2. Extract and crop frames based on detected events
    3. Create scene images with bounding boxes
    4. Combine all results into a comprehensive JSON structure
    
    Args:
        video_path: Path to the video file to analyze
        output_json: Name of JSON file to save comprehensive results (default: "comprehensive_analysis.json")
        output_folder: Folder to save extracted frame crops (default: "extracted_frames")
        max_retries: Maximum retries for API calls (default: 3)
        batch_size: Number of frames to process in each API batch (default: 2)
    
    Returns:
        str: Path to the comprehensive analysis JSON file, or empty string if failed
    """
    try:
        print(f"🔍 Starting comprehensive AI analysis for: {video_path}")
        print("="*60)
        
        # Step 1: Analyze video and extract incidents/timestamps
        print("📊 Step 1: Analyzing video for incidents and timestamps...")
        incident_data = analyze_video_with_polling_return_data(video_path, address, timestamp)
        
        if not incident_data:
            print(f"❌ Error: Incident analysis failed.")
            return ""
        
        print("✅ Video analysis completed successfully!")
        print("-"*40)
        
        # Step 2: Extract frames and detect objects with comprehensive data
        print("🖼️ Step 2: Extracting frames and detecting objects...")
        events_output_file = "events_output.json"
        
        # Check if events file exists
        if not os.path.exists(events_output_file):
            print(f"❌ Error: {events_output_file} was not created. Analysis may have failed.")
            return ""
            
        detected_events = extract_frames_with_comprehensive_output(
            video_path=video_path, 
            json_file=events_output_file, 
            output_folder=output_folder,
            max_retries=max_retries,
            batch_size=batch_size
        )
        
        # Step 3: Combine all data into comprehensive structure
        print("🔗 Step 3: Creating comprehensive analysis report...")
        comprehensive_data = create_comprehensive_analysis(incident_data, detected_events)
        
        # Save comprehensive analysis
        with open(output_json, "w", encoding="utf-8") as f:
            json.dump(comprehensive_data, f, ensure_ascii=False, indent=2)
        
        print("✅ Frame extraction completed successfully!")
        print("="*60)
        print(f"🎉 Comprehensive AI analysis completed! Check:")
        print(f"   📄 Complete analysis: {output_json}")
        print(f"   📁 Extracted frames: {output_folder}/")
        
        return comprehensive_data
        
    except Exception as e:
        print(f"❌ AI analysis failed: {str(e)}")
        return ""


# if __name__ == '__main__':
#     # Example usage - you can modify these parameters as needed
#     video_file_path = "data/uploads/videos/fight.mp4" 
    
#     # Run the comprehensive analysis
#     output_file = run_full_ai_analysis(
#         video_path=video_file_path,
#         address=address,
#         output_json="comprehensive_analysis.json",
#         output_folder="extracted_frames",
#         max_retries=3,
#         batch_size=2
#     )
    
#     if output_file:
#         print(f"✅ Comprehensive analysis completed successfully! Output: {output_file}")
#     else:
#         print("❌ Analysis failed. Check the logs above for details.")