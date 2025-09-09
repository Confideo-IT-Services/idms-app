from rest_framework import serializers
from .models import School, ClassRoom, Student, UploadLink, FormTemplate, User, IdCardTemplate

class SchoolSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = "__all__"

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        # include password as write-only
        fields = ["id", "username", "password", "first_name", "last_name", "email", "role", "school"]
        extra_kwargs = {
            "password": {"write_only": True},
        }

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance

class SchoolMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = School
        fields = ["id", "name"]

class FormTemplateSerializer(serializers.ModelSerializer):
    school = SchoolMiniSerializer(read_only=True)
    school_id = serializers.PrimaryKeyRelatedField(
        source="school",                      # map incoming school_id -> school
        queryset=School.objects.all(),
        write_only=True,
        required=True                         # required for SUPER_ADMIN create
    )

    class Meta:
        model = FormTemplate
        fields = ["id", "school", "school_id", "name", "fields", "created_at"]

    def get_school_read(self, obj):
        return {"id": obj.school_id, "name": getattr(obj.school, "name", None)}

    def validate(self, attrs):
        u = self.context["request"].user
        if getattr(u, "role", "") == "SUPER_ADMIN":
            if not attrs.get("school") and not getattr(self.instance, "school_id", None):
                raise serializers.ValidationError({"school": "School is required."})
        return attrs

    def create(self, validated_data):
        u = self.context["request"].user
        # SCHOOL_ADMIN write should never reach here due to permission, but be safe:
        if getattr(u, "role", "") != "SUPER_ADMIN":
            raise serializers.ValidationError("Only SUPER_ADMIN can create templates.")
        return super().create(validated_data)

    def update(self, instance, validated_data):
        u = self.context["request"].user
        if getattr(u, "role", "") != "SUPER_ADMIN":
            raise serializers.ValidationError("Only SUPER_ADMIN can modify templates.")
        return super().update(instance, validated_data)
    
class CurrentUserSchool(serializers.CurrentUserDefault):
    # small helper to act as a default for FK
    def __call__(self, serializer_field):
        user = serializer_field.context["request"].user
        return getattr(user, "school", None)

class UploadLinkSerializer(serializers.ModelSerializer):
    # SCHOOL_ADMIN won’t send school; SUPER_ADMIN can read/list but not POST
    school = serializers.PrimaryKeyRelatedField(queryset=School.objects.all(), required=False, allow_null=True, default=CurrentUserSchool())
    classroom = serializers.PrimaryKeyRelatedField(queryset=ClassRoom.objects.all(), required=True)
    template  = serializers.PrimaryKeyRelatedField(queryset=FormTemplate.objects.all(), required=True)

    class Meta:
        model = UploadLink
        fields = ["id", "token", "school", "classroom", "template",
                  "expires_at", "is_active", "notes", "max_uses", "uses_count"]
        read_only_fields = ["id", "token", "uses_count"]
        extra_kwargs = {
            # double-tell DRF that school is not required
            "school": {"required": False, "allow_null": True},
        }

    def validate(self, attrs):
        user = self.context["request"].user
        school = attrs.get("school") or getattr(self.instance, "school", None)
        if getattr(user, "role", "") == "SCHOOL_ADMIN":
            # force school to the user’s school
            school = getattr(user, "school", None)
            attrs["school"] = school

        if school is None:
            raise serializers.ValidationError({"school": "Your account is not assigned to a school."})

        tmpl = attrs.get("template")  or getattr(self.instance, "template", None)
        cls  = attrs.get("classroom") or getattr(self.instance, "classroom", None)

        if tmpl is None:
            raise serializers.ValidationError({"template": "Template is required."})
        if tmpl.school_id != school.id:
            raise serializers.ValidationError({"template": "Template belongs to a different school."})
        if cls and cls.school_id != school.id:
            raise serializers.ValidationError({"classroom": "Classroom belongs to a different school."})
        return attrs

    def create(self, validated_data):
        # At this point SCHOOL_ADMIN already has school in validated_data
        return super().create(validated_data)

    def update(self, instance, validated_data):
        user = self.context["request"].user
        if getattr(user, "role", "") == "SCHOOL_ADMIN":
            validated_data["school"] = user.school
        return super().update(instance, validated_data)

class ClassRoomSerializer(serializers.ModelSerializer):
    school = SchoolSerializer(read_only=True)
    school_id = serializers.PrimaryKeyRelatedField(
        write_only=True, queryset=School.objects.all(), source="school", required=False
    )

    class Meta:
        model = ClassRoom
        fields = ["id", "class_name", "section", "total_students", "school", "school_id"]

class StudentSerializer(serializers.ModelSerializer):
    photo = serializers.ImageField(required=False, allow_null=True)
    class Meta:
        model = Student
        fields = [
            "id", "school", "classroom",
            "full_name", "father_name", "dob", "gender",
            "photo",
            "parent_email", "parent_phone",
            "status",          # <-- include this
            "meta",            # <-- include this (so father_name shows in UI under meta)
            "submitted", "created_at"
        ]
        read_only_fields = ["submitted", "created_at"]

class ParentSubmissionSerializer(serializers.Serializer):
    # full_name = serializers.CharField(max_length=100)
    # dob = serializers.DateField()
    # gender = serializers.ChoiceField(choices=[("Male","Male"),("Female","Female"),("Other","Other")])
    # parent_email = serializers.EmailField(required=False, allow_null=True, allow_blank=True)
    # parent_phone = serializers.CharField(required=False, allow_blank=True, max_length=20)
    # photo = serializers.ImageField(required=True)
    pass

class IdCardTemplateSerializer(serializers.ModelSerializer):
    background_url = serializers.SerializerMethodField()

    class Meta:
        model = IdCardTemplate
        fields = ["id","school","name","background","background_url","fields","is_default","created_at","card_size_mm"]


    def get_background_url(self, obj):
        request = self.context.get("request")
        if obj.background:
            try:
                return request.build_absolute_uri(obj.background.url)
            except Exception:
                return obj.background.url
        return None