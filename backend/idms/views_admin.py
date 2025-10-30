# idcards/views_admin.py


from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

# import the serializer you just added
from .serializers import ChangePasswordSerializer
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Count, Q
from .models import School, ClassRoom, Student, UploadLink, FormTemplate, IdCardTemplate, User
import uuid
from .permissions import IsSuperAdmin, IsSchoolAdmin, IsSameSchoolOrSuper, IsSuperOrSchoolAdmin, SuperAdminWrite_SchoolAdminRead,SchoolAdminCreateOnly
from .serializers import *  # your serializers
from .utils import render_card_image
from django.http import FileResponse
from django.template import Template, Context
from xhtml2pdf import pisa
import io
from .utils import generate_id_cards

from .serializers import ChangePasswordSerializer
import secrets
from datetime import timedelta
from django.conf import settings
from django.core.mail import send_mail

RESET_TOKEN_EXPIRY_HOURS = getattr(settings, "PASSWORD_RESET_TOKEN_EXPIRY_HOURS", 1)

# replace your PasswordResetRequestView.post with this version
class PasswordResetRequestView(APIView):
    permission_classes = []  # AllowAny

    def post(self, request):
        from .serializers import PasswordResetRequestSerializer
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"].strip().lower()

        generic_response = {"detail": "If an account exists for that email, a reset link has been sent."}

        # find matching users (case-insensitive)
        users_qs = User.objects.filter(email__iexact=email)
        if not users_qs.exists():
            # don't reveal whether account exists
            return Response(generic_response)

        from .models import PasswordResetToken
        frontend_url = getattr(settings, "FRONTEND_URL", "http://localhost:5173")

        for user in users_qs:
            # create a unique token per user
            token = secrets.token_urlsafe(48)
            expires_at = timezone.now() + timedelta(hours=RESET_TOKEN_EXPIRY_HOURS)
            PasswordResetToken.objects.create(user=user, token=token, expires_at=expires_at)

            reset_link = f"{frontend_url}/reset-password/{token}"
            subject = "IDMS — Password reset request"
            message = f"""Hi {user.get_full_name() or user.username},

We received a request to reset your password for IDMS.

Click the link below to set a new password (the link expires in {RESET_TOKEN_EXPIRY_HOURS} hour(s)):

{reset_link}

If you didn't request a password reset, you can safely ignore this email.

Thanks,
ConfideoIT Services
"""
            try:
                send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
            except Exception as e:
                # still continue; log exception for debugging
                print("Failed sending password reset email for user id", user.id, ":", e)

        return Response(generic_response)


class PasswordResetConfirmView(APIView):
    permission_classes = []
    def post(self, request):
        from .serializers import PasswordResetConfirmSerializer
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]
        new_password = serializer.validated_data["password"]

        from .models import PasswordResetToken
        try:
            prt = PasswordResetToken.objects.select_related("user").get(token=token)
        except PasswordResetToken.DoesNotExist:
            return Response({"detail": "Invalid token"}, status=400)

        if not prt.is_valid():
            return Response({"detail": "Token expired or already used"}, status=400)

        user = prt.user
        user.set_password(new_password)
        user.save()

        # mark used and invalidate any other tokens for this user
        prt.mark_used()
        PasswordResetToken.objects.filter(user=user, used=False).update(used=True)

        # Optionally: you might want to invalidate user sessions/refresh tokens here.

        return Response({"detail": "Password updated successfully"})



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
class ChangePasswordView(APIView):
    """
    Authenticated endpoint for users to change their own password.
    Accepts multiple common payload shapes and returns JSON errors/messages.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        old = serializer.validated_data.get("_old")
        new = serializer.validated_data.get("_new")
        user = request.user

        # verify current password
        if not user.check_password(old):
            return Response({"old_password": ["Current password is incorrect."]}, status=status.HTTP_400_BAD_REQUEST)

        # optional: validate against Django's password validators (AUTH_PASSWORD_VALIDATORS)
        try:
            validate_password(new, user=user)
        except DjangoValidationError as e:
            return Response({"new_password": list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new)
        user.save()
        return Response({"detail": "Password changed successfully."}, status=status.HTTP_200_OK)

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
    
    @action(detail=False, methods=["get"], permission_classes=[IsSuperAdmin])
    def submissions(self, request):
        # SUPER_ADMIN view: see all
        qs = self.get_queryset().filter(status="VERIFIED")
        ser = StudentSerializer(qs, many=True)
        return Response(ser.data)
    
    @action(detail=False, methods=["get"], permission_classes=[IsSuperAdmin])
    def generate_ids(self, request):
        school_id = request.query_params.get("school")
        class_id = request.query_params.get("classroom")
        paper = request.query_params.get("paper", "A4")
        # card_size optionally override: "54x86"
        card_size = request.query_params.get("card_size")
        students = Student.objects.filter(school_id=school_id, classroom_id=class_id, status="VERIFIED")
        try:
            tmpl = IdCardTemplate.objects.get(school_id=school_id, is_default=True)
        except IdCardTemplate.DoesNotExist:
            return Response({"detail": "No default ID card template for this school."}, status=400)

        # optionally override template.card_size_mm if card_size passed
        if card_size:
            try:
                w,h = card_size.split("x")
                tmpl.card_size_mm = {"w": float(w), "h": float(h)}
            except Exception:
                pass

        pdf_buf = generate_id_cards(students, tmpl, paper=paper)
        return FileResponse(pdf_buf, as_attachment=True, filename="idcards.pdf")
    
    @action(detail=True, methods=["post"], url_path="mark-id-generated")
    def mark_id_generated(self, request, pk=None):
        student = self.get_object()
        student.status = "ID_GENERATED"
        student.save(update_fields=["status"])
        return Response({"detail": "Marked as ID_GENERATED"}, status=200)

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
    
    @action(detail=False, methods=["get"], url_path="used-form-templates")
    def used_form_templates(self, request):
        """Return a list of form templates (full objects) that are referenced by upload links for this school."""
        u = request.user
        qs = self.get_queryset().filter(is_active=True)
        # School admins should have get_queryset already scoped to their school
        template_ids = qs.values_list("template_id", flat=True).distinct()
        templates = FormTemplate.objects.filter(id__in=template_ids)
        ser = FormTemplateSerializer(templates, many=True)
        return Response(ser.data)
        
# backend/idcards/views_admin.py
class IdCardTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = IdCardTemplateSerializer
    queryset = IdCardTemplate.objects.select_related("school").all()
    permission_classes = [IsSuperAdmin]   # only SUPER_ADMIN uploads/updates

    def get_queryset(self):
        qs = super().get_queryset()
        u = self.request.user
        if getattr(u, "role", "") == "SCHOOL_ADMIN":
            qs = qs.filter(school_id=u.school_id)
        return qs
    
    def perform_create(self, serializer):
        instance = serializer.save()
        if instance.is_default:
            # unset all others for this school
            IdCardTemplate.objects.filter(school=instance.school).exclude(id=instance.id).update(is_default=False)

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.is_default:
            IdCardTemplate.objects.filter(school=instance.school).exclude(id=instance.id).update(is_default=False)

    @action(detail=True, methods=["get"], url_path="preview")
    def preview(self, request, pk=None):
        """
        Returns a JPEG preview of a single sample student rendered with this template.
        Query params:
           student_id (optional) - use a real student
           sample=true - use synthetic sample
        """
        tpl = get_object_or_404(IdCardTemplate, pk=pk)
        student_id = request.query_params.get("student_id")
        student = None
        if student_id:
            from .models import Student
            try:
                student = Student.objects.get(pk=student_id)
            except Student.DoesNotExist:
                student = None
        if not student:
            # pick any verified student for the school
            from .models import Student
            student = Student.objects.filter(school_id=tpl.school_id, status="VERIFIED").first()
        if not student:
            # build synthetic sample with values for each template field
            class Dummy: pass
            student = Dummy()
            # place sample values into attributes and meta
            student.meta = {}
            for k, cfg in (tpl.fields or {}).items():
                # sample text depending on field name
                if "name" in k.lower():
                    val = "Student Name"
                elif "father" in k.lower():
                    val = "Father Name"
                elif "phone" in k.lower() or "mobile" in k.lower():
                    val = "9999999999"
                elif "dob" in k.lower():
                    val = "01-01-2010"
                else:
                    val = k.replace("_", " ").title()
                # try to set attribute directly if common keys
                setattr(student, k, val)
                student.meta[k] = val
            # add a dummy blank photo so paste_photo skips gracefully
            student.photo = None

        # render PIL image
        img = render_card_image(student, tpl)
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=90)
        buf.seek(0)
        return HttpResponse(buf.read(), content_type="image/jpeg")

    @action(detail=True, methods=["get"], url_path="grid")
    def grid(self, request, pk=None):
        """
        Return grid info for a template and paper/card params.
        Query params:
           paper=A4 or 12x18 or custom (pass width and height as two floats via paper_w_pt & paper_h_pt)
           card_w_mm, card_h_mm (optional override)
           margin_mm, spacing_mm
        """
        tpl = get_object_or_404(IdCardTemplate, pk=pk)
        paper = request.query_params.get("paper", "A4")
        card_w_mm = float(request.query_params.get("card_w_mm") or tpl.card_size_mm.get("w") or 54)
        card_h_mm = float(request.query_params.get("card_h_mm") or tpl.card_size_mm.get("h") or 86)
        margin_mm = float(request.query_params.get("margin_mm") or 10)
        spacing_mm = float(request.query_params.get("spacing_mm") or 3)

        if paper.upper() in PAPER_SIZES:
            paper_w_pt, paper_h_pt = PAPER_SIZES[paper.upper()]
        else:
            # accept custom: provide paper_w_mm & paper_h_mm
            paper_w_mm = float(request.query_params.get("paper_w_mm", 210))
            paper_h_mm = float(request.query_params.get("paper_h_mm", 297))
            paper_w_pt, paper_h_pt = mm_to_pt(paper_w_mm), mm_to_pt(paper_h_mm)

        card_w_pt = mm_to_pt(card_w_mm); card_h_pt = mm_to_pt(card_h_mm)
        margin_pt = mm_to_pt(margin_mm); spacing_pt = mm_to_pt(spacing_mm)

        cols, rows, per_page, x_start_pt, y_top_pt, used_w, used_h = compute_grid(
            paper_w_pt, paper_h_pt, card_w_pt, card_h_pt, margin_pt, spacing_pt
        )

        return Response({
            "paper": paper,
            "paper_w_pt": paper_w_pt, "paper_h_pt": paper_h_pt,
            "card_w_mm": card_w_mm, "card_h_mm": card_h_mm,
            "cols": cols, "rows": rows, "per_page": per_page,
            "margin_mm": margin_mm, "spacing_mm": spacing_mm,
            "used_w_pt": used_w, "used_h_pt": used_h
        })
    

    @action(detail=True, methods=["get"], url_path="preview-for-student")
    def preview_for_student(self, request, pk=None):
        """
        GET /api/id-templates/{pk}/preview-for-student/?student_id=123
        Returns a JPG preview of the ID for the given student rendered with this template.
        """
        tpl = self.get_object()
        student_id = request.query_params.get("student_id")
        student = None
        if student_id:
            try:
                student = Student.objects.get(pk=student_id)
            except Student.DoesNotExist:
                return Response({"detail": "Student not found."}, status=404)

        if student is None:
            # fallback to first verified student in school
            student = Student.objects.filter(school=tpl.school, status="VERIFIED").first()
            if student is None:
                # create synthetic dummy object
                class Dummy: pass
                student = Dummy()
                student.meta = {}
                for k in (tpl.fields or {}).keys():
                    setattr(student, k, k.replace("_", " ").title())
                    student.meta[k] = getattr(student, k)
                student.photo = None

        img = render_card_image(student, tpl)  # PIL image
        buf = BytesIO()
        img.save(buf, format="JPEG", quality=90)
        buf.seek(0)
        return HttpResponse(buf.read(), content_type="image/jpeg")

class DashboardViewSet(APIView):
    permission_classes = [IsAuthenticated]
 
    def get(self, request, format=None):
        user = request.user
       
        # SUPERADMIN: global counts_
        if getattr(user, "role", "") == "SUPER_ADMIN":
            total_schools = School.objects.count()
            total_students = Student.objects.filter(status__in=["VERIFIED", "ID_GENERATED"]).count()
            id_generated = Student.objects.filter(status="ID_GENERATED").count()
            id_pending = Student.objects.filter(status="VERIFIED").count()
            total_templates = IdCardTemplate.objects.count()
            total_upload_links = UploadLink.objects.count()
            return Response({
                "role": "SUPER_ADMIN",
                "schools": total_schools,
                "students": total_students,
                "id_generated": id_generated,
                "id_pending": id_pending,
                "templates": total_templates,
                "upload_links": total_upload_links,
            })
 
        # SCHOOLADMIN: scoped to the admin's school_
        elif getattr(user, "role", "") == "SCHOOL_ADMIN":
            if not user.school_id:
                return Response({"detail": "School admin has no school assigned."}, status=400)
           
            school_id = user.school_id
           
            # Total students in the school
            total_students = Student.objects.filter(school_id=school_id).count()
           
            # Parents submitted = students who have submitted (not PENDING/SUBMITTED status)
            parents_submitted = Student.objects.filter(
                school_id=school_id
            ).exclude(status__in=["PENDING", "SUBMITTED"]).count()
           
            # ID cards generated
            id_generated = Student.objects.filter(
                school_id=school_id,
                status="ID_GENERATED"
            ).count()
           
            # FIXED: Pending = Students waiting for school admin verification (status="SUBMITTED")
            # These are students that parents have submitted but school admin hasn't verified yet
            id_pending = Student.objects.filter(
                school_id=school_id,
                status="SUBMITTED"
            ).count()
           
            # FIXED: Class-wise pending - only SUBMITTED students (waiting for school admin to verify)
            class_counts = Student.objects.filter(
                school_id=school_id
            ).values(
                'classroom_id'
            ).annotate(
                total=Count('id'),
                pending=Count('id', filter=Q(status="SUBMITTED"))
            )
           
            return Response({
                "role": "SCHOOL_ADMIN",
                "school_id": school_id,
                "students": total_students,
                "parents_submitted": parents_submitted,
                "id_generated": id_generated,
                "id_pending": id_pending,
                "class_counts": list(class_counts)
            })
 
        else:
            return Response({"detail": "Unsupported role."}, status=403)
        



        