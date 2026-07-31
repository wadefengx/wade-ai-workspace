#!/usr/bin/env bash
# 用途: Phase 9 认证冒烟 + channels lastMessageAt + docs .ai/specs 列表验证
# 前置依赖: 本地 API 已启动在 http://localhost:3001/api ; 已有 admin/admin 演示账号 ; node/curl 可用
# 运行方式: bash .ai/harness/regression/verify-phase9.sh
set -u

BASE="${API_BASE:-http://localhost:3001/api}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname "$0")" && pwd)"
REPO_ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)"
TMP_DIR="$(mktemp -d /tmp/phase9-qa.XXXXXX)"
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
  echo "PHASE9_SMOKE_FAIL"
  exit 1
}

echo "== 0. preflight =="
request "health" GET "/health" "" "" "$TMP_DIR/health.json"
if [ "$REQ_STATUS" != "200" ]; then
  assert_status "health" 200
  fatal "测试前置失败: health 检查失败"
fi
echo "  ✓ health 200"

echo "== 1. auth login / refresh / logout =="
request "login" POST "/auth/login" "" '{"email":"admin@wade.local","password":"admin"}' "$TMP_DIR/login.json"
assert_status "1. login 200" 200
ACCESS_TOKEN="$(json_eval "$TMP_DIR/login.json" 'data.accessToken ?? ""' 2>/dev/null)"
REFRESH_TOKEN="$(json_eval "$TMP_DIR/login.json" 'data.refreshToken ?? ""' 2>/dev/null)"
[ -n "$ACCESS_TOKEN" ] || fatal "测试前置失败: accessToken 缺失"
[ -n "$REFRESH_TOKEN" ] || fatal "测试前置失败: refreshToken 缺失"
json_true "1. login returns token alias" "$TMP_DIR/login.json" 'data.token === data.accessToken'
json_true "1. login returns admin user" "$TMP_DIR/login.json" 'data.user?.email === "admin@wade.local"'

request "refresh" POST "/auth/refresh" "" "{\"refreshToken\":\"$REFRESH_TOKEN\"}" "$TMP_DIR/refresh.json"
assert_status "2. refresh 200" 200
ROTATED_ACCESS_TOKEN="$(json_eval "$TMP_DIR/refresh.json" 'data.accessToken ?? ""' 2>/dev/null)"
ROTATED_REFRESH_TOKEN="$(json_eval "$TMP_DIR/refresh.json" 'data.refreshToken ?? ""' 2>/dev/null)"
[ -n "$ROTATED_ACCESS_TOKEN" ] || fatal "测试前置失败: rotated accessToken 缺失"
[ -n "$ROTATED_REFRESH_TOKEN" ] || fatal "测试前置失败: rotated refreshToken 缺失"
ck "2. refresh token rotated" "true" "$([ "$REFRESH_TOKEN" != "$ROTATED_REFRESH_TOKEN" ] && echo true || echo false)"

request "refresh-old" POST "/auth/refresh" "" "{\"refreshToken\":\"$REFRESH_TOKEN\"}" "$TMP_DIR/refresh-old.json"
assert_status "3. old refresh 401" 401
json_true "3. old refresh returns expiry message" "$TMP_DIR/refresh-old.json" 'data.message === "登录已过期,请重新登录"'

echo "== 2. channels =="
request "workspaces" GET "/workspaces" "$ROTATED_ACCESS_TOKEN" "" "$TMP_DIR/workspaces.json"
assert_status "4. list workspaces 200" 200
WORKSPACE_ID="$(json_eval "$TMP_DIR/workspaces.json" '(Array.isArray(data) ? data : []).find((item) => item.name === "Team Alpha")?.id ?? (Array.isArray(data) ? data[0]?.id : "")' 2>/dev/null)"
[ -n "$WORKSPACE_ID" ] || fatal "测试前置失败: 未找到可访问工作区"

request "channels" GET "/workspaces/$WORKSPACE_ID/channels" "$ROTATED_ACCESS_TOKEN" "" "$TMP_DIR/channels.json"
assert_status "5. channels 200" 200
json_true "5. channels include lastMessageAt field" "$TMP_DIR/channels.json" 'Array.isArray(data) && data.length > 0 && data.every((item) => Object.prototype.hasOwnProperty.call(item, "lastMessageAt"))'
json_true "5. channels include general entry" "$TMP_DIR/channels.json" 'Array.isArray(data) && data.some((item) => item.name === "general")'

echo "== 3. docs =="
request "docs-specs" GET "/docs/specs" "$ROTATED_ACCESS_TOKEN" "" "$TMP_DIR/docs-specs.json"
assert_status "6. docs specs 200" 200
EXPECTED_SPECS="$(node -e '
const fs = require("fs");
const path = require("path");
const root = process.argv[1];
const out = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name.endsWith(".md")) out.push(path.basename(entry.name, ".md"));
  }
};
walk(path.join(root, ".ai", "specs"));
process.stdout.write(JSON.stringify(out.sort()));
' "$REPO_ROOT")"
EXPECTED_SPECS_JSON="$EXPECTED_SPECS" json_true "6. docs specs list matches .ai/specs basenames" "$TMP_DIR/docs-specs.json" '
const expected = JSON.parse(process.env.EXPECTED_SPECS_JSON);
const actual = Array.isArray(data) ? data.map((item) => item.name).sort() : [];
expected.every((name) => actual.includes(name))
'
request "docs-spec" GET "/docs/specs/SPEC-phase9" "$ROTATED_ACCESS_TOKEN" "" "$TMP_DIR/docs-spec.json"
assert_status "7. docs spec detail 200" 200
json_true "7. docs spec detail loads content" "$TMP_DIR/docs-spec.json" 'typeof data.content === "string" && data.content.includes("SPEC-Phase 9")'

echo "== 4. logout =="
request "logout" POST "/auth/logout" "$ROTATED_ACCESS_TOKEN" "" "$TMP_DIR/logout.json"
assert_status "8. logout 200" 200
json_true "8. logout returns ok" "$TMP_DIR/logout.json" 'data.ok === true'

request "refresh-after-logout" POST "/auth/refresh" "" "{\"refreshToken\":\"$ROTATED_REFRESH_TOKEN\"}" "$TMP_DIR/refresh-after-logout.json"
assert_status "9. refresh after logout 401" 401
json_true "9. logout invalidates refresh token" "$TMP_DIR/refresh-after-logout.json" 'data.message === "登录已过期,请重新登录"'

echo ""
echo "RESULT: PASS=$PASS FAIL=$FAIL"
[ "$FAIL" = "0" ] && echo "PHASE9_SMOKE_OK" || echo "PHASE9_SMOKE_FAIL"
if [ "$FAIL" != "0" ]; then
  exit 1
fi
