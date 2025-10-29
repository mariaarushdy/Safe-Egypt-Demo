"""
Simplified Database Models
- app_users: Mobile users (NO LOGIN)
- dashboard_users: Dashboard users (simple login)
"""

from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

Base = declarative_base()


# ============ APP USERS (Mobile - NO LOGIN) ============

class AppUser(Base):
    """Mobile app users - NO LOGIN REQUIRED"""
    __tablename__ = "app_users"
    
    id = Column(Integer, primary_key=True, index=True)
    national_id = Column(String(50), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    contact_info = Column(String(255), nullable=False)  # Phone or email
    device_id = Column(String(255), index=True)  # For auto-linking
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    incidents = relationship("Incident", back_populates="reporter")


# ============ DASHBOARD USERS (Simple Login) ============

class DashboardUser(Base):
    """Dashboard users - all can approve/reject incidents"""
    __tablename__ = "dashboard_users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime)


# ============ LOCATIONS ============

class Location(Base):
    __tablename__ = "locations"
    
    id = Column(Integer, primary_key=True, index=True)
    address = Column(Text)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    # Relationships
    incidents = relationship("Incident", back_populates="location")


# ============ INCIDENTS ============

class Incident(Base):
    __tablename__ = "incidents"
    
    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String(100), unique=True, nullable=False, index=True)  # UUID
    
    # Reporter (can be NULL for anonymous)
    app_user_id = Column(Integer, ForeignKey("app_users.id"), nullable=True)
    
    # Location
    location_id = Column(Integer, ForeignKey("locations.id"), nullable=True)
    
    # Basic info
    category = Column(String(100))
    title = Column(String(500))
    description = Column(Text)
    
    # Status (pending, approved, rejected)
    status = Column(String(50), default="pending")
    verified = Column(String(50))
    severity = Column(String(50))
    
    # Incident details (from AI analysis)
    violence_type = Column(Text)
    weapon = Column(Text)
    site_description = Column(Text)
    number_of_people = Column(Integer)
    description_of_people = Column(Text)
    detailed_description_for_the_incident = Column(Text)
    accident_type = Column(Text)
    vehicles_machines_involved = Column(Text)
    utility_type = Column(Text)
    extent_of_impact = Column(Text)
    duration = Column(Text)
    illegal_type = Column(Text)
    items_involved = Column(Text)
    detected_events = Column(JSON)
    
    # Timestamps
    timestamp = Column(DateTime, nullable=False)  # When incident occurred
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    reporter = relationship("AppUser", back_populates="incidents")
    location = relationship("Location", back_populates="incidents")
    media_files = relationship("MediaFile", back_populates="incident", cascade="all, delete-orphan")


# ============ MEDIA FILES ============

class MediaFile(Base):
    __tablename__ = "media_files"
    
    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String(100), ForeignKey("incidents.incident_id"), nullable=False)
    
    file_path = Column(String(1000), nullable=False)
    media_type = Column(String(50), default="video")  # photo, video
    
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    incident = relationship("Incident", back_populates="media_files")


# ============ DATABASE CONNECTION ============

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DB_NAME = os.getenv("DB_NAME", "safe_egypt_db")
    DB_USER = os.getenv("DB_USER", "postgres")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Dependency for FastAPI routes"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables (use setup_db.py instead for proper setup)"""
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully!")


if __name__ == "__main__":
    init_db()

