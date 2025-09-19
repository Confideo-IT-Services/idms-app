from rest_framework import viewsets, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from django.db import IntegrityError, transaction

from .models import School, ClassRoom, Student, UploadLink, SubmissionIndex
from .serializers import SchoolSerializer, ClassRoomSerializer, StudentSerializer, ParentSubmissionSerializer

@api_view(["GET"])
@permission_classes([permissions.AllowAny])
def public_form_schema(request, token):
    """Return the dynamic form schema for this token."""
    link = get_object_or_404(UploadLink, token=token)

    if not link.is_valid():
        return Response({"detail": "Link is invalid or expired."}, status=400)
    
    if not link.template_id or not link.template.fields:
        return Response({"detail": "No form template configured for this link."}, status=400)    

    return Response({
        "school": link.school.name,
        "class": link.classroom.class_name,
        "section": link.classroom.section,
        "expires_at": link.expires_at,
        "fields": link.template.fields,
        "template_id": link.template_id,
        "source": "template"
    })


CORE_MAPPABLE = {"full_name","dob","gender","parent_email","parent_phone","photo"}

@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def public_submit_student(request, token):
    link = get_object_or_404(UploadLink, token=token)
    if not link.is_valid():
        return Response({"detail": "Link is invalid or expired."}, status=400)

    schema = (link.template.fields if link.template else []) or [
        {"name":"full_name","label":"Student Name","type":"text","required":True,"map_to":"full_name"},
        {"name":"parent_phone","label":"Parent Phone","type":"tel","required":True,"map_to":"parent_phone","unique":True},
        {"name":"photo","label":"Photo","type":"file","required":True,"map_to":"photo"},
    ]

    # 1) Validate required fields
    missing = []
    for f in schema:
        if f.get("required"):
            fname = f["name"]
            ftype = f.get("type","text")
            if ftype == "file":
                if fname not in request.FILES:
                    missing.append(fname)
            else:
                if (request.data.get(fname) in [None, ""]):
                    missing.append(fname)
    if missing:
        return Response({"detail": f"Missing required fields: {', '.join(missing)}"}, status=400)

    # 2) Build core kwargs + meta from schema (no hardcoding)
    core_kwargs = {
        "school": link.school,
        "classroom": link.classroom,
        "submitted": True,
        "status": "SUBMITTED",
    }
    meta = {}

    # collect unique constraints to enforce: (field_name, value)
    unique_checks = []

    for f in schema:
        name = f["name"]
        ftype = f.get("type","text")
        map_to = f.get("map_to")  # optional
        val = None

        if ftype == "file":
            if name in request.FILES:
                val = request.FILES[name]
        else:
            val = request.data.get(name)

        if map_to in CORE_MAPPABLE:
            # map to known columns
            if map_to == "dob" and val:
                core_kwargs["dob"] = parse_date(val)
            elif map_to == "photo":
                if val: core_kwargs["photo"] = val
            else:
                if val not in [None, ""]:
                    core_kwargs[map_to] = val
        else:
            # store as meta (stringify non-files)
            if ftype == "file":
                if val:
                    # store just filename in meta for extra files (we only store real file on 'photo' map_to)
                    meta[name] = getattr(val, "name", "uploaded_file")
            else:
                if val not in [None, ""]:
                    meta[name] = val

        if f.get("unique"):
            # Normalize to string for the index
            if ftype == "file":
                norm = getattr(val, "name", "")
            else:
                norm = "" if val is None else str(val).strip()
            if norm:
                unique_checks.append((name, norm))

    # 3) Enforce unique constraints per school
    # DB-level: we’ll create SubmissionIndex rows; if conflict, error out.
    try:
        with transaction.atomic():
            student = Student.objects.create(**core_kwargs, meta=meta)

            for (field_name, field_value) in unique_checks:
                SubmissionIndex.objects.create(
                    school=link.school,
                    field_name=field_name,
                    field_value=field_value,
                    student=student
                )

            # success → increment token usage
            link.uses_count += 1
            link.save()

    except IntegrityError:
        return Response(
            {"detail": "A submission already exists with one of the unique fields you provided."},
            status=400
        )

    return Response({"message": "Submission received", "student_id": student.id}, status=201)

class IsAdminOrReadOnly(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return bool(request.user and request.user.is_staff)

class SchoolViewSet(viewsets.ModelViewSet):
    queryset = School.objects.all()
    serializer_class = SchoolSerializer
    permission_classes = [IsAdminOrReadOnly]

class ClassRoomViewSet(viewsets.ModelViewSet):
    queryset = ClassRoom.objects.select_related("school").all()
    serializer_class = ClassRoomSerializer
    permission_classes = [IsAdminOrReadOnly]

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.select_related("school", "classroom").all()
    serializer_class = StudentSerializer
    permission_classes = [IsAdminOrReadOnly]

@api_view(["GET"])
def public_link_info(request, token):
    """Parents app can fetch what class/school the link corresponds to (and check validity)."""
    link = get_object_or_404(UploadLink, token=token)
    if not link.is_valid():
        return Response({"detail": "Link is invalid or expired."}, status=400)
    return Response({
        "school": link.school.name,
        "class": link.classroom.class_name,
        "section": link.classroom.section,
        "expires_at": link.expires_at
    })

@api_view(['GET'])
def test_api(request):
    return Response({"message": "Backend is working!"})
