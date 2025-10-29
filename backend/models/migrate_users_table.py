"""
Migration script to update app_users table structure.
This changes national_id from NOT NULL to nullable and makes device_id NOT NULL UNIQUE.

Run this ONLY if you have an existing database with the old schema.
"""
import psycopg2
from dotenv import load_dotenv
import os

def migrate_users_table():
    load_dotenv()
    
    conn = psycopg2.connect(
        dbname=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT")
    )
    conn.autocommit = False
    cur = conn.cursor()
    
    try:
        print("🔄 Starting migration...")
        
        # Check if migration is needed
        cur.execute("""
            SELECT column_name, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'app_users' AND column_name IN ('device_id', 'national_id');
        """)
        columns = cur.fetchall()
        print(f"Current schema: {columns}")
        
        # Drop old table and recreate
        print("⚠️  Dropping and recreating app_users table...")
        print("⚠️  THIS WILL DELETE ALL USER DATA!")
        confirm = input("Type 'YES' to confirm: ")
        
        if confirm != 'YES':
            print("❌ Migration cancelled")
            return
        
        cur.execute("DROP TABLE IF EXISTS app_users CASCADE;")
        
        cur.execute("""
            CREATE TABLE app_users (
                id SERIAL PRIMARY KEY,
                device_id VARCHAR(255) UNIQUE NOT NULL,
                national_id VARCHAR(50) UNIQUE,
                full_name VARCHAR(255),
                contact_info VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Recreate indexes
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_app_users_device_id ON app_users(device_id);
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_app_users_national_id ON app_users(national_id);
        """)
        
        conn.commit()
        print("✅ Migration completed successfully!")
        print("📝 New schema:")
        print("   - device_id: UNIQUE NOT NULL (primary identifier)")
        print("   - national_id: UNIQUE, nullable (NULL for anonymous users)")
        print("   - full_name: nullable")
        print("   - contact_info: nullable")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Migration failed: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    migrate_users_table()

