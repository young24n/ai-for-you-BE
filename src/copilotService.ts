const dotenv = require('dotenv');
const { streamText, convertToModelMessages } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');

dotenv.config();

// 1. 임시 토큰 관리용 변수
let tidToken = '';
let tidTokenExpiry = 0;

// 2. GitHub 발급용 토큰을 Copilot 세션 토큰으로 교환하는 함수
async function getCopilotToken(apiKey: string) {
  if (!apiKey) throw new Error("COPILOT_API_KEY가 설정되지 않았습니다.");

  // 토큰 만료 1분 전이 아니면 기존 토큰 재사용 
  if (tidToken && Date.now() < tidTokenExpiry - 60000) {
    return tidToken;
  }

  console.log('GitHub Copilot 임시 세션 토큰 발급 중...');
  
  const res = await fetch("https://api.github.com/copilot_internal/v2/token", {
    method: 'GET',
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "Editor-Version": "vscode/1.85.0",
      "User-Agent": "GitHubCopilotChat/0.11.1"
    }
  });

  if (!res.ok) {
    throw new Error(`토큰 교환 실패: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  tidToken = data.token;
  tidTokenExpiry = data.expires_at * 1000;
  
  return tidToken;
}

async function generationMessage(messages: any[]) {
  try {
    const rawKey = process.env.COPILOT_API_KEY || '';
    
    // 임시 토큰부터 받아옵니다.
    const sessionToken = await getCopilotToken(rawKey);

    // OpenAI 프로바이더 -> OpenAI한테 모델 요청할때 사용되는 양식(github에서 같은 양식을 사용하기에 사용)
    const copilot = createOpenAI({
      baseURL: 'https://api.githubcopilot.com', // 실제 요청 보낼 위치(OpenAI로 보내는거 아님)
      apiKey: sessionToken, // 교환받은 임시 세션 토큰을 사용
      headers: {
        // 강제 주입하는 필수의 무기명 헤더들
        'Copilot-Integration-Id': 'vscode-chat',
        'Editor-plugin-version': 'copilot-chat/0.11.1',
        'Editor-version': 'vscode/1.85.0',
        'User-Agent': 'GitHubCopilotChat/0.11.1',
        'X-Github-Api-Version': '2025-10-01'
      }
    });

    const streamObject = streamText({
      model: copilot.chat('gemini-3.1-pro-preview'),
      messages: await convertToModelMessages(messages), // 프론트에서 assistant-ui가 쏴준 전체 기록을 그대로 전달
    });

    return streamObject // stream object를 넘겨 줌

  } catch (error) {
    throw error;
  }
}

module.exports = { getCopilotToken, generationMessage };