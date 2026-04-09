const dotenv = require('dotenv');
const { streamText, generateText } = require('ai');
const { createOpenAI } = require('@ai-sdk/openai');

dotenv.config();

// 1. 임시 토큰 관리용 변수 (LBI의 githubCopilotTidToken 로직)
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

// 3. 테스트용 함수
async function testAI() {
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

    console.log('AI에게 메시지 전송 중...');
    
    // AI 호출
    const result = await generateText({
      model: copilot.chat('gemini-3.1-pro-preview'),
        // .chat()을 통해 endpoint를 /chat/completions로 변경 .chat()이 없으면 기본값인 /responses로 됨
        // chat: messages 중심(역할 기반 대화 포맷)
        // responses: 텍스트/툴/이미지/추론 등을 더 통합된 이벤트/아이템 구조로 반환
      messages: [{ role: 'user', content: '안녕 반가워' }],
    });

    console.log('=== AI 응답 결과 ===');
    console.log(result.text);
    console.log('====================');

  } catch (error) {
    console.error('AI 호출 실패:', error);
  }
}

// 테스트 함수 바로 실행
testAI();
