from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views_admin import UploadLinkViewSet, FormTemplateViewSet, UserViewSet, SchoolViewSet, ClassRoomViewSet, StudentViewSet, IdCardTemplateViewSet
from .views import public_submit_student, public_link_info, public_form_schema, test_api

router = DefaultRouter()
router.register(r"schools", SchoolViewSet, basename="schools")
router.register(r"classes", ClassRoomViewSet, basename="classes")
router.register(r"students", StudentViewSet, basename="students")
router.register(r"upload-links", UploadLinkViewSet, basename="upload-links")
router.register(r"form-templates", FormTemplateViewSet)
router.register(r"users", UserViewSet, basename="users")
router.register(r"id-templates", IdCardTemplateViewSet, basename="id-templates")

urlpatterns = [
    path("", include(router.urls)),
    path("public/upload/<uuid:token>/", public_submit_student, name="public-upload"),
    path("public/link/<uuid:token>/", public_link_info, name="public-link-info"),
    path("public/form/<uuid:token>/", public_form_schema),   
    path('test/', test_api),
]
