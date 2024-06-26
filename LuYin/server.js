//server.js

// const express = require('express'); // 引入 Express 框架
// const multer = require('multer'); // 引入 multer 处理文件上传
// const path = require('path'); // 引入处理文件路径的模块
// const fs = require('fs'); // 引入文件系统模块
// const cors = require('cors');  // 添加这一行，引入 CORS 中间件

// const app = express(); // 创建 Express 应用
// const port = 3000; // 设置服务器端口

// app.use(cors());  // 为所有路由启用 CORS

// app.use(express.static('public')); // 设置静态文件目录为 'public'

// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, 'uploads/'); // 设置上传文件存储的目录为 'uploads/'
//   },
//   filename: (req, file, cb) => {
//     cb(null, file.originalname); // 设置上传文件的文件名为原始文件名
//   },
// });

// const upload = multer({ storage }); // 创建 multer 实例，配置上传参数

// app.post('/upload', upload.single('audio'), (req, res) => {
//   console.log("文件上传成功");
//   res.send('文件上传成功！'); // 发送文件上传成功的响应
// });
  

// app.listen(port, () => {
//   console.log(`服务器运行在 http://101.42.12.250:${port}`);
// });


// app.get('/download/:filename', (req, res) => {
//     console.log("监听到 GET 请求");
//     const filename = req.params.filename;
//     const filePath = path.join(__dirname, 'uploads', filename);
  
//     console.log("文件路径：", filePath);
  
//     if (fs.existsSync(filePath)) {
//       console.log("文件存在，可以下载");
//       res.download(filePath);
//     } else {
//       console.log("未找到文件");
//       res.send('文件未找到');
//     }
// });

// const axios = require('axios');

// const url = 'http://101.42.12.250:20020/merge';
// const data = { data: 'OK' };

// axios.post(url, data)
//   .then(response => {
//     console.log("Response: ", response);
//     console.log("Response_Status: " + response.status + ' Response:' + response.data);
//   })
//   .catch(error => {
//     console.error('Error:', error.message);
//   });


const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const port = 20020;

app.use(cors());

app.use(express.static('public'));

// 使用内存存储
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 创建可写流对象的映射，用于存储每个用户的音频数据
const audioStreams = {};
const chatRooms = []; // 记录每个聊天室的信息，包含人数和已上传完成的客户端数量

// 获取指定目录下的文件数量
async function countFiles(directoryPath) {
  const files = await fs.promises.readdir(directoryPath);
  return files.length;
}

// 处理音频数据上传的路由
app.post('/upload', upload.single('audio'), async (req, res) => {
  //console.log("进入POST");

  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const audioData = req.file.buffer; // 获取音频数据
  const userId = req.body.userId; // 假设客户端在请求中携带了用户ID
  const fileName = req.body.fileName || 'filename.wav'; // 获取客户端指定的文件名，如果没有指定则默认为'filename.wav'
  const isComplete = req.body.isComplete === '1'; // 根据 isComplete 参数判断是否是最后一个音频块
  const clientDirectory = req.body.clientDirectory; //客户端指定保存音频文件目录,房间ID

  const filePath = path.join(__dirname, 'uploads', clientDirectory);
  //console.log(userId + fileName);

  // 如果用户ID不存在，返回错误
  if (!userId) {
    return res.status(400).send('No user ID provided.');
  }

  const chatRoomIndex = chatRooms.findIndex(room => room.clientDirectory === clientDirectory);
  //添加对象
  if (chatRoomIndex == -1) {
    try {
      const result = await countFiles(filePath);
      chatRooms.push({
        clientDirectory,
        completedClients: 0,
        totalClients: result,
      });
      console.log("创建一个新聊天室: " + clientDirectory);
    } catch (error) {
      console.error("Error:", error);
    }
  } else {
    try {
      const result = await countFiles(filePath);
      chatRooms[chatRoomIndex].totalClients = result;
    } catch (error) {
      console.error("Error:", error);
    }
  }


  // 如果该用户的可写流不存在，创建新的可写流
  if (!audioStreams[userId]) {
    audioStreams[userId] = fs.createWriteStream(path.join(__dirname, 'uploads',clientDirectory,fileName), { flags: 'a' });
  }

  // 将音频数据块写入用户对应的文件
  audioStreams[userId].write(audioData);

  //console.log('接收到音频数据块');

  if (isComplete) {
    // 如果是最后一个音频块，则关闭文件可写流并清除数组里的对象
    audioStreams[userId].end();
    delete audioStreams[userId];
    console.log('用户上传完成，关闭文件流');
    chatRooms[chatRoomIndex].completedClients++;
    console.log("当前文件总个数: " + chatRooms[chatRoomIndex].totalClients + "当前已经上传完成的客户端总个数: " + chatRooms[chatRoomIndex].completedClients);
    if(chatRooms[chatRoomIndex].completedClients === chatRooms[chatRoomIndex].totalClients){
      console.log("所有客户端音频数据上传完成");
      // 重置聊天室信息，以便下一轮的上传
      chatRooms.splice(chatRoomIndex, 1);
    }
  }

  res.send('接收到音频数据块！');
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://101.42.12.250:${port}`);
});


