#!/usr/bin/env bash
# Purpose: Phase 6 e2e verification for members + agents + user search + AI stream
# Prerequisites: local API running at http://localhost:3001/api; alice/bob/carol test accounts exist; node and curl available
# Run: bash .ai/harness/regression/verify-phase6.sh
set -u

BASE="${API_BASE:-http://localhost:3001/api}"
TMP_DIR="$(mktemp -d /tmp/phase6-qa.XXXXXX)"
PASS=0
FAIL=0

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

ck() { # ck <desc> <expected> <actual>
  if [ "$2" = "$3" ]; then
    PASS=$((PASS + 1))
    echo "  ✓ $1 ($3)"
  else
    FAIL=$((FAIL + 1))
    echo "  ✗ $1 (expect $2 got $3)"
  fi
}

pretty_body() {
  local file="$1"
  if [ ! -s "$file" ]; then
    echo "    <empty body>"
    return
  fi

  node - "$file" <<'NODE'
const fs = require("fs");
const raw = fs.readFileSync(process.argv[2], "utf8");
try {
  console.log(JSON.stringify(JSON.parse(raw), null, 2));
} catch {
  process.stdout.write(raw);
  if (!raw.endsWith("\n")) {
    process.stdout.write("\n");
  }
}
NODE
}

request() { # request <name> <method> <path> <token> <json-or-empty> <body-file>
  local name="$1"
  local method="$2"
  local path="$3"
  local token="$4"
  local json="${5:-}"
  local body_file="$6"
  local err_file="$TMP_DIR/${name}.err"
  local status=""
  local rc=0
  local -a cmd=(curl -sS -o "$body_file" -w '%{http_code}' -X "$method" "$BASE$path")

  if [ -n "$token" ]; then
    cmd+=(-H "Authorization: Bearer $token")
  fi

  if [ -n "$json" ]; then
    cmd+=(-H 'Content-Type: application/json' -d "$json")
  fi

  status="$("${cmd[@]}" 2>"$err_file")" || rc=$?

  REQ_NAME="$name"
  REQ_RC="$rc"
  REQ_STATUS="${status:-000}"
  REQ_BODY="$body_file"
  REQ_ERR="$err_file"
}

show_request_failure() {
  if [ "${REQ_RC:-0}" -ne 0 ]; then
    echo "    curl error:"
    sed 's/^/    /' "$REQ_ERR"
  fi

  if [ "${REQ_STATUS:-000}" = "500" ] || [ "${REQ_STATUS:-000}" = "000" ]; then
    echo "    response:"
    pretty_body "$REQ_BODY" | sed 's/^/    /'
  fi
}

assert_status() { # assert_status <desc> <expected>
  local desc="$1"
  local expected="$2"
  ck "$desc" "$expected" "$REQ_STATUS"
  if [ "$expected" != "$REQ_STATUS" ]; then
    show_request_failure
  fi
}

json_eval() { # json_eval <file> <js-expr using data>
  node -e '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const value = eval(process.argv[2]);
if (value === undefined || value === null) process.stdout.write("");
else if (typeof value === "object") process.stdout.write(JSON.stringify(value));
else process.stdout.write(String(value));
' "$1" "$2"
}

json_true() { # json_true <desc> <file> <expr>
  local desc="$1"
  local file="$2"
  local expr="$3"
  local actual
  actual="$(json_eval "$file" "$expr" 2>/dev/null || echo "__JSON_ERROR__")"
  ck "$desc" "true" "$actual"
  if [ "$actual" != "true" ]; then
    echo "    body:"
    pretty_body "$file" | sed 's/^/    /'
  fi
}

text_true() { # text_true <desc> <file> <expr using text>
  local desc="$1"
  local file="$2"
  local expr="$3"
  local actual
  actual="$(node -e '
const fs = require("fs");
const text = fs.readFileSync(process.argv[1], "utf8");
const value = eval(process.argv[2]);
process.stdout.write(String(value));
' "$file" "$expr" 2>/dev/null || echo "__TEXT_ERROR__")"
  ck "$desc" "true" "$actual"
  if [ "$actual" != "true" ]; then
    echo "    body:"
    pretty_body "$file" | sed 's/^/    /'
  fi
}

fatal() { # fatal <message> [count_fail=1]
  local message="$1"
  local count_fail="${2:-1}"
  if [ "$count_fail" = "1" ]; then
    FAIL=$((FAIL + 1))
  fi
  echo "  ✗ $1"
  echo ""
  echo "RESULT: PASS=$PASS FAIL=$FAIL"
  echo "PHASE6_E2E_FAIL"
  exit 1
}

ensure_registered() { # ensure_registered <name> <email>
  local name="$1"
  local email="$2"
  request "register-${name}" POST "/auth/register" "" "{\"name\":\"$name\",\"email\":\"$email\",\"password\":\"password123\"}" "$TMP_DIR/register-${name}.json"
  if [ "$REQ_STATUS" = "201" ] || [ "$REQ_STATUS" = "409" ]; then
    echo "  ✓ ensure $email registered ($REQ_STATUS)"
  else
    ck "ensure $email registered" "201|409" "$REQ_STATUS"
    show_request_failure
    fatal "Test prerequisite failed: could not ensure $email is registered"
  fi
}

echo "== 0. preflight =="
request "health" GET "/health" "" "" "$TMP_DIR/health.json"
if [ "$REQ_STATUS" = "200" ]; then
  echo "  ✓ health 200"
else
  FAIL=$((FAIL + 1))
  echo "  ✗ health (expect 200 got $REQ_STATUS)"
  show_request_failure
  echo ""
  echo "RESULT: PASS=$PASS FAIL=$FAIL"
  echo "PHASE6_E2E_FAIL"
  exit 1
fi

echo "== 1. setup =="
request "alice-login" POST "/auth/login" "" '{"email":"alice@wade.local","password":"password123"}' "$TMP_DIR/alice-login.json"
if [ "$REQ_STATUS" != "200" ]; then
  assert_status "alice login" 200
  fatal "Test prerequisite failed: alice login failed" 0
fi
ALICE_TOKEN="$(json_eval "$TMP_DIR/alice-login.json" 'data.token ?? ""' 2>/dev/null)"
[ -n "$ALICE_TOKEN" ] || fatal "Test prerequisite failed: alice token is missing"

request "admin-login" POST "/auth/login" "" '{"email":"admin@wade.local","password":"admin"}' "$TMP_DIR/admin-login.json"
if [ "$REQ_STATUS" != "200" ]; then
  assert_status "admin login" 200
  fatal "Test prerequisite failed: admin login failed" 0
fi
ADMIN_TOKEN="$(json_eval "$TMP_DIR/admin-login.json" 'data.token ?? ""' 2>/dev/null)"
[ -n "$ADMIN_TOKEN" ] || fatal "Test prerequisite failed: admin token is missing"

request "alice-workspaces" GET "/workspaces" "$ALICE_TOKEN" "" "$TMP_DIR/alice-workspaces.json"
if [ "$REQ_STATUS" != "200" ]; then
  assert_status "alice workspaces" 200
  fatal "Test prerequisite failed: could not read workspace list" 0
fi
WORKSPACE_ID="$(json_eval "$TMP_DIR/alice-workspaces.json" '(Array.isArray(data) ? data : []).find((item) => item.name === "Team Alpha")?.id ?? ""' 2>/dev/null)"
[ -n "$WORKSPACE_ID" ] || fatal "Test prerequisite failed: Team Alpha workspaceId was not found"

request "channels" GET "/workspaces/$WORKSPACE_ID/channels" "$ALICE_TOKEN" "" "$TMP_DIR/channels.json"
if [ "$REQ_STATUS" != "200" ]; then
  assert_status "list channels" 200
  fatal "Test prerequisite failed: could not read channel list" 0
fi
GENERAL_CHANNEL_ID="$(json_eval "$TMP_DIR/channels.json" '(Array.isArray(data) ? data : []).find((item) => item.name === "general")?.id ?? ""' 2>/dev/null)"
[ -n "$GENERAL_CHANNEL_ID" ] || fatal "Test prerequisite failed: general channel was not found"

ensure_registered "Carol" "carol@wade.local"

# Idempotent cleanup: remove bob/carol members left by the previous run and reset agent configuration
request "members-list" GET "/workspaces/$WORKSPACE_ID/members" "$ALICE_TOKEN" "" "$TMP_DIR/members-before.json"
for _email in bob@wade.local carol@wade.local; do
  _mid="$(json_eval "$TMP_DIR/members-before.json" "(Array.isArray(data) ? data : []).find((item) => item.email === \"$_email\")?.id ?? \"\"" 2>/dev/null)"
  if [ -n "$_mid" ]; then
    curl -s -o /dev/null -X DELETE "$BASE/members/$_mid" -H "Authorization: Bearer $ALICE_TOKEN" || true
  fi
done
request "agents-before" GET "/workspaces/$WORKSPACE_ID/agents" "$ALICE_TOKEN" "" "$TMP_DIR/agents-before.json"
# Reset agent configuration to its initial state (the API cannot clear apiKey, so the test environment updates the database directly)
mongosh --quiet mongodb://127.0.0.1:27017/wade_workspace --eval 'db.Agent.updateMany({}, {$set: {providerConfigRef: null}})' > /dev/null 2>&1 || true

echo "== 2. members =="
request "add-bob" POST "/workspaces/$WORKSPACE_ID/members" "$ALICE_TOKEN" '{"email":"bob@wade.local"}' "$TMP_DIR/add-bob.json"
assert_status "1. add bob 201" 201

request "add-bob-dup" POST "/workspaces/$WORKSPACE_ID/members" "$ALICE_TOKEN" '{"email":"bob@wade.local"}' "$TMP_DIR/add-bob-dup.json"
assert_status "2. duplicate add bob 409" 409

request "add-missing" POST "/workspaces/$WORKSPACE_ID/members" "$ALICE_TOKEN" '{"email":"nobody-phase6@wade.local"}' "$TMP_DIR/add-missing.json"
assert_status "3. add unregistered 404" 404

request "add-owner" POST "/workspaces/$WORKSPACE_ID/members" "$ALICE_TOKEN" '{"email":"bob@wade.local","role":"OWNER"}' "$TMP_DIR/add-owner.json"
assert_status "4. add OWNER 400" 400

request "bob-login" POST "/auth/login" "" '{"email":"bob@wade.local","password":"password123"}' "$TMP_DIR/bob-login.json"
if [ "$REQ_STATUS" != "200" ]; then
  assert_status "5. bob login 200" 200
  fatal "Test prerequisite failed: bob login failed" 0
fi
BOB_TOKEN="$(json_eval "$TMP_DIR/bob-login.json" 'data.token ?? ""' 2>/dev/null)"
[ -n "$BOB_TOKEN" ] || fatal "Test prerequisite failed: bob token is missing"

request "bob-workspaces" GET "/workspaces" "$BOB_TOKEN" "" "$TMP_DIR/bob-workspaces.json"
assert_status "5. bob can list workspaces 200" 200
json_true "5. bob sees Team Alpha" "$TMP_DIR/bob-workspaces.json" '(Array.isArray(data) ? data : []).some((item) => item.name === "Team Alpha")'

request "members-after-bob" GET "/workspaces/$WORKSPACE_ID/members" "$ALICE_TOKEN" "" "$TMP_DIR/members-after-bob.json"
if [ "$REQ_STATUS" != "200" ]; then
  assert_status "list members for ids" 200
  fatal "Test prerequisite failed: could not read member list" 0
fi
BOB_MEMBER_ID="$(json_eval "$TMP_DIR/members-after-bob.json" '(Array.isArray(data) ? data : []).find((item) => item.email === "bob@wade.local")?.id ?? ""' 2>/dev/null)"
ALICE_MEMBER_ID="$(json_eval "$TMP_DIR/members-after-bob.json" '(Array.isArray(data) ? data : []).find((item) => item.email === "alice@wade.local")?.id ?? ""' 2>/dev/null)"
[ -n "$BOB_MEMBER_ID" ] || fatal "Test prerequisite failed: bob memberId was not found"
[ -n "$ALICE_MEMBER_ID" ] || fatal "Test prerequisite failed: alice memberId was not found"

request "promote-bob" PATCH "/members/$BOB_MEMBER_ID" "$ALICE_TOKEN" '{"role":"ADMIN"}' "$TMP_DIR/promote-bob.json"
assert_status "6. promote bob to ADMIN 200" 200

request "bob-add-carol" POST "/workspaces/$WORKSPACE_ID/members" "$BOB_TOKEN" '{"email":"carol@wade.local"}' "$TMP_DIR/bob-add-carol.json"
assert_status "7. bob as ADMIN adds carol 201" 201

request "demote-bob" PATCH "/members/$BOB_MEMBER_ID" "$ALICE_TOKEN" '{"role":"MEMBER"}' "$TMP_DIR/demote-bob.json"
assert_status "8. alice demotes bob to MEMBER 200" 200

request "bob-add-after-demote" POST "/workspaces/$WORKSPACE_ID/members" "$BOB_TOKEN" '{"email":"nobody-after-demote@wade.local"}' "$TMP_DIR/bob-add-after-demote.json"
assert_status "8. bob as MEMBER add member 403" 403

request "patch-owner" PATCH "/members/$ALICE_MEMBER_ID" "$ALICE_TOKEN" '{"role":"MEMBER"}' "$TMP_DIR/patch-owner.json"
assert_status "9. patch OWNER target 403" 403

request "delete-owner" DELETE "/members/$ALICE_MEMBER_ID" "$ALICE_TOKEN" "" "$TMP_DIR/delete-owner.json"
assert_status "10. delete OWNER target 403" 403

request "members-after-carol" GET "/workspaces/$WORKSPACE_ID/members" "$ALICE_TOKEN" "" "$TMP_DIR/members-after-carol.json"
if [ "$REQ_STATUS" != "200" ]; then
  assert_status "list members before carol delete" 200
  fatal "Test prerequisite failed: could not refresh member list" 0
fi
CAROL_MEMBER_ID="$(json_eval "$TMP_DIR/members-after-carol.json" '(Array.isArray(data) ? data : []).find((item) => item.email === "carol@wade.local")?.id ?? ""' 2>/dev/null)"
[ -n "$CAROL_MEMBER_ID" ] || fatal "Test prerequisite failed: carol memberId was not found"

request "delete-carol" DELETE "/members/$CAROL_MEMBER_ID" "$ALICE_TOKEN" "" "$TMP_DIR/delete-carol.json"
assert_status "11. alice deletes carol 200" 200

echo "== 3. agents =="
request "list-agents-1" GET "/workspaces/$WORKSPACE_ID/agents" "$ALICE_TOKEN" "" "$TMP_DIR/list-agents-1.json"
assert_status "12. list agents 200" 200
json_true "12. agents response is array" "$TMP_DIR/list-agents-1.json" 'Array.isArray(data)'
AGENT_ID="$(json_eval "$TMP_DIR/list-agents-1.json" '(Array.isArray(data) ? data : [])[0]?.id ?? ""' 2>/dev/null)"
[ -n "$AGENT_ID" ] || fatal "Test prerequisite failed: agents list is empty; cannot continue PATCH/stream verification"

request "patch-agent-no-key" PATCH "/agents/$AGENT_ID" "$ALICE_TOKEN" '{"providerConfig":{"model":"qwen3:8b","baseUrl":"http://127.0.0.1:11434/v1"}}' "$TMP_DIR/patch-agent-no-key.json"
assert_status "13. patch agent without apiKey 200" 200
json_true "13. providerConfig.hasApiKey === false" "$TMP_DIR/patch-agent-no-key.json" 'data.providerConfig?.hasApiKey === false'

request "patch-agent-with-key" PATCH "/agents/$AGENT_ID" "$ALICE_TOKEN" '{"providerConfig":{"model":"qwen3:8b","baseUrl":"http://127.0.0.1:11434/v1","apiKey":"sk-test"}}' "$TMP_DIR/patch-agent-with-key.json"
assert_status "14. patch agent with apiKey 200" 200
json_true "14. response hasApiKey === true" "$TMP_DIR/patch-agent-with-key.json" 'data.providerConfig?.hasApiKey === true'

request "list-agents-2" GET "/workspaces/$WORKSPACE_ID/agents" "$ALICE_TOKEN" "" "$TMP_DIR/list-agents-2.json"
assert_status "14. list agents after apiKey 200" 200
json_true "14. list agents hasApiKey === true" "$TMP_DIR/list-agents-2.json" '(Array.isArray(data) ? data : []).some((item) => item.id === "'"$AGENT_ID"'" && item.providerConfig?.hasApiKey === true)'
json_true "14. list agents does not expose apiKey" "$TMP_DIR/list-agents-2.json" '(Array.isArray(data) ? data : []).every((item) => !("apiKey" in (item.providerConfig ?? {})))'

echo "== 4. AI stream =="
request "ai-stream" POST "/channels/$GENERAL_CHANNEL_ID/ai/stream" "$ALICE_TOKEN" '{"content":"@AI \u8bf7\u53ea\u56de\u590d ok"}' "$TMP_DIR/ai-stream.txt"
assert_status "15. ai stream 200" 200
text_true "15. ai stream has token event" "$TMP_DIR/ai-stream.txt" 'text.split(/\n/).filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6))).some((event) => event.type === "token" && typeof event.content === "string" && event.content.length > 0)'
text_true "15. ai stream has done event" "$TMP_DIR/ai-stream.txt" 'text.split(/\n/).filter((line) => line.startsWith("data: ")).map((line) => JSON.parse(line.slice(6))).some((event) => event.type === "done")'

echo "== 5. users search =="
request "user-search-bob" GET "/users/search?q=bob" "$ADMIN_TOKEN" "" "$TMP_DIR/user-search-bob.json"
assert_status "16. search bob 200" 200
json_true "16. search bob contains bob" "$TMP_DIR/user-search-bob.json" '(Array.isArray(data) ? data : []).some((item) => (item.email ?? "").includes("bob") || (item.name ?? "").includes("bob"))'

request "user-search-empty" GET "/users/search?q=" "$ADMIN_TOKEN" "" "$TMP_DIR/user-search-empty.json"
assert_status "16. empty search 200" 200
json_true "16. empty search returns users list" "$TMP_DIR/user-search-empty.json" 'Array.isArray(data) && data.length > 0'

request "user-search-no-token" GET "/users/search?q=bob" "" "" "$TMP_DIR/user-search-no-token.json"
assert_status "16. search without token 401" 401

echo ""
echo "RESULT: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ] && echo "PHASE6_E2E_OK" || echo "PHASE6_E2E_FAIL"
