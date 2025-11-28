#!/usr/bin/env python3
"""
Migration script to add latitude and longitude columns to incidents table
This fixes the issue where incident GPS coordinates from mobile reports were not being saved
"""

import psycopg2
from dotenv import load_dotenv
import os

def add_incident_coordinates():
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
        # Check if columns already exist
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='incidents' AND column_name IN ('latitude', 'longitude');
        """)
        existing_columns = [row[0] for row in cur.fetchall()]

        if 'latitude' in existing_columns and 'longitude' in existing_columns:
            print("✅ Columns latitude and longitude already exist in incidents table")
            return

        print("📋 Adding latitude and longitude columns to incidents table...")

        if 'latitude' not in existing_columns:
            cur.execute("""
                ALTER TABLE incidents
                ADD COLUMN latitude DOUBLE PRECISION;
            """)
            print("✅ Added latitude column")

        if 'longitude' not in existing_columns:
            cur.execute("""
                ALTER TABLE incidents
                ADD COLUMN longitude DOUBLE PRECISION;
            """)
            print("✅ Added longitude column")

        # Add address column too (for reverse geocoding)
        cur.execute("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='incidents' AND column_name='address';
        """)
        has_address = cur.fetchone()

        if not has_address:
            cur.execute("""
                ALTER TABLE incidents
                ADD COLUMN address TEXT;
            """)
            print("✅ Added address column")

        # Create indexes for location-based queries
        print("📋 Creating indexes for location columns...")
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_incidents_location ON incidents(latitude, longitude);
        """)
        print("✅ Created location index")

        print("\n🎉 Migration completed successfully!")
        print("   Incidents table now has latitude, longitude, and address columns")

    except Exception as e:
        print(f"❌ Error during migration: {e}")
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    add_incident_coordinates()
