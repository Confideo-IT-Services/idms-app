from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views_admin import (
    UploadLinkViewSet,
    FormTemplateViewSet,
    UserViewSet,
    SchoolViewSet,
    ClassRoomViewSet,
    StudentViewSet,
    IdCardTemplateViewSet,
    DashboardViewSet,
    ChangePasswordView,   # ✅ added here
)
from .views import public_submit_student, public_link_info, public_form_schema, test_api
from .views_admin import PasswordResetRequestView, PasswordResetConfirmView


router = DefaultRouter()
router.register(r"schools", SchoolViewSet, basename="schools")
router.register(r"classes", ClassRoomViewSet, basename="classes")
router.register(r"students", StudentViewSet, basename="students")
router.register(r"upload-links", UploadLinkViewSet, basename="upload-links")
router.register(r"form-templates", FormTemplateViewSet)
router.register(r"users", UserViewSet, basename="users")
router.register(r"id-templates", IdCardTemplateViewSet, basename="id-templates")


urlpatterns = [
    # default router endpoints
    path("", include(router.urls)),

    # public (unauthenticated) routes
    path("public/upload/<uuid:token>/", public_submit_student, name="public-upload"),
    path("public/link/<uuid:token>/", public_link_info, name="public-link-info"),
    path("public/form/<uuid:token>/", public_form_schema),
    path("dashboard/", DashboardViewSet.as_view(), name="api-dashboard"),
    path("test/", test_api),

    # ✅ password change endpoints used by frontend
    path("auth/password/change/", ChangePasswordView.as_view(), name="password-change"),
    path("auth/change-password/", ChangePasswordView.as_view(), name="change-password-alt"),
    path("auth/users/set_password/", ChangePasswordView.as_view(), name="users-set-password"),
    path("auth/password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path("auth/password-reset-confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
]
