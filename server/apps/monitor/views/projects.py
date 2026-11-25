from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.auth.authentication import CanReadMonitor, IsAdmin, IsAdminForWrites
from apps.core.exceptions import AppError
from apps.core.responses import ok, page_result

from ..models import IpRule, Project
from ..serializers import (
    IpRuleInputSerializer,
    IpRuleSerializer,
    ProjectInputSerializer,
    ProjectSerializer,
    ProjectUpdateSerializer,
)
from ..utils import generate_app_key, parse_pagination


class ProjectListCreateView(APIView):
    permission_classes = [IsAuthenticated, CanReadMonitor, IsAdminForWrites]

    def get(self, request):
        page, limit = parse_pagination(request.query_params, default_limit=20)
        qs = Project.objects.all()
        total = qs.count()
        offset = (page - 1) * limit
        items = ProjectSerializer(qs[offset : offset + limit], many=True).data
        return ok(page_result(items, total, page, limit))

    def post(self, request):
        ser = ProjectInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        project = Project.objects.create(
            name=ser.validated_data["name"].strip(),
            description=ser.validated_data.get("description", "").strip(),
            app_key=generate_app_key(),
        )
        return ok(ProjectSerializer(project).data, status=201)


class ProjectDetailView(APIView):
    permission_classes = [IsAuthenticated, CanReadMonitor, IsAdminForWrites]

    def _get(self, project_id: str) -> Project:
        project = Project.objects.filter(pk=project_id).first()
        if project is None:
            raise AppError.not_found("PROJECT_NOT_FOUND", "Project not found")
        return project

    def get(self, request, project_id: str):
        return ok(ProjectSerializer(self._get(project_id)).data)

    def put(self, request, project_id: str):
        project = self._get(project_id)
        ser = ProjectUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        if "name" in ser.validated_data:
            project.name = ser.validated_data["name"].strip()
        if "description" in ser.validated_data:
            project.description = ser.validated_data["description"].strip()
        project.save()
        return ok(ProjectSerializer(project).data)

    def delete(self, request, project_id: str):
        project = self._get(project_id)
        pid = str(project.id)
        project.delete()
        return ok({"id": pid})


class ProjectRotateKeyView(APIView):
    permission_classes = [IsAuthenticated, CanReadMonitor, IsAdmin]

    def post(self, request, project_id: str):
        project = Project.objects.filter(pk=project_id).first()
        if project is None:
            raise AppError.not_found("PROJECT_NOT_FOUND", "Project not found")
        project.app_key = generate_app_key()
        project.save(update_fields=["app_key", "updated_at"])
        return ok(ProjectSerializer(project).data, status=201)


class IpRuleListCreateView(APIView):
    permission_classes = [IsAuthenticated, CanReadMonitor, IsAdminForWrites]

    def get(self, request):
        return ok(IpRuleSerializer(IpRule.objects.all(), many=True).data)

    def post(self, request):
        ser = IpRuleInputSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ip = ser.validated_data["ip"].strip()
        if IpRule.objects.filter(ip=ip).exists():
            raise AppError.conflict("IP_RULE_EXISTS", "IP is already blocked")
        rule = IpRule.objects.create(ip=ip, note=ser.validated_data.get("note", "").strip())
        return ok(IpRuleSerializer(rule).data, status=201)


class IpRuleDeleteView(APIView):
    permission_classes = [IsAuthenticated, CanReadMonitor, IsAdmin]

    def delete(self, request, rule_id: str):
        rule = IpRule.objects.filter(pk=rule_id).first()
        if rule is None:
            raise AppError.not_found("IP_RULE_NOT_FOUND", "IP rule not found")
        rid = str(rule.id)
        rule.delete()
        return ok({"id": rid})
