const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'your_cloudinary_cloud_name',
  api_key: process.env.CLOUDINARY_API_KEY || 'your_cloudinary_api_key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'your_cloudinary_api_secret'
});

/**
 * Uploads a file buffer directly to Cloudinary using streams
 * @param {Buffer} fileBuffer - The file content buffer
 * @param {String} originalName - Original filename for identification
 * @returns {Promise<Object>} Cloudinary API response
 */
const uploadToCloudinary = (fileBuffer, originalName) => {
  return new Promise((resolve, reject) => {
    // Determine folder structure or options
    const options = {
      folder: 'whatsapp_attachments',
      resource_type: 'auto', // Auto-detects image, video, pdf, etc.
      public_id: `${Date.now()}-${originalName.split('.')[0]}`.replace(/[^a-zA-Z0-9-_]/g, '')
    };

    const writeStream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        console.error('Cloudinary Stream Upload Error:', error);
        return reject(error);
      }
      resolve(result);
    });

    // Write buffer directly to the writable upload stream
    writeStream.write(fileBuffer);
    writeStream.end();
  });
};

module.exports = {
  uploadToCloudinary
};
