# backend/idcards/permissions.py
from rest_framework.permissions import BasePermission, SAFE_METHODS

class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, "role", "") == "SUPER_ADMIN")

class IsSchoolAdmin(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, "role", "") == "SCHOOL_ADMIN")

class SuperAdminWrite_SchoolAdminRead(BasePermission):
    """SUPER_ADMIN can write (POST/PUT/PATCH/DELETE); SCHOOL_ADMIN can only read (GET/HEAD/OPTIONS)."""
    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return getattr(u, "role", "") in {"SUPER_ADMIN", "SCHOOL_ADMIN"}
        return getattr(u, "role", "") == "SUPER_ADMIN"

class SchoolAdminCreateOnly(BasePermission):
    """Only SCHOOL_ADMIN can create (POST). Other methods allowed for both roles (adjust as you like)."""
    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if request.method == "POST":
            return getattr(u, "role", "") == "SCHOOL_ADMIN"
        # reads/deletes/updates allowed for both (tighten if needed)
        return getattr(u, "role", "") in {"SUPER_ADMIN", "SCHOOL_ADMIN"}

class IsSameSchoolOrSuper(BasePermission):
    """Object-level: SCHOOL_ADMIN sees only own school’s objects; SUPER_ADMIN sees all."""
    def has_object_permission(self, request, view, obj):
        u = request.user
        if not u or not u.is_authenticated: return False
        if getattr(u, "role", "") == "SUPER_ADMIN": return True
        school = getattr(obj, "school", None) or getattr(getattr(obj, "classroom", None), "school", None)
        return getattr(u, "school_id", None) == getattr(school, "id", None)

class IsSuperOrSchoolAdmin(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, "role", "") in {"SUPER_ADMIN", "SCHOOL_ADMIN"})