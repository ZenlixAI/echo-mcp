# Echo MCP 产品与技术设计文档

## 0. 文档用途

本文档定义一个名为 **Echo MCP** 的 MCP Server / Tool 方案。  
它的目标不是执行业务逻辑，而是为 Agent 与 Client 提供一种**基于 MCP tool call 返回值承载结构化消息**的通用机制。

本文档面向：

- 产品经理
- 技术架构师
- MCP Server 实现工程师
- Agent / Skill 开发者
- Client 集成工程师

本文档的写法假设读者将基于它直接实现 Echo MCP，或为 Agent 编写配套 Skill。

---

# 1. 背景与问题定义

## 1.1 背景

在现有 Agent 系统中，Agent 往往只能通过自然语言文本向外表达中间状态、阶段信息、报告大纲、结构化结果等内容。  
这会带来几个问题：

1. Client 难以稳定提取特定结构的数据
2. 同一类数据缺少统一 schema 和校验
3. 业务侧若想在消息流中消费这些内容，往往需要在 SDK 或协议层做额外扩展
4. 如果想让 Agent 输出“供程序消费”的结果，单纯依赖自然语言或松散 JSON 都不够稳

## 1.2 核心问题

要解决的不是“Agent 能否输出 JSON”，而是：

**如何在不改造底层 ACP / SDK 协议的前提下，让 Agent 在现有消息流中稳定地产生可识别、可校验、可过滤、可编排的结构化消息。**

## 1.3 设计思路

利用一种“几乎什么也不做”的 MCP 工具来承载结构化消息：

- Agent 将结构化 payload 作为 Tool Input 发给 Echo MCP
- Echo MCP 对 payload 做可选 schema 校验
- 校验通过后，Echo MCP **原样返回该 payload**
- Client 从 tool return 中获取这条结构化消息，并按 schema id 或其它字段进行处理

这样，结构化消息不需要成为底层协议新增能力，而是通过标准 MCP tool call 返回值嵌入现有消息流中。

---

# 2. 产品定位

## 2.1 Echo MCP 是什么

Echo MCP 是一个 **结构化消息承载与校验工具集**，提供三类能力：

1. **Schema Registry**：注册 session 级 schema
2. **Schema Discovery**：查询当前 session 中可用的 schema
3. **Echo / Emit**：接收 payload，按指定 schema 校验，成功后原样返回

## 2.2 Echo MCP 不是什么

Echo MCP 不是：

- 业务工具
- 事件总线
- 渲染层协议
- 业务语义命名系统
- 权限管理系统
- 幂等更新系统
- 状态管理框架

它只提供底层能力，不做业务层限制。

---

# 3. 产品目标与非目标

## 3.1 产品目标

Echo MCP 必须支持以下目标：

### 目标 1：让 Agent 输出结构化消息
Agent 可以通过调用 Echo MCP，在 MCP 消息流中发出结构化结果。

### 目标 2：支持按 schema 校验
如果某条结构化消息指定了 schema id，Echo MCP 应对 payload 做校验。

### 目标 3：支持 session 级 schema 管理
schema 的注册、发现和生命周期都限定在 session 范围内。

### 目标 4：允许 schemaless 输出
系统必须允许无需预注册 schema 的结构化输出。

### 目标 5：尽量不增加集成负担
不要求 ACP SDK 或底层消息协议做二次开发。

### 目标 6：适合被 Skill 驱动
Agent 开发者可以通过 Skill 约定：
- 何时 emit
- 用什么 schema id
- payload 结构是什么
- 触发条件是什么

## 3.2 非目标

Echo MCP 不负责以下能力：

- 定义业务事件模型
- 规定 event_type 命名体系
- 统一状态机语义
- 定义阶段事件与状态快照的区别
- 规定“有序大纲”的顺序字段表示方式
- 自动渲染 UI
- 对消息进行业务补偿
- 跨 session 的 schema 共享
- schema 版本管理
- schema 引用与组合
- update / patch / merge 语义
- 权限与多租户治理

---

# 4. 关键设计结论

本节是整个方案的硬性结论。

## 4.1 结构化消息的载体

**Echo MCP 的输出载体就是 MCP tool call 的返回值。**

不依赖 side-effect stream item。  
不要求 client 支持额外的协议扩展。  
client 只需观察 tool return 即可。

## 4.2 要解决的是“结构化消息协议”，实现方式是“特殊 MCP 工具”

从产品本质上看，需求是结构化消息协议。  
从落地方式上看，通过一个特殊 MCP 工具来实现，是最轻量、最现实的办法。

## 4.3 输入 schema 与输出 schema 相同

Echo MCP 是“接收合法 payload，原样返回 payload”的工具。

因此：

- 输入 schema = 输出 schema
- 不存在独立的 response schema 设计问题

## 4.4 schema 作用域

schema id 在 **session 维度唯一**。  
schema 的注册、发现、持久化都以 session 为边界。

## 4.5 不做 schema 版本化

若 schema 变更，直接使用新的 schema id。  
不引入显式 version 字段与升级机制。

## 4.6 支持 schemaless

允许无 schema 输出。  
建议以一个预置 schema id 明确表达 schemaless，而不是完全依赖省略字段。

## 4.7 错误属于协议错误

校验失败、schema 不存在、注册冲突等，属于 Echo MCP 协议失败，不是业务失败。

## 4.8 采用 append 思维，而不是 update 思维

Echo MCP 更适合做“追加一条结构化消息”，而不是“覆盖之前的消息”。

若业务需要“更新状态”，应通过 payload 自带标识与版本信息，由 client 自行折叠。

## 4.9 Skill 与 schema 的关系

- Echo MCP 自身可附带一个“如何使用 Echo MCP”的通用 Skill
- 业务 schema 的定义、触发条件和 payload 语义由业务层 Skill 决定
- Echo MCP 不承担业务 schema 的语义定义责任

## 4.10 schema 对外表达与内部校验

推荐方案：

- **对外 schema 表达：JSON Schema**
- **内部运行时校验：Zod**

原因：

- JSON Schema 更适合 discovery、交换、跨语言理解
- Zod 更适合在 TypeScript / Node.js 环境内执行校验

---

# 5. 用户故事

## 5.1 工作阶段输出

Agent 在执行复杂任务时，按阶段 emit 结构化消息，例如：

- `analysis_started`
- `retrieving_documents`
- `draft_completed`

client 可以据此展示进度或控制 UI。

## 5.2 有顺序的报告大纲

Agent 将大纲作为结构化数组发给 Echo MCP。  
client 获取后可直接渲染成目录树或导航结构。

## 5.3 特定 schema 的 JSON 结果

业务方定义一个结果 schema，例如：

- `customer_summary_v1`
- `risk_assessment_v1`
- `travel_plan_v1`

Agent 按该 schema 组装 payload，Echo MCP 校验并返回，client 直接消费。

## 5.4 多次 emit 中间产物

Agent 可以在一个任务中多次调用 Echo MCP，输出多个结构化节点，而不需要等待最终自然语言回答。

---

# 6. 总体架构

## 6.1 架构概览

Echo MCP 由三部分组成：

### A. Session Schema Registry
维护当前 session 内已注册的 schema。

### B. Validation Engine
将已注册 schema 转换为可执行校验器，对 echo 请求进行验证。

### C. Echo Tools
对外暴露一组 MCP tools，供 Agent / Client 调用。

## 6.2 逻辑关系

```text
Agent / Client
   |
   | MCP Tool Call
   v
Echo MCP Server
   |- Session Registry
   |- Schema Discovery
   |- Validation Engine
   \- Echo / Emit Tool
   |
   | Tool Result
   v
Agent / Client
```

---

# 7. 术语定义

## 7.1 Schema
用于约束 payload 结构的定义。  
在 Echo MCP 中，schema 为 session 级注册对象。

## 7.2 Schema ID
schema 在 session 内的唯一标识符。  
不承担业务语义命名责任，但业务方可自行命名得更有语义。

## 7.3 Payload
Echo MCP 接收并回显的结构化数据对象。

## 7.4 Schemaless
无需预注册 schema 的输出模式。  
Echo MCP 在该模式下不做结构校验，只做基本请求结构检查。

## 7.5 Echo / Emit
将 payload 交给 Echo MCP 校验并原样返回的操作。  
“emit”更符合产品语义，“echo”更符合工具语义。  
实现时可任选一种主命名，建议文档中同时说明。

---

# 8. 作用域与边界

## 8.1 Session 级作用域

Echo MCP 的所有 schema 都只在当前 session 中有效。  
不同 session 的 schema 互相不可见。

## 8.2 持久化边界

session 生命周期内，schema registry 应保持可查询状态。  
当 session 结束时，registry 可销毁。

## 8.3 无权限模型

当前版本不设计权限与角色控制。  
默认 session 内参与方可调用本 session 的 Echo MCP 工具。

## 8.4 无 schema 组合

不支持：

- `$ref`
- schema include
- schema inheritance
- schema composition orchestration

可以接受 JSON Schema 自身局部特性，但产品层面不对组合特性做承诺。

---

# 9. Tool 设计

推荐 Echo MCP 暴露以下 MCP tools。

---

## 9.1 `register_schema`

### 作用
在当前 session 中注册一个 schema。

### 输入

```json
{
  "schema_id": "report_outline_v1",
  "description": "Ordered outline for a report",
  "schema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "items": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "index": { "type": "integer" },
            "heading": { "type": "string" }
          },
          "required": ["index", "heading"],
          "additionalProperties": false
        }
      }
    },
    "required": ["title", "items"],
    "additionalProperties": false
  }
}
```

### 语义
- 在当前 session 中创建一个 schema 注册项
- `schema_id` 必须在当前 session 内唯一
- `schema` 推荐使用 JSON Schema 表达
- `description` 可选但建议提供，便于 discovery

### 输出

```json
{
  "ok": true,
  "schema_id": "report_outline_v1",
  "description": "Ordered outline for a report"
}
```

### 错误条件
- `schema_id` 已存在
- `schema` 非法
- 请求体不合法

---

## 9.2 `list_schemas`

### 作用
列出当前 session 中已注册的 schema。

### 输入

```json
{}
```

### 输出

```json
{
  "schemas": [
    {
      "schema_id": "__schemaless__",
      "description": "Built-in schema for unvalidated payload echo",
      "builtin": true
    },
    {
      "schema_id": "report_outline_v1",
      "description": "Ordered outline for a report",
      "builtin": false
    }
  ]
}
```

### 说明
- 应包含内置 schemaless schema
- 结果面向 discovery 场景，不必返回完整 schema 内容

---

## 9.3 `get_schema`

### 作用
查询某个 schema 的详细定义。

### 输入

```json
{
  "schema_id": "report_outline_v1"
}
```

### 输出

```json
{
  "schema_id": "report_outline_v1",
  "description": "Ordered outline for a report",
  "builtin": false,
  "schema": {
    "...": "..."
  }
}
```

### 错误条件
- schema 不存在

---

## 9.4 `echo`

### 作用
接收 payload，按指定 schema 校验，通过后原样返回。

### 输入

```json
{
  "schema_id": "report_outline_v1",
  "payload": {
    "title": "Q2 Review",
    "items": [
      { "index": 1, "heading": "Executive Summary" },
      { "index": 2, "heading": "Financial Highlights" }
    ]
  }
}
```

### 输出

```json
{
  "ok": true,
  "schema_id": "report_outline_v1",
  "payload": {
    "title": "Q2 Review",
    "items": [
      { "index": 1, "heading": "Executive Summary" },
      { "index": 2, "heading": "Financial Highlights" }
    ]
  }
}
```

### 语义
- 若 `schema_id` 对应已注册 schema，则执行校验
- 若 `schema_id` 为内置 schemaless id，则不做 schema 校验
- 成功时 `payload` 必须与输入完全一致
- Echo MCP 不对 payload 做语义转换、标准化或补全

### 错误条件
- `schema_id` 不存在
- payload 不符合 schema
- 请求结构不合法

---

# 10. 推荐的协议 envelope

为了让 client 更容易统一处理，建议所有 Echo MCP 返回值采用稳定 envelope，而不是返回裸 payload。

---

## 10.1 成功返回格式

```json
{
  "ok": true,
  "schema_id": "some_schema_id",
  "payload": { "...": "..." }
}
```

### 字段说明
- `ok`: 固定为 `true`
- `schema_id`: 本次 echo 使用的 schema id
- `payload`: 与请求完全一致的 payload

---

## 10.2 错误返回格式

```json
{
  "ok": false,
  "error": {
    "code": "SCHEMA_VALIDATION_FAILED",
    "message": "Payload does not conform to schema 'report_outline_v1'.",
    "schema_id": "report_outline_v1",
    "details": [
      {
        "path": "/items/0/index",
        "message": "Expected integer, received string"
      }
    ]
  }
}
```

### 字段说明
- `ok`: 固定为 `false`
- `error.code`: 机器可读错误码
- `error.message`: 人类可读错误说明
- `error.schema_id`: 相关 schema id
- `error.details`: 字段级错误详情，建议包含路径与说明

---

# 11. 错误码设计

建议至少支持以下错误码。

## 11.1 `INVALID_REQUEST`
请求结构本身非法，例如缺少必要字段。

## 11.2 `SCHEMA_ALREADY_EXISTS`
注册 schema 时，当前 session 中已有同名 schema id。

## 11.3 `SCHEMA_NOT_FOUND`
请求使用了不存在的 schema id。

## 11.4 `INVALID_SCHEMA_DEFINITION`
传入的 schema 定义本身非法，无法接受或无法编译。

## 11.5 `SCHEMA_VALIDATION_FAILED`
payload 不符合目标 schema。

## 11.6 `INTERNAL_ERROR`
服务内部异常。  
仅用于不可预期错误，不应用来承载校验类问题。

---

# 12. schemaless 设计

## 12.1 为什么 schemaless 是必要的

部分场景下，业务方只想把结构化对象放进消息流，不想先注册 schema。  
例如：

- 快速实验
- 临时调试
- 粗粒度结构化输出
- agent 仅需要一个机械可解析对象

## 12.2 推荐表示方式

建议内置一个固定 schema id，例如：

```text
__schemaless__
```

也可使用其它保留名，但应满足：

- 明确
- 不歧义
- 可 discovery
- 可被 client 稳定识别

## 12.3 schemaless 模式的行为

当 `schema_id = "__schemaless__"` 时：

- 不做 payload 结构校验
- 仍做请求 envelope 的基本合法性检查
- 成功时原样返回 payload

---

# 13. event_type 与 schema_id 的关系

## 13.1 不应强绑定

`schema_id` 主要表示“结构约束”，不是“业务语义类别”。  
因此不建议将 `schema_id` 直接视为 `event_type`。

## 13.2 推荐做法

- Echo MCP 协议层只要求 `schema_id`
- 如果业务需要更强语义，可在 `payload` 中自带 `event_type`

例如：

```json
{
  "schema_id": "workflow_stage_v1",
  "payload": {
    "event_type": "analysis_started",
    "stage": "analysis",
    "ts": "2026-03-30T12:00:00Z"
  }
}
```

## 13.3 原因

这样可以保持职责分离：

- `schema_id`：结构标识
- `event_type`：业务语义标识

即使两者在某些场景看起来重复，也不应在协议层混为一谈。

---

# 14. append vs update 设计决策

## 14.1 推荐原则

Echo MCP 默认采用 **append 语义**。

也就是说，每次调用 `echo` 都代表：

**产生一条新的结构化消息**

而不是修改以前的某条消息。

## 14.2 为什么不用 update 语义

update 语义会引入额外复杂性：

- 消息身份标识
- 覆盖规则
- 并发冲突
- 顺序一致性
- 最终视图折叠逻辑

这超出了 Echo MCP 的职责边界。

## 14.3 若业务需要“更新”

让 payload 自带这些字段即可：

- `entity_id`
- `sequence`
- `revision`
- `supersedes`

由 client 决定如何把多条 append 消息折叠为“当前状态”。

---

# 15. 多次 emit 与流式 emit

## 15.1 多次 emit

必须支持。  
一个任务中，Agent 可以多次调用 `echo`，分别输出不同结构化消息。

这是 Echo MCP 的自然使用方式。

## 15.2 流式 emit

本设计**不要求 Echo MCP 实现 transport-level streaming**。  
推荐通过“多次 tool call”模拟流式体验。

例如：

1. emit 阶段开始
2. emit 中间大纲
3. emit 最终结果

这样既符合现有 MCP 工具模式，也避免引入复杂的流式协议设计。

---

# 16. Session 生命周期与持久化

## 16.1 生命周期

schema registry 生命周期与 session 一致：

- session 创建后可注册
- session 存续期间可查询 / 使用
- session 结束后可销毁

## 16.2 持久化要求

“session 级持久化”意味着：

- 在 session 生命周期内，schema 注册结果应被保留
- 不能要求每次 emit 前重复注册 schema

实现上可以采用：

- 内存存储
- 会话上下文存储
- session scope KV store

具体取决于 MCP Server 运行环境。

## 16.3 不要求跨 session 恢复

当前版本不要求：

- session 重启后自动恢复
- 跨 session schema 迁移
- 全局 schema registry

---

# 17. 数据模型设计

以下给出推荐的数据结构。

---

## 17.1 Schema Registry Entry

```ts
type SchemaId = string;

interface SchemaRegistryEntry {
  schemaId: SchemaId;
  description?: string;
  builtin: boolean;
  schema: JsonSchema | null;
  validator: ZodTypeAny | null;
  createdAt: string;
}
```

说明：

- `schema`：对外表达，推荐 JSON Schema
- `validator`：内部执行器，推荐 Zod 编译结果
- 内置 schemaless entry 可令 `schema = null`、`validator = null`

---

## 17.2 Echo Success Result

```ts
interface EchoSuccessResult<T = unknown> {
  ok: true;
  schema_id: string;
  payload: T;
}
```

---

## 17.3 Echo Error Result

```ts
interface EchoErrorResult {
  ok: false;
  error: {
    code:
      | "INVALID_REQUEST"
      | "SCHEMA_ALREADY_EXISTS"
      | "SCHEMA_NOT_FOUND"
      | "INVALID_SCHEMA_DEFINITION"
      | "SCHEMA_VALIDATION_FAILED"
      | "INTERNAL_ERROR";
    message: string;
    schema_id?: string;
    details?: Array<{
      path?: string;
      message: string;
    }>;
  };
}
```

---

# 18. 校验引擎设计

## 18.1 对外：JSON Schema

推荐 `register_schema` 接收 JSON Schema，原因：

- 可序列化
- 可 discovery
- 可跨语言理解
- 便于未来客户端消费

## 18.2 对内：Zod

推荐在服务内部将 schema 转为 Zod 校验器。  
理由：

- TypeScript 实现方便
- 错误信息结构化较好
- 运行时校验体验更佳

## 18.3 兼容策略

推荐以 JSON Schema 作为“注册输入的官方格式”。  
内部实现可以：

- 直接用支持 JSON Schema 的校验库
- 或将 JSON Schema 转为 Zod
- 或采用 AJV 做官方校验，再映射错误格式

尽管前面推荐“内部 Zod”，但实现层允许根据工程实际改用 AJV。  
只要满足以下外部契约即可：

1. schema 注册接口输入格式稳定
2. echo 校验行为稳定
3. 错误结构稳定

**如果团队实现 JSON Schema -> Zod 转换成本较高，允许直接使用 AJV 作为实际校验器。**  
产品层不强制内部必须是 Zod，只要求“若内部使用 Zod，这是推荐路线”。

---

# 19. 推荐实现方案

## 19.1 推荐技术栈

如果使用 TypeScript / Node.js：

- MCP Server SDK
- JSON Schema 校验：AJV 或等价库
- 可选内部类型层：Zod
- Session Storage：内存 Map 或 session-scoped storage

## 19.2 Registry 存储结构

推荐：

```ts
Map<SessionId, Map<SchemaId, SchemaRegistryEntry>>
```

## 19.3 内置 schema 初始化

每个 session 初始化时，应自动插入：

```text
__schemaless__
```

对应 entry：

- `builtin = true`
- `schema = null`
- `validator = null`

---

# 20. 推荐请求处理流程

## 20.1 `register_schema` 流程

1. 解析请求
2. 检查 `schema_id` 是否存在
3. 校验 schema 定义是否合法
4. 编译校验器
5. 写入当前 session registry
6. 返回成功结果

## 20.2 `list_schemas` 流程

1. 定位当前 session
2. 读取 registry
3. 返回简要列表

## 20.3 `get_schema` 流程

1. 解析 `schema_id`
2. 在当前 session registry 中查找
3. 找不到则报错
4. 返回 schema 详情

## 20.4 `echo` 流程

1. 解析请求
2. 检查 `schema_id`
3. 在当前 session registry 中查找 schema
4. 若不存在，返回 `SCHEMA_NOT_FOUND`
5. 若为 schemaless，直接成功返回
6. 若为普通 schema，执行 payload 校验
7. 校验失败则返回 `SCHEMA_VALIDATION_FAILED`
8. 校验成功则原样返回 payload

---

# 21. Agent 与 Skill 的集成方式

## 21.1 Echo MCP 自带通用 Skill

Echo MCP 可提供一个通用 Skill，说明：

- 什么时候适合使用 Echo MCP
- 如何先 discovery schema
- 如何使用 `echo`
- schemaless 模式如何工作
- 校验失败时该如何修正 payload

该 Skill 不定义任何业务 schema。

## 21.2 业务层 Skill 的职责

业务层 Skill 应定义：

- 触发条件
- 应使用的 schema id
- payload 字段含义
- 何时多次 emit
- 是否需要 `event_type`
- 是否需要序列号、实体 id、阶段字段等

例如，一个业务 Skill 可写成：

- 当任务进入分析阶段时，调用 Echo MCP，schema_id 为 `workflow_stage_v1`
- 当生成大纲后，调用 Echo MCP，schema_id 为 `report_outline_v1`
- 当最终结构化结果产出时，调用 Echo MCP，schema_id 为 `final_report_v1`

## 21.3 Agent 的运行时行为

Agent 在运行时：

1. 参考业务 Skill 决定是否要输出结构化消息
2. 若有需要，可先调用 `list_schemas` / `get_schema`
3. 组装 payload
4. 调用 `echo`
5. 若失败，根据错误详情修正重试

---

# 22. Client 的集成方式

## 22.1 最小契约

Client 的最小契约是：

- 能读取 MCP tool return
- 能识别 Echo MCP 的返回 envelope
- 能按 `schema_id` 过滤

## 22.2 推荐契约

更好的 client 可以：

- 根据 `schema_id` 决定渲染逻辑
- 根据 `payload.event_type` 做更细的行为分支
- 根据 `entity_id` / `sequence` 折叠多条 append 消息
- 保存结构化消息用于日志、审计、调试或 UI 驱动

## 22.3 Client 不需要做的事

Client 不需要：

- 参与 schema 校验
- 理解 Echo MCP 的内部实现
- 修改底层 ACP 协议

---

# 23. 示例

## 23.1 示例一：工作阶段通知

### 注册 schema

```json
{
  "schema_id": "workflow_stage_v1",
  "description": "Workflow stage notification",
  "schema": {
    "type": "object",
    "properties": {
      "event_type": { "type": "string" },
      "stage": { "type": "string" },
      "message": { "type": "string" },
      "sequence": { "type": "integer" }
    },
    "required": ["event_type", "stage", "sequence"],
    "additionalProperties": false
  }
}
```

### echo 输入

```json
{
  "schema_id": "workflow_stage_v1",
  "payload": {
    "event_type": "analysis_started",
    "stage": "analysis",
    "message": "Agent started analyzing the task.",
    "sequence": 1
  }
}
```

### echo 输出

```json
{
  "ok": true,
  "schema_id": "workflow_stage_v1",
  "payload": {
    "event_type": "analysis_started",
    "stage": "analysis",
    "message": "Agent started analyzing the task.",
    "sequence": 1
  }
}
```

---

## 23.2 示例二：有顺序的报告大纲

### 注册 schema

```json
{
  "schema_id": "report_outline_v1",
  "description": "Ordered report outline",
  "schema": {
    "type": "object",
    "properties": {
      "title": { "type": "string" },
      "items": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "index": { "type": "integer" },
            "heading": { "type": "string" },
            "notes": { "type": "string" }
          },
          "required": ["index", "heading"],
          "additionalProperties": false
        }
      }
    },
    "required": ["title", "items"],
    "additionalProperties": false
  }
}
```

### echo 输入

```json
{
  "schema_id": "report_outline_v1",
  "payload": {
    "title": "Quarterly Business Review",
    "items": [
      { "index": 1, "heading": "Executive Summary", "notes": "High-level overview" },
      { "index": 2, "heading": "Performance Review", "notes": "KPIs and metrics" },
      { "index": 3, "heading": "Next Steps", "notes": "Action plan" }
    ]
  }
}
```

---

## 23.3 示例三：schemaless 输出

### echo 输入

```json
{
  "schema_id": "__schemaless__",
  "payload": {
    "kind": "debug_snapshot",
    "raw": {
      "step": "retrieval_done",
      "hits": 12
    }
  }
}
```

### echo 输出

```json
{
  "ok": true,
  "schema_id": "__schemaless__",
  "payload": {
    "kind": "debug_snapshot",
    "raw": {
      "step": "retrieval_done",
      "hits": 12
    }
  }
}
```

---

## 23.4 示例四：校验失败

### echo 输入

```json
{
  "schema_id": "workflow_stage_v1",
  "payload": {
    "event_type": "analysis_started",
    "stage": "analysis",
    "sequence": "1"
  }
}
```

### 返回

```json
{
  "ok": false,
  "error": {
    "code": "SCHEMA_VALIDATION_FAILED",
    "message": "Payload does not conform to schema 'workflow_stage_v1'.",
    "schema_id": "workflow_stage_v1",
    "details": [
      {
        "path": "/sequence",
        "message": "Expected integer, received string"
      }
    ]
  }
}
```

---

# 24. 开发约束与注意事项

## 24.1 Echo 必须“原样返回”
任何成功的 `echo` 调用，返回的 `payload` 必须与请求中的 `payload` 保持一致。  
不可做：

- 自动补字段
- 自动排序
- 自动类型修正
- 自动标准化
- 自动注入 event_type

## 24.2 不要偷做业务约束
即使某些业务用例明显像“阶段事件”或“有序大纲”，Echo MCP 也不能把这类语义固化到工具内部。

## 24.3 错误必须可编程处理
错误结果不能只有自然语言。  
必须包含稳定的错误码与尽量结构化的字段级详情。

## 24.4 discovery 必须可用
既然 session 级 schema discovery 是需求的一部分，就不应省略 `list_schemas` / `get_schema`。

## 24.5 内置 schemaless 必须是显式概念
不要让“省略 schema_id”变成半隐式语义。  
显式内置 schema 更利于 client、agent、skill 统一使用。

---

# 25. 测试要求

## 25.1 功能测试

至少覆盖：

1. 注册合法 schema 成功
2. 注册重复 schema id 失败
3. 查询已有 schema 成功
4. 查询不存在 schema 失败
5. 按 schema echo 成功
6. payload 不合法时 echo 失败
7. schemaless echo 成功
8. 多次 echo 不互相影响
9. 多 session 下 schema 隔离正确

## 25.2 边界测试

至少覆盖：

1. 空 payload
2. 深层嵌套对象
3. 大数组
4. 非法 schema 定义
5. 特殊字符 schema id
6. session 切换后 registry 隔离
7. 内置 schema 不可被覆盖

## 25.3 协议一致性测试

至少覆盖：

1. 成功结果 envelope 稳定
2. 错误结果 envelope 稳定
3. 错误码稳定
4. 校验错误路径可预测
5. payload echo 完全一致

---

# 26. 推荐实现优先级

## Phase 1：MVP

实现以下能力即可：

- `register_schema`
- `list_schemas`
- `get_schema`
- `echo`
- 内置 `__schemaless__`
- session 级 registry
- 结构化错误返回

## Phase 2：工程增强

可选增强项：

- 更丰富的错误详情
- schema 描述字段增强
- schema 注册时更严格的静态检查
- 更完善的 observability
- 更细的输入大小限制与性能保护

---

# 27. 安全与稳定性建议

当前版本不做权限模型，但仍建议实现者考虑以下保护：

## 27.1 输入大小限制
避免极大 payload 或极大 schema 导致性能问题。

## 27.2 schema 数量限制
对单个 session 中可注册的 schema 数量做上限保护。

## 27.3 payload 深度限制
避免过深嵌套对象造成序列化和校验压力。

## 27.4 日志脱敏
如服务端记录日志，应避免在日志中无条件落完整 payload。

这些属于工程稳定性建议，不改变产品语义。

---

# 28. 最终规格总结

Echo MCP 的最终规格可以概括为：

1. 它是一个通过 MCP tool return 承载结构化消息的底层机制
2. 它的职责是：
   - session 级 schema 注册
   - session 级 schema discovery
   - payload 校验
   - 合法 payload 原样 echo
3. 它不负责业务语义、不负责渲染、不负责权限、不负责 update 语义
4. 它支持 schemaless
5. 它适合由业务 Skill 驱动 Agent 何时 emit 以及 emit 什么结构
6. Client 只需消费 tool return，即可获得稳定的结构化消息