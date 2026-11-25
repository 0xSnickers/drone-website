"""Error messages by code and language (see docs/API_CONTRACT.md).

`Accept-Language: zh*` -> Simplified Chinese, otherwise English.
Unknown codes keep their own message.
"""

MESSAGES: dict[str, tuple[str, str]] = {
    "VALIDATION_ERROR": ("请求参数不合法", "Invalid request parameters"),
    "UNAUTHORIZED": ("未登录或登录已过期", "Authentication required"),
    "INVALID_CREDENTIALS": ("邮箱或密码错误", "Invalid email or password"),
    "FORBIDDEN": ("没有权限执行该操作", "Permission denied"),
    "NOT_FOUND": ("接口不存在", "Resource not found"),
    "USER_NOT_FOUND": ("用户不存在", "User not found"),
    "METHOD_NOT_ALLOWED": ("不支持的请求方法", "Method not allowed"),
    "EMAIL_EXISTS": ("该邮箱已注册", "Email already in use"),
    "NOT_READY": ("服务暂不可用", "Service not ready"),
    "INTERNAL_ERROR": ("服务器内部错误", "Internal server error"),
    "INVALID_APP_KEY": ("appKey 无效", "Invalid app key"),
    "IP_BLOCKED": ("该 IP 已被禁止上报", "This IP is blocked"),
    "RATE_LIMITED": ("请求过于频繁，请稍后再试", "Too many requests"),
    "PROJECT_NOT_FOUND": ("项目不存在", "Project not found"),
    "ISSUE_NOT_FOUND": ("异常不存在", "Issue not found"),
    "IP_RULE_NOT_FOUND": ("IP 规则不存在", "IP rule not found"),
    "IP_RULE_EXISTS": ("该 IP 已在黑名单中", "IP is already blocked"),
    "RELEASE_NOT_FOUND": ("发版记录不存在", "Release record not found"),
    "STRESS_RUN_NOT_FOUND": ("压测记录不存在", "Stress run not found"),
    "ADMIN_ACCESS_REQUIRED": (
        "仅管理员或监控查看者可登录管理端",
        "Admin or monitor viewer role required",
    ),
    "AUDIENCE_MISMATCH": (
        "当前登录凭证不适用于此端，请重新登录",
        "Token audience does not match this portal",
    ),
}


def localize(code: str, accept_language: str | None, fallback: str) -> str:
    entry = MESSAGES.get(code)
    if entry is None:
        return fallback
    zh, en = entry
    return zh if (accept_language or "").lower().startswith("zh") else en
