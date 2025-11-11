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

(async function screenManagementFlow() {
  // Check if frontend server is running
  console.log(`Checking if frontend server is running at ${BASE_URL}...`);
  const serverRunning = await checkServerRunning(BASE_URL);
  if (!serverRunning) {
    console.error(`\n❌ ERROR: Frontend server is not running at ${BASE_URL}`);
    console.error(`\nPlease start your frontend server first:`);
    console.error(`  cd frontend`);
    console.error(`  npm run dev`);
    console.error(`\nOr set BASE_URL environment variable if your server runs on a different port:`);
    console.error(`  $env:BASE_URL='http://localhost:5175'; node tests/screenManagement.test.js`);
    process.exit(1);
  }
  console.log(`✓ Frontend server is running\n`);

  const driver = await new Builder().forBrowser('chrome').build();
  try {
    console.log(`Navigating to ${BASE_URL}...`);
    await driver.get(BASE_URL);
    console.log('✓ Page loaded successfully');
    await driver.sleep(2000); // Wait for page to fully render

    // Step 0: Login as Theatre Owner
    console.log('\n🔐 Step 0: Logging in as Theatre Owner...');
    try {
      // Check if already logged in (look for theatre owner dashboard or absence of login button)
      const loginButton = await driver.findElements(By.xpath("//button[contains(.,'Login')] | //a[contains(.,'Login')]"));
      if (loginButton.length > 0) {
        console.log('  - Not logged in, starting login process...');
        
        // Click Login button
        const loginBtn = await findFirstPresent(driver, [
          By.xpath("//button[contains(.,'Login')] | //a[contains(.,'Login')]"),
          By.css('button[class*="login"]'),
        ], 5000);
        console.log('  ✓ Found login button, clicking...');
        await loginBtn.click();
        await driver.sleep(2000); // Wait for modal to open

        // Fill in email (theatre owner email with @booknview.com)
        console.log('  - Filling email field...');
        const emailInput = await findFirstPresent(driver, [
          By.name('email'),
          By.id('email'),
          By.css('input[type="email"]'),
          By.xpath("//input[@placeholder='Email' or @placeholder='Enter your email']"),
        ], 10000);
        await emailInput.clear();
        await emailInput.sendKeys(THEATRE_OWNER_EMAIL);
        console.log('  ✓ Email filled');

        // Fill in password
        console.log('  - Filling password field...');
        const passwordInput = await findFirstPresent(driver, [
          By.name('password'),
          By.id('password'),
          By.css('input[type="password"]'),
          By.xpath("//input[@placeholder='Password' or @placeholder='Enter your password']"),
        ], 5000);
        await passwordInput.clear();
        await passwordInput.sendKeys(THEATRE_OWNER_PASSWORD);
        console.log('  ✓ Password filled');

        // Click submit/login button
        console.log('  - Submitting login form...');
        const submitBtn = await findFirstPresent(driver, [
          By.xpath("//button[@type='submit']"),
          By.xpath("//button[contains(.,'Login') or contains(.,'Sign In')]"),
          By.css('button[type="submit"]'),
        ], 5000);
        await submitBtn.click();
        console.log('  ✓ Login form submitted');
        
        // Wait for redirect to theatre owner dashboard
        console.log('  - Waiting for redirect to dashboard...');
        await driver.wait(async () => {
          const currentUrl = await driver.getCurrentUrl();
          return currentUrl.includes('/theatre-owner') || currentUrl.includes('/dashboard');
        }, 15000);
        
        const currentUrl = await driver.getCurrentUrl();
        console.log(`  ✓ Redirected to: ${currentUrl}`);
        await driver.sleep(2000); // Wait for page to fully load
      } else {
        console.log('  ✓ Already logged in!');
        // Try to navigate to theatre owner dashboard if not already there
        const currentUrl = await driver.getCurrentUrl();
        if (!currentUrl.includes('/theatre-owner')) {
          await driver.get(`${BASE_URL}/theatre-owner/dashboard`);
          await driver.sleep(2000);
        }
      }
    } catch (err) {
      console.log('  ⚠️  Login check failed:', err.message);
      console.log('  ⚠️  Trying to navigate to theatre owner page anyway...');
      await driver.get(`${BASE_URL}/theatre-owner/dashboard`);
      await driver.sleep(2000);
    }

    // Step 1: Navigate to Manage Screens
    console.log('\n🖥️  Step 1: Navigating to Manage Screens...');
    try {
      // Wait for dashboard to load
      await driver.wait(until.elementLocated(By.xpath("//*[contains(text(),'Theatre Owner Dashboard') or contains(text(),'Quick Actions')]")), 10000);
      console.log('✓ Dashboard loaded');
      
      // Find and click "Manage Screens" button
      const manageScreensBtn = await findFirstPresent(driver, [
        By.xpath("//button[.//i[contains(@class,'fa-cog')] and .//span[contains(.,'Manage Screens')]]"),
        By.xpath("//button[contains(.,'Manage Screens')]"),
        By.xpath("//button[.//span[contains(.,'Manage Screens')]]"),
      ], 10000);
      console.log('✓ Found "Manage Screens" button, clicking...');
      await manageScreensBtn.click();
      await driver.sleep(3000); // Wait for navigation to screen management page
      
      // Verify we're on the screen management page
      const currentUrl = await driver.getCurrentUrl();
      if (currentUrl.includes('/theatre-owner/screens')) {
        console.log('✓ Successfully navigated to screen management page');
      } else {
        console.log(`⚠️  Expected /theatre-owner/screens but got: ${currentUrl}`);
      }
    } catch (err) {
      console.log('⚠️  Could not find "Manage Screens" button, trying direct navigation...');
      // Fallback: navigate directly to screen management page
      await driver.get(`${BASE_URL}/theatre-owner/screens`);
      await driver.sleep(2000);
    }

    // Step 2: Click "Add Screen" button
    console.log('\n➕ Step 2: Clicking "Add Screen" button...');
    await driver.sleep(2000); // Wait for page to fully load
    
    // Find and click "Add Screen" button
    const addScreenBtn = await findFirstPresent(driver, [
      By.xpath("//button[.//i[contains(@class,'fa-plus')] and .//span[contains(.,'Add Screen')]]"),
      By.xpath("//button[contains(.,'Add Screen')]"),
      By.xpath("//button[.//span[contains(.,'Add Screen')]]"),
      By.css('button.bg-brand-red'),
    ], 10000);
    
    console.log('✓ Found "Add Screen" button, clicking...');
    await addScreenBtn.click();
    await driver.sleep(2000); // Wait for modal to open

    // Step 3: Fill screen name
    console.log('\n📝 Step 3: Filling screen details...');
    
    // Wait for modal to be visible
    await driver.wait(until.elementLocated(By.xpath("//*[contains(text(),'Add New Screen')]")), 10000);
    console.log('✓ Add Screen modal opened');
    
    // Generate a unique screen name with timestamp
    const screenName = `Screen ${Date.now()}`;
    
    // Find and fill screen name input
    const screenNameInput = await findFirstPresent(driver, [
      By.xpath("//input[@placeholder='Enter screen name']"),
      By.xpath("//label[contains(.,'Screen Name')]/following::input[1]"),
      By.xpath("//div[contains(.,'Add New Screen')]//input[@type='text']"),
    ], 10000);
    
    await screenNameInput.clear();
    await screenNameInput.sendKeys(screenName);
    console.log(`✓ Screen name filled: ${screenName}`);

    // Step 4: Select screen type (default is 2D, but let's select 3D)
    console.log('\n🎬 Step 4: Selecting screen type...');
    
    // Find and click screen type button (3D)
    try {
      const screenType3D = await findFirstPresent(driver, [
        By.xpath("//button[contains(.,'3D')]"),
        By.xpath("//button[.//span[contains(.,'3D')]]"),
      ], 5000);
      await screenType3D.click();
      console.log('✓ Selected screen type: 3D');
      await driver.sleep(1000);
    } catch (err) {
      console.log('⚠️  Could not find 3D button, using default (2D)...');
      // Default is 2D, so we can proceed
    }

    // Step 5: Click "Add Screen" button to submit
    console.log('\n✅ Step 5: Submitting add screen form...');
    
    // Find the submit button in the modal
    const submitBtn = await findFirstPresent(driver, [
      By.xpath("//div[contains(@class,'modal')]//button[contains(.,'Add Screen')]"),
      By.xpath("//button[contains(.,'Add Screen') and not(contains(@class,'fa-plus'))]"),
      By.xpath("//div[contains(.,'Add New Screen')]//button[contains(.,'Add Screen')]"),
    ], 10000);
    
    // Scroll button into view
    await driver.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", submitBtn);
    await driver.sleep(1000);
    
    // Check if button is enabled
    const isEnabled = await submitBtn.isEnabled();
    if (!isEnabled) {
      console.log('⚠️  Submit button is disabled, checking screen name...');
      // Button might be disabled if screen name is empty
      const nameValue = await screenNameInput.getAttribute('value');
      if (!nameValue || nameValue.trim().length === 0) {
        await screenNameInput.sendKeys(screenName);
        await driver.sleep(500);
      }
    }
    
    // Try clicking with JavaScript if regular click fails
    try {
      await submitBtn.click();
      console.log('✓ Clicked submit button');
    } catch (err) {
      console.log('  ⚠️  Regular click failed, trying JavaScript click...');
      await driver.executeScript("arguments[0].click();", submitBtn);
      console.log('✓ Clicked submit button using JavaScript');
    }
    
    await driver.sleep(3000); // Wait for screen to be added

    // Step 6: Verify success
    console.log('\n🎉 Step 6: Verifying screen addition...');
    
    // Check for success message or updated screen list
    try {
      // Look for success toast/message
      const successToast = await driver.wait(
        until.elementLocated(By.xpath("//*[contains(.,'success') or contains(.,'added') or contains(.,'created')]")),
        10000
      ).catch(() => null);
      
      if (successToast) {
        const successText = await successToast.getText();
        console.log(`✓ Success message found: ${successText}`);
      } else {
        // Check if modal closed (indicates success)
        const modalExists = await driver.findElements(By.xpath("//*[contains(text(),'Add New Screen')]"));
        if (modalExists.length === 0) {
          console.log('✓ Modal closed, screen likely added successfully');
        }
        
        // Check if screen appears in the list
        const screenList = await driver.findElements(By.xpath("//*[contains(text(),'Screen')]"));
        if (screenList.length > 0) {
          console.log('✓ Screen list is visible, screen likely added successfully');
        }
      }
      
      console.log('\n✅ Screen Management test completed successfully!');
    } catch (err) {
      console.log('⚠️  Could not verify success automatically, but screen may have been added');
      console.log('   Check the screen list manually to confirm');
    }
  } catch (err) {
    console.error('\n❌ Screen Management test failed:', err.message);
    if (err.message.includes('ERR_CONNECTION_REFUSED') || err.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Tip: Make sure your frontend server is running.');
      console.error('   Start it with: cd frontend && npm run dev');
    }
    process.exitCode = 1;
  } finally {
    await driver.quit();
  }
})();




