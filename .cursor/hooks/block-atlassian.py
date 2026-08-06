#!/usr/bin/env python3
import json
import sys

BLOCKED_MARKERS = ("atlassian", "plugin-atlassian")

DENY_RESPONSE = {
    "permission": "deny",
    "user_message": "Atlassian MCP is disabled in this project.",
    "agent_message": (
        "Atlassian MCP (Jira/Confluence) is blocked by a project hook in this "
        "workspace. Do not call Atlassian MCP tools or use Atlassian skills that "
        "require MCP access here."
    ),
}


def is_blocked(value):
    if value is None:
        return False
    text = str(value).lower()
    return any(marker in text for marker in BLOCKED_MARKERS)


def parse_tool_input(raw):
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return None
        return parsed if isinstance(parsed, dict) else None
    return None


def deny():
    print(json.dumps(DENY_RESPONSE))
    sys.exit(2)


def main():
    try:
        data = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        print(f"block-atlassian hook: invalid JSON input: {exc}", file=sys.stderr)
        sys.exit(1)

    hook_event = data.get("hook_event_name", "")
    tool_name = data.get("tool_name", "")
    tool_input = parse_tool_input(data.get("tool_input"))

    candidates = [
        data.get("server"),
        data.get("command"),
        data.get("url"),
    ]

    if tool_input is not None:
        candidates.extend(
            [
                tool_input.get("server"),
                tool_input.get("uri"),
            ]
        )

    if hook_event == "preToolUse":
        if tool_name in {"CallMcpTool", "FetchMcpResource"}:
            server = tool_input.get("server") if tool_input else None
            if is_blocked(server):
                deny()
        print(json.dumps({"permission": "allow"}))
        return

    if any(is_blocked(candidate) for candidate in candidates):
        deny()

    print(json.dumps({"permission": "allow"}))


if __name__ == "__main__":
    main()
