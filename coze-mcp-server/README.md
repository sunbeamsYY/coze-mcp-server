# coze-mcp-server

一个基于Model Context Protocol的Coze API服务器，用于通过Coze API获取内容。

## 安装

```bash
npx -y coze-mcp-server
```

## 配置

在使用之前，需要设置以下环境变量：

- `COZE_API_KEY`: Coze API密钥
- `BOT_ID`: Coze机器人ID

## 使用方法

在你的MCP配置文件中添加以下配置：

```json
{
  "mcpServers": {
    "coze-mcp-server": {
      "command": "npx",
      "args": ["-y", "coze-mcp-server"],
      "env": {
        "COZE_API_KEY": "your_api_key",
        "BOT_ID": "your_bot_id"
      }
    }
  }
}
```

## 可用工具

### get_content

通过Coze API获取内容

**输入参数：**

```json
{
  "keyword": "string" // 输入关键词
}
```

## 许可证

MIT
