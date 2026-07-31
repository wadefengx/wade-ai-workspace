#!/usr/bin/env bash
# 用途: Phase 10 workspace icon 冒烟(创建带 icon -> 列表返回 icon -> 更新 icon -> 删除)
# 前置依赖: 本地 API 已启动在 http://localhost:3001/api ; 已有 admin/admin 演示账号 ; node/curl 可用
# 运行方式: bash .ai/harness/regression/verify-phase10.sh
set -u

BASE="${API_BASE:-http://localhost:3001/api}"
TMP_DIR="$(mktemp -d /tmp/phase10-qa.XXXXXX)"
PASS=0
FAIL=0
ACCESS_TOKEN=""
WORKSPACE_ID=""

cleanup() {
  if [ -n "$WORKSPACE_ID" ] && [ -n "$ACCESS_TOKEN" ]; then
    curl -s -o /dev/null -X DELETE "$BASE/workspaces/$WORKSPACE_ID" -H "Authorization: Bearer $ACCESS_TOKEN" || true
  fi
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

fatal() {
  FAIL=$((FAIL + 1))
  echo "  ✗ $1"
  echo ""
  echo "RESULT: PASS=$PASS FAIL=$FAIL"
  echo "PHASE10_SMOKE_FAIL"
  exit 1
}

echo "== 0. preflight =="
request "health" GET "/health" "" "" "$TMP_DIR/health.json"
if [ "$REQ_STATUS" != "200" ]; then
  assert_status "health" 200
  fatal "测试前置失败: health 检查失败"
fi
echo "  ✓ health 200"

echo "== 1. login =="
request "login" POST "/auth/login" "" '{"email":"admin@wade.local","password":"admin"}' "$TMP_DIR/login.json"
assert_status "1. login 200" 200
ACCESS_TOKEN="$(json_eval "$TMP_DIR/login.json" 'data.accessToken ?? ""' 2>/dev/null)"
[ -n "$ACCESS_TOKEN" ] || fatal "测试前置失败: accessToken 缺失"

RUN_ID="$(date +%s)"
WORKSPACE_NAME="Icon Smoke $RUN_ID"
UPDATED_WORKSPACE_NAME="Icon Smoke Updated $RUN_ID"
INITIAL_ICON="RocketOutlined"
UPDATED_ICON="TeamOutlined"

echo "== 2. create workspace with icon =="
request "create-workspace" POST "/workspaces" "$ACCESS_TOKEN" "{\"name\":\"$WORKSPACE_NAME\",\"icon\":\"$INITIAL_ICON\"}" "$TMP_DIR/create-workspace.json"
assert_status "2. create workspace 201" 201
WORKSPACE_ID="$(json_eval "$TMP_DIR/create-workspace.json" 'data.id ?? ""' 2>/dev/null)"
[ -n "$WORKSPACE_ID" ] || fatal "测试前置失败: workspace id 缺失"
json_true "2. create response returns icon" "$TMP_DIR/create-workspace.json" 'data.icon === "RocketOutlined"'

echo "== 3. list workspace icon =="
request "list-workspaces-1" GET "/workspaces" "$ACCESS_TOKEN" "" "$TMP_DIR/list-workspaces-1.json"
assert_status "3. list workspaces 200" 200
json_true "3. list returns created workspace icon" "$TMP_DIR/list-workspaces-1.json" '(Array.isArray(data) ? data : []).some((item) => item.id === "'"$WORKSPACE_ID"'" && item.name === "'"$WORKSPACE_NAME"'" && item.icon === "RocketOutlined")'

echo "== 4. update workspace icon =="
request "update-workspace" PATCH "/workspaces/$WORKSPACE_ID" "$ACCESS_TOKEN" "{\"name\":\"$UPDATED_WORKSPACE_NAME\",\"icon\":\"$UPDATED_ICON\"}" "$TMP_DIR/update-workspace.json"
assert_status "4. update workspace 200" 200
json_true "4. update response returns new icon" "$TMP_DIR/update-workspace.json" 'data.name === "'"$UPDATED_WORKSPACE_NAME"'" && data.icon === "TeamOutlined"'

request "list-workspaces-2" GET "/workspaces" "$ACCESS_TOKEN" "" "$TMP_DIR/list-workspaces-2.json"
assert_status "5. list workspaces after update 200" 200
json_true "5. list reflects updated icon" "$TMP_DIR/list-workspaces-2.json" '(Array.isArray(data) ? data : []).some((item) => item.id === "'"$WORKSPACE_ID"'" && item.name === "'"$UPDATED_WORKSPACE_NAME"'" && item.icon === "TeamOutlined")'

echo "== 5. delete workspace =="
request "delete-workspace" DELETE "/workspaces/$WORKSPACE_ID" "$ACCESS_TOKEN" "" "$TMP_DIR/delete-workspace.json"
assert_status "6. delete workspace 200" 200
json_true "6. delete returns deleted id" "$TMP_DIR/delete-workspace.json" 'data.id === "'"$WORKSPACE_ID"'"'

request "list-workspaces-3" GET "/workspaces" "$ACCESS_TOKEN" "" "$TMP_DIR/list-workspaces-3.json"
assert_status "7. list workspaces after delete 200" 200
json_true "7. deleted workspace disappears from list" "$TMP_DIR/list-workspaces-3.json" '(Array.isArray(data) ? data : []).every((item) => item.id !== "'"$WORKSPACE_ID"'")'
WORKSPACE_ID=""

echo ""
echo "RESULT: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ] && echo "PHASE10_SMOKE_OK" || echo "PHASE10_SMOKE_FAIL"
if [ "$FAIL" != "0" ]; then
  exit 1
fi
