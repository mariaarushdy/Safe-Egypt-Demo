import psycopg2
from psycopg2 import sql
import json
from dotenv import load_dotenv
import os
import uuid
from datetime import datetime

def setup_database():
    load_dotenv()
    DB_NAME = os.getenv("DB_NAME")
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_HOST = os.getenv("DB_HOST")
    DB_PORT = os.getenv("DB_PORT")

    # === 1️⃣ CONNECT TO POSTGRES DEFAULT DATABASE ===
    # Connect to the default 'postgres' database first to create our target database
    conn = psycopg2.connect(
        dbname="postgres",  # Connect to default postgres database
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    conn.autocommit = True
    cur = conn.cursor()

    # === 2️⃣ CHECK IF DATABASE EXISTS ===
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (DB_NAME,))
    exists = cur.fetchone()

    if not exists:
        print(f"📦 Database '{DB_NAME}' not found. Creating it...")
        cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(DB_NAME)))
    else:
        print(f"✅ Database '{DB_NAME}' already exists.")

    cur.close()
    conn.close()

    # === 3️⃣ CONNECT TO YOUR DATABASE ===
    conn = psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    conn.autocommit = True
    cur = conn.cursor()

    # === 4️⃣ FUNCTION TO CHECK AND CREATE TABLES ===
    def create_table_if_not_exists(name, create_sql):
        cur.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = %s
            );
        """, (name,))
        exists = cur.fetchone()[0]

        if not exists:
            print(f"🧱 Creating table '{name}'...")
            cur.execute(create_sql)
        else:
            print(f"✅ Table '{name}' already exists.")

    # === 5️⃣ CREATE TABLES ===

    # App Users table (for mobile app - NO LOGIN REQUIRED)
    # device_id is the primary identifier (always present)
    # national_id, full_name, contact_info are NULL for anonymous users
    create_table_if_not_exists("app_users", """
    CREATE TABLE app_users (
        id SERIAL PRIMARY KEY,
        device_id VARCHAR(255) UNIQUE NOT NULL,
        national_id VARCHAR(50) UNIQUE,
        full_name VARCHAR(255),
        contact_info VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Create indexes for app_users table
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_app_users_device_id ON app_users(device_id);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_app_users_national_id ON app_users(national_id);
    """)
    
    # Dashboard Users table (simple login for dashboard only)
    create_table_if_not_exists("dashboard_users", """
    CREATE TABLE dashboard_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
    );
    """)
    
    # Create index for dashboard_users
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_dashboard_users_username ON dashboard_users(username);
    """)

    # Locations table
    create_table_if_not_exists("locations", """
    CREATE TABLE locations (
        id SERIAL PRIMARY KEY,
        address TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION
    );
    """)

    # Incidents table
    create_table_if_not_exists("incidents", """
    CREATE TABLE incidents (
        incident_id UUID PRIMARY KEY,
        app_user_id INT REFERENCES app_users(id) ON DELETE SET NULL,
        category TEXT,
        title TEXT,
        description TEXT,
        severity TEXT,
        verified TEXT,
        violence_type TEXT,
        weapon TEXT,
        site_description TEXT,
        number_of_people INT,
        description_of_people TEXT,
        detailed_description_for_the_incident TEXT,
        accident_type TEXT,
        vehicles_machines_involved TEXT,
        utility_type TEXT,
        extent_of_impact TEXT,
        duration TEXT,
        illegal_type TEXT,
        items_involved TEXT,
        detected_events JSONB,
        timestamp TIMESTAMP,
        status TEXT DEFAULT 'pending',
        location_id INT REFERENCES locations(id) ON DELETE SET NULL,
        real_files JSONB 
    );
    """)

    # Media files table
    create_table_if_not_exists("media_files", """
    CREATE TABLE media_files (
        id SERIAL PRIMARY KEY,
        incident_id UUID REFERENCES incidents(incident_id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        media_type TEXT DEFAULT 'video'
    );
    """)

    # === 6️⃣ CREATE DEFAULT DASHBOARD USER (if not exists) ===
    cur.execute("""
        SELECT EXISTS (
            SELECT FROM dashboard_users 
            WHERE username = 'admin'
        );
    """)
    admin_exists = cur.fetchone()[0]
    
    if not admin_exists:
        print("👤 Creating default dashboard user...")
        # Default password: Admin@123 (should be changed on first login)
        try:
            from werkzeug.security import generate_password_hash
            default_password_hash = generate_password_hash("Admin@123")
        except ImportError:
            import hashlib
            default_password_hash = hashlib.sha256("Admin@123".encode()).hexdigest()
        
        cur.execute("""
            INSERT INTO dashboard_users (username, password_hash, full_name, is_active)
            VALUES (%s, %s, %s, %s);
        """, (
            'admin',
            default_password_hash,
            'System Administrator',
            True
        ))
        print("✅ Default dashboard user created (username: admin, password: Admin@123)")
        print("⚠️  Please change the default password after first login!")
    else:
        print("✅ Dashboard admin user already exists.")

    cur.close()
    conn.close()
    
    print("🎉 Database and tables are ready.")
    print("✅ All done!")


if __name__ == "__main__":
    setup_database()
