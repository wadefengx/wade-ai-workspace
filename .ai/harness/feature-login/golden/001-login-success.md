# 001 Login Success

## Scenario

- A registered user signs in with the correct email and password, and the system returns new access and refresh tokens.

## Input

- Endpoint: `POST /api/auth/login`
- Body:

```json
{
  "email": "alice@example.com",
  "password": "******"
}
```

## Expected output

- HTTP 200
- Returns `accessToken`
- Returns `refreshToken`
- Returns `user.id / user.email / user.role`

## Assertions

1. `accessToken` is a non-empty string.
2. `refreshToken` is a non-empty string.
3. `user.email` equals the requested email.
4. The response does not include the `statusCode` error field.
