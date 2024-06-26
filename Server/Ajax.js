const axios = require('axios');


function HeCheng_LuYin(url,filename){
    axios.post(url,{
        params: {
            cmd: 'OK',
            FileName: filename,
        }
    }).then(response => {
        console.log("Response_Status: " + response.status + ' Response:' + response.data);
    })
    .catch(error => {
        console.error('Error:', error.message);
    })
  
}

function Post_Create_File(url,filename,initiate){
    axios.post(url,{
        params: {
            FileName: filename,
            InItIate: initiate
        }
    }).then(response => {
        console.log("Response_Status: " + response.status + ' Response:' + response.data);
    })
    .catch(error => {
        console.error('Post_Create_File_Error:', error.message);
    })
}

// Post_Create_File('http://127.0.0.1:20020/CreateMkdir','4520295','张三');

module.exports = {
    Post_Create_File,
    HeCheng_LuYin
}
