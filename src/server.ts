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

