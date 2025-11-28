import psycopg2
from psycopg2.extras import Json, RealDictCursor
from dotenv import load_dotenv
import os
import logging
from typing import Dict, Any, Optional, List
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


# ==================== COMPANY FUNCTIONS ====================

def get_company_by_code(company_code: str) -> Optional[Dict]:
    """
    Get company information by company code
    Used for authentication
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT id, company_code, company_name, industry_type, is_active
            FROM companies
            WHERE company_code = %s AND is_active = TRUE;
        """, (company_code,))

        company = cur.fetchone()
        cur.close()
        conn.close()

        if company:
            return dict(company)
        return None

    except Exception as e:
        if conn:
            conn.close()
        logger.error(f"Error getting company by code: {str(e)}")
        return None


def get_company_by_id(company_id: int) -> Optional[Dict]:
    """Get company information by ID"""
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT *
            FROM companies
            WHERE id = %s;
        """, (company_id,))

        company = cur.fetchone()
        cur.close()
        conn.close()

        if company:
            return dict(company)
        return None

    except Exception as e:
        if conn:
            conn.close()
        logger.error(f"Error getting company: {str(e)}")
        return None


# ==================== SITE FUNCTIONS ====================

def get_sites_by_company(company_id: int) -> List[Dict]:
    """
    Get all sites for a specific company
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT id, site_name, site_type, site_code, address,
                   latitude, longitude, manager_name, is_active
            FROM sites
            WHERE company_id = %s AND is_active = TRUE
            ORDER BY site_name;
        """, (company_id,))

        sites = cur.fetchall()
        cur.close()
        conn.close()

        return [dict(site) for site in sites]

    except Exception as e:
        if conn:
            conn.close()
        logger.error(f"Error getting sites: {str(e)}")
        return []


def get_site_by_id(site_id: int, company_id: int) -> Optional[Dict]:
    """
    Get site by ID with company validation (multi-tenant security)
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT *
            FROM sites
            WHERE id = %s AND company_id = %s;
        """, (site_id, company_id))

        site = cur.fetchone()
        cur.close()
        conn.close()

        if site:
            return dict(site)
        return None

    except Exception as e:
        if conn:
            conn.close()
        logger.error(f"Error getting site: {str(e)}")
        return None


def get_zones_by_site(site_id: int, company_id: int) -> List[Dict]:
    """
    Get all zones for a specific site (with company validation)
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Validate site belongs to company first
        cur.execute("""
            SELECT id FROM sites WHERE id = %s AND company_id = %s;
        """, (site_id, company_id))

        if not cur.fetchone():
            cur.close()
            conn.close()
            logger.warning(f"Site {site_id} does not belong to company {company_id}")
            return []

        # Get zones
        cur.execute("""
            SELECT id, zone_name, zone_code, hazard_level, description
            FROM site_zones
            WHERE site_id = %s
            ORDER BY zone_name;
        """, (site_id,))

        zones = cur.fetchall()
        cur.close()
        conn.close()

        return [dict(zone) for zone in zones]

    except Exception as e:
        if conn:
            conn.close()
        logger.error(f"Error getting zones: {str(e)}")
        return []


# ==================== WORKER FUNCTIONS ====================

def get_worker_by_id(worker_id: int, company_id: int) -> Optional[Dict]:
    """
    Get worker by ID with company validation
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT id, company_id, username, full_name, employee_id,
                   role, department, is_active
            FROM workers
            WHERE id = %s AND company_id = %s;
        """, (worker_id, company_id))

        worker = cur.fetchone()
        cur.close()
        conn.close()

        if worker:
            return dict(worker)
        return None

    except Exception as e:
        if conn:
            conn.close()
        logger.error(f"Error getting worker: {str(e)}")
        return None


def get_worker_by_device_id(device_id: str) -> Optional[Dict]:
    """
    Get worker by device_id (for mobile app authentication)
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT w.*, c.company_code, c.company_name
            FROM workers w
            JOIN companies c ON w.company_id = c.id
            WHERE w.device_id = %s AND w.is_active = TRUE;
        """, (device_id,))

        worker = cur.fetchone()
        cur.close()
        conn.close()

        if worker:
            return dict(worker)
        return None

    except Exception as e:
        if conn:
            conn.close()
        logger.error(f"Error getting worker by device: {str(e)}")
        return None


def update_worker_device_id(worker_id: int, device_id: str) -> bool:
    """
    Update worker's device_id (when logging in from a new device)
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            UPDATE workers
            SET device_id = %s, last_login = CURRENT_TIMESTAMP
            WHERE id = %s;
        """, (device_id, worker_id))

        conn.commit()
        cur.close()
        conn.close()

        logger.info(f"Updated device_id for worker {worker_id}")
        return True

    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        logger.error(f"Error updating device_id: {str(e)}")
        return False


# ==================== INCIDENT FUNCTIONS ====================

def save_ai_analysis_to_db(
    incident_id: str,
    company_id: int,
    site_id: int,
    worker_id: int,
    ai_analysis: Dict[Any, Any],
    timestamp: str,
    file_paths: list,
    latitude: float,
    longitude: float,
    address: str,
    zone_id: Optional[int] = None,
    real_files: Optional[list] = None
) -> bool:
    """
    Save AI analysis results to the database with multi-tenant isolation

    Args:
        incident_id: UUID of the incident
        company_id: Company ID (for multi-tenant isolation)
        site_id: Site ID where incident occurred
        worker_id: Worker who reported the incident
        ai_analysis: AI analysis results dictionary
        timestamp: Incident timestamp
        file_paths: List of file paths for media files
        zone_id: Optional zone ID within the site
        real_files: Optional list of file metadata

    Returns:
        True if successful, False otherwise
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Parse timestamp
        try:
            incident_timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        except:
            incident_timestamp = datetime.now()

        # Normalize severity to match DB constraint ('Low','Medium','High')
        severity_raw = ai_analysis.get('severity')
        severity_normalized = None
        if severity_raw:
            sev = str(severity_raw).lower()
            if sev in ['low', 'medium', 'high']:
                severity_normalized = sev.capitalize()
            else:
                severity_normalized = 'Medium'
        else:
            severity_normalized = 'Medium'

        # Save incident with AI analysis data (using new schema)
        cur.execute("""
            INSERT INTO incidents (
                incident_id,
                company_id,
                site_id,
                zone_id,
                worker_id,
                category,
                title,
                description,
                severity,
                verified,
                site_type,
                site_description,
                number_of_people,
                description_of_people,
                detailed_description_for_the_incident,
                vehicles_machines_involved,
                extent_of_impact,
                duration,
                petroleum_type,
                substance_involved,
                equipment_id,
                spill_volume,
                environmental_impact,
                ppe_missing,
                construction_type,
                structure_affected,
                materials_involved,
                height_elevation,
                equipment_involved,
                detected_events,
                timestamp,
                status,
                real_files,
                latitude,
                longitude,
                address
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s, %s
            );
        """, (
            incident_id,
            company_id,
            site_id,
            zone_id,
            worker_id,
            ai_analysis.get('category'),
            ai_analysis.get('title'),
            ai_analysis.get('description'),
            severity_normalized,
            ai_analysis.get('verified'),
            ai_analysis.get('site_type'),
            ai_analysis.get('site_description'),
            ai_analysis.get('number_of_people'),
            ai_analysis.get('description_of_people'),
            ai_analysis.get('detailed_description_for_the_incident'),
            ai_analysis.get('vehicles_machines_involved'),
            ai_analysis.get('extent_of_impact'),
            ai_analysis.get('duration'),
            ai_analysis.get('petroleum_type'),
            ai_analysis.get('substance_involved'),
            ai_analysis.get('equipment_id'),
            ai_analysis.get('spill_volume'),
            ai_analysis.get('environmental_impact'),
            Json(ai_analysis.get('ppe_missing', [])),
            ai_analysis.get('construction_type'),
            ai_analysis.get('structure_affected'),
            ai_analysis.get('materials_involved'),
            ai_analysis.get('height_elevation'),
            ai_analysis.get('equipment_involved'),
            Json(ai_analysis.get('detected_events', [])),
            incident_timestamp,
            'pending',
            Json(real_files) if real_files else None,
            latitude,
            longitude,
            address
        ))

        logger.info(f"Incident saved: id={incident_id}, company={company_id}, site={site_id}, worker={worker_id}")

        # Save media files
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

        logger.info(f"✅ Successfully saved AI analysis for incident {incident_id}")
        return True

    except Exception as e:
        if conn:
            conn.rollback()
            conn.close()
        logger.error(f"❌ Error saving AI analysis: {str(e)}")
        logger.exception("Full traceback:")
        return False


def get_incident_by_id(incident_id: str, company_id: int) -> Optional[Dict]:
    """
    Retrieve incident data by ID with company validation (multi-tenant security)
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute("""
            SELECT
                i.*,
                s.site_name,
                s.site_code,
                s.address as site_address,
                s.latitude as site_latitude,
                s.longitude as site_longitude,
                z.zone_name,
                z.zone_code,
                w.full_name as worker_name,
                w.employee_id,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'file_path', m.file_path,
                            'media_type', m.media_type
                        )
                    ) FILTER (WHERE m.id IS NOT NULL),
                    '[]'::json
                ) as media_files
            FROM incidents i
            JOIN sites s ON i.site_id = s.id
            LEFT JOIN site_zones z ON i.zone_id = z.id
            LEFT JOIN workers w ON i.worker_id = w.id
            LEFT JOIN media_files m ON i.incident_id = m.incident_id
            WHERE i.incident_id = %s AND i.company_id = %s
            GROUP BY i.incident_id, s.id, z.id, w.id;
        """, (incident_id, company_id))

        incident = cur.fetchone()
        cur.close()
        conn.close()

        if incident:
            return dict(incident)
        return None

    except Exception as e:
        if conn:
            conn.close()
        logger.error(f"Error retrieving incident: {str(e)}")
        return None


def get_all_incidents_from_db(
    company_id: int,
    site_id: Optional[int] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 100
) -> List[Dict]:
    """
    Get all incidents for a company with optional filtering
    Multi-tenant: Only returns incidents for specified company
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)

        # Build query with filters
        query = """
            SELECT
                i.incident_id,
                i.company_id,
                i.category,
                i.title,
                i.description,
                i.severity,
                i.timestamp,
                i.status,
                i.verified,
                i.site_type,
                i.petroleum_type,
                i.construction_type,
                i.site_description,
                i.detected_events,
                i.real_files,
                i.latitude,
                i.longitude,
                i.address,
                s.site_name,
                s.site_code,
                s.address as site_address,
                s.latitude as site_latitude,
                s.longitude as site_longitude,
                z.zone_name,
                w.full_name as worker_name,
                w.employee_id,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'file_path', m.file_path,
                            'media_type', m.media_type
                        )
                    ) FILTER (WHERE m.id IS NOT NULL),
                    '[]'::json
                ) as media_files
            FROM incidents i
            JOIN sites s ON i.site_id = s.id
            LEFT JOIN site_zones z ON i.zone_id = z.id
            LEFT JOIN workers w ON i.worker_id = w.id
            LEFT JOIN media_files m ON i.incident_id = m.incident_id
            WHERE i.company_id = %s
        """

        params = [company_id]

        if site_id:
            query += " AND i.site_id = %s"
            params.append(site_id)

        if status:
            query += " AND i.status = %s"
            params.append(status)

        if severity:
            query += " AND i.severity = %s"
            params.append(severity)

        query += """
            GROUP BY i.incident_id, s.id, z.id, w.id
            ORDER BY i.timestamp DESC
            LIMIT %s;
        """
        params.append(limit)

        cur.execute(query, params)

        rows = cur.fetchall()
        cur.close()
        conn.close()

        return [dict(row) for row in rows]

    except Exception as e:
        if conn:
            conn.close()
        logger.error(f"Error getting incidents: {str(e)}")
        return []


def update_incident_status(
    incident_id: str,
    company_id: int,
    new_status: str,
    assigned_to: Optional[int] = None,
    resolution_notes: Optional[str] = None
) -> bool:
    """
    Update incident status with company validation

    Args:
        incident_id: UUID of incident
        company_id: Company ID (for multi-tenant security)
        new_status: New status value
        assigned_to: Optional HSE user ID
        resolution_notes: Optional resolution notes
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Build update query
        update_fields = ["status = %s", "updated_at = CURRENT_TIMESTAMP"]
        params = [new_status]

        if assigned_to is not None:
            update_fields.append("assigned_to = %s")
            params.append(assigned_to)

        if resolution_notes:
            update_fields.append("resolution_notes = %s")
            params.append(resolution_notes)

        if new_status in ['resolved', 'closed']:
            update_fields.append("resolved_at = CURRENT_TIMESTAMP")

        params.extend([incident_id, company_id])

        query = f"""
            UPDATE incidents
            SET {', '.join(update_fields)}
            WHERE incident_id = %s AND company_id = %s;
        """

        cur.execute(query, params)

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


def get_incidents_count_by_company(company_id: int) -> Dict[str, int]:
    """
    Get incident statistics for a company
    """
    conn = None
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'under_review' THEN 1 END) as under_review,
                COUNT(CASE WHEN status = 'investigating' THEN 1 END) as investigating,
                COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
                COUNT(CASE WHEN severity = 'High' THEN 1 END) as high_severity,
                COUNT(CASE WHEN severity = 'Medium' THEN 1 END) as medium_severity,
                COUNT(CASE WHEN severity = 'Low' THEN 1 END) as low_severity
            FROM incidents
            WHERE company_id = %s;
        """, (company_id,))

        row = cur.fetchone()
        cur.close()
        conn.close()

        return {
            'total': row[0],
            'pending': row[1],
            'under_review': row[2],
            'investigating': row[3],
            'resolved': row[4],
            'high_severity': row[5],
            'medium_severity': row[6],
            'low_severity': row[7]
        }

    except Exception as e:
        if conn:
            conn.close()
        logger.error(f"Error getting incident stats: {str(e)}")
        return {}
