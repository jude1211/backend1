async function testForgotPassword() {
  try {
    console.log('🧪 Testing Forgot Password API...');

    const response = await fetch('http://localhost:5000/api/v1/auth/forgot-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'http://localhost:5173'
      },
      body: JSON.stringify({
        email: 'test@example.com'
      })
    });

    console.log('✅ API Response:', response.status, response.statusText);
    const data = await response.json();
    console.log('✅ Response Data:', data);

  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    console.error('❌ Error details:', error);
  }
}

testForgotPassword();
