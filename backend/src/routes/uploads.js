const express = require('express');
const router = express.Router();
const { uploadAttachment } = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/multer');

router.post('/', upload.single('file'), uploadAttachment);

module.exports = router;
