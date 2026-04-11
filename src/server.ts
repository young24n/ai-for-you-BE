import type { MongoClient as MongoClientType } from 'mongodb'; // require 및에 import하면 충돌생김

const dotenv = require('dotenv');
const express = require('express')
const cors = require('cors');
const app = express()

app.use(cors({ origin: '*' }));
app.use(express.json())
app.use(express.urlencoded({extended:true})) 

dotenv.config()

app.listen(8080, () => {
    console.log('http://localhost:8080 에서 서버 실행중')
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