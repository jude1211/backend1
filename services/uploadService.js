const cloudinary = require('../config/cloudinary');
const { Readable } = require('stream');

class UploadService {
  /**
   * Upload file to Cloudinary
   * @param {Buffer} fileBuffer - File buffer
   * @param {string} fileName - Original file name
   * @param {string} folder - Cloudinary folder (optional)
   * @param {string} resourceType - Type of resource (image, video, raw)
   * @returns {Promise<Object>} Upload result with URL
   */
  static async uploadFile(fileBuffer, fileName, folder = 'booknview', resourceType = 'auto') {
    try {
      // Convert buffer to stream
      const stream = Readable.from(fileBuffer);
      
      // Upload to Cloudinary
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: folder,
            resource_type: resourceType,
            allowed_formats: ['jpg', 'jpeg', 'png', 'svg', 'pdf'],
            transformation: resourceType === 'image' ? [
              { quality: 'auto:good' },
              { fetch_format: 'auto' }
            ] : []
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );

        stream.pipe(uploadStream);
      });

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        size: result.bytes,
        width: result.width,
        height: result.height
      };
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      throw new Error(`Failed to upload file: ${error.message}`);
    }
  }

  /**
   * Upload image with specific transformations
   * @param {Buffer} fileBuffer - Image buffer
   * @param {string} fileName - Original file name
   * @param {string} folder - Cloudinary folder
   * @param {Object} transformations - Image transformations
   * @returns {Promise<Object>} Upload result
   */
  static async uploadImage(fileBuffer, fileName, folder = 'booknview/images', transformations = {}) {
    try {
      const stream = Readable.from(fileBuffer);
      
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: folder,
            resource_type: 'image',
            allowed_formats: ['jpg', 'jpeg', 'png', 'svg'],
            transformation: [
              { quality: 'auto:good' },
              { fetch_format: 'auto' },
              ...Object.entries(transformations).map(([key, value]) => ({ [key]: value }))
            ]
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );

        stream.pipe(uploadStream);
      });

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        size: result.bytes,
        width: result.width,
        height: result.height
      };
    } catch (error) {
      console.error('Cloudinary image upload error:', error);
      throw new Error(`Failed to upload image: ${error.message}`);
    }
  }

  /**
   * Upload PDF document
   * @param {Buffer} fileBuffer - PDF buffer
   * @param {string} fileName - Original file name
   * @param {string} folder - Cloudinary folder
   * @returns {Promise<Object>} Upload result
   */
  static async uploadPDF(fileBuffer, fileName, folder = 'booknview/documents') {
    try {
      const stream = Readable.from(fileBuffer);
      
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: folder,
            resource_type: 'raw',
            allowed_formats: ['pdf'],
            format: 'pdf'
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );

        stream.pipe(uploadStream);
      });

      return {
        success: true,
        url: result.secure_url,
        publicId: result.public_id,
        format: 'pdf',
        size: result.bytes
      };
    } catch (error) {
      console.error('Cloudinary PDF upload error:', error);
      throw new Error(`Failed to upload PDF: ${error.message}`);
    }
  }

  /**
   * Delete file from Cloudinary
   * @param {string} publicId - Cloudinary public ID
   * @param {string} resourceType - Type of resource
   * @returns {Promise<Object>} Deletion result
   */
  static async deleteFile(publicId, resourceType = 'auto') {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType
      });

      return {
        success: true,
        result: result
      };
    } catch (error) {
      console.error('Cloudinary delete error:', error);
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Validate file type and size
   * @param {Object} file - File object
   * @param {Array} allowedTypes - Allowed file types
   * @param {number} maxSize - Maximum file size in bytes
   * @returns {Object} Validation result
   */
  static validateFile(file, allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'], maxSize = 10 * 1024 * 1024) {
    const errors = [];

    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      errors.push(`File type ${file.mimetype} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    // Check file size
    if (file.size > maxSize) {
      errors.push(`File size ${file.size} bytes exceeds maximum allowed size of ${maxSize} bytes`);
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  }
}

module.exports = UploadService; 