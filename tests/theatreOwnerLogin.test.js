const { Builder, By, Key, until } = require('selenium-webdriver');
const http = require('http');

// Configure your app URL here or via BASE_URL env var
// Vite default is 5173, but check your actual running port
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

// Theatre Owner Credentials
const THEATRE_OWNER_EMAIL = process.env.THEATRE_OWNER_EMAIL || 'anchani@booknview.com';
const THEATRE_OWNER_PASSWORD = process.env.THEATRE_OWNER_PASSWORD || '3*F#cbKPPMv2';

// Helper to check if server is running
async function checkServerRunning(url) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: '/',
      method: 'HEAD',
      timeout: 3000
    }, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function findFirstPresent(driver, locators, timeoutMs = 10000) {
  for (let i = 0; i < locators.length; i++) {
    try {
      const el = await driver.wait(until.elementLocated(locators[i]), timeoutMs);
      await driver.wait(until.elementIsVisible(el), timeoutMs);
      return el;
    } catch (err) {
      // try next locator
      if (i === locators.length - 1) {
        // Last locator failed, throw error with details
        throw new Error('None of the expected elements were found. Tried: ' + locators.map(String).join(', '));
      }
    }
  }
  throw new Error('None of the expected elements were found: ' + locators.map(String).join(', '));
}

(async function theatreOwnerLoginTest() {
  // Check if frontend server is running
  console.log(`Checking if frontend server is running at ${BASE_URL}...`);
  const serverRunning = await checkServerRunning(BASE_URL);
  if (!serverRunning) {
    console.error(`\n❌ ERROR: Frontend server is not running at ${BASE_URL}`);
    console.error(`\nPlease start your frontend server first:`);
    console.error(`  cd frontend`);
    console.error(`  npm run dev`);
    console.error(`\nOr set BASE_URL environment variable if your server runs on a different port:`);
    console.error(`  $env:BASE_URL='http://localhost:5175'; node tests/theatreOwnerLogin.test.js`);
    process.exit(1);
  }
  console.log(`✓ Frontend server is running\n`);

  const driver = await new Builder().forBrowser('chrome').build();
  try {
    console.log(`Navigating to ${BASE_URL}...`);
    await driver.get(BASE_URL);
    console.log('✓ Page loaded successfully');
    await driver.sleep(2000); // Wait for page to fully render

    // Step 1: Open Login Modal/Page
    console.log('\n🔐 Step 1: Opening login...');
    
    // Check if already logged in
    const loginButton = await driver.findElements(By.xpath("//button[contains(.,'Login')] | //a[contains(.,'Login')]"));
    if (loginButton.length === 0) {
      console.log('⚠️  Already logged in! Logging out first...');
      try {
        // Try to find and click logout button
        const logoutBtn = await driver.findElements(By.xpath("//button[contains(.,'Logout')] | //a[contains(.,'Logout')]"));
        if (logoutBtn.length > 0) {
          await logoutBtn[0].click();
          await driver.sleep(2000);
          console.log('✓ Logged out successfully');
        }
      } catch (err) {
        console.log('⚠️  Could not logout, clearing localStorage...');
        await driver.executeScript("localStorage.clear(); sessionStorage.clear();");
        await driver.navigate().refresh();
        await driver.sleep(2000);
      }
    }
    
    // Click Login button
    const loginBtn = await findFirstPresent(driver, [
      By.xpath("//button[contains(.,'Login')] | //a[contains(.,'Login')]"),
      By.css('button[class*="login"]'),
      By.css('a[class*="login"]'),
    ], 10000);
    console.log('✓ Found login button, clicking...');
    await loginBtn.click();
    await driver.sleep(2000); // Wait for modal/page to open

    // Step 2: Enter Username
    console.log('\n📝 Step 2: Entering username...');
    const emailInput = await findFirstPresent(driver, [
      By.name('email'),
      By.id('email'),
      By.css('input[type="email"]'),
      By.xpath("//input[@placeholder='Email' or @placeholder='Enter your email' or @placeholder='Username or Email']"),
      By.xpath("//label[contains(.,'Email') or contains(.,'Username')]/following::input[1]"),
    ], 10000);
    
    await emailInput.clear();
    await emailInput.sendKeys(THEATRE_OWNER_EMAIL);
    console.log(`✓ Username entered: ${THEATRE_OWNER_EMAIL}`);
    await driver.sleep(500);

    // Step 3: Enter Password
    console.log('\n🔑 Step 3: Entering password...');
    const passwordInput = await findFirstPresent(driver, [
      By.name('password'),
      By.id('password'),
      By.css('input[type="password"]'),
      By.xpath("//input[@placeholder='Password' or @placeholder='Enter your password']"),
      By.xpath("//label[contains(.,'Password')]/following::input[1]"),
    ], 10000);
    
    await passwordInput.clear();
    await passwordInput.sendKeys(THEATRE_OWNER_PASSWORD);
    console.log('✓ Password entered');
    await driver.sleep(500);

    // Step 4: Click Login Button
    console.log('\n✅ Step 4: Clicking Login button...');
    const submitBtn = await findFirstPresent(driver, [
      By.xpath("//button[@type='submit']"),
      By.xpath("//button[contains(.,'Login') or contains(.,'Sign In')]"),
      By.css('button[type="submit"]'),
      By.xpath("//form//button[contains(.,'Login')]"),
    ], 10000);
    
    await submitBtn.click();
    console.log('✓ Login button clicked');
    await driver.sleep(2000); // Wait for login to process

    // Step 5: Check Redirect
    console.log('\n🎯 Step 5: Checking redirect...');
    
    // Wait for redirect to theatre owner dashboard
    await driver.wait(async () => {
      const currentUrl = await driver.getCurrentUrl();
      return currentUrl.includes('/theatre-owner') || currentUrl.includes('/dashboard');
    }, 15000);
    
    const finalUrl = await driver.getCurrentUrl();
    console.log(`✓ Redirected to: ${finalUrl}`);
    
    // Verify we're on the dashboard
    if (finalUrl.includes('/theatre-owner/dashboard') || finalUrl.includes('/theatre-owner')) {
      console.log('✓ Successfully redirected to theatre owner dashboard');
      
      // Wait for dashboard content to load
      await driver.wait(until.elementLocated(By.xpath("//*[contains(text(),'Theatre Owner Dashboard') or contains(text(),'Dashboard') or contains(text(),'Quick Actions')]")), 10000);
      console.log('✓ Dashboard content loaded');
      
      // Verify login success by checking for dashboard elements
      const dashboardElements = await driver.findElements(By.xpath("//*[contains(text(),'Theatre Owner Dashboard') or contains(text(),'Quick Actions')]"));
      if (dashboardElements.length > 0) {
        console.log('✓ Dashboard elements found, login successful!');
      }
      
      console.log('\n✅ Theatre Owner Login test completed successfully!');
      console.log(`   Final URL: ${finalUrl}`);
      console.log(`   Login Status: ✓ Authenticated`);
    } else {
      throw new Error(`Unexpected redirect location: ${finalUrl}. Expected /theatre-owner/dashboard`);
    }
    
  } catch (err) {
    console.error('\n❌ Theatre Owner Login test failed:', err.message);
    
    // Try to capture error message if available
    try {
      const errorElements = await driver.findElements(By.xpath("//*[contains(@class,'error') or contains(@class,'Error')]"));
      if (errorElements.length > 0) {
        const errorText = await errorElements[0].getText();
        console.error(`   Error message: ${errorText}`);
      }
    } catch (_) {}
    
    if (err.message.includes('ERR_CONNECTION_REFUSED') || err.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Tip: Make sure your frontend server is running.');
      console.error('   Start it with: cd frontend && npm run dev');
    } else if (err.message.includes('redirect')) {
      console.error('\n💡 Tip: Check if login credentials are correct.');
      console.error('   Verify the username and password are valid.');
    }
    
    process.exitCode = 1;
  } finally {
    await driver.quit();
  }
})();




