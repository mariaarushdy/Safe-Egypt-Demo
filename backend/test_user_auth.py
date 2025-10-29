"""
Test script for the user authentication system
Run this after setting up the database to verify everything works
"""

import psycopg2
import sys
import os

# Add parent directory to path to import services
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.auth import UserService, AuthService
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


def test_auth_system():
    """Run comprehensive authentication system tests"""
    print("=" * 60)
    print("Testing User Authentication System")
    print("=" * 60)
    
    conn = get_db_connection()
    user_service = UserService(conn)
    
    # Test 1: Verify default admin exists
    print("\n[Test 1] Verifying default admin user...")
    try:
        admin = user_service.authenticate_user("admin", "Admin@123", "dashboard")
        if admin:
            print(f"✅ Admin user exists and can authenticate")
            print(f"   Username: {admin['username']}")
            print(f"   Email: {admin['email']}")
            print(f"   Role: {admin['role']}")
            print(f"   User Type: {admin['user_type']}")
        else:
            print("❌ Admin authentication failed")
            print("   Make sure you ran setup_db.py first!")
            conn.close()
            return
    except Exception as e:
        print(f"❌ Error: {e}")
        conn.close()
        return
    
    # Test 2: Create a mobile user
    print("\n[Test 2] Creating a mobile user...")
    try:
        # First, try to clean up if user already exists
        try:
            cur = conn.cursor()
            cur.execute("DELETE FROM users WHERE username = 'test_mobile_user';")
            conn.commit()
            cur.close()
        except:
            pass
        
        mobile_user = user_service.create_mobile_user(
            username="test_mobile_user",
            email="mobile@test.com",
            password="MobilePass123!",
            full_name="Test Mobile User",
            phone_number="+201234567890"
        )
        print(f"✅ Mobile user created successfully")
        print(f"   ID: {mobile_user['id']}")
        print(f"   Username: {mobile_user['username']}")
        print(f"   Email: {mobile_user['email']}")
        print(f"   User Type: {mobile_user['user_type']}")
        print(f"   Role: {mobile_user['role']}")
    except Exception as e:
        print(f"❌ Failed to create mobile user: {e}")
        conn.close()
        return
    
    # Test 3: Authenticate mobile user
    print("\n[Test 3] Authenticating mobile user...")
    try:
        user = user_service.authenticate_user(
            "test_mobile_user",
            "MobilePass123!",
            "mobile"
        )
        if user:
            print(f"✅ Mobile user authentication successful")
            print(f"   Verified: {user['is_verified']}")
        else:
            print("❌ Mobile user authentication failed")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 4: Generate JWT tokens
    print("\n[Test 4] Generating JWT tokens...")
    try:
        tokens = AuthService.create_user_tokens(
            user_id=mobile_user['id'],
            username=mobile_user['username'],
            email=mobile_user['email'],
            user_type=mobile_user['user_type'],
            role=mobile_user['role']
        )
        print(f"✅ Tokens generated successfully")
        print(f"   Access Token: {tokens['access_token'][:50]}...")
        print(f"   Refresh Token: {tokens['refresh_token'][:50]}...")
        print(f"   Token Type: {tokens['token_type']}")
        
        # Store token for next test
        access_token = tokens['access_token']
    except Exception as e:
        print(f"❌ Failed to generate tokens: {e}")
        conn.close()
        return
    
    # Test 5: Verify JWT token
    print("\n[Test 5] Verifying JWT token...")
    try:
        payload = AuthService.verify_token(access_token)
        if payload:
            print(f"✅ Token verified successfully")
            print(f"   User ID: {payload['user_id']}")
            print(f"   Username: {payload['username']}")
            print(f"   User Type: {payload['user_type']}")
            print(f"   Role: {payload['role']}")
        else:
            print("❌ Token verification failed")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 6: Create dashboard operator
    print("\n[Test 6] Creating a dashboard operator...")
    try:
        # Clean up if exists
        try:
            cur = conn.cursor()
            cur.execute("DELETE FROM users WHERE username = 'test_operator';")
            conn.commit()
            cur.close()
        except:
            pass
        
        operator = user_service.create_dashboard_user(
            username="test_operator",
            email="operator@test.com",
            password="OperatorPass123!",
            full_name="Test Operator",
            role="operator"
        )
        print(f"✅ Dashboard operator created successfully")
        print(f"   Username: {operator['username']}")
        print(f"   Email: {operator['email']}")
        print(f"   User Type: {operator['user_type']}")
        print(f"   Role: {operator['role']}")
        print(f"   Auto-verified: {operator.get('is_active', False)}")
    except Exception as e:
        print(f"❌ Failed to create operator: {e}")
    
    # Test 7: Test wrong password
    print("\n[Test 7] Testing wrong password...")
    try:
        user = user_service.authenticate_user(
            "test_mobile_user",
            "WrongPassword123!",
            "mobile"
        )
        if user:
            print("❌ Authentication should have failed with wrong password")
        else:
            print("✅ Correctly rejected wrong password")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 8: Test user type restriction
    print("\n[Test 8] Testing user type restriction...")
    try:
        # Try to login mobile user as dashboard user
        user = user_service.authenticate_user(
            "test_mobile_user",
            "MobilePass123!",
            "dashboard"  # Wrong user type
        )
        if user:
            print("❌ Should not authenticate mobile user as dashboard")
        else:
            print("✅ Correctly rejected wrong user type")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Test 9: Change password
    print("\n[Test 9] Testing password change...")
    try:
        success = user_service.change_password(
            user_id=mobile_user['id'],
            old_password="MobilePass123!",
            new_password="NewMobilePass456!"
        )
        if success:
            print("✅ Password changed successfully")
            
            # Try to authenticate with new password
            user = user_service.authenticate_user(
                "test_mobile_user",
                "NewMobilePass456!",
                "mobile"
            )
            if user:
                print("✅ Authentication with new password successful")
            else:
                print("❌ Authentication with new password failed")
        else:
            print("❌ Password change failed")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    # Clean up test users
    print("\n[Cleanup] Removing test users...")
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM users WHERE username IN ('test_mobile_user', 'test_operator');")
        conn.commit()
        cur.close()
        print("✅ Test users cleaned up")
    except Exception as e:
        print(f"⚠️  Warning: Could not clean up test users: {e}")
    
    conn.close()
    
    print("\n" + "=" * 60)
    print("✅ All authentication tests completed!")
    print("=" * 60)
    print("\n⚠️  Remember to:")
    print("   1. Change the default admin password (Admin@123)")
    print("   2. Add your SECRET_KEY to .env file")
    print("   3. Install required packages: pip install -r requirements.txt")
    print()


if __name__ == "__main__":
    try:
        test_auth_system()
    except Exception as e:
        print(f"\n❌ Test failed with error: {e}")
        import traceback
        traceback.print_exc()

