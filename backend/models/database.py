from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, Enum, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime
import enum
import os
from dotenv import load_dotenv
load_dotenv()

Base = declarative_base()


# Enums
class UserType(enum.Enum):
    MOBILE = "mobile"  # Mobile app users who report incidents
    DASHBOARD = "dashboard"  # Dashboard users who manage the system

class UserRole(enum.Enum):
    USER = "user"  # Regular mobile app user
    ADMIN = "admin"  # Dashboard admin with full access
    MODERATOR = "moderator"  # Dashboard moderator with limited access
    OPERATOR = "operator"  # Dashboard operator for viewing and updating

class IncidentStatus(enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    REJECTED = "rejected"

class VerificationStatus(enum.Enum):
    UNVERIFIED = "unverified"
    VERIFIED = "verified"
    FALSE_REPORT = "false_report"

class Severity(enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(255))
    phone_number = Column(String(20))  # For mobile users
    
    # User type and role
    user_type = Column(Enum(UserType), nullable=False, default=UserType.MOBILE)
    role = Column(Enum(UserRole), default=UserRole.USER)
    
    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)  # Email/phone verification
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login = Column(DateTime)
    
    # Relationships
    incidents = relationship("Incident", back_populates="reporter")
    audit_logs = relationship("AuditLog", back_populates="user")

class Incident(Base):
    __tablename__ = "incidents" 
    
    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(String(100), unique=True, nullable=False, index=True)  # UUID
    
    # Reporter info
    reporter_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Nullable for anonymous
    is_anonymous = Column(Boolean, default=False)
    
    # Location data
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    location_name = Column(String(500))  # Geocoded address
    
    # Incident details
    description = Column(Text)
    incident_type = Column(String(100))  # emergency, accident, crime, etc.
    category = Column(String(100))  # From AI analysis
    title = Column(String(500))  # From AI analysis
    
    # Status and verification
    status = Column(Enum(IncidentStatus), default=IncidentStatus.PENDING)
    verification_status = Column(Enum(VerificationStatus), default=VerificationStatus.UNVERIFIED)
    severity = Column(Enum(Severity), default=Severity.MEDIUM)
    
    # Timestamps
    incident_timestamp = Column(DateTime, nullable=False)  # When incident occurred
    created_at = Column(DateTime, default=datetime.utcnow)  # When reported
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    reporter = relationship("User", back_populates="incidents")
    media_files = relationship("MediaFile", back_populates="incident", cascade="all, delete-orphan")
    analysis_result = relationship("AnalysisResult", back_populates="incident", uselist=False, cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="incident")

class MediaFile(Base):
    __tablename__ = "media_files"
    
    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False)
    
    # File info
    original_filename = Column(String(500))
    saved_filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_type = Column(String(50))  # photo, video
    file_size = Column(Integer)
    mime_type = Column(String(100))
    
    # Timestamps
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    incident = relationship("Incident", back_populates="media_files")

class AnalysisResult(Base):
    __tablename__ = "analysis_results"
    
    id = Column(Integer, primary_key=True, index=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=False, unique=True)
    
    # AI Analysis results
    detected_events = Column(JSON)  # Array of detected events
    confidence_score = Column(Float)
    analysis_summary = Column(Text)
    recommended_actions = Column(JSON)  # Array of recommended actions
    ai_model_version = Column(String(100))
    
    # Timestamps
    analyzed_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    incident = relationship("Incident", back_populates="analysis_result")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # References
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    incident_id = Column(Integer, ForeignKey("incidents.id"), nullable=True)
    
    # Log details
    action = Column(String(100), nullable=False)  # created, updated, deleted, status_changed, etc.
    entity_type = Column(String(50))  # incident, user, media, etc.
    old_value = Column(JSON)
    new_value = Column(JSON)
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
    incident = relationship("Incident", back_populates="audit_logs")


# Database connection
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/safe_egypt_db")

engine = create_engine(DATABASE_URL, echo=True)  # Set echo=False in production
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Dependency for FastAPI routes"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created successfully!")

if __name__ == "__main__":
    # Create tables when run directly
    init_db()