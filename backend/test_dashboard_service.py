"""
Test script to check if dashboard service can retrieve data from database
"""
import sys
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    from models.db_helper import get_all_incidents_from_db, get_db_connection
    from services.dashboard import get_incidents_summary_service, get_incident_by_id_service
    
    print("=" * 60)
    print("Testing Database Connection and Dashboard Service")
    print("=" * 60)
    
    # Test 1: Check database connection
    print("\n1. Testing database connection...")
    try:
        conn = get_db_connection()
        print("   ✅ Database connection successful")
        conn.close()
    except Exception as e:
        print(f"   ❌ Database connection failed: {str(e)}")
        sys.exit(1)
    
    # Test 2: Check if we can query incidents
    print("\n2. Testing get_all_incidents_from_db()...")
    try:
        incidents = get_all_incidents_from_db()
        print(f"   ✅ Retrieved {len(incidents)} incidents from database")
        
        if len(incidents) > 0:
            print(f"\n   Sample incident keys: {list(incidents[0].keys())}")
            print(f"   First incident ID: {incidents[0].get('incident_id', 'N/A')}")
            print(f"   First incident title: {incidents[0].get('title', 'N/A')}")
        else:
            print("   ⚠️  No incidents found in database")
    except Exception as e:
        print(f"   ❌ Error getting incidents: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Test 3: Test dashboard service
    print("\n3. Testing get_incidents_summary_service()...")
    try:
        result = get_incidents_summary_service()
        print(f"   Status: {result.get('status')}")
        print(f"   Message: {result.get('message')}")
        print(f"   Total incidents: {result.get('total_incidents')}")
        
        if result.get('status') == 'success' and result.get('incidents'):
            print(f"\n   ✅ Service working correctly")
            print(f"   Sample incident from service:")
            sample = result['incidents'][0]
            print(f"      - ID: {sample.get('incident_id')}")
            print(f"      - Title: {sample.get('title')}")
            print(f"      - Category: {sample.get('category')}")
            print(f"      - Status: {sample.get('status')}")
        elif result.get('status') == 'error':
            print(f"   ❌ Service returned error: {result.get('message')}")
        else:
            print(f"   ⚠️  Service returned empty result")
    except Exception as e:
        print(f"   ❌ Service error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Test 4: If we have incidents, test getting one by ID
    if incidents and len(incidents) > 0:
        print("\n4. Testing get_incident_by_id_service()...")
        try:
            test_id = incidents[0]['incident_id']
            print(f"   Testing with incident ID: {test_id}")
            
            result = get_incident_by_id_service(test_id)
            print(f"   ✅ Retrieved incident details")
            print(f"   Status: {result.get('status')}")
            print(f"   Has incident_info: {'incident_info' in result}")
            
            if 'incident_info' in result:
                info = result['incident_info']
                print(f"   Incident info keys: {list(info.keys())}")
        except Exception as e:
            print(f"   ❌ Error: {str(e)}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "=" * 60)
    print("Test completed!")
    print("=" * 60)
    
except ImportError as e:
    print(f"❌ Import error: {str(e)}")
    print("Make sure you're running this from the backend directory")
    sys.exit(1)
except Exception as e:
    print(f"❌ Unexpected error: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

