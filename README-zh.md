# Echo MCP

一个轻量级的 MCP（Model Context Protocol）服务器，使 Agent 能够通过 MCP 工具调用返回值发出结构化消息。

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Protocol-green.svg)](https://modelcontextprotocol.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[English](README.md) | [中文](README-zh.md)

---

## 目录

- [项目背景](#项目背景)
- [Echo MCP 是什么](#echo-mcp-是什么)
- [关键设计决策](#关键设计决策)
- [快速开始](#快速开始)
- [API 参考](#api-参考)
- [使用示例](#使用示例)
- [项目结构](#项目结构)

---

## 项目背景

在现有的 Agent 系统中，Agent 通常只能通过自然语言文本来传达中间状态、阶段信息、报告大纲和结构化结果。这带来了几个挑战：

1. **Client 难以稳定提取特定的结构化数据**
2. **同类数据缺少统一的 schema 和校验机制**
3. **业务方如果想在消息流中消费这些内容，往往需要在 SDK 或协议层做额外扩展**
4. **单纯依赖自然语言或松散的 JSON，让 Agent 输出"供程序消费"的结果不够稳定**

**Echo MCP** 通过提供一种机制来解决这个问题：利用 MCP 工具调用返回值来承载结构化消息——无需改造底层的 ACP/SDK 协议。

---

## Echo MCP 是什么

Echo MCP 是一个**结构化消息承载与校验工具集**，提供三类核心能力：

1. **Built-in Schema Config（内置 schema 配置）** —— 通过服务端配置文件维护可用 schema
2. **Schema Discovery（Schema 发现）** —— 查询当前可用的内置 schema
3. **Echo/Emit（回显/发射）** —— 接收 payload，按指定 schema 校验，通过后原样返回

### Echo MCP 不是什么

- ❌ 业务工作流引擎
- ❌ 事件总线
- ❌ 渲染层协议
- ❌ 权限管理系统
- ❌ 状态管理框架

它只提供底层能力，不做业务层限制。

---

## 关键设计决策

### 1. MCP 工具返回值作为消息载体

**Echo MCP 的输出载体就是 MCP 工具调用的返回值。**

- 不依赖 side-effect stream item
- 不要求 Client 支持额外的协议扩展
- Client 只需观察 tool return 即可

### 2. 输入 Schema = 输出 Schema

Echo MCP 是"接收合法 payload，原样返回 payload"的工具：

- 输入 schema = 输出 schema
- 不对 payload 做任何转换、标准化或字段注入
- **"Echo"意味着完全复现**

### 3. 配置驱动内置 Schema

- Client 不能在运行时注册新 schema
- 内置 schema 统一维护在 `config/builtin-schemas.json`
- 所有 session 共享同一套内置 schema

### 4. 不做 Schema 版本化

如果 schema 变更，直接使用新的 schema ID。不引入显式的 version 字段与升级机制。

### 5. 内置 Schemaless 模式

内置的 `__schemaless__` schema ID 允许无 schema 的结构化输出：

- 适用于快速实验、临时调试或粗粒度结构化输出
- 仍对请求 envelope 做基本合法性检查

### 6. Append 语义（而非 Update）

Echo MCP 默认采用 **append 语义**，即每次调用 `echo` 都代表**产生一条新的结构化消息**，而不是修改以前的某条消息。

如果业务需要"更新"状态，应在 payload 中自带标识字段（如 `entity_id`、`sequence`、`revision`），由 client 自行将多条 append 消息折叠为"当前状态"。

### 7. 校验策略：JSON Schema（对外）+ Zod（对内）

- **对外 schema 表达：** JSON Schema（便于 discovery、交换、跨语言理解）
- **内部运行时校验：** Zod（TypeScript/Node.js 环境执行效率更高）

### 8. 结构化错误响应

所有错误返回机器可读的错误码，并包含详细的字段级错误信息：

```json
{
  "ok": false,
  "error": {
    "code": "SCHEMA_VALIDATION_FAILED",
    "message": "Payload does not conform to schema...",
    "schema_id": "zenlix-agent-stage-v1",
    "details": [
      { "path": "/stage", "message": "must be string" }
    ]
  }
}
```

---

## 快速开始

### 安装

```bash
# 克隆仓库
git clone https://github.com/zenlix/echo-mcp.git
cd echo-mcp

# 安装依赖（需要 pnpm）
pnpm install
```

### 开发模式

```bash
pnpm dev
```

服务器默认运行在 `http://localhost:3000`。

在浏览器中打开 [http://localhost:3000/inspector](http://localhost:3000/inspector) 可以交互式测试服务器。

### 构建生产版本

```bash
pnpm build
```

### 运行测试

```bash
pnpm test
```

### 部署

```bash
pnpm deploy
```

---

## API 参考

Echo MCP 暴露 3 个 MCP 工具：

### `list_schemas`

列出当前所有内置 schema（包括 `__schemaless__`）。

**输入：** `{}`

**输出：**
```json
{
  "schemas": [
    { "schema_id": "__schemaless__", "description": "...", "builtin": true },
    { "schema_id": "zenlix-agent-stage-v1", "description": "...", "builtin": true }
  ]
}
```

### `get_schema`

获取指定 schema 的完整定义。

**输入：** `{"schema_id": "zenlix-agent-stage-v1"}`

**输出：** 包含完整 JSON Schema 定义的 schema 详情。

### `echo`

将 payload 按指定 schema 校验，通过后原样返回。

**输入：**
```json
{
  "schema_id": "zenlix-agent-stage-v1",
  "payload": {
    "stage": "authentication",
    "stage_status": "start",
    "next_stage": "authorization",
    "extra": {
      "user_id": "u_123"
    }
  }
}
```

**输出：**
```json
{
  "ok": true,
  "schema_id": "zenlix-agent-stage-v1",
  "payload": {
    "stage": "authentication",
    "stage_status": "start",
    "next_stage": "authorization",
    "extra": {
      "user_id": "u_123"
    }
  }
}
```

---

## 使用示例

### 示例一：工作阶段通知

`zenlix-agent-stage-v1` 在 `config/builtin-schemas.json` 中维护。

**发射阶段更新：**
```json
{
  "schema_id": "zenlix-agent-stage-v1",
  "payload": {
    "stage": "authentication",
    "stage_status": "running",
    "next_stage": "authorization",
    "extra": {
      "user_id": "u_123",
      "user_name": "Alice"
    }
  }
}
```

### 示例二：最小阶段事件

```json
{
  "schema_id": "zenlix-agent-stage-v1",
  "payload": {
    "stage": "authorization"
  }
}
```

### 示例三：Schemaless 输出（快速调试）

```json
{
  "schema_id": "__schemaless__",
  "payload": {
    "kind": "debug_snapshot",
    "raw": { "step": "retrieval_done", "hits": 12 }
  }
}
```

---

## 项目结构

```
zenlix-echo-mcp/
├── index.ts              # 进程入口
├── config/
│   └── builtin-schemas.json # 内置 schema 配置文件
├── src/
│   ├── server.ts         # MCP 服务器组装和工具注册
│   ├── echo-service.ts   # 内置 schema 发现与 echo 协议行为实现
│   ├── builtin-schema-config.ts # 内置 schema 配置加载器
│   └── json-schema-zod.ts # JSON Schema 到 Zod 的转换
├── tests/
│   └── echo-service.test.ts  # 协议和行为回归测试
├── docs/
│   └── design-doc.md     # 完整的产品与技术设计文档
├── AGENTS.md             # AI agent 开发导航指南
└── package.json
```

---

## 文档

- **[设计文档](docs/design-doc.md)** —— 完整的产品与技术设计
- **[AGENTS.md](AGENTS.md)** —— 本仓库的 AI agent 开发指南

---

## 许可证

MIT © [zenlix](https://github.com/zenlix)
