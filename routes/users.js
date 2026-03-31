var express = require("express");
var router = express.Router();
const multer = require("multer"); // 1. Bổ sung thư viện multer

let userModel = require("../schemas/users");
let { CreateAnUserValidator, validatedResult, ModifyAnUser } = require('../utils/validateHandler')
let userController = require('../controllers/users')
let { CheckLogin,CheckRole } = require('../utils/authHandler')

// 2. Nạp file Controller chứa logic import (File này chứa đoạn code xử lý CSV và gửi mail mình đưa ở câu trước)
const importController = require('../controllers/importController'); 

// 3. Cấu hình multer để lưu file tải lên vào thư mục 'uploads/'
const upload = multer({ dest: 'uploads/' });

// ==========================================
// 4. THÊM ROUTE IMPORT TẠI ĐÂY
// (Lưu ý: API này sẽ là POST http://localhost:3000/users/import)
// ==========================================
router.post("/import", upload.single("file"), importController.importUsers);


// ==========================================
// CÁC ROUTE CŨ CỦA BẠN GIỮ NGUYÊN BÊN DƯỚI
// ==========================================
router.get("/", CheckLogin,CheckRole("ADMIN"), async function (req, res, next) {
  let users = await userController.GetAllUser()
  res.send(users);
});

router.get("/:id", CheckLogin,CheckRole("ADMIN","MODERATOR"), async function (req, res, next) {
  try {
    let result = await userModel
      .find({ _id: req.params.id, isDeleted: false })
    if (result.length > 0) {
      res.send(result);
    }
    else {
      res.status(404).send({ message: "id not found" });
    }
  } catch (error) {
    res.status(404).send({ message: "id not found" });
  }
});

router.post("/", CreateAnUserValidator, validatedResult, async function (req, res, next) {
  try {
    let newItem = await userController.CreateAnUser(
      req.body.username, req.body.password, req.body.email, req.body.role, null,
      req.body.fullName, req.body.avatarUrl, req.body.status, req.body.loginCount
    )
    // populate cho đẹp
    let saved = await userModel
      .findById(newItem._id)
    res.send(saved);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put("/:id", ModifyAnUser, validatedResult, async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(id, req.body, { new: true });

    if (!updatedItem) return res.status(404).send({ message: "id not found" });

    let populated = await userModel
      .findById(updatedItem._id)
    res.send(populated);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete("/:id", async function (req, res, next) {
  try {
    let id = req.params.id;
    let updatedItem = await userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );
    if (!updatedItem) {
      return res.status(404).send({ message: "id not found" });
    }
res.send(updatedItem);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;
