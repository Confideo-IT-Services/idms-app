from rest_framework import serializers
from .models import School, ClassRoom, Student, UploadLink, FormTemplate, User

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

class FormTemplateSerializer(serializers.ModelSerializer):
    school = SchoolSerializer(read_only=True)
    school_id = serializers.PrimaryKeyRelatedField(
        write_only=True, queryset=School.objects.all(), source="school", required=False
    )

    class Meta:
        model = FormTemplate
        fields = ["id", "school", "school_id", "name", "fields", "created_at"]

class UploadLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadLink
        fields = [
            "id", "token", "school", "classroom", "expires_at",
            "is_active", "notes", "max_uses", "uses_count",
        ]
        read_only_fields = ["id", "token", "uses_count"]

class UploadLinkCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadLink
        fields = ["school", "classroom", "expires_at", "is_active", "notes", "max_uses"]

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
            "full_name", "full_name", "dob", "gender",
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
