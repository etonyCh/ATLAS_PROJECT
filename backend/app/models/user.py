from enum import Enum
from typing import Optional, List, TYPE_CHECKING
from datetime import datetime, date
import uuid
from sqlmodel import SQLModel, Field, Relationship
import sqlalchemy as sa

# Defensive Forward Referencing to prevent Circular Imports
if TYPE_CHECKING:
    from .contribution import Contribution
    from .contribution import ContributorRequest
    from .gamification import XPTransaction
    from .course import Course


class UserRole(str, Enum):
    STUDENT = "STUDENT"
    TEACHER = "TEACHER"
    ADMIN = "ADMIN"
    SUPERADMIN = "SUPERADMIN"


class AccountStatus(str, Enum):
    ACTIVE = "ACTIVE"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    SUSPENDED = "SUSPENDED"


class TeacherRequestStatus(str, Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class StudentLevel(str, Enum):
    L1 = "L1"
    L2 = "L2"
    L3 = "L3"
    M1 = "M1"
    M2 = "M2"
    DOCTORAT = "Doctorat"


class OTPPurpose(str, Enum):
    """
    Strictly defined OTP types per US-03 and US-05 specifications.
    """

    ACCOUNT_ACTIVATION = "ACCOUNT_ACTIVATION"
    TEACHER_ONBOARDING = "TEACHER_ONBOARDING"
    PASSWORD_RESET = "PASSWORD_RESET"


class Establishment(SQLModel, table=True):
    """
    Educational establishment (e.g., University, School) for teacher affiliation.
    """

    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True)
    domain: str = Field(index=True, description="Email domain for this establishment (e.g. fss.rnu.tn)")
    is_authorized: bool = Field(
        default=True, index=True, description="Whether this domain is authorized for teacher import"
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)  # Added missing field

    departments: List["Department"] = Relationship(
        back_populates="establishment", cascade_delete=True
    )
    users: List["User"] = Relationship(back_populates="establishment", cascade_delete=True)


class Department(SQLModel, table=True):
    """
    Department within an establishment (e.g., Computer Science, Mathematics).
    Merged to resolve Alembic MetaData collision. Acts as the single source of truth.
    """

    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str = Field(index=True)
    establishment_id: uuid.UUID = Field(foreign_key="establishment.id", ondelete="CASCADE")
    allowed_levels: list[str] = Field(
        default_factory=list,
        sa_column=sa.Column(sa.JSON(), nullable=False),
        description="Levels enabled by administrators for this department.",
    )
    created_at: datetime = Field(default_factory=datetime.utcnow)

    establishment: Optional[Establishment] = Relationship(back_populates="departments")
    teacher_profiles: List["TeacherProfile"] = Relationship(back_populates="department")
    # US-06: Bidirectional relationship to Course added during consolidation
    courses: List["Course"] = Relationship(back_populates="department")


class Gender(str, Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"
    PREFER_NOT_TO_SAY = "PREFER_NOT_TO_SAY"


class UserBase(SQLModel):
    """
    Base shared properties for User models.
    """

    email: str = Field(unique=True, index=True)
    full_name: Optional[str] = None
    role: UserRole = UserRole.STUDENT
    status: AccountStatus = Field(default=AccountStatus.ACTIVE)
    establishment_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="establishment.id", nullable=True
    )

    # Trust & Verification
    trust_score: int = Field(default=0, description="Reputation score for verified badges")
    profile_completeness: int = Field(default=0, description="0-100 score of profile completion")

    # Security: Accounts must be explicitly activated via OTP
    is_active: bool = False

    # Represents the "Enseignant Vérifié" badge or general verification
    is_verified: bool = False
    verified_at: Optional[datetime] = Field(
        default=None, description="Timestamp of when the user was verified"
    )
    is_contributor: bool = Field(default=False, index=True)
    contributor_badge_awarded_at: Optional[datetime] = Field(default=None)

    # Student specific fields
    filiere: Optional[str] = None  # Major/Department
    level: Optional[StudentLevel] = None
    student_id: Optional[str] = Field(
        default=None, index=True, description="Unique institutional identifier / roll number"
    )
    program: Optional[str] = Field(default=None, description="Program or course of study")
    academic_year: Optional[str] = Field(
        default=None, description="Current academic year, e.g., 1, 2, 3, M1"
    )
    date_of_birth: Optional[date] = Field(default=None)
    gender: Optional[Gender] = Field(default=None)
    phone_number: Optional[str] = Field(default=None)
    address: Optional[str] = Field(default=None)
    preferred_language: Optional[str] = Field(default=None)
    profile_picture_url: Optional[str] = Field(default=None)

    onboarding_completed: bool = Field(default=False, index=True)


class TeacherProfile(SQLModel, table=True):
    """
    Teacher-specific profile data linked to a generic User account.
    """

    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", unique=True, ondelete="CASCADE")
    department_id: Optional[uuid.UUID] = Field(
        foreign_key="department.id", nullable=True, ondelete="SET NULL"
    )

    specialization: Optional[str] = Field(
        default=None, description="Teacher's primary field of expertise"
    )
    modules: Optional[str] = Field(
        default=None, description="Comma-separated or JSON string of taught modules"
    )

    # NEW SECURE ONBOARDING FIELDS: Token verification gate
    invite_token: Optional[str] = Field(
        default=None,
        unique=True,
        index=True,
        description="Cryptographically secure token for onboarding gate",
    )
    invite_expires_at: Optional[datetime] = Field(
        default=None, description="Expiration timestamp for the single-use invite token"
    )

    user: Optional["User"] = Relationship(back_populates="teacher_profile")
    department: Optional[Department] = Relationship(back_populates="teacher_profiles")


class TeacherVerificationRequest(SQLModel, table=True):
    """
    Tracks trust-first teacher onboarding requests submitted from the public educator flow.
    """

    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", unique=True, ondelete="CASCADE")
    requested_department: str = Field(index=True)
    requested_domain: str = Field(index=True)
    establishment_id: Optional[uuid.UUID] = Field(
        default=None, foreign_key="establishment.id", nullable=True
    )
    status: TeacherRequestStatus = Field(default=TeacherRequestStatus.PENDING, index=True)
    reviewed_by: Optional[uuid.UUID] = Field(default=None, foreign_key="user.id", nullable=True)
    review_note: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_at: Optional[datetime] = None

    user: Optional["User"] = Relationship(
        back_populates="teacher_request",
        sa_relationship_kwargs={"foreign_keys": "[TeacherVerificationRequest.user_id]"},
    )
    establishment: Optional[Establishment] = Relationship()


class User(UserBase, table=True):
    """
    Database table for Users.
    """

    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    contributions: List["Contribution"] = Relationship(back_populates="uploader")
    xp_transactions: List["XPTransaction"] = Relationship(back_populates="user")
    otp_tokens: List["OTPToken"] = Relationship(back_populates="user", cascade_delete=True)
    teacher_profile: Optional[TeacherProfile] = Relationship(
        back_populates="user", cascade_delete=True
    )
    establishment: Optional[Establishment] = Relationship(back_populates="users")
    teacher_request: Optional[TeacherVerificationRequest] = Relationship(
        back_populates="user",
        sa_relationship_kwargs={"foreign_keys": "[TeacherVerificationRequest.user_id]"},
        cascade_delete=True,
    )
    contributor_requests: List["ContributorRequest"] = Relationship(
        back_populates="student",
        sa_relationship_kwargs={"foreign_keys": "[ContributorRequest.student_id]"},
        cascade_delete=True,
    )


class UserCreate(UserBase):
    """
    Properties to receive via API on creation.
    """

    password: str


class UserRead(UserBase):
    """
    Properties to return via API.
    """

    id: uuid.UUID
    created_at: datetime


class OTPToken(SQLModel, table=True):
    """
    Database table for storing hashed One-Time Passwords (OTPs).
    Hiding the raw OTP and only storing the hash is a security best practice.
    Tracks validation attempts to prevent brute force attacks.
    """

    id: Optional[uuid.UUID] = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True, ondelete="CASCADE")
    purpose: OTPPurpose
    otp_code_hash: str  # Stored as a hash to prevent database leak vulnerabilities
    expires_at: datetime

    # Usage and brute-force protection
    attempts: int = Field(
        default=0, description="Tracks the number of failed verification attempts"
    )
    max_attempts: int = Field(
        default=5, description="Max allowed attempts (Strictly 1 for TEACHER_ONBOARDING)"
    )
    is_used: bool = Field(default=False, description="Flagged true upon successful verification")

    created_at: datetime = Field(default_factory=datetime.utcnow)
    consumed_at: Optional[datetime] = None

    # Relationship back to User
    user: Optional[User] = Relationship(back_populates="otp_tokens")
