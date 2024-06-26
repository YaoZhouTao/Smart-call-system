const mysql = require('mysql2');

function UPdateMySQL(staff_online,roomid,name){

    // 创建数据库连接
    const connection = mysql.createConnection({
      host: '192.144.215.114',     // 数据库主机地址
      user: 'root', // 数据库用户名
      password: 'Hckj201509', // 数据库密码
      database: 'webrtc_db' // 数据库名称
    });

    connection.connect((err) => {
        if (err) {
          console.error('连接到数据库时出错：', err);
          return;
        }
        console.log('已成功连接到数据库');

        // 要执行的 SQL 查询，这里是一个更新操作示例
        const updateSql = 'UPDATE sys_staff SET staff_online = ?,room_num = ? WHERE staff_name = ?;';
        const values = [staff_online, roomid,name]; // 替换为实际的值

        // 执行 SQL 更新操作
        connection.query(updateSql, values, (err, results) => {
        if (err) {
            console.error('执行 SQL 查询时出错：', err);
            return;
        }
        console.log('成功更新数据');
        
        // 关闭数据库连接
        connection.end((err) => {
            if (err) {
            console.error('关闭数据库连接时出错：', err);
            return;
            }
            console.log('已成功关闭数据库连接');
        });
        });


    });
}

// UPdateMySQL(1,1014525,'张三');
// UPdateMySQL(1,69696969,'李四');


function InsertyMySQL(room_num,room_create_time,room_create_by){

  // 创建数据库连接
  const connection = mysql.createConnection({
    host: '192.144.215.114',     // 数据库主机地址
    user: 'root', // 数据库用户名
    password: 'Hckj201509', // 数据库密码
    database: 'webrtc_db' // 数据库名称
  });

  connection.connect((err) => {
      if (err) {
        console.error('连接到数据库时出错：', err);
        return;
      }
      console.log('已成功连接到数据库');

      // 要执行的 SQL 查询，这里是一个更新操作示例
      const updateSql = 'insert into sys_room (room_num,room_create_time,room_create_by) values(?,?,?);';
      const values = [room_num,room_create_time,room_create_by]; // 替换为实际的值

      // 执行 SQL 更新操作
      connection.query(updateSql, values, (err, results) => {
      if (err) {
          console.error('执行 SQL 查询时出错：', err);
          return;
      }
      console.log('成功更新数据');
      
      // 关闭数据库连接
      connection.end((err) => {
          if (err) {
          console.error('关闭数据库连接时出错：', err);
          return;
          }
          console.log('已成功关闭数据库连接');
      });
      });
  });
}

function deletemysql(uid){
  const connection = mysql.createConnection({
    host: '192.144.215.114',     // 数据库主机地址
    user: 'root', // 数据库用户名
    password: 'Hckj201509', // 数据库密码
    database: 'webrtc_db' // 数据库名称
  });

    // 执行DELETE语句
    const sql = "DELETE FROM sys_room WHERE room_create_by = ?"; // 假设你要删除的行有一个唯一的ID作为标识
    const idToDelete = uid; // 用实际的ID值替换这里的1
  
    connection.query(sql, [idToDelete], (err, results) => {
      if (err) {
        console.error('删除行时发生错误:', err);
        return;
      }
      console.log('成功删除行:', results.affectedRows);
      
      // 关闭数据库连接
      connection.end((err) => {
        if (err) {
          console.error('关闭数据库连接时发生错误:', err);
        }
        console.log('数据库连接已关闭');
      });
    });
}

module.exports = {
    UPdateMySQL,
    InsertyMySQL,
    deletemysql
  };
  