/**
 * Coze API配置
 */
interface CozeConfig {
  apiKey: string;
  botId: string;
  userId: string;
}

/**
 * 默认配置
 */
const defaultConfig: CozeConfig = {
  apiKey: process.env.COZE_API_KEY || '',
  botId: process.env.BOT_ID || '',
  userId: '12345678' // 默认用户ID
};

export default defaultConfig;