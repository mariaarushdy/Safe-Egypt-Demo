import psycopg2
from psycopg2.extras import Json
from dotenv import load_dotenv
import os
import logging
from typing import Dict, Any, Optional
import uuid
from datetime import datetime

load_dotenv()

logger = logging.getLogger(__name__)

def get_db_connection():
    """Create and return a database connection"""
    try:
        conn = psycopg2.connect(
            dbname=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PASSWORD"),
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT")
        )
        return conn
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
        raise


def save_location(conn, latitude: float, longitude: float, address: str) -> int:
    """
    Save location to database and return location_id
    """
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO locations (address, latitude, longitude)
            VALUES (%s, %s, %s)
            RETURNING id;
        """, (address, latitude, longitude))
        
        location_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        return location_id
    except Exception as e:
        conn.rollback()
        logger.error(f"Error saving location: {str(e)}")
        raise


def get_or_create_user_by_device(device_id: str) -> Optional[int]:
    """
    Get or create anonymous user by device_id
    Anonymous users only have device_id (no national_id until they register)
    Returns app_user_id
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check if device exists
        cur.execute("SELECT id FROM app_users WHERE device_id = %s;", (device_id,))
        result = cur.fetchone()
        
        if result:
            user_id = result[0]
            logger.info(f"Found existing user for device_id={device_id}, user_id={user_id}")
        else:
            # Create anonymous user (only device_id, no national_id)
            cur.execute("""
                INSERT INTO app_users (device_id)
                VALUES (%s)
                RETURNING id;
            """, (device_id,))
            user_id = cur.fetchone()[0]
            conn.commit()
            logger.info(f"Created anonymous user for device_id={device_id}, user_id={user_id}")
        
        cur.close()
        conn.close()
        return user_id
        
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        logger.error(f"Error in get_or_create_user_by_device: {str(e)}")
        return None


def save_ai_analysis_to_db(
    incident_id: str,
    ai_analysis: Dict[Any, Any],
    latitude: float,
    longitude: float,
    address: str,
    timestamp: str,
    file_paths: list,
    device_id: str,
    app_user_id: Optional[int] = None,
    real_files: Optional[list] = None
) -> bool:
    """
    Save AI analysis results to the database.
    
    Args:
        incident_id: UUID of the incident
        ai_analysis: AI analysis results dictionary
        latitude: Latitude coordinate
        longitude: Longitude coordinate
        address: Geocoded address
        timestamp: Incident timestamp
        file_paths: List of file paths for media files
        device_id: Device ID of the reporter
        app_user_id: Optional user ID if not anonymous
        real_files: Optional list of file metadata (original names, paths, etc.)
        
    Returns:
        True if successful, False otherwise
    """
    conn = None
    try:
        conn = get_db_connection()
        
        # 1. Get or create user by device_id
        if not app_user_id:
            app_user_id = get_or_create_user_by_device(device_id)
        
        # 2. Save location
        location_id = save_location(conn, latitude, longitude, address)
        logger.info(f"Location saved with id={location_id}")
        
        # 3. Parse timestamp
        try:
            incident_timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        except:
            incident_timestamp = datetime.now()
        
        # 4. Save incident with AI analysis data
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO incidents (
                incident_id,
                app_user_id,
                category,
                title,
                description,
                severity,
                verified,
                violence_type,
                weapon,
                site_description,
                number_of_people,
                description_of_people,
                detailed_description_for_the_incident,
                accident_type,
                vehicles_machines_involved,
                utility_type,
                extent_of_impact,
                duration,
                illegal_type,
                items_involved,
                detected_events,
                timestamp,
                status,
                location_id,
                real_files
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s
            );
        """, (
            incident_id,
            app_user_id,
            ai_analysis.get('category'),
            ai_analysis.get('title'),
            ai_analysis.get('description'),
            ai_analysis.get('severity'),
            ai_analysis.get('verified'),
            ai_analysis.get('violence_type'),
            ai_analysis.get('weapon'),
            ai_analysis.get('site_description'),
            ai_analysis.get('number_of_people'),
            ai_analysis.get('description_of_people'),
            ai_analysis.get('detailed_description_for_the_incident'),
            ai_analysis.get('accident_type'),
            ai_analysis.get('vehicles_machines_involved'),
            ai_analysis.get('utility_type'),
            ai_analysis.get('extent_of_impact'),
            ai_analysis.get('duration'),
            ai_analysis.get('illegal_type'),
            ai_analysis.get('items_involved'),
            Json(ai_analysis.get('detected_events', [])),
            incident_timestamp,
            'pending',
            location_id,
            Json(real_files) if real_files else None
        ))
        
        logger.info(f"Incident saved with id={incident_id}, user_id={app_user_id}")
        
        # 5. Save media files
        for file_path in file_paths:
            file_ext = os.path.splitext(file_path)[1].lower()
            media_type = 'video' if file_ext in ['.mp4', '.avi', '.mov', '.mkv'] else 'image'
            
            cur.execute("""
                INSERT INTO media_files (incident_id, file_path, media_type)
                VALUES (%s, %s, %s);
            """, (incident_id, file_path, media_type))
        
        logger.info(f"Saved {len(file_paths)} media file(s)")
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"✅ Successfully saved AI analysis for incident {incident_id} to database")
        return True
        
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        logger.error(f"❌ Error saving AI analysis to database: {str(e)}")
        logger.exception("Full traceback:")
        return False


def get_incident_by_id(incident_id: str) -> Optional[Dict]:
    """
    Retrieve incident data from database by incident_id
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT 
                i.*,
                l.address,
                l.latitude,
                l.longitude,
                json_agg(
                    json_build_object(
                        'file_path', m.file_path,
                        'media_type', m.media_type
                    )
                ) as media_files
            FROM incidents i
            LEFT JOIN locations l ON i.location_id = l.id
            LEFT JOIN media_files m ON i.incident_id = m.incident_id
            WHERE i.incident_id = %s
            GROUP BY i.incident_id, l.id;
        """, (incident_id,))
        
        row = cur.fetchone()
        cur.close()
        conn.close()
        
        if row:
            # Convert to dictionary (you may need to adjust column names)
            return dict(row)
        return None
        
    except Exception as e:
        if conn:
            conn.close()
        logger.error(f"Error retrieving incident: {str(e)}")
        return None


def update_incident_status(incident_id: str, new_status: str) -> bool:
    """
    Update the status of an incident
    
    Args:
        incident_id: UUID of the incident
        new_status: New status value (pending, in_progress, resolved, etc.)
    
    Returns:
        True if successful, False otherwise
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            UPDATE incidents
            SET status = %s
            WHERE incident_id = %s;
        """, (new_status, incident_id))
        
        conn.commit()
        cur.close()
        conn.close()
        
        logger.info(f"✅ Updated incident {incident_id} status to {new_status}")
        return True
        
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        logger.error(f"❌ Error updating incident status: {str(e)}")
        return False


def get_all_incidents_from_db():
    """
    Get all incidents from database with location and media files
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT 
                i.incident_id,
                i.category,
                i.title,
                i.description,
                i.severity,
                i.timestamp,
                i.status,
                i.violence_type,
                i.weapon,
                i.site_description,
                i.number_of_people,
                i.description_of_people,
                i.detailed_description_for_the_incident,
                i.accident_type,
                i.vehicles_machines_involved,
                i.utility_type,
                i.extent_of_impact,
                i.duration,
                i.illegal_type,
                i.items_involved,
                i.detected_events,
                i.location_id,
                i.real_files,
                i.verified,
                l.address,
                l.latitude,
                l.longitude,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'file_path', m.file_path,
                            'media_type', m.media_type
                        )
                    ) FILTER (WHERE m.id IS NOT NULL), 
                    '[]'::json
                ) as media_files,
                u.device_id,
                COALESCE(u.full_name, 'Anonymous User') as full_name,
                u.national_id
            FROM incidents i
            LEFT JOIN locations l ON i.location_id = l.id
            LEFT JOIN media_files m ON i.incident_id = m.incident_id
            LEFT JOIN app_users u ON i.app_user_id = u.id
            GROUP BY i.incident_id, l.id, u.id
            ORDER BY i.timestamp DESC;
        """)
        
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        incidents = []
        incidents = []
        for row in rows:
            incidents.append({
                'incident_id': str(row[0]),
                'category': row[1],
                'title': row[2],
                'description': row[3],
                'severity': row[4],
                'timestamp': row[5].isoformat() if row[5] else None,
                'status': row[6],
                'violence_type': row[7],
                'weapon': row[8],
                'site_description': row[9],
                'number_of_people': row[10],
                'description_of_people': row[11],
                'detailed_description_for_the_incident': row[12],
                'accident_type': row[13],
                'vehicles_machines_involved': row[14],
                'utility_type': row[15],
                'extent_of_impact': row[16],
                'duration': row[17],
                'illegal_type': row[18],
                'items_involved': row[19],
                'detected_events': row[20],
                'location_id': row[21],
                'real_files': row[22],
                'verified': row[23],
                'address': row[24],
                'latitude': row[25],
                'longitude': row[26],
                'media_files': row[27] if row[27] is not None else [],
                'device_id': row[28],
                'user_name': row[29],
                'national_id': row[30],
                'is_anonymous': row[30] is None  # If no national_id, user is anonymous
            })
        
        return incidents
        
    except Exception as e:
        if conn:
            conn.close()
        logger.error(f"Error getting incidents from database: {str(e)}")
        return []


def create_registered_user(national_id: str, full_name: str, contact_info: str, device_id: str) -> Optional[int]:
    """
    Create or update a registered user (not anonymous)
    Links device_id to a real user account
    
    Args:
        national_id: National ID of the user
        full_name: Full name of the user
        contact_info: Contact information (phone/email)
        device_id: Device ID to link
    
    Returns:
        User ID if successful, None otherwise
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Check if device already has a user
        cur.execute("SELECT id, national_id FROM app_users WHERE device_id = %s;", (device_id,))
        result = cur.fetchone()
        
        if result:
            existing_id, existing_national_id = result
            if existing_national_id is None:
                # Update anonymous user (device_id only) to registered
                cur.execute("""
                    UPDATE app_users 
                    SET national_id = %s, full_name = %s, contact_info = %s
                    WHERE id = %s
                    RETURNING id;
                """, (national_id, full_name, contact_info, existing_id))
                user_id = cur.fetchone()[0]
                logger.info(f"Updated anonymous user to registered: device_id={device_id}, user_id={user_id}")
            else:
                # Already registered
                user_id = existing_id
                logger.info(f"User already registered: device_id={device_id}, user_id={user_id}")
        else:
            # Check if national_id already exists (user registering from new device)
            cur.execute("SELECT id FROM app_users WHERE national_id = %s;", (national_id,))
            result = cur.fetchone()
            
            if result:
                # Update existing user with new device_id
                user_id = result[0]
                cur.execute("UPDATE app_users SET device_id = %s WHERE id = %s;", (device_id, user_id))
                logger.info(f"Updated device_id for existing user: user_id={user_id}")
            else:
                # Create new registered user
                cur.execute("""
                    INSERT INTO app_users (device_id, national_id, full_name, contact_info)
                    VALUES (%s, %s, %s, %s)
                    RETURNING id;
                """, (device_id, national_id, full_name, contact_info))
                user_id = cur.fetchone()[0]
                logger.info(f"Created new registered user: device_id={device_id}, user_id={user_id}")
        
        conn.commit()
        cur.close()
        conn.close()
        return user_id
        
    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        logger.error(f"Error creating registered user: {str(e)}")
        logger.exception("Full traceback:")
        return None

