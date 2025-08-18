# idcards/views_admin.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from django.utils import timezone
from .models import School, ClassRoom, Student, UploadLink, FormTemplate, IdCardTemplate, User
import uuid
from .permissions import IsSuperAdmin, IsSchoolAdmin, IsSameSchoolOrSuper, IsSuperOrSchoolAdmin, SuperAdminWrite_SchoolAdminRead,SchoolAdminCreateOnly
from .serializers import *  # your serializers


class SchoolViewSet(viewsets.ModelViewSet):
    queryset = School.objects.all().order_by("-id")
    serializer_class = SchoolSerializer
    permission_classes = [IsSuperAdmin]

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.select_related("school").filter(role="SCHOOL_ADMIN").order_by("-id")
    serializer_class = UserSerializer
    permission_classes = [IsSuperAdmin]

    @action(detail=True, methods=["post"])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        new_pwd = request.data.get("password")
        if not new_pwd:
            return Response({"detail": "password required"}, status=400)
        user.set_password(new_pwd)
        user.save()
        return Response({"status": "ok"})

# School Admin scoped resources
class ClassRoomViewSet(viewsets.ModelViewSet):
    serializer_class = ClassRoomSerializer
    permission_classes = [IsSuperOrSchoolAdmin]

    def get_queryset(self):
        u = self.request.user
        qs = ClassRoom.objects.select_related("school").all()
        if getattr(u, "role", "") == "SCHOOL_ADMIN":
            qs = qs.filter(school_id=u.school_id)
        return qs

    def perform_create(self, serializer):
        u = self.request.user
        if getattr(u, "role", "") == "SCHOOL_ADMIN":
            if not u.school_id:
                # hard guard: a school admin must be bound to a school
                raise PermissionError("School admin has no school assigned.")
            serializer.save(school_id=u.school_id)
        else:
            serializer.save()

    def perform_update(self, serializer):
        # prevent SCHOOL_ADMIN from moving a class to a different school
        u = self.request.user
        if getattr(u, "role", "") == "SCHOOL_ADMIN":
            serializer.save(school_id=u.school_id)
        else:
            serializer.save()

# Students: listing scoped + actions for verify/approve
class StudentViewSet(viewsets.ModelViewSet):
    serializer_class = StudentSerializer
    permission_classes = [IsSuperOrSchoolAdmin]

    def get_queryset(self):
        u = self.request.user
        qs = Student.objects.select_related("school","classroom").all()
        if getattr(u, "role", "") == "SCHOOL_ADMIN":
            qs = qs.filter(school_id=u.school_id)
        status = self.request.query_params.get("status")
        if status: qs = qs.filter(status=status)
        classroom = self.request.query_params.get("classroom")
        if classroom: qs = qs.filter(classroom_id=classroom)
        return qs

    @action(detail=True, methods=["post"], permission_classes=[IsSchoolAdmin|IsSuperAdmin])
    def verify(self, request, pk=None):
        student = self.get_object()
        student.status = "VERIFIED"
        student.save()
        return Response({"status": student.status})

    @action(detail=True, methods=["post"], permission_classes=[IsSuperAdmin])
    def approve(self, request, pk=None):
        student = self.get_object()
        student.status = "APPROVED"
        student.save()
        return Response({"status": student.status})

class FormTemplateViewSet(viewsets.ModelViewSet):
    queryset = FormTemplate.objects.select_related("school").all().order_by("-id")
    serializer_class = FormTemplateSerializer
    permission_classes = [SuperAdminWrite_SchoolAdminRead]

    def get_queryset(self):
        u = self.request.user
        qs = super().get_queryset()
        if getattr(u, "role", "") == "SCHOOL_ADMIN":
            qs = qs.filter(school_id=u.school_id)
        return qs

    def perform_create(self, serializer):
        u = self.request.user
        if getattr(u, "role", "") == "SCHOOL_ADMIN":
            if not u.school_id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("School admin has no school assigned.")
            serializer.save(school_id=u.school_id)
        else:
            serializer.save()  # SUPER_ADMIN may pass school/school_id

    def perform_update(self, serializer):
        u = self.request.user
        if getattr(u, "role", "") == "SCHOOL_ADMIN":
            serializer.save(school_id=u.school_id)
        else:
            serializer.save()

class UploadLinkViewSet(viewsets.ModelViewSet):
    serializer_class = UploadLinkSerializer
    queryset = UploadLink.objects.select_related("school","classroom","template").all()
    permission_classes = [SchoolAdminCreateOnly]
    
    def get_queryset(self):
        u = self.request.user
        qs = super().get_queryset()
        if getattr(u, "role", "") == "SCHOOL_ADMIN":
            qs = qs.filter(school_id=u.school_id)
        return qs
    
    # def perform_create(self, serializer):
    #     u = self.request.user
    #     if getattr(u, "role", "") == "SCHOOL_ADMIN":
    #         # attach their school but DO NOT strip template/classroom provided by request
    #         serializer.save(school_id=u.school_id)
    #     else:
    #         serializer.save()

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        link = self.get_object()
        link.is_active = True
        link.save()
        return Response(UploadLinkSerializer(link).data)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        link = self.get_object()
        link.is_active = False
        link.save()
        return Response(UploadLinkSerializer(link).data)

    @action(detail=True, methods=["post"])
    def extend(self, request, pk=None):
        """Extend expiry by N days: { "days": 7 }"""
        link = self.get_object()
        days = int(request.data.get("days", 7))
        link.expires_at = link.expires_at + timezone.timedelta(days=days)
        link.save()
        return Response(UploadLinkSerializer(link).data)

    @action(detail=True, methods=["post"])
    def rotate_token(self, request, pk=None):
        link = self.get_object()
        link.token = uuid.uuid4()
        link.save()
        return Response(UploadLinkSerializer(link).data)
    
    @action(detail=False, methods=["delete"], url_path="cleanup")
    def cleanup_expired(self, request):
        expired = self.get_queryset().filter(expires_at__lt=now())
        count = expired.count()
        expired.delete()
        return Response({"deleted": count})