# 001 Login Success

## 场景

- 已注册用户使用正确邮箱和密码登录,系统返回新的访问令牌与刷新令牌。

## 输入

- Endpoint: `POST /api/auth/login`
- Body:

```json
{
  "email": "alice@example.com",
  "password": "******"
}
```

## 期望输出

- HTTP 200
- 返回 `accessToken`
- 返回 `refreshToken`
- 返回 `user.id / user.email / user.role`

## 断言

1. `accessToken` 为非空字符串。
2. `refreshToken` 为非空字符串。
3. `user.email` 等于请求邮箱。
4. 响应不包含错误字段 `statusCode`。
