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
   const messages = req.body.messages; // 찾는 속성이 무조건 messages 여야함 

   const streamResult = await generationMessage(messages);
   streamResult.pipeUIMessageStreamToResponse(res);

  } catch (error) {
    console.error('에러:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: errorMessage });
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