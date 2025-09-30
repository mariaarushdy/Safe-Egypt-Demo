import requests
import datetime

# Endpoint URL
url = "http://127.0.0.1:8000/upload-media"  # change to your server/ngrok URL

# Example metadata
data = {
    "latitude": "30.0444",
    "longitude": "31.2357",
    "description": "A fight happened in the street.",
    "incident_type": "Violence",
    "is_anonymous": "true",
    "timestamp": datetime.datetime.utcnow().isoformat()
}

# Attach file(s)
files = {
    "file_0": ("data/uploads/videos/fight.mp4", open("data/uploads/videos/fight.mp4", "rb"), "video/mp4"),
}
# Extra file metadata
data["file_0_type"] = "video"
data["file_0_name"] = "test.mp4"

# Optional second file example:
# files["file_1"] = ("video.mp4", open("video.mp4", "rb"), "video/mp4")
# data["file_1_type"] = "video"
# data["file_1_name"] = "video.mp4"

# Send request
response = requests.post(url, data=data, files=files)

print("Status Code:", response.status_code)
try:
    print("Response JSON:", response.json())
except Exception:
    print("Response Text:", response.text)
