const multer = require('multer');
const path = require('path');

// Store files in memory buffer
const storage = multer.memoryStorage();

// Validate file mime types
const fileFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|gif|webp|mp4|webm|mov|pdf/;
  const extName = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  
  // Accept standard mimetypes for image, video, and pdf
  const mimeType = allowedExtensions.test(file.mimetype);

  if (extName && mimeType) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file format. Only images, videos, and PDFs are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB size limit
  },
  fileFilter
});

module.exports = upload;
