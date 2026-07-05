const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const { sendSuccess, sendError } = require('../utils/helpers');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'gymsword', allowed_formats: ['jpg','jpeg','png','gif','webp'] },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image uploads are allowed'));
    cb(null, true);
  },
}).single('file');

const uploadImage = (req, res) => {
  upload(req, res, (err) => {
    if (err) return sendError(res, err.message || 'Upload failed', 400);
    if (!req.file) return sendError(res, 'No file uploaded', 400);
    return sendSuccess(res, { url: req.file.path }, 'Uploaded');
  });
};

module.exports = { uploadImage };