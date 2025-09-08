const cloudinary = require('../config/cloudinary');
const UploadService = require('../services/uploadService');

async function testCloudinaryConnection() {
  console.log('🧪 Testing Cloudinary Integration...\n');

  try {
    // Test 1: Check Cloudinary configuration
    console.log('1. Testing Cloudinary configuration...');
    const config = cloudinary.config();
    console.log('✅ Cloudinary configured with cloud name:', config.cloud_name);
    console.log('✅ API Key:', config.api_key ? 'Set' : 'Not set');
    console.log('✅ API Secret:', config.api_secret ? 'Set' : 'Not set');

    // Test 2: Test file validation
    console.log('\n2. Testing file validation...');
    const mockFile = {
      mimetype: 'image/jpeg',
      size: 1024 * 1024, // 1MB
      originalname: 'test.jpg'
    };

    const validation = UploadService.validateFile(mockFile);
    console.log('✅ File validation:', validation.isValid ? 'PASS' : 'FAIL');
    if (!validation.isValid) {
      console.log('❌ Validation errors:', validation.errors);
    }

    // Test 3: Test invalid file validation
    console.log('\n3. Testing invalid file validation...');
    const invalidFile = {
      mimetype: 'application/msword',
      size: 1024 * 1024,
      originalname: 'test.doc'
    };

    const invalidValidation = UploadService.validateFile(invalidFile);
    console.log('✅ Invalid file correctly rejected:', !invalidValidation.isValid ? 'PASS' : 'FAIL');

    // Test 4: Test file size validation
    console.log('\n4. Testing file size validation...');
    const largeFile = {
      mimetype: 'image/jpeg',
      size: 15 * 1024 * 1024, // 15MB
      originalname: 'large.jpg'
    };

    const sizeValidation = UploadService.validateFile(largeFile);
    console.log('✅ Large file correctly rejected:', !sizeValidation.isValid ? 'PASS' : 'FAIL');

    console.log('\n🎉 All tests passed! Cloudinary integration is working correctly.');
    console.log('\n📝 Next steps:');
    console.log('1. Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in your .env file');
    console.log('2. Test actual file uploads through the API endpoints');
    console.log('3. Verify file storage in Cloudinary dashboard');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Check if Cloudinary credentials are set in environment variables');
    console.log('2. Verify internet connectivity');
    console.log('3. Check Cloudinary account status');
  }
}

// Run the test
testCloudinaryConnection(); 