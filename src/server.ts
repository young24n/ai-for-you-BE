import type { Request, Response } from 'express';
import type { MongoClient as MongoClientType } from 'mongodb'; // import는 require 밑에 하면 충돌남

const dotenv = require('dotenv');
const express = require('express')
const cors = require('cors');
const app = express()

app.use(cors({ origin: '*' }));
app.use(express.json())
app.use(express.urlencoded({extended:true})) 

dotenv.config()

// copilotService.ts에서 getCopilotToken 가져오기
const { generationMessage } = require('./copilotService.ts');

app.listen(8080, () => {
    console.log('http://localhost:8080 에서 서버 실행중')
})

app.post('/sendMessage', async (req: Request, res: Response) => {
  try {
    // 요청 헤더에서 API Key 추출
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Authorization header is missing" });
    }

    // 환경 변수에 저장된 API Key들과 비교
    const validApiKeys = [
      process.env.USER_API_KEY_1,
      process.env.USER_API_KEY_2,
      process.env.USER_API_KEY_3,
    ];

    if (!validApiKeys.includes(authHeader)) {
      return res.status(403).json({ error: "Invalid API Key" });
    }

    // API Key가 유효하면 요청 처리
    const messages = req.body.messages; // 찾는 속성이 무조건 messages 여야함 
    const streamResult = await generationMessage(messages);
    streamResult.pipeUIMessageStreamToResponse(res);

  } catch (error) {
    console.error('에러:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: errorMessage });
  }
}) 

app.post('/validateApiKey', async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ valid: false, error: "API Key is missing" });
    }

    // 환경 변수에 저장된 API Key들과 비교
    const validApiKeys = [
      process.env.USER_API_KEY_1,
      process.env.USER_API_KEY_2,
      process.env.USER_API_KEY_3,
    ];

    if (validApiKeys.includes(apiKey)) {
      return res.status(200).json({ valid: true });
    } else {
      return res.status(403).json({ valid: false, error: "Invalid API Key" });
    }
  } catch (error) {
    console.error("API Key validation error:", error);
    res.status(500).json({ valid: false, error: "Internal server error" });
  }
})

// 실제 작동에 필요한 모듈 불러오기 (값으로 사용될 클래스)
const { MongoClient } = require('mongodb');

let db;
const url = process.env.DATABASE_URL;

// 생성할 때는 실제 객체인 'MongoClient' 사용
new MongoClient(url).connect().then((client: MongoClientType) => { // 타입은 'MongoClientType' 사용
  console.log('DB연결성공');
  db = client.db('chat');
}).catch((err: Error) => {  
  console.log(err);
})