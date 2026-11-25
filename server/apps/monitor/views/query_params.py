from ..serializers import MonitorQuerySerializer
from ..utils import resolve_time_window


def query_context(params):
    serializer = MonitorQuerySerializer(data=params)
    serializer.is_valid(raise_exception=True)
    query = serializer.validated_data
    return query.get("projectId"), resolve_time_window(query["range"], query.get("tz"))
