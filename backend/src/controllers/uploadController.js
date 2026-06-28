const { uploadToCloudinary } = require('../services/cloudinary');

// @desc    Upload file attachment to Cloudinary
// @route   POST /api/uploads
// @access  Private
const uploadAttachment = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file attachment provided' });
  }

  try {
    // Perform stream upload from memory buffer to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);

    res.status(200).json({
      success: true,
      message: 'Attachment uploaded to Cloudinary successfully',
      data: {
        mediaUrl: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadAttachment
};
