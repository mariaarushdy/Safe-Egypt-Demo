#!/usr/bin/env python3
"""
Migration script to update the incident status check constraint
to allow 'accepted' and 'rejected' statuses.
"""

import psycopg2
from dotenv import load_dotenv
import os

def migrate_status_constraint():
    load_dotenv()

    DB_NAME = os.getenv("DB_NAME")
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_HOST = os.getenv("DB_HOST")
    DB_PORT = os.getenv("DB_PORT")

    print("🔄 Connecting to database...")
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    conn.autocommit = True
    cur = conn.cursor()

    try:
        print("📋 Dropping old check constraint...")
        cur.execute("""
            ALTER TABLE incidents
            DROP CONSTRAINT IF EXISTS check_status;
        """)
        print("✅ Old constraint dropped")

        print("📋 Adding new check constraint with accepted/rejected...")
        cur.execute("""
            ALTER TABLE incidents
            ADD CONSTRAINT check_status
            CHECK (status IN ('pending', 'under_review', 'investigating', 'resolved', 'closed', 'accepted', 'rejected'));
        """)
        print("✅ New constraint added")

        print("\n🎉 Migration completed successfully!")
        print("   Allowed statuses: pending, under_review, investigating, resolved, closed, accepted, rejected")

    except Exception as e:
        print(f"❌ Error during migration: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    migrate_status_constraint()
