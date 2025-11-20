"""
Create a dashboard user (admin/operator) in the database.

Usage (non-interactive):
  python models/create_dashboard_user.py --username maria --full-name "Maria Rushdy" --password "StrongPass123" --active

Usage (interactive prompts):
  python models/create_dashboard_user.py

This script uses bcrypt for password hashing and writes to the `dashboard_users` table.
"""

import os
import sys
import argparse
import getpass
import bcrypt
from typing import Optional

# Optional hardcoded defaults to bypass prompts (leave empty/None to keep prompts)
# Fill these to enter values directly in code.
DEFAULT_USERNAME: str = ""      
DEFAULT_FULL_NAME: str = ""     
DEFAULT_PASSWORD: str = ""     
# Set to True/False to force active flag; keep as None to show prompt
DEFAULT_ACTIVE: Optional[bool] = None

# Make sure we can import models.db_helper when running from repo root or backend/
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(CURRENT_DIR)
if BACKEND_DIR not in sys.path:
    sys.path.append(BACKEND_DIR)

from models.db_helper import get_db_connection  # noqa: E402


def create_dashboard_user(username: str, full_name: str, password: str, active: bool = True) -> int:
    """Insert a new dashboard user. Returns new user id."""
    conn = None
    cur = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Check for duplicate username
        cur.execute("SELECT id FROM dashboard_users WHERE username = %s;", (username,))
        if cur.fetchone():
            raise ValueError(f"Username '{username}' already exists")

        # Hash password with bcrypt
        salt = bcrypt.gensalt()
        password_hash = bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

        cur.execute(
            """
            INSERT INTO dashboard_users (username, full_name, password_hash, is_active, created_at)
            VALUES (%s, %s, %s, %s, NOW())
            RETURNING id;
            """,
            (username, full_name, password_hash, active),
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        return user_id
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()


def ensure_inputs(username: Optional[str], full_name: Optional[str], password: Optional[str], active_flag: Optional[bool]):
    """Prompt for missing inputs interactively."""
    if not username:
        if DEFAULT_USERNAME:
            print(f"Using default username: {DEFAULT_USERNAME}")
            username = DEFAULT_USERNAME
        else:
            username = input("Username: ").strip()
    if not full_name:
        if DEFAULT_FULL_NAME:
            print(f"Using default full name: {DEFAULT_FULL_NAME}")
            full_name = DEFAULT_FULL_NAME
        else:
            full_name = input("Full name (display name): ").strip()
            if not full_name:
                full_name = username
    if not password:
        if DEFAULT_PASSWORD:
            print("Using default password from code (be careful in production).")
            password = DEFAULT_PASSWORD
        else:
            # Use getpass for hidden input
            pw1 = getpass.getpass("Password: ")
            pw2 = getpass.getpass("Confirm Password: ")
            if pw1 != pw2:
                print("Passwords do not match. Aborting.")
                sys.exit(1)
            password = pw1
    if active_flag is None:
        if DEFAULT_ACTIVE is not None:
            active_flag = bool(DEFAULT_ACTIVE)
            print(f"Using default active flag: {active_flag}")
        else:
            resp = input("Active user? [Y/n]: ").strip().lower()
            active_flag = False if resp == "n" else True
    return username, full_name, password, active_flag


def main(argv=None):
    parser = argparse.ArgumentParser(description="Create a dashboard user")
    parser.add_argument("--username", dest="username", help="Unique username")
    parser.add_argument("--full-name", dest="full_name", help="Full/display name")
    parser.add_argument("--password", dest="password", help="Plain password (use with care)")
    parser.add_argument("--active", dest="active", action="store_true", help="Mark user as active (default)")
    parser.add_argument("--inactive", dest="inactive", action="store_true", help="Create as inactive user")

    args = parser.parse_args(argv)

    active_flag = True
    if args.inactive:
        active_flag = False
    elif args.active:
        active_flag = True
    else:
        # None indicates we'll prompt
        active_flag = None

    username, full_name, password, active_flag = ensure_inputs(
        args.username, args.full_name, args.password, active_flag
    )

    try:
        user_id = create_dashboard_user(username, full_name, password, active_flag)
        status = "active" if active_flag else "inactive"
        print(f"\n✓ Created dashboard user #{user_id} -> {username} ({status})")
    except ValueError as ve:
        print(f"\n✗ {ve}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Failed to create user: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
