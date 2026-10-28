# Access Token Authentication Specification

**Version:** 1.1.0  
**Target:** React Native SDK Implementation  
**Source of truth:** React SDK (`react-autolocalise`)

| Reference | Path |
|-----------|------|
| Token lifecycle implementation | `src/services/translation.ts` |
| Unit tests (achieve parity) | `src/services/__tests__/translation.test.ts` |
| Config validation | `src/utils/validation.ts` |
| Type definitions | `src/types.ts` |
| Constants | `src/constants.ts` |

---

## Overview

This specification describes access token authentication for the React Native SDK. It enables short-lived token-based auth as an alternative to long-lived API keys, with automatic refresh and expiry handling.

**Goal:** Implement the same client-side token behavior as the React SDK's `TranslationService`. The RN SDK does not call AutoLocalise's `/auth-token` endpoint or store API keys.

---

## 0. Implementation Scope

### What the RN SDK implements

- Configuration validation (`apiKey` **or** `getAccessToken`, mutually exclusive)
- In-memory token state (current token, expiry time)
- Proactive refresh (60s before expiry) and reactive refresh (401/403 `token_expired`)
- Request queuing during token refresh; parallel replay after token is ready
- Include `accessToken` in JSON body of translation API calls
- Invoke the app's `getAccessToken` callback when a token is needed
- Graceful degradation on auth failures (log, return null, do not crash the app)

### What the RN SDK does **not** implement

- User backend endpoints (e.g. `/api/autolocalise-token`)
- Calls to AutoLocalise `POST /auth-token` (that is the **app developer's backend**)
- Persisting access tokens to AsyncStorage, SecureStore, or disk
- SSR / server-side translation (React-only; not applicable to typical RN apps)

### Responsibility split

| Layer | Owner | Role |
|-------|-------|------|
| AutoLocalise API | Platform | Issues short-lived tokens via `POST /auth-token` (API key in header) |
| User backend | App developer | Holds API key; proxies token requests to AutoLocalise |
| RN SDK | RN team | Token lifecycle; calls `getAccessToken`; sends `accessToken` in API bodies |
| App | App developer | Supplies `getAccessToken` that fetches from their backend |

---

## 1. Configuration

### 1.1 Authentication Methods

The SDK supports **two mutually exclusive** authentication methods:

| Method | Config Field | Description |
|--------|--------------|-------------|
| API Key | `apiKey: string` | Long-lived key (backward compatibility) |
| Access Token | `getAccessToken: () => Promise<AccessTokenResponse>` | Callback to fetch short-lived token |

**Validation Rules:**
- Exactly one method must be provided
- If `apiKey` is provided, it must be non-empty after trimming whitespace
- If `getAccessToken` is provided, it must be a function
- Validate on service construction (throw `ConfigurationError` immediately)

### 1.2 Type Definitions

Mirror these types from `src/types.ts`:

```typescript
interface TranslationConfig {
  apiKey?: string;
  getAccessToken?: () => Promise<AccessTokenResponse>;
  sourceLocale: string;
  targetLocale: string;
}

interface AccessTokenResponse {
  accessToken: string;
  expiresAt: number | string; // Unix ms timestamp OR ISO 8601 date string
}

class ConfigurationError extends Error {
  name = "ConfigurationError";
}

class AccessTokenError extends Error {
  name = "AccessTokenError";
  constructor(message: string, public originalError?: unknown) {}
}
```

### 1.3 Access Token Response

The `getAccessToken` callback must return:

| Field | Type | Description |
|-------|------|-------------|
| `accessToken` | `string` | JWT or opaque token string |
| `expiresAt` | `number \| string` | Unix timestamp (ms) or ISO 8601 date string |

**Behavior:** Accept both `expiresAt` formats and normalize to an internal millisecond timestamp:

```typescript
tokenExpiryTime =
  typeof expiresAt === "string"
    ? new Date(expiresAt).getTime()
    : expiresAt;
```

---

## 2. Token Lifecycle

### 2.1 Constants

| Constant | Value | Rationale |
|----------|-------|-----------|
| `TOKEN_EXPIRY_SAFETY_BUFFER_MS` | 60000 (60s) | Prevents requests failing due to token expiry during network transit |
| `MAX_RETRY_ATTEMPTS` | 1 | Limit retries after token refresh to avoid infinite loops |

Default API base URL (configurable): see `API_BASE_URL` in `src/constants.ts`.

### 2.2 Token Expiry Logic

A token is considered **expired** when:
1. No token has been fetched yet, OR
2. `Date.now() >= (tokenExpiryTime - TOKEN_EXPIRY_SAFETY_BUFFER_MS)`

**Why the safety buffer?** A token might expire between the expiry check and the actual API call. The 60-second buffer ensures the token is still valid when the request reaches the server.

### 2.3 Token Refresh Triggers

The `getAccessToken` callback is invoked when:

| Trigger | Condition | Behavior |
|---------|-----------|----------|
| SDK Initialization | No valid token exists | Await token fetch before other API calls |
| Proactive Refresh | Within 60s of expiry | Refresh before actual expiry |
| Server Error | API returns 401/403 with `token_expired` | Refresh and retry the failed request |

---

## 3. Request Flow

### 3.1 Authentication Method Selection

```
┌─────────────────────────────────────────────────────────────┐
│                    API Request Flow                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Check authentication method                             │
│     ├─ apiKey configured → include apiKey in request body   │
│     └─ getAccessToken configured → check token state        │
│                                                             │
│  2. If using access token:                                  │
│     ├─ Token expired? → Queue request, fetch token first    │
│     └─ Token valid? → Include accessToken in request body   │
│                                                             │
│  3. POST to AutoLocalise API (credentials in JSON body)     │
│                                                             │
│  4. Handle response:                                        │
│     ├─ Success → Return response                            │
│     ├─ 401/403 + token_expired → Refresh token, retry once  │
│     └─ Other error → Log error, return null                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Important:** Credentials go in the **JSON request body**, not an `Authorization` header.

### 3.2 Concurrent Request Handling

When multiple API calls occur during token refresh:

```
Timeline:
─────────────────────────────────────────────────────────>

Request A ──┐
Request B ──┼──► [QUEUED] ──► [Token Refresh] ──► [Process Queue]
Request C ──┘        │                              │
                     │                              ├─► Execute A
                     │                              ├─► Execute B
                     │                              └─► Execute C
                     └─ All wait for same token
```

**Behavior:**
- First request triggers token refresh
- Subsequent requests queue and wait
- After token is fetched, all queued requests execute in parallel
- If token fetch fails during proactive refresh, reject all queued requests (`AccessTokenError`)

### 3.3 Retry Logic

```
┌────────────────────────────────────────────────────────────┐
│                   Token Expired Error Flow                 │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  API returns 401/403 with token_expired error              │
│           │                                                │
│           ▼                                                │
│  Is refresh already in progress?                           │
│     ├─ Yes → Queue this request (increment retry count)  │
│     └─ No  → Initiate refresh, then retry request          │
│                                                            │
│  Retry count >= MAX_RETRY_ATTEMPTS?                        │
│     ├─ Yes → Log error, return null                        │
│     └─ No  → Continue with retry                           │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 4. State Management

### 4.1 Required Internal State

| State | Purpose |
|-------|---------|
| `currentAccessToken` | Include in API request bodies |
| `tokenExpiryTime` | Determine when to refresh |
| `isTokenRefreshing` | Prevent concurrent refresh attempts |
| `pendingRequests` | Hold requests during refresh |

### 4.2 State Transitions

```
                    ┌──────────────┐
                    │  No Token    │
                    └──────┬───────┘
                           │ fetchAccessToken()
                           ▼
                    ┌──────────────┐
         ┌─────────│ Valid Token  │◄─────────┐
         │         └──────┬───────┘          │
         │                │                  │
    expires or            │            token refresh
    401 error             │                  │
         │                ▼                  │
         │         ┌──────────────┐          │
         └────────►│  Expired     │──────────┘
                   └──────────────┘
```

---

## 5. Initialization Flow

```
┌────────────────────────────────────────────────────────────┐
│                    SDK Initialization                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. Validate configuration                                 │
│     └─ Must have exactly one: apiKey OR getAccessToken     │
│                                                            │
│  2. If using access token AND token expired/missing:       │
│     └─ Fetch token BEFORE other API operations             │
│                                                            │
│  3. Load cached translations (AsyncStorage — not token)  │
│                                                            │
│  4. Fetch existing translations from API                   │
│                                                            │
│  5. Mark as initialized                                    │
│                                                            │
│  Error Handling:                                           │
│  - Token fetch failure → Log error, still mark initialized │
│  - Reason: Don't block app startup                         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 6. Error Handling

### 6.1 Error Types

| Error | When Raised | Behavior |
|-------|-------------|----------|
| `ConfigurationError` | Invalid config (missing/both auth methods, empty apiKey) | Throw immediately on construction |
| `AccessTokenError` | `getAccessToken` throws or returns invalid data | Wrap original error; reject queued requests on proactive refresh failure |

### 6.2 Error Handling Principles

1. **Never throw on token fetch failure during runtime API calls** → Log and return `null`
2. **Never crash the host application** → Graceful degradation
3. **Log all errors** → For debugging
4. **Reject all queued requests on fatal token error during proactive refresh** → Clean state

---

## 7. API Contract

All translation endpoints use `POST` with `Content-Type: application/json`. Auth credentials are in the **body**, not headers.

### 7.1 Translate Request

`POST {API_BASE_URL}/v1/translate`

```typescript
interface TranslationRequest {
  texts: Array<{
    hashkey: string;
    text: string;
    persist: boolean;
    reference?: string;
  }>;
  sourceLocale: string;
  targetLocale: string;
  apiKey?: string;       // when using API key auth
  accessToken?: string;  // when using token auth
  version: string;       // e.g. "react-native-v1.0.0"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `texts[]` | Yes | Array of text objects to translate |
| `sourceLocale` | Yes | Source language code (BCP 47) |
| `targetLocale` | Yes | Target language code |
| `apiKey` | Conditional | Present when using API key auth |
| `accessToken` | Conditional | Present when using token auth |
| `version` | Yes | RN SDK version string |

### 7.2 Get Translations Request

`POST {API_BASE_URL}/v1/translations`

```typescript
interface GetTranslationsRequest {
  targetLocale: string;
  lastRefreshTime?: number; // optional incremental sync timestamp
  apiKey?: string;
  accessToken?: string;
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `targetLocale` | Yes | Target language code |
| `lastRefreshTime` | No | Timestamp for incremental sync |
| `apiKey` | Conditional | Present when using API key auth |
| `accessToken` | Conditional | Present when using token auth |

### 7.3 Server Error Response (Translation APIs)

When a token expires mid-request, the server returns:
- HTTP Status: `401` or `403`
- Body: `{ "error": "token_expired" }` OR `{ "code": "token_expired" }`

SDK must check both `error` and `code` fields before treating as token expiry.

### 7.4 Auth Token Endpoint (App Developer Backend — Not RN SDK)

The RN SDK **does not** call this endpoint. Documented here so implementers understand the full flow when debugging app integrations.

The **app developer's backend** exchanges an API key for a short-lived token:

```
POST {autolocalise_url}/auth-token
Header: x-api-key: <api-key>
Body: (empty)

Response 200:
{
  "accessToken": "<token>",
  "expiresAt": <unix_ms_timestamp>   // or ISO 8601 string
}
```

**Auth pattern summary:**

| Call | Who makes it | Auth mechanism |
|------|--------------|----------------|
| `POST /auth-token` | App developer's backend | `x-api-key` header |
| `POST /v1/translate` | RN SDK | `accessToken` or `apiKey` in JSON body |
| `POST /v1/translations` | RN SDK | `accessToken` or `apiKey` in JSON body |

---

## 8. App Developer Integration (Not SDK Implementation)

This section is for **app developers** using the RN SDK. RN SDK implementers should not build this into the SDK.

### 8.1 User Backend Token Proxy

The app developer provides a backend that:
1. Authenticates the client (session, JWT, etc.)
2. Calls AutoLocalise `POST /auth-token` with their API key in `x-api-key`
3. Returns `{ accessToken, expiresAt }` to the app

```
App (RN)                  User Backend              AutoLocalise API
  │                            │                          │
  │  GET /api/autolocalise-token│                          │
  │───────────────────────────►│                          │
  │                            │  POST /auth-token        │
  │                            │  Header: x-api-key       │
  │                            │─────────────────────────►│
  │                            │                          │
  │                            │  { accessToken, expiresAt}
  │                            │◄─────────────────────────│
  │  { accessToken, expiresAt} │                          │
  │◄───────────────────────────│                          │
```

### 8.2 RN App Configuration Examples

**With Access Token (recommended):**

```typescript
const config = {
  getAccessToken: async () => {
    const res = await fetch("https://your-api.com/autolocalise-token");
    if (!res.ok) throw new Error("Token fetch failed");
    return res.json(); // { accessToken, expiresAt }
  },
  sourceLocale: "en",
  targetLocale: "es",
};
```

**With API Key (simple / dev only):**

```typescript
const config = {
  apiKey: "your-api-key",
  sourceLocale: "en",
  targetLocale: "es",
};
```

---

## 9. React Native Notes

| Topic | Guidance |
|-------|----------|
| Token storage | Memory only — never AsyncStorage or SecureStore |
| Translation cache | AsyncStorage is OK for translation data (separate from tokens) |
| `getAccessToken` | App may attach session cookies or app JWT when calling their backend; SDK only awaits the callback |
| Network | Use `fetch` or equivalent; credentials in JSON body |
| Background / slow network | Same queue + refresh logic applies; no special RN handling required |
| Locale switch | New config instance per locale; token state does not persist across instances |

---

## 10. Testing Scenarios

Achieve parity with `src/services/__tests__/translation.test.ts` ("Access Token Flow" describe block).

| Scenario | Expected Behavior |
|----------|-------------------|
| Init with no token | `getAccessToken` called; token stored in memory |
| Init with valid token | Skip token fetch if not expired |
| Proactive refresh | Refresh when within 60s of expiry |
| Concurrent requests during refresh | Queue all; execute in parallel after token ready |
| 401/403 `token_expired` response | Refresh token; retry request once |
| Token fetch failure during proactive refresh | Reject queued requests; log; don't crash |
| Token fetch failure during init | Log error; still mark initialized |
| `accessToken` in request body | Present on `/v1/translate` and `/v1/translations` |
| Both `apiKey` and `getAccessToken` | Throw `ConfigurationError` |
| Neither auth method | Throw `ConfigurationError` |
| Empty/whitespace `apiKey` | Throw `ConfigurationError` |
| `expiresAt` as ISO string | Parse to ms timestamp |
| `expiresAt` as Unix ms | Use directly |
| Locale change with new config | Independent token state per service instance |

---

## 11. Security Considerations

| Consideration | Implementation |
|---------------|----------------|
| Short-lived tokens | Server enforces expiry (e.g., 1 hour) |
| API key protection | Never embed API key in RN app; use backend token proxy |
| Automatic refresh | SDK handles refresh transparently via `getAccessToken` |
| Token storage | Memory only — never persist to disk or cache |
| Graceful degradation | Failed auth does not crash the app |

---

## 12. Implementation Checklist

- [ ] Configuration validation for mutually exclusive auth methods (`ConfigurationError`)
- [ ] Type definitions matching `src/types.ts`
- [ ] Token state tracking (`currentAccessToken`, `tokenExpiryTime`, `isTokenRefreshing`)
- [ ] Token expiry check with `TOKEN_EXPIRY_SAFETY_BUFFER_MS`
- [ ] Token fetch via `getAccessToken` callback
- [ ] Request queuing during refresh
- [ ] Queue processing after token ready (parallel replay)
- [ ] Reject queued requests on proactive refresh failure (`AccessTokenError`)
- [ ] 401/403 `token_expired` error handling (check `error` and `code` fields)
- [ ] Retry logic with `MAX_RETRY_ATTEMPTS` limit
- [ ] Include `accessToken` in JSON body (not headers) for translation APIs
- [ ] Include `version` string on translate requests
- [ ] Initialization fetches token before `/v1/translations`
- [ ] Init failure does not block app startup
- [ ] Unit tests achieving parity with `translation.test.ts` Access Token Flow tests
- [ ] Do **not** implement `/auth-token` or user backend inside the SDK

---

*End of Specification*
