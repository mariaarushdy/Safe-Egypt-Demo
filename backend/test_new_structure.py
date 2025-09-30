#!/usr/bin/env python3
"""
Test script for the new backend structure
"""
import requests
import json
import sys

def test_api():
    """Test the new API structure"""
    base_url = "http://localhost:8000"
    
    print("Testing new backend structure...")
    print("=" * 50)
    
    # Test root endpoint
    try:
        response = requests.get(f"{base_url}/")
        print(f"✅ Root endpoint: {response.status_code}")
        print(f"   Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"❌ Root endpoint failed: {e}")
        return False
    
    # Test mobile health endpoint
    try:
        response = requests.get(f"{base_url}/api/mobile/health")
        print(f"✅ Mobile health endpoint: {response.status_code}")
        print(f"   Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"❌ Mobile health endpoint failed: {e}")
    
    # Test formatted incidents endpoint
    try:
        response = requests.get(f"{base_url}/api/mobile/incidents/formatted")
        print(f"✅ Formatted incidents endpoint: {response.status_code}")
        print(f"   Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"❌ Formatted incidents endpoint failed: {e}")
    
    # Test location endpoint
    try:
        response = requests.get(f"{base_url}/api/mobile/location/30.0444/31.2357")
        print(f"✅ Location endpoint: {response.status_code}")
        print(f"   Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"❌ Location endpoint failed: {e}")
    
    # Test dashboard endpoint
    try:
        response = requests.get(f"{base_url}/api/dashboard/")
        print(f"✅ Dashboard endpoint: {response.status_code}")
        print(f"   Response: {json.dumps(response.json(), indent=2)}")
    except Exception as e:
        print(f"❌ Dashboard endpoint failed: {e}")
    
    print("=" * 50)
    print("Testing complete!")
    return True

if __name__ == "__main__":
    test_api()
