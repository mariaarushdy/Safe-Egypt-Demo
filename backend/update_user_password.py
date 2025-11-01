"""
Update existing dashboard user passwords to bcrypt format
This script will:
1. Show all existing users in dashboard_users table
2. Allow you to update their password to bcrypt format
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import bcrypt
from models.db_helper import get_db_connection

def list_users():
    """List all dashboard users"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT id, username, full_name, is_active FROM dashboard_users ORDER BY id;")
        users = cur.fetchall()
        
        print("\n=== Existing Dashboard Users ===")
        if not users:
            print("No users found in database")
            return []
        
        for user in users:
            user_id, username, full_name, is_active = user
            status = "Active" if is_active else "Inactive"
            print(f"ID: {user_id} | Username: {username} | Name: {full_name} | Status: {status}")
        
        return users
        
    except Exception as e:
        print(f"Error listing users: {str(e)}")
        return []
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

def update_user_password(username, new_password):
    """Update a user's password with bcrypt hash"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check if user exists
        cur.execute("SELECT id, username FROM dashboard_users WHERE username = %s;", (username,))
        user = cur.fetchone()
        
        if not user:
            print(f"User '{username}' not found!")
            return False
        
        # Hash the new password with bcrypt
        salt = bcrypt.gensalt()
        password_hash = bcrypt.hashpw(new_password.encode('utf-8'), salt).decode('utf-8')
        
        # Update the password
        cur.execute("""
            UPDATE dashboard_users 
            SET password_hash = %s 
            WHERE username = %s;
        """, (password_hash, username))
        
        conn.commit()
        print(f"\n✓ Password updated successfully for user '{username}'")
        print(f"  New password: {new_password}")
        return True
        
    except Exception as e:
        print(f"Error updating password: {str(e)}")
        return False
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

if __name__ == "__main__":
    print("=== Dashboard User Password Updater ===\n")
    
    # List existing users
    users = list_users()
    
    if not users:
        print("\nNo users to update. Exiting.")
        sys.exit(0)
    
    print("\n" + "="*50)
    print("Enter the username and new password to update:")
    print("="*50)
    
    username = input("\nUsername: ").strip()
    if not username:
        print("No username provided. Exiting.")
        sys.exit(0)
    
    new_password = input("New password: ").strip()
    if not new_password:
        print("No password provided. Exiting.")
        sys.exit(0)
    
    # Update the password
    success = update_user_password(username, new_password)
    
    if success:
        print(f"\n✓ You can now login with:")
        print(f"  Username: {username}")
        print(f"  Password: {new_password}")
    else:
        print("\n✗ Failed to update password")
