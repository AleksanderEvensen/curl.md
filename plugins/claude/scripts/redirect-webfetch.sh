#!/bin/sh
set -eu

case "${CLAUDE_PLUGIN_OPTION_webfetch_redirect:-true}" in
0 | [Ff][Aa][Ll][Ss][Ee])
  # Drain the hook payload before exiting so callers piping JSON into stdin do not hit EPIPE.
  cat >/dev/null || true
  exit 0
  ;;
*) ;;
esac

cat <<'EOF'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Use the curl.md plugin fetch tool instead of built-in WebFetch for URL reads. Retry with fetch using the same url, and map the WebFetch prompt to objective."
  }
}
EOF
