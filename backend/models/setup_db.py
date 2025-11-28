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
    conn = psycopg2.connect(
        dbname="postgres",
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

    # === 5️⃣ CREATE MULTI-TENANT TABLES ===

    # Companies table - Root of multi-tenancy
    create_table_if_not_exists("companies", """
    CREATE TABLE companies (
        id SERIAL PRIMARY KEY,
        company_code VARCHAR(50) UNIQUE NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        industry_type VARCHAR(50) NOT NULL,
        contact_email VARCHAR(255),
        contact_phone VARCHAR(100),
        address TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Create index for company_code (used in authentication)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(company_code);
    """)

    # Sites table - Belongs to a company
    create_table_if_not_exists("sites", """
    CREATE TABLE sites (
        id SERIAL PRIMARY KEY,
        company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        site_name VARCHAR(255) NOT NULL,
        site_type VARCHAR(50) NOT NULL,
        site_code VARCHAR(50),
        address TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        manager_name VARCHAR(255),
        manager_contact VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_site_type CHECK (site_type IN ('petroleum', 'construction'))
    );
    """)

    # Create indexes for sites
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_sites_company ON sites(company_id);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_sites_type ON sites(site_type);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_sites_code ON sites(site_code);
    """)

    # Site Zones table - Zones within a site
    create_table_if_not_exists("site_zones", """
    CREATE TABLE site_zones (
        id SERIAL PRIMARY KEY,
        site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        zone_name VARCHAR(255) NOT NULL,
        zone_code VARCHAR(50),
        hazard_level VARCHAR(50) DEFAULT 'low',
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT check_hazard_level CHECK (hazard_level IN ('low', 'medium', 'high', 'critical'))
    );
    """)

    # Create index for site_zones
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_zones_site ON site_zones(site_id);
    """)

    # Workers table (replaces app_users) - Site workers with authentication
    create_table_if_not_exists("workers", """
    CREATE TABLE workers (
        id SERIAL PRIMARY KEY,
        company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        username VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        employee_id VARCHAR(100),
        device_id VARCHAR(255),
        contact_info VARCHAR(255),
        role VARCHAR(100),
        department VARCHAR(100),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        CONSTRAINT unique_worker_username_per_company UNIQUE (company_id, username)
    );
    """)

    # Create indexes for workers
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_workers_company ON workers(company_id);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_workers_username ON workers(company_id, username);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_workers_employee_id ON workers(employee_id);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_workers_device_id ON workers(device_id);
    """)

    # HSE Users table (replaces dashboard_users) - HSE team members
    create_table_if_not_exists("hse_users", """
    CREATE TABLE hse_users (
        id SERIAL PRIMARY KEY,
        company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        username VARCHAR(100) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(100) DEFAULT 'hse_officer',
        email VARCHAR(255),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP,
        CONSTRAINT unique_hse_username_per_company UNIQUE (company_id, username)
    );
    """)

    # Create indexes for hse_users
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_hse_company ON hse_users(company_id);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_hse_username ON hse_users(company_id, username);
    """)

    # Incidents table - Site safety incidents
    create_table_if_not_exists("incidents", """
    CREATE TABLE incidents (
        incident_id UUID PRIMARY KEY,
        company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        site_id INT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        zone_id INT REFERENCES site_zones(id) ON DELETE SET NULL,
        worker_id INT REFERENCES workers(id) ON DELETE SET NULL,

        -- Core incident fields
        category TEXT NOT NULL,
        title TEXT,
        description TEXT,
        severity TEXT,
        verified TEXT,
        site_type VARCHAR(50),

        -- Location fields (GPS coordinates from mobile reports)
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        address TEXT,

        -- Common fields (still relevant for industrial safety)
        site_description TEXT,
        number_of_people INT,
        description_of_people TEXT,
        detailed_description_for_the_incident TEXT,
        vehicles_machines_involved TEXT,
        extent_of_impact TEXT,
        duration TEXT,

        -- Petroleum-specific fields
        petroleum_type TEXT,
        substance_involved TEXT,
        equipment_id VARCHAR(100),
        spill_volume VARCHAR(100),
        environmental_impact TEXT,
        ppe_missing JSONB,

        -- Construction-specific fields
        construction_type TEXT,
        structure_affected TEXT,
        materials_involved TEXT,
        height_elevation VARCHAR(100),
        equipment_involved TEXT,

        -- AI analysis and metadata
        detected_events JSONB,
        timestamp TIMESTAMP NOT NULL,
        status TEXT DEFAULT 'pending',
        real_files JSONB,

        -- Tracking fields
        assigned_to INT REFERENCES hse_users(id) ON DELETE SET NULL,
        resolution_notes TEXT,
        corrective_actions JSONB,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT check_severity CHECK (severity IN ('Low', 'Medium', 'High')),
        CONSTRAINT check_status CHECK (status IN ('pending', 'under_review', 'investigating', 'resolved', 'closed', 'accepted', 'rejected'))
    );
    """)

    # Create indexes for incidents (critical for multi-tenant filtering and performance)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_incidents_company ON incidents(company_id);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_incidents_site ON incidents(site_id);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_incidents_zone ON incidents(zone_id);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_incidents_worker ON incidents(worker_id);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_incidents_timestamp ON incidents(timestamp DESC);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_incidents_site_type ON incidents(site_type);
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_incidents_location ON incidents(latitude, longitude);
    """)

    # Media files table (mostly unchanged)
    create_table_if_not_exists("media_files", """
    CREATE TABLE media_files (
        id SERIAL PRIMARY KEY,
        incident_id UUID REFERENCES incidents(incident_id) ON DELETE CASCADE,
        file_path TEXT NOT NULL,
        media_type TEXT DEFAULT 'video',
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Create index for media_files
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_media_incident ON media_files(incident_id);
    """)

    # === 6️⃣ CREATE SAMPLE COMPANIES AND DATA ===
    print("\n📋 Checking for sample data...")

    # Check if sample companies exist
    cur.execute("SELECT COUNT(*) FROM companies;")
    company_count = cur.fetchone()[0]

    if company_count == 0:
        print("🏢 Creating sample companies...")
        try:
            from werkzeug.security import generate_password_hash

            # Sample Company 1: Petroleum
            cur.execute("""
                INSERT INTO companies (company_code, company_name, industry_type, contact_email, is_active)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id;
            """, (
                'PETRO001',
                'Egypt Petroleum Corporation',
                'petroleum',
                'contact@egyptpetro.com',
                True
            ))
            petro_company_id = cur.fetchone()[0]

            # Sample Company 2: Construction
            cur.execute("""
                INSERT INTO companies (company_code, company_name, industry_type, contact_email, is_active)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id;
            """, (
                'CONST001',
                'Cairo Construction Ltd',
                'construction',
                'info@cairoconst.com',
                True
            ))
            const_company_id = cur.fetchone()[0]

            print(f"✅ Created sample companies (PETRO001, CONST001)")

            # Create sample sites for petroleum company
            cur.execute("""
                INSERT INTO sites (company_id, site_name, site_type, site_code, address, latitude, longitude)
                VALUES
                    (%s, %s, %s, %s, %s, %s, %s),
                    (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
            """, (
                petro_company_id, 'Suez Refinery', 'petroleum', 'SR-001', 'Suez, Egypt', 29.9668, 32.5498,
                petro_company_id, 'Alexandria Drilling Site', 'petroleum', 'AD-002', 'Alexandria, Egypt', 31.2001, 29.9187
            ))

            # Create sample sites for construction company
            cur.execute("""
                INSERT INTO sites (company_id, site_name, site_type, site_code, address, latitude, longitude)
                VALUES
                    (%s, %s, %s, %s, %s, %s, %s),
                    (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
            """, (
                const_company_id, 'New Capital Tower Project', 'construction', 'NC-001', 'New Administrative Capital, Egypt', 30.0131, 31.4303,
                const_company_id, 'Giza Bridge Construction', 'construction', 'GB-002', 'Giza, Egypt', 30.0444, 31.2357
            ))

            print(f"✅ Created sample sites for companies")

            # Create sample HSE users for each company
            hse_password = generate_password_hash("HSE@123")

            cur.execute("""
                INSERT INTO hse_users (company_id, username, password_hash, full_name, role, email)
                VALUES
                    (%s, %s, %s, %s, %s, %s),
                    (%s, %s, %s, %s, %s, %s);
            """, (
                petro_company_id, 'hse_admin', hse_password, 'Ahmed Hassan', 'hse_manager', 'ahmed.hassan@egyptpetro.com',
                const_company_id, 'hse_admin', hse_password, 'Mohamed Ali', 'hse_manager', 'mohamed.ali@cairoconst.com'
            ))

            print(f"✅ Created sample HSE users (username: hse_admin, password: HSE@123)")

            # Create sample workers
            worker_password = generate_password_hash("Worker@123")

            cur.execute("""
                INSERT INTO workers (company_id, username, password_hash, full_name, employee_id, role, department)
                VALUES
                    (%s, %s, %s, %s, %s, %s, %s),
                    (%s, %s, %s, %s, %s, %s, %s);
            """, (
                petro_company_id, 'worker1', worker_password, 'Khaled Mahmoud', 'EMP-1001', 'Field Operator', 'Operations',
                const_company_id, 'worker1', worker_password, 'Omar Ibrahim', 'EMP-2001', 'Site Engineer', 'Engineering'
            ))

            print(f"✅ Created sample workers (username: worker1, password: Worker@123)")
            print("\n⚠️  SAMPLE CREDENTIALS:")
            print("   Company Codes: PETRO001, CONST001")
            print("   HSE Login: hse_admin / HSE@123 + company_code")
            print("   Worker Login: worker1 / Worker@123 + company_code")

        except ImportError:
            print("⚠️  werkzeug not available. Skipping sample user creation.")
        except Exception as e:
            print(f"⚠️  Error creating sample data: {e}")
    else:
        print(f"✅ Found {company_count} existing companies. Skipping sample data creation.")

    cur.close()
    conn.close()

    print("\n🎉 Multi-tenant database setup complete!")
    print("✅ All tables created with company isolation.")
    print("✅ Ready for site safety incident reporting.")


if __name__ == "__main__":
    setup_database()
