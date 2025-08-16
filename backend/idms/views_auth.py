# backend/idcards/views_auth.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    u = request.user
    return Response({
        "username": u.username,
        "role": getattr(u, "role", ""),
        "school_id": getattr(u, "school_id", None),
    })
