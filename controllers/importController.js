const fs = require('fs');
const csv = require('csv-parser');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');

const userService = require('./users');
const roleModel = require('../schemas/roles'); // Bắt buộc gọi bảng roles vào để tìm ID

const transporter = nodemailer.createTransport({
  host: "sandbox.smtp.mailtrap.io",
  port: 2525,
  auth: {
    user: "290c7a36b6d55c", // Đổi thành thông tin của bạn
    pass: "76e08d517b86e9"  // Đổi thành thông tin của bạn
  }
});

const generateRandomPassword = () => crypto.randomBytes(8).toString('hex');

const sendPasswordEmail = async (email, username, password) => {
  const mailOptions = {
    from: '"Hệ thống Admin" <admin@example.com>',
    to: email,
    subject: 'Tài khoản của bạn đã được tạo thành công',
    text: `Chào ${username},\n\nTài khoản của bạn đã được tạo. Dưới đây là thông tin đăng nhập:\n- Username: ${username}\n- Password: ${password}\n\nVui lòng đăng nhập và đổi mật khẩu sớm nhất có thể.\n\nTrân trọng.`
  };
  await transporter.sendMail(mailOptions);
};

exports.importUsers = async (req, res) => {
  const file = req.file || (req.files && req.files[0]);
  if (!file) {
    return res.status(400).json({ message: 'Vui lòng upload file CSV.' });
  }

  const filePath = file.path;
  const users = [];

  // BƯỚC QUAN TRỌNG: Tìm chính xác ObjectId của role 'user' trong Database
  // Kiểm tra các trường hợp tên có thể viết hoa hoặc thường (user, USER, User)
  const userRoleObj = await roleModel.findOne({ 
      $or: [{ roleName: { $regex: /^user$/i } }, { name: { $regex: /^user$/i } }] 
  });

  if (!userRoleObj) {
      // Nếu Database chưa có role 'user', báo lỗi ngay để ngừng lại
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Trong CSDL chưa có role tên là "user". Vui lòng tạo role này trước khi import!' });
  }

  const roleId = userRoleObj._id; // Lấy ra được cái ID chuẩn xác của role 'user'

  res.status(200).json({ message: 'File đã được nhận. Hệ thống đang tiến hành import...' });

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      // Đọc dữ liệu file CSV (Xử lý cả lỗi ký tự ẩn BOM của file Excel)
      const keys = Object.keys(row);
      const uname = row.username || row.Username || row[keys[0]];
      const uemail = row.email || row.Email || row[keys[1]];
      
      if (uname && uemail) {
        users.push({ username: uname.trim(), email: uemail.trim() });
      }
    })
    .on('end', async () => {
      console.log(`Đang tiến hành tạo tài khoản với Role ID là: ${roleId}`);

      for (const userData of users) {
        try {
          const existUsername = await userService.GetAnUserByUsername(userData.username);
const existEmail = await userService.GetAnUserByEmail(userData.email);

          if (existUsername || existEmail) {
            console.log(`Bỏ qua: User ${userData.username} hoặc email ${userData.email} đã tồn tại.`);
            continue; 
          }

          const rawPassword = generateRandomPassword();
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(rawPassword, salt);

          // Tạo user với roleId của 'user' đã tìm được ở trên và status là true
          await userService.CreateAnUser(
            userData.username,
            hashedPassword,
            userData.email,
            roleId,         
            null,
            userData.username,
            '',
            true,           
            0
          );

          await sendPasswordEmail(userData.email, userData.username, rawPassword);
          console.log(`✅ Đã tạo thành công và gửi mail cho: ${userData.email}`);

        } catch (error) {
          console.error(`❌ Lỗi khi xử lý user ${userData.username}:`, error.message);
        }
      }
      
      fs.unlinkSync(filePath);
      console.log('🎉 Hoàn thành quá trình import!');
    });
};
