from django.db import models
from django.contrib.postgres.fields import ArrayField  # if Postgres; not required for JSONField
from django.utils import timezone
from datetime import timedelta
import uuid
from django.contrib.auth.models import AbstractUser

def default_expiry():
    return timezone.now() + timedelta(days=14)

# in idcards/models.py
class User(AbstractUser):
    ROLE_CHOICES = (
        ("SUPER_ADMIN", "Super Admin"),
        ("SCHOOL_ADMIN", "School Admin"),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="SCHOOL_ADMIN")
    school = models.ForeignKey("School", on_delete=models.SET_NULL, null=True, blank=True, related_name="admins")

    def save(self, *args, **kwargs):
        # auto-fix role for true superusers
        if self.is_superuser:
            self.role = "SUPER_ADMIN"
        super().save(*args, **kwargs)

class FormTemplate(models.Model):
    """
    JSON-based form definition.
    Example fields JSON:
    [
      {"name":"full_name","label":"Student Name","type":"text","required":true},
      {"name":"father_name","label":"Father Name","type":"text","required":false},
      {"name":"parent_phone","label":"Parent Phone","type":"tel","required":true},
      {"name":"dob","label":"Date of Birth","type":"date","required":true},
      {"name":"photo","label":"Photo","type":"file","required":true}
    ]
    """
    school = models.ForeignKey("School", on_delete=models.CASCADE, related_name="form_templates")
    name = models.CharField(max_length=80)
    fields = models.JSONField(default=list)  # list of {name,label,type,required,options?}
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.school.name} - {self.name}"

class UploadLink(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    school = models.ForeignKey("School", on_delete=models.CASCADE, related_name="upload_links")
    classroom = models.ForeignKey("ClassRoom", on_delete=models.CASCADE, related_name="upload_links")
    template = models.ForeignKey(FormTemplate, on_delete=models.SET_NULL, null=True, blank=True)
    expires_at = models.DateTimeField(default=default_expiry)
    is_active = models.BooleanField(default=True)
    notes = models.CharField(max_length=255, blank=True, default="")
    max_uses = models.PositiveIntegerField(null=True, blank=True)
    uses_count = models.PositiveIntegerField(default=0)

    def is_valid(self):
        time_ok = timezone.now() < self.expires_at
        active_ok = self.is_active
        uses_ok = (self.max_uses is None) or (self.uses_count < self.max_uses)
        return time_ok and active_ok and uses_ok

    def __str__(self):
        return f"{self.school.name} - {self.classroom.class_name} ({self.token})"


# For file uploads (if not using S3 yet, stored in MEDIA folder)
def student_photo_upload_path(instance, filename):
    return f"photos/{instance.school.name}/{instance.full_name}/{filename}"

class School(models.Model):
    name = models.CharField(max_length=100)
    address = models.TextField()
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

class ClassRoom(models.Model):
    school = models.ForeignKey(School, on_delete=models.CASCADE, related_name='classes')
    class_name = models.CharField(max_length=50)  # e.g., "Grade 1", "Class A"
    section = models.CharField(max_length=10, blank=True, null=True)
    total_students = models.IntegerField()

    def __str__(self):
        return f"{self.class_name} - {self.section} ({self.school.name})"

class Student(models.Model):
    school = models.ForeignKey("School", on_delete=models.CASCADE, related_name="students")
    classroom = models.ForeignKey("ClassRoom", on_delete=models.SET_NULL, null=True, related_name="students")
    full_name = models.CharField(max_length=100, blank=True)
    father_name = models.CharField(max_length=100, blank=True)
    dob = models.DateField(blank=True, null=True)
    gender = models.CharField(max_length=10, blank=True)
    parent_email = models.EmailField(blank=True, null=True)
    parent_phone = models.CharField(max_length=20, blank=True, null=True)
    photo = models.ImageField(upload_to="photos/", blank=True, null=True)
    submitted = models.BooleanField(default=False)
    status = models.CharField(max_length=20, default="SUBMITTED")  # SUBMITTED / VERIFIED / APPROVED
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            # OPTIONAL phone uniqueness per school — this is OK on Student
            models.UniqueConstraint(
                fields=["school", "parent_phone"],
                name="uniq_school_parent_phone",
            ),
        ]

    def __str__(self):
        return self.full_name or f"Student {self.pk}"

class IdCardTemplate(models.Model):
    school = models.ForeignKey("School", on_delete=models.CASCADE, related_name="id_templates")
    name = models.CharField(max_length=100)
    background = models.ImageField(upload_to="id_templates/backgrounds/", blank=True, null=True)
    fields = models.JSONField(default=dict)  # coordinates & styles for placeholders
    created_at = models.DateTimeField(auto_now_add=True)
    is_default = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.school.name} - {self.name}"


class SubmissionIndex(models.Model):
    """
    Generic uniqueness index for arbitrary template fields.
    Uniqueness is enforced per (school, field_name, field_value).
    """
    school = models.ForeignKey("School", on_delete=models.CASCADE)
    field_name = models.CharField(max_length=100)
    field_value = models.CharField(max_length=255)
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name="unique_index", null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["school", "field_name", "field_value"],
                name="uniq_index_school_field_value",
            ),
        ]

    def __str__(self):
        return f"{self.school_id}:{self.field_name}={self.field_value}"