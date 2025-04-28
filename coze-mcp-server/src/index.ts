#!/usr/bin/env node

/**
 * Coze MCP服务主文件
 * 实现通过Coze API获取内容的MCP服务
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import config from './config.js';
const { apiKey, botId, userId } = config;

/**
 * Coze API客户端类
 * 封装所有与Coze API交互的方法
 */
class CozeAPIClient {
  constructor(private apiKey: string, private botId: string, private userId: string) { }
  /**
   * 获取请求头
   * @returns Object - 包含认证信息的请求头
   */
  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }
  /**
   * 发送聊天消息
   * @param keyword - 用户输入的关键词
   * @returns Promise<CozeResponse> - API响应数据
   */
  async sendChatMessage(keyword: string): Promise<any> {
    const response = await fetch('https://api.coze.cn/v3/chat', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        bot_id: this.botId,
        user_id: this.userId,
        stream: false,
        auto_save_history: true,
        additional_messages: [{
          role: 'user',
          content: keyword,
          content_type: 'text'
        }]
      })
    });
    return await response.json();
  }

  /**
   * 获取聊天状态
   * @param chatId - 聊天ID
   * @param conversationId - 会话ID
   * @returns Promise<any> - API响应数据
   */
  async getChatStatus(chatId: string, conversationId: string): Promise<any> {
    const response = await fetch(
      `https://api.coze.cn/v3/chat/retrieve?chat_id=${chatId}&conversation_id=${conversationId}`,
      { headers: this.getHeaders() }
    );
    return await response.json();
  }

  /**
   * 获取消息列表
   * @param chatId - 聊天ID
   * @param conversationId - 会话ID
   * @returns Promise<any> - API响应数据
   */
  async getMessageList(chatId: string, conversationId: string): Promise<any> {
    const response = await fetch(
      `https://api.coze.cn/v3/chat/message/list?chat_id=${chatId}&conversation_id=${conversationId}`,
      { headers: this.getHeaders() }
    );
    return await response.json();
  }
}

/**
 * 创建一个具有资源能力(用于列出/读取笔记)、
 * 工具能力(用于创建新笔记)和提示能力(用于总结笔记)的MCP服务器。
 */
const server = new Server(
  {
    name: "coze-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

/**
 * Handler for Coze API调用
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const keyword = String(request.params.arguments?.keyword);
  if (!keyword) {
    throw new Error("输入关键词是必需的");
  }

  const result = await getCozeContent(keyword);

  return {
    content: [{
      type: "text",
      text: result
    }]
  };
});

/**
 * 列出可用工具的处理程序。
 * 暴露一个"get_content"工具，允许客户端从Coze获取内容。
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_content",
        description: "通过Coze API获取内容",
        inputSchema: {
          type: "object",
          properties: {
            keyword: {
              type: "string",
              description: "输入关键词"
            }
          },
          required: ["keyword"]
        }
      }
    ]
  };
});


/**
 * 使用stdio传输启动服务器。
 * 这允许服务器通过标准输入/输出流进行通信。
 */
/**
 * 启动MCP服务
 */
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: {
        status: "started",
        message: "MCP服务已启动"
      }
    }));
  } catch (error) {
    console.log(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "start_failed",
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : '未知错误'
      }
    }));
    process.exit(1); // 退出进程
  }
}

main();

/**
 * 调用Coze API获取内容
 * @param keyword - 输入关键词
 * @returns Promise<string> - 返回内容字符串
 */
/**
 * 调用Coze API获取内容
 * @param keyword - 输入关键词
 * @returns Promise<string> - 返回内容字符串
 */
const apiClient = new CozeAPIClient(apiKey, botId, userId);

/**
 * 调用Coze API获取内容
 * @param keyword - 输入关键词
 * @returns Promise<string> - 返回内容字符串
 */
async function getCozeContent(keyword: string): Promise<string> {
  try {
    console.log(JSON.stringify({ message: '开始调用Coze API', keyword: keyword }));
    const chatResponse = await apiClient.sendChatMessage(keyword);
    const { data, code } = chatResponse;

    if (code !== 0) {
      throw new Error(`API调用失败: ${chatResponse.msg || '未知错误'}`);
    }

    console.log(JSON.stringify({
      message: 'API调用成功',
      chat_id: data.id,
      conversation_id: data.conversation_id
    }));

    // 轮询获取结果
    const answerContent = await pollForAnswer(data.id, data.conversation_id);
    return answerContent;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : '未知错误';
    console.error(`API调用失败: ${errorMsg}`);
    throw new Error(`获取Coze内容失败: ${errorMsg}`);
  }
}

/**
 * 轮询获取回答内容
 * @param chatId - 聊天ID
 * @param conversationId - 会话ID
 * @returns Promise<string> - 回答内容
 */
async function pollForAnswer(chatId: string, conversationId: string): Promise<string> {
  let retryCount = 0;
  const maxRetries = 30;
  const pollInterval = 2000;

  while (retryCount < maxRetries) {
    console.log(JSON.stringify({
      message: '开始轮询',
      retry_count: retryCount + 1
    }));

    await new Promise(resolve => setTimeout(resolve, pollInterval));

    try {
      const pollData = await apiClient.getChatStatus(chatId, conversationId);
      console.log(JSON.stringify({
        message: '轮询成功',
        status: pollData.data.status
      }));

      if (pollData.data.status === 'completed') {
        const messageData = await apiClient.getMessageList(chatId, conversationId);
        console.log(JSON.stringify({ message: '获取消息列表成功' }));

        if (messageData.code === 0) {
          const answerItem = messageData.data.find((item: any) => item.type === 'answer');
          if (answerItem && answerItem.content) {
            console.log(JSON.stringify({
              message: '获取到answer内容',
              content_preview: answerItem.content.substring(0, 50)
            }));
            return answerItem.content;
          }
          throw new Error('未找到answer类型内容');
        }
        throw new Error(messageData.msg || '获取消息列表失败');
      }
    } catch (pollError) {
      console.error(`轮询过程中出错: ${pollError instanceof Error ? pollError.message : '未知错误'}`);
    }

    retryCount++;
  }

  throw new Error(`轮询超时，已达到最大重试次数${maxRetries}次`);
}
