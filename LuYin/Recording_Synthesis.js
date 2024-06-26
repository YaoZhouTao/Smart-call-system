const express = require('express');
const bodyParser = require('body-parser');
const { exec } = require('child_process');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer'); // 引入 multer 处理文件上传
const fsExtra = require('fs-extra');
const { UPdateMySQL,InsertyMySQL,deletemysql } = require('./mysql'); // 引入数据库连接函数

const app = express();
const PORT = 20020;
var num = 1;
var initIate = ""; //房间创始人
app.use(cors());
app.use(bodyParser.json());

app.use(express.static('public')); // 设置静态文件目录为 'public'

// 使用内存存储
const storage = multer.memoryStorage();
const upload = multer({ storage });

// 创建可写流对象的映射，用于存储每个用户的音频数据
const audioStreams = {};
const chatRooms = []; // 记录每个聊天室的信息，包含人数和已上传完成的客户端数量

const Rooms_client_info = new Map(); //存放每个房间中的信息 

// 获取指定目录下的文件数量
async function countFiles(directoryPath) {
  const files = await fs.promises.readdir(directoryPath);
  return files.length;
}

// 处理音频数据上传
app.post('/upload', upload.single('audio'), async (req, res) => {
    console.log("进入POST");
console.log("在这里--------------------------");
  
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
          initiate: initIate,
          participants: [],
          start_time: getCurrentDateTime(),
          end_time: '',
          duration: '',
          voice_url: ''
        });
        console.log("创建一个新聊天室: " + clientDirectory);
      } catch (error) {
        console.error("Error:", error);
      }
    } else {
      try {
        const result = await countFiles(filePath);
        chatRooms[chatRoomIndex].totalClients = result;

        // 在插入之前检查名字是否已经存在
        var existingParticipant = chatRooms[chatRoomIndex].participants.find(function(participant) {
          return participant === userId;
        });

        if (!existingParticipant) {
          // 名字不存在，可以插入
          chatRooms[chatRoomIndex].participants.push(userId);
          console.log("名字插入成功");
        } else {
          //console.log("该名字已经存在，无法插入。");
        }

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
        //chatRooms.splice(chatRoomIndex, 1);
        res.status(200).send("over");
        Combine_audio_tasks(clientDirectory);
        return;
      }
    }
  
    res.send('接收到音频数据块！');
});

//测试接口，下载录音文件
app.get('/download/:filename', (req, res) => {
    console.log("监听到 GET 请求");
    const filename = req.params.filename;
    const filePath = path.join(__dirname, 'Save_LuYin', filename);
  
    console.log("文件路径：", filePath);
  
    if (fs.existsSync(filePath)) {
      console.log("文件存在，可以下载");
      res.download(filePath);
    } else {
      console.log("未找到文件");
      res.send('文件未找到');
    }
});
const filePath = '/home/ubuntu/webrtc/node/LuYin/uploads';

var recordingsPath  = ''; //存放音频文件的目录

//每创建一个房间就为这个房间创建一个文件夹存放录音文件
app.post('/CreateMkdir', (req, res) => {
   const folderName = req.body.params.FileName;
   initIate = req.body.params.InItIate;
   console.log("房间创始人" + initIate);
    // 获取目标目录的完整路径
    const targetDirectory = path.join('/home/ubuntu/webrtc/node/LuYin/uploads', folderName);

    // 检查目录是否存在
    if (fs.existsSync(targetDirectory)) {
        console.log('目录已经存在:', targetDirectory);
        res.status(200).send('目录已经存在');
    } else {
        // 创建目录
        fs.mkdir(targetDirectory, { recursive: true }, (err) => {
            if (err) {
                console.error('创建文件夹失败:', err);
                res.status(500).send('创建文件夹失败');
            } else {
                console.log('成功创建文件夹:', targetDirectory);
                res.status(200).send('已经成功创建文件夹');
            }
        });
    }
});

//删除指定目录及其所有文件
function deleteDirectory(directoryPath) {
    const targetDirectory = path.join('/home/ubuntu/webrtc/node/LuYin/uploads', directoryPath);

    // 检查目录是否存在
    if (fs.existsSync(targetDirectory)) {
        // 使用 fs-extra 的 remove 方法删除目录及其内容
        fsExtra.remove(targetDirectory, (err) => {
            if (err) {
                console.error('删除目录失败:', err);
            } else {
                console.log('成功删除目录:', targetDirectory);
            }
        });
    } else {
        console.log('目录不存在:', targetDirectory);
    }
}

//合并指定文件夹的所有音频数据并删除该文件夹
function Combine_audio_tasks(FileName) {
  console.log("接收到合并请求,需要合并的文件名为：" + FileName);
  recordingsPath = filePath + `/${FileName}`;

  // 获取录音文件列表
  const files = fs.readdirSync(recordingsPath);
  const sortedFiles = files.sort();

  if (sortedFiles.length < 2) {
      res.status(400).send('录音文件数量不足，无法合并。');
      return;
  }

  // 获取第一个文件的开始时间
  const startTime = new Date(sortedFiles[0].split('.')[0]).getTime();

  // 使用map遍历每个文件，并构建adelay滤镜
  const concatFilter = sortedFiles.map((file, index) => {
      const inputPath = path.join(recordingsPath, file);
      const fileStartTime = new Date(file.split('.')[0]).getTime(); // 获取当前文件的开始时间
      const offset = fileStartTime - startTime; // 计算相对于第一个文件的时间偏移（单位：毫秒）
      return `[${index}:a]adelay=${offset}|${offset}[a${index}]`;
  }).join(';').replace(/NaN/g, '999999');

  // 在concatFilter后动态添加amix滤镜，使用动态生成的[a${index}]标签
  const amixFilter = sortedFiles.map((file, index) => `[a${index}]`).join('') + `amix=inputs=${sortedFiles.length}[aout]`;

  const outputFilePath = `/home/ubuntu/webrtc/node/LuYin/Save_LuYin/merged${num}.wav`;
  num++;
  const chatRoomIndex = chatRooms.findIndex(room => room.clientDirectory === FileName);
  if(chatRoomIndex != -1){
    chatRooms[chatRoomIndex].voice_url = outputFilePath;
    chatRooms[chatRoomIndex].end_time = getCurrentDateTime();

    // 定义两个时间字符串
    var time1 = chatRooms[chatRoomIndex].start_time;
    var time2 = chatRooms[chatRoomIndex].end_time;

    // 将时间字符串转换为Date对象
    var date1 = new Date(time1);
    var date2 = new Date(time2);

    // // 计算时间差（以毫秒为单位）
    // var diffMilliseconds = Math.abs(date2 - date1);

    // // 计算总共的分钟数和剩余的秒数
    // var diffMinutes = Math.floor(diffMilliseconds / (1000 * 60));
    // var diffSeconds = Math.floor((diffMilliseconds % (1000 * 60)) / 1000);

    // // 输出时间差
    // if (diffMinutes > 0) {
    //     if (diffSeconds > 0) {
    //         console.log("时间差: ", diffMinutes, "分钟", diffSeconds, "秒");
    //         chatRooms[chatRoomIndex].duration = `${diffMinutes}:${diffSeconds}`;
    //     } else {
    //         console.log("时间差: ", diffMinutes, "分钟");
    //         chatRooms[chatRoomIndex].duration = `${diffMinutes}`;
    //     }
    // } else {
    //     console.log("时间差: ", diffSeconds, "秒");
    //     chatRooms[chatRoomIndex].duration = `${diffSeconds}`;   
    // }

    // 计算时间差（以毫秒为单位）
    var diffMilliseconds = Math.abs(date2 - date1);

    // 如果时间差大于60秒，则以分钟为单位
    if (diffMilliseconds > 60 * 1000) {
        var diffMinutes = Math.floor(diffMilliseconds / (1000 * 60));
        console.log("时间差（以分钟为单位）: ", diffMinutes, "分钟");
        chatRooms[chatRoomIndex].duration = `${diffMinutes}`;
    } else { // 否则以秒为单位
        var diffSeconds = Math.floor(diffMilliseconds / 1000);
        console.log("时间差（以秒为单位）: ", diffSeconds, "秒");
        chatRooms[chatRoomIndex].duration = `${diffSeconds}`;  
    }
    var participantsString = chatRooms[chatRoomIndex].participants.join(", ");
    console.log(chatRooms[chatRoomIndex].initiate,chatRooms[chatRoomIndex].start_time,chatRooms[chatRoomIndex].end_time,chatRooms[chatRoomIndex].voice_url,chatRooms[chatRoomIndex].duration,participantsString);
  }
  InsertyMySQL(chatRooms[chatRoomIndex].initiate,participantsString,chatRooms[chatRoomIndex].start_time,chatRooms[chatRoomIndex].end_time,chatRooms[chatRoomIndex].duration,chatRooms[chatRoomIndex].voice_url);
   // 重置聊天室信息，以便下一轮的上传
  chatRooms.splice(chatRoomIndex, 1);

  // 构建ffmpeg命令
  const ffmpegCommand = `ffmpeg -y ${sortedFiles.map(file => `-i "${path.join(recordingsPath, file)}"`).join(' ')} -filter_complex "${concatFilter};${amixFilter}" -map "[aout]" -c:a pcm_s16le -b:a 256k "${outputFilePath}"`;

  // 执行ffmpeg命令
  exec(ffmpegCommand, (error, stdout, stderr) => {
      if (error) {
          console.error(`执行合并命令错误: ${error.message}`);
          return;
      }
      // if (stderr) {
      //     console.error(`合并命令输出错误: ${stderr}`);
      //     res.status(200).send('内部服务器错误');
      //     return;
      // }
      console.log('合并完成');
      //res.status(200).send(`合并完成，文件名: merged.wav`);
      deleteDirectory(`${FileName}`);
  });
  console.log("结束合并任务");
}

//Combine_audio_tasks(555);

app.listen(PORT, () => { 
    console.log(`服务器运行在 http://localhost:${PORT}/`);
});


// const startTime = new Date(); // 获取当前时间
//formattedStartTime = startTime.toISOString();
// console.log("当前时间" + formattedStartTime);

//获取当前时间
function getCurrentDateTime() {
  const currentDate = new Date();

  const year = currentDate.getFullYear();
  const month = padZero(currentDate.getMonth() + 1);  // getMonth 返回的是 0 到 11，因此需要加 1
  const day = padZero(currentDate.getDate());

  const hours = padZero(currentDate.getHours());
  const minutes = padZero(currentDate.getMinutes());
  const seconds = padZero(currentDate.getSeconds());

  const formattedDateTime = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;

  return formattedDateTime;
}

// 辅助函数，用于在数字前补零
function padZero(number) {
  return number.toString().padStart(2, '0');
}

const startTime = getCurrentDateTime();
console.log("当前时间" + startTime);

