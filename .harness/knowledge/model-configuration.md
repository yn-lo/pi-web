# 模型与认证配置

## 新会话模型

`GET /api/models` 从 `~/.pi/agent/settings.json` 读取 `defaultModel`，ChatWindow 在新会话挂载时预选。浏览器明确选择模型或思考等级时，在 AgentSession 构建时原子应用，并通过 `lib/startup-preferences.ts` 保存有效值；不要通过重放 `set_model` 或 `set_thinking_level` 保存。

## enabledModels

`enabledModels` 使用 Pi 的 `--models` 语义：支持针对 `provider/modelId` 或裸 `modelId` 的 minimatch glob、非 glob 的模糊匹配，以及 `:thinkingLevel` 后缀。

必须用 `lib/model-scope.ts` 的 SDK `resolveModelScopeWithDiagnostics()` 解析，禁止字符串直接比较。没有任何匹配时回退为所有可用模型。`startRpcSession()` 应原子传递 initial model、thinking pin 与 SDK-native `scopedModels`；`GET /api/models` 仅复用解析结果来展示选择器、thinking pins 和 warnings。

## Provider 与凭证

- Providers 的分类由 capability（`auth.apiKey.login`、`auth.oauth`）和实际保存的凭证类型决定，集中在 `lib/provider-listing.ts`；禁止按 provider id 硬编码。双认证 provider 只能出现一次。
- `auth.json` 每个 provider 仅能保存一份凭证。删除必须使用 `removeStoredCredentialIfType()`，在与 Pi auth storage 相同的锁下比对后删除。
- API key 接口使用 `AuthStorage` 保存和删除；状态响应绝不可返回原始 key。
- OAuth/device-code/manual-code 通过 `GET /api/auth/login/[provider]` SSE 流转；人工 code 回传使用带短期 token 的 POST，回调存于 `globalThis.__piLoginCallbacks`。
- 任意认证改变后，UI 必须刷新 API-key 与 OAuth 两个列表，防止双认证 provider 重复渲染。
- 模型测试路由为 `app/api/models-config/test/route.ts`，不存在 `app/api/models/test/`。