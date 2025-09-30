#!/usr/bin/env python3
"""
Test script for the incident status update endpoint
"""

import requests
import json

# Base URL for the API
BASE_URL = "http://localhost:8000"

def test_status_update():
    """Test the incident status update endpoint"""
    
    # Get an incident ID from the analysed_incidents.json file
    try:
        with open('data/analysed_incidents.json', 'r', encoding='utf-8') as file:
            incidents = json.load(file)
        
        if not incidents:
            print("No incidents found in analysed_incidents.json")
            return
        
        # Get the first incident ID for testing
        incident_id = incidents[0]["incident_id"]
        original_status = incidents[0]["status"]
        
        print(f"Testing status update for incident: {incident_id}")
        print(f"Original status: {original_status}")
        print("-" * 50)
        
        # Test updating status to "accepted"
        print("1. Testing status update to 'accepted'...")
        response = requests.post(
            f"{BASE_URL}/api/dashboard/incident/{incident_id}/status",
            json={"status": "accepted"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Success!")
            print(f"   Response: {result['message']}")
            print(f"   New Status: {result['new_status']}")
        else:
            print(f"❌ Failed: {response.status_code} - {response.text}")
        
        print()
        
        # Test updating status to "rejected"
        print("2. Testing status update to 'rejected'...")
        response = requests.post(
            f"{BASE_URL}/api/dashboard/incident/{incident_id}/status",
            json={"status": "rejected"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print("✅ Success!")
            print(f"   Response: {result['message']}")
            print(f"   New Status: {result['new_status']}")
        else:
            print(f"❌ Failed: {response.status_code} - {response.text}")
        
        print()
        
        # Test invalid status
        print("3. Testing invalid status (should fail)...")
        response = requests.post(
            f"{BASE_URL}/api/dashboard/incident/{incident_id}/status",
            json={"status": "invalid_status"}
        )
        
        if response.status_code == 422:
            print("✅ Validation failed as expected!")
            print(f"   Response: {response.json()}")
        else:
            print(f"❌ Unexpected response: {response.status_code} - {response.text}")
        
        print()
        
        # Test invalid incident ID
        print("4. Testing invalid incident ID (should fail)...")
        response = requests.post(
            f"{BASE_URL}/api/dashboard/incident/invalid-id/status",
            json={"status": "accepted"}
        )
        
        if response.status_code == 404:
            print("✅ Failed as expected (incident not found)!")
            error = response.json()
            print(f"   Response: {error['detail']}")
        else:
            print(f"❌ Unexpected response: {response.status_code} - {response.text}")
        
    except FileNotFoundError:
        print("❌ analysed_incidents.json file not found")
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to API server. Make sure it's running at http://localhost:8000")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def test_endpoint_documentation():
    """Test that the endpoint appears in API documentation"""
    print("Testing API documentation...")
    try:
        response = requests.get(f"{BASE_URL}/api/dashboard/")
        if response.status_code == 200:
            data = response.json()
            endpoints = data.get("available_endpoints", [])
            
            status_endpoint_found = any("status" in endpoint for endpoint in endpoints)
            if status_endpoint_found:
                print("✅ Status update endpoint found in documentation!")
                for endpoint in endpoints:
                    if "status" in endpoint:
                        print(f"   {endpoint}")
            else:
                print("❌ Status update endpoint not found in documentation")
        else:
            print(f"❌ Could not get documentation: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to API server")

if __name__ == "__main__":
    print("🧪 Testing Incident Status Update Endpoint")
    print("=" * 50)
    
    test_endpoint_documentation()
    print()
    test_status_update()
    
    print("\n" + "=" * 50)
    print("Test completed!")
    print("\nTo manually test the endpoint:")
    print("curl -X POST http://localhost:8000/api/dashboard/incident/{incident_id}/status \\")
    print('     -H "Content-Type: application/json" \\')
    print('     -d \'{"status": "accepted"}\'')


