from django.contrib import admin

from .models import School, ClassRoom, Student, UploadLink

admin.site.register(UploadLink)
admin.site.register(School)
admin.site.register(ClassRoom)
admin.site.register(Student)
