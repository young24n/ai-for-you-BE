import type { Request, Response } from 'express';
import type { MongoClient as MongoClientType, Db } from 'mongodb';

const dotenv = require('dotenv');
const express = require('express')
const cors = require('cors');
const app = express()

app.use(cors({ origin: 'https://ai-for-you-fe.won8560.workers.dev' }));
app.use(express.json())
app.use(express.urlencoded({extended:true})) 

dotenv.config()

// 실제 작동에 필요한 모듈 불러오기 (값으로 사용될 클래스)
const { MongoClient } = require('mongodb');

let db: Db;
const url = process.env.DATABASE_URL;

// 생성할 때는 실제 객체인 'MongoClient' 사용
new MongoClient(url).connect().then((client: MongoClientType) => { // 타입은 'MongoClientType' 사용(이런 타입도 존재하는구나..)
  console.log('DB연결성공');
  db = client.db('chat');
}).catch((err: Error) => {  
  console.log(err);
})

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
    const messages = req.body.messages; 
    const roomId = req.body.roomId;

    // 서비스 함수 호출 시 roomId, authHeader, db 인스턴스를 넘겨줍니다.
    const streamResult = await generationMessage(messages, roomId, authHeader, db);
    
    // 프론트로 스트리밍 응답 (DB 저장은 generationMessage에서 onFinish가 알아서 해줌)
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

app.get('/getMessages', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const roomId = req.query.roomId as string; // 쿼리 파라미터는 string으로 명시

    // 1. API Key 유무 확인
    if (!authHeader) {
      return res.status(401).json({ error: "Authorization header is missing" });
    }

    // 2. Room ID 유무 확인
    if (!roomId) {
       return res.status(400).json({ error: "roomId is missing" });
    }

    // 3. DB에서 apiKey와 roomId 둘 다 일치하는 문서 찾기
    const chatRoom = await db.collection('chats').findOne({ 
      roomId: roomId,
      apiKey: authHeader 
    });
    
    // 4. 찾은 문서 안의 messages 배열 반환 (문서가 없으면 빈 배열)
    res.status(200).json(chatRoom ? chatRoom.messages : []); 

  } catch (error) {
    console.error("채팅 내역 불러오기 에러:", error);
    res.status(500).json({ error: "Internal server error" });
  }
})

app.get('/getChatRooms', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ error: "Authorization header is missing" });
    }

    // DB에서 해당 API Key의 모든 채팅방을 찾되, 필요한 필드만 추출(project)합니다.
    const chatRooms = await db.collection('chats')
      .find({ apiKey: authHeader })
      .project({ 
        roomId: 1,      // 1은 가져오겠다는 뜻
        title: 1, 
        updatedAt: 1, 
        _id: 0          // 0은 빼겠다는 뜻
      })
      .sort({ updatedAt: -1 }) // 최근 대화가 위로 오도록 내림차순 정렬
      .toArray();

    // 추출된 목록을 프론트로 전송
    // 응답 예시: [{ roomId: "room1", title: "리액트 질문", updatedAt: "..." }, ...]
    res.status(200).json(chatRooms);

  } catch (error) {
    console.error("채팅방 목록 불러오기 에러:", error);
    res.status(500).json({ error: "Internal server error" });
  }
})

app.delete('/deleteChat', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const roomId = req.query.roomId as string; // 쿼리로 방 ID를 받습니다

    // 1. API Key 유무 확인
    if (!authHeader) {
      return res.status(401).json({ error: "Authorization header is missing" });
    }

    // 2. Room ID 유무 확인
    if (!roomId) {
      return res.status(400).json({ error: "roomId is missing" });
    }

    // 3. DB에서 apiKey와 roomId가 모두 일치하는 채팅방 삭제
    // (다른 사람의 키로는 남의 방을 지울 수 없도록 보안 적용)
    const result = await db.collection('chats').deleteOne({ 
      roomId: roomId,
      apiKey: authHeader 
    });
    
    // 4. 삭제 결과에 따른 응답
    if (result.deletedCount === 1) {
      res.status(200).json({ message: "채팅방이 성공적으로 삭제되었습니다." });
    } else {
      // 0개 지워졌다면 해당 방이 없거나 내 소유가 아닌 경우
      res.status(404).json({ error: "채팅방을 찾을 수 없거나 지울 권한이 없습니다." });
    }

  } catch (error) {
    console.error("채팅방 삭제 에러:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
