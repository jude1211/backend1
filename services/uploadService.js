const path = require('path');

let cloudinary;
try {
  cloudinary = require('cloudinary').v2;
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config(process.env.CLOUDINARY_URL);
  } else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
  }
} catch (e) {
  // cloudinary not installed; handled below
}

const isCloudinaryConfigured = () => {
  try {
    if (!cloudinary) return false;
    const cfg = cloudinary.config();
    return Boolean(cfg?.cloud_name || process.env.CLOUDINARY_URL);
  } catch {
    return false;
  }
};

const UploadService = {
  isConfigured() {
    return isCloudinaryConfigured();
  },

  validateFile(file) {
    if (!file) {
      return { isValid: false, reason: 'No file provided' };
    }
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(file.mimetype)) {
      return { isValid: false, reason: `Invalid type ${file.mimetype}` };
    }
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return { isValid: false, reason: 'File too large' };
    }
    return { isValid: true };
  },

  async uploadImage(buffer, fileName, folder = 'uploads') {
    return this.uploadFile(buffer, fileName, folder, 'image');
  },

  async uploadPDF(buffer, fileName, folder = 'uploads') {
    return this.uploadFile(buffer, fileName, folder, 'raw');
  },

  async uploadFile(buffer, fileName, folder = 'uploads', resourceType = 'auto') {
    try {
      if (!buffer) throw new Error('No file buffer provided');

      if (!isCloudinaryConfigured()) {
        const fakeUrl = `https://res.cloudinary.com/demo/${folder}/${Date.now()}_${path.basename(fileName || 'file')}`;
        console.warn('⚠️  Cloudinary not configured. Using DEV fallback URL:', fakeUrl);
        console.warn('   Set CLOUDINARY_URL or CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET to enable real uploads.');
        return { url: fakeUrl, publicId: `dev_${Date.now()}` };
      }

      const uploadPromise = new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder,
            resource_type: resourceType,
            public_id: path.parse(fileName || `file_${Date.now()}`).name,
            overwrite: true
          },
          (error, uploadResult) => {
            if (error) return reject(error);
            resolve(uploadResult);
          }
        );
        stream.end(buffer);
      });

      const uploadRes = await uploadPromise;
      return { url: uploadRes.secure_url || uploadRes.url, publicId: uploadRes.public_id };
    } catch (error) {
      console.error('UploadService.uploadFile error:', error.message);
      throw error;
    }
  },

  async deleteFile(publicId) {
    try {
      if (!publicId) {
        throw new Error('publicId is required');
      }
      if (!isCloudinaryConfigured()) {
        console.warn(`⚠️  Cloudinary not configured. Skipping delete for publicId=${publicId}`);
        return { success: true };
      }
      const res = await cloudinary.uploader.destroy(publicId, { invalidate: true });
      return { success: res.result === 'ok' || res.result === 'not found' };
    } catch (error) {
      console.error('UploadService.deleteFile error:', error.message);
      return { success: false, error: error.message };
    }
  }
};

module.exports = UploadService;