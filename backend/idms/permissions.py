# backend/idcards/permissions.py
from rest_framework.permissions import BasePermission

class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, "role", "") == "SUPER_ADMIN")

class IsSchoolAdmin(BasePermission):
    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and getattr(u, "role", "") == "SCHOOL_ADMIN")

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