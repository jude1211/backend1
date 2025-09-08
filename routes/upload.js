const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { authenticateUser } = require('../middleware/auth');
const UploadService = require('../services/uploadService');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`));
    }
  }
});

// Upload single file
router.post('/single', [
  authenticateUser,
  upload.single('file'),
  body('folder').optional().isString().trim(),
  body('type').optional().isIn(['image', 'pdf', 'auto'])
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Check if file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Validate file
    const validation = UploadService.validateFile(req.file);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'File validation failed',
        details: validation.errors
      });
    }

    const { folder = 'booknview', type = 'auto' } = req.body;
    const fileName = req.file.originalname;
    const fileBuffer = req.file.buffer;

    let uploadResult;

    // Upload based on file type
    if (type === 'image' || req.file.mimetype.startsWith('image/')) {
      uploadResult = await UploadService.uploadImage(fileBuffer, fileName, folder);
    } else if (type === 'pdf' || req.file.mimetype === 'application/pdf') {
      uploadResult = await UploadService.uploadPDF(fileBuffer, fileName, folder);
    } else {
      uploadResult = await UploadService.uploadFile(fileBuffer, fileName, folder, type);
    }

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        fileName: fileName,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        format: uploadResult.format,
        width: uploadResult.width,
        height: uploadResult.height
      }
    });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file'
    });
  }
});

// Upload multiple files
router.post('/multiple', [
  authenticateUser,
  upload.array('files', 10), // Max 10 files
  body('folder').optional().isString().trim(),
  body('type').optional().isIn(['image', 'pdf', 'auto'])
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Check if files exist
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    const { folder = 'booknview', type = 'auto' } = req.body;
    const uploadResults = [];

    // Process each file
    for (const file of req.files) {
      try {
        // Validate file
        const validation = UploadService.validateFile(file);
        if (!validation.isValid) {
          uploadResults.push({
            fileName: file.originalname,
            success: false,
            error: validation.errors.join(', ')
          });
          continue;
        }

        const fileName = file.originalname;
        const fileBuffer = file.buffer;

        let uploadResult;

        // Upload based on file type
        if (type === 'image' || file.mimetype.startsWith('image/')) {
          uploadResult = await UploadService.uploadImage(fileBuffer, fileName, folder);
        } else if (type === 'pdf' || file.mimetype === 'application/pdf') {
          uploadResult = await UploadService.uploadPDF(fileBuffer, fileName, folder);
        } else {
          uploadResult = await UploadService.uploadFile(fileBuffer, fileName, folder, type);
        }

        uploadResults.push({
          fileName: fileName,
          success: true,
          data: {
            url: uploadResult.url,
            publicId: uploadResult.publicId,
            fileType: file.mimetype,
            fileSize: file.size,
            format: uploadResult.format,
            width: uploadResult.width,
            height: uploadResult.height
          }
        });

      } catch (error) {
        uploadResults.push({
          fileName: file.originalname,
          success: false,
          error: error.message
        });
      }
    }

    const successfulUploads = uploadResults.filter(result => result.success);
    const failedUploads = uploadResults.filter(result => !result.success);

    res.json({
      success: true,
      message: `Uploaded ${successfulUploads.length} files successfully`,
      data: {
        totalFiles: req.files.length,
        successfulUploads: successfulUploads.length,
        failedUploads: failedUploads.length,
        results: uploadResults
      }
    });

  } catch (error) {
    console.error('Multiple file upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload files'
    });
  }
});

// Delete file from Cloudinary
router.delete('/:publicId', [
  authenticateUser,
  body('resourceType').optional().isIn(['image', 'video', 'raw', 'auto'])
], async (req, res) => {
  try {
    const { publicId } = req.params;
    const { resourceType = 'auto' } = req.body;

    const result = await UploadService.deleteFile(publicId, resourceType);

    res.json({
      success: true,
      message: 'File deleted successfully',
      data: result
    });

  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete file'
    });
  }
});

// Error handling for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum size is 10MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Too many files. Maximum is 10 files'
      });
    }
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  next(error);
});

module.exports = router; 