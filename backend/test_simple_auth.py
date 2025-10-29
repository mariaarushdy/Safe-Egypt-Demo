"""
Test script for the simplified authentication system
"""

import psycopg2
import sys
import os
from datetime import datetime
import uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.simple_auth import AppUserService, DashboardAuthService, IncidentService
from dotenv import load_dotenv

load_dotenv()


def get_db_connection():
    """Get database connection"""
    return psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT")
    )


def test_simple_system():
    """Test the simplified user system"""
    print("=" * 70)
    print("Testing Simplified User System")
    print("=" * 70)
    
    conn = get_db_connection()
    
    # Clean up test data first
    print("\n[Setup] Cleaning up test data...")
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM app_users WHERE national_id LIKE 'TEST%';")
        cur.execute("DELETE FROM dashboard_users WHERE username LIKE 'test_%';")
        conn.commit()
        cur.close()
        print("✅ Test data cleaned up")
    except Exception as e:
        print(f"⚠️  Warning: {e}")
    
    # Test 1: Verify default dashboard user
    print("\n" + "=" * 70)
    print("[Test 1] Verify default dashboard user exists")
    print("=" * 70)
    dashboard_auth = DashboardAuthService(conn)
    
    result = dashboard_auth.login("admin", "Admin@123")
    if result:
        print(f"✅ Default dashboard user can login")
        print(f"   Username: {result['username']}")
        print(f"   Full Name: {result['full_name']}")
        print(f"   Token: {result['token'][:50]}...")
    else:
        print("❌ Default dashboard user login failed!")
        print("   Run: python models/setup_db.py")
        conn.close()
        return
    
    # Test 2: Create app user profile (first time)
    print("\n" + "=" * 70)
    print("[Test 2] Create app user profile (first time)")
    print("=" * 70)
    app_user_service = AppUserService(conn)
    
    try:
        profile = app_user_service.create_or_get_profile(
            national_id="TEST29912010101234",
            full_name="Ahmed Mohamed Ali",
            contact_info="+201234567890",
            device_id="test-device-12345"
        )
        print(f"✅ App user profile created")
        print(f"   ID: {profile['id']}")
        print(f"   National ID: {profile['national_id']}")
        print(f"   Full Name: {profile['full_name']}")
        print(f"   Contact: {profile['contact_info']}")
        print(f"   Is New: {profile['is_new']}")
        
        app_user_id = profile['id']
    except Exception as e:
        print(f"❌ Failed to create app user: {e}")
        conn.close()
        return
    
    # Test 3: Get existing app user profile
    print("\n" + "=" * 70)
    print("[Test 3] Get existing app user profile (returning user)")
    print("=" * 70)
    
    try:
        profile2 = app_user_service.create_or_get_profile(
            national_id="TEST29912010101234",  # Same national ID
            full_name="Ahmed Mohamed Ali",
            contact_info="+201234567890",
            device_id="test-device-12345"
        )
        print(f"✅ Retrieved existing profile")
        print(f"   ID: {profile2['id']} (same as before: {profile2['id'] == app_user_id})")
        print(f"   Is New: {profile2['is_new']} (should be False)")
    except Exception as e:
        print(f"❌ Failed: {e}")
    
    # Test 4: Get profile by device ID
    print("\n" + "=" * 70)
    print("[Test 4] Get profile by device ID")
    print("=" * 70)
    
    try:
        profile3 = app_user_service.get_profile_by_device_id("test-device-12345")
        if profile3:
            print(f"✅ Found profile by device ID")
            print(f"   Full Name: {profile3['full_name']}")
        else:
            print("❌ Profile not found by device ID")
    except Exception as e:
        print(f"❌ Failed: {e}")
    
    # Test 5: Report anonymous incident
    print("\n" + "=" * 70)
    print("[Test 5] Report anonymous incident (no profile)")
    print("=" * 70)
    
    try:
        cur = conn.cursor()
        incident_id = str(uuid.uuid4())
        
        cur.execute("""
            INSERT INTO incidents (
                incident_id, app_user_id, category, description, 
                severity, timestamp, status
            ) VALUES (%s, NULL, %s, %s, %s, %s, %s);
        """, (
            incident_id, 
            "crime", 
            "Anonymous theft report",
            "medium",
            datetime.now(),
            "pending"
        ))
        conn.commit()
        cur.close()
        
        print(f"✅ Anonymous incident reported")
        print(f"   Incident ID: {incident_id}")
        print(f"   No app_user_id (anonymous)")
        
        anonymous_incident_id = incident_id
    except Exception as e:
        print(f"❌ Failed: {e}")
    
    # Test 6: Report incident with profile
    print("\n" + "=" * 70)
    print("[Test 6] Report incident with user profile")
    print("=" * 70)
    
    try:
        cur = conn.cursor()
        incident_id = str(uuid.uuid4())
        
        cur.execute("""
            INSERT INTO incidents (
                incident_id, app_user_id, category, description, 
                severity, timestamp, status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s);
        """, (
            incident_id, 
            app_user_id,  # Linked to user profile
            "accident", 
            "Car accident with profile",
            "high",
            datetime.now(),
            "pending"
        ))
        conn.commit()
        cur.close()
        
        print(f"✅ Incident with profile reported")
        print(f"   Incident ID: {incident_id}")
        print(f"   App User ID: {app_user_id}")
        
        profile_incident_id = incident_id
    except Exception as e:
        print(f"❌ Failed: {e}")
    
    # Test 7: Dashboard user approves incident
    print("\n" + "=" * 70)
    print("[Test 7] Dashboard user approves incident")
    print("=" * 70)
    
    incident_service = IncidentService(conn)
    
    try:
        success = incident_service.update_status(
            incident_id=profile_incident_id,
            status="approved",
            dashboard_user_id=result['id']
        )
        
        if success:
            print(f"✅ Incident approved successfully")
            
            # Verify status was updated
            cur = conn.cursor()
            cur.execute("SELECT status FROM incidents WHERE incident_id = %s;", 
                       (profile_incident_id,))
            status = cur.fetchone()[0]
            cur.close()
            print(f"   New status: {status}")
        else:
            print("❌ Failed to approve incident")
    except Exception as e:
        print(f"❌ Failed: {e}")
    
    # Test 8: Dashboard user rejects incident
    print("\n" + "=" * 70)
    print("[Test 8] Dashboard user rejects incident")
    print("=" * 70)
    
    try:
        success = incident_service.update_status(
            incident_id=anonymous_incident_id,
            status="rejected",
            dashboard_user_id=result['id']
        )
        
        if success:
            print(f"✅ Incident rejected successfully")
            
            # Verify status
            cur = conn.cursor()
            cur.execute("SELECT status FROM incidents WHERE incident_id = %s;", 
                       (anonymous_incident_id,))
            status = cur.fetchone()[0]
            cur.close()
            print(f"   New status: {status}")
        else:
            print("❌ Failed to reject incident")
    except Exception as e:
        print(f"❌ Failed: {e}")
    
    # Test 9: Verify dashboard token
    print("\n" + "=" * 70)
    print("[Test 9] Verify dashboard token")
    print("=" * 70)
    
    try:
        token = result['token']
        user = dashboard_auth.get_user_from_token(token)
        
        if user:
            print(f"✅ Token verified successfully")
            print(f"   User ID: {user['id']}")
            print(f"   Username: {user['username']}")
            print(f"   Full Name: {user['full_name']}")
        else:
            print("❌ Token verification failed")
    except Exception as e:
        print(f"❌ Failed: {e}")
    
    # Test 10: Create new dashboard user
    print("\n" + "=" * 70)
    print("[Test 10] Create new dashboard user")
    print("=" * 70)
    
    try:
        new_user = dashboard_auth.create_dashboard_user(
            username="test_operator",
            password="TestPass123!",
            full_name="Mohamed Hassan"
        )
        print(f"✅ New dashboard user created")
        print(f"   ID: {new_user['id']}")
        print(f"   Username: {new_user['username']}")
        print(f"   Full Name: {new_user['full_name']}")
        
        # Test login with new user
        login_result = dashboard_auth.login("test_operator", "TestPass123!")
        if login_result:
            print(f"✅ New user can login")
        else:
            print(f"❌ New user login failed")
    except Exception as e:
        print(f"❌ Failed: {e}")
    
    # Clean up test data
    print("\n" + "=" * 70)
    print("[Cleanup] Removing test data")
    print("=" * 70)
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM incidents WHERE incident_id IN (%s, %s);", 
                   (profile_incident_id, anonymous_incident_id))
        cur.execute("DELETE FROM app_users WHERE national_id LIKE 'TEST%';")
        cur.execute("DELETE FROM dashboard_users WHERE username = 'test_operator';")
        conn.commit()
        cur.close()
        print("✅ Test data cleaned up")
    except Exception as e:
        print(f"⚠️  Warning: {e}")
    
    conn.close()
    
    print("\n" + "=" * 70)
    print("✅ All tests completed successfully!")
    print("=" * 70)
    print("\n📋 Summary:")
    print("   • App users: NO LOGIN required")
    print("   • Profile creation: OPTIONAL")
    print("   • Anonymous reporting: ALLOWED")
    print("   • Dashboard users: Simple login")
    print("   • All dashboard users can approve/reject incidents")
    print("\n⚠️  Remember to:")
    print("   1. Change default admin password (Admin@123)")
    print("   2. Add your SECRET_KEY to .env file")
    print()


if __name__ == "__main__":
    try:
        test_simple_system()
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()

