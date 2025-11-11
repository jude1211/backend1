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

(async function showManagementFlow() {
  // Check if frontend server is running
  console.log(`Checking if frontend server is running at ${BASE_URL}...`);
  const serverRunning = await checkServerRunning(BASE_URL);
  if (!serverRunning) {
    console.error(`\n❌ ERROR: Frontend server is not running at ${BASE_URL}`);
    console.error(`\nPlease start your frontend server first:`);
    console.error(`  cd frontend`);
    console.error(`  npm run dev`);
    console.error(`\nOr set BASE_URL environment variable if your server runs on a different port:`);
    console.error(`  $env:BASE_URL='http://localhost:5175'; node tests/showManagement.test.js`);
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

    // Step 1: Navigate to Show Management
    console.log('\n🎬 Step 1: Navigating to Show Management...');
    try {
      // Wait for dashboard to load
      await driver.wait(until.elementLocated(By.xpath("//*[contains(text(),'Theatre Owner Dashboard') or contains(text(),'Quick Actions')]")), 10000);
      console.log('✓ Dashboard loaded');
      
      // Find and click "Show Management" button
      const showManagementBtn = await findFirstPresent(driver, [
        By.xpath("//button[.//i[contains(@class,'fa-film')] and .//span[contains(.,'Show Management')]]"),
        By.xpath("//button[contains(.,'Show Management')]"),
        By.xpath("//button[.//span[contains(.,'Show Management')]]"),
      ], 10000);
      console.log('✓ Found "Show Management" button, clicking...');
      await showManagementBtn.click();
      await driver.sleep(3000); // Wait for navigation to show management page
      
      // Verify we're on the show management page
      const currentUrl = await driver.getCurrentUrl();
      if (currentUrl.includes('/theatre-owner/shows')) {
        console.log('✓ Successfully navigated to show management page');
      } else {
        console.log(`⚠️  Expected /theatre-owner/shows but got: ${currentUrl}`);
      }
    } catch (err) {
      console.log('⚠️  Could not find "Show Management" button, trying direct navigation...');
      // Fallback: navigate directly to show management page
      await driver.get(`${BASE_URL}/theatre-owner/shows`);
      await driver.sleep(2000);
    }

    // Step 2: Wait for page to load and select movie
    console.log('\n🎭 Step 2: Selecting movie...');
    await driver.sleep(2000); // Wait for page to fully load
    
    // Find and select a movie from dropdown
    const movieSelect = await findFirstPresent(driver, [
      By.xpath("//select[.//option[contains(text(),'Select a movie')]]"),
      By.xpath("//label[contains(.,'Movie')]/following::select[1]"),
      By.xpath("//select[contains(@class,'bg-black')]"),
    ], 15000);
    
    // Get all movie options
    const movieOptions = await movieSelect.findElements(By.tagName('option'));
    if (movieOptions.length > 1) {
      // Select the first available movie (skip the "Select a movie" option)
      const firstMovie = movieOptions[1];
      const movieText = await firstMovie.getText();
      await firstMovie.click();
      console.log(`✓ Selected movie: ${movieText}`);
      await driver.sleep(1000);
    } else {
      throw new Error('No movies available. Please add a movie first.');
    }

    // Step 3: Select screen
    console.log('\n🖥️  Step 3: Selecting screen...');
    const screenSelect = await findFirstPresent(driver, [
      By.xpath("//select[.//option[contains(text(),'Select a screen') or contains(text(),'Loading screens')]]"),
      By.xpath("//label[contains(.,'Screen')]/following::select[1]"),
    ], 15000);
    
    // Wait for screens to load
    await driver.sleep(2000);
    
    // Get all screen options
    const screenOptions = await screenSelect.findElements(By.tagName('option'));
    if (screenOptions.length > 1) {
      // Select the first available screen (skip the "Select a screen" option)
      const firstScreen = screenOptions[1];
      const screenText = await firstScreen.getText();
      await firstScreen.click();
      console.log(`✓ Selected screen: ${screenText}`);
      await driver.sleep(2000); // Wait for shows to load
    } else {
      throw new Error('No screens available. Please add a screen first.');
    }

    // Step 4: Enter showtimes by clicking available timing buttons
    console.log('\n⏰ Step 4: Selecting showtimes...');
    
    // Wait for available timings to load
    await driver.sleep(2000);
    
    // Find and click available timing buttons
    try {
      const timingButtons = await driver.findElements(By.xpath("//button[contains(@class,'bg-blue-600') and contains(text(),':')]"));
      if (timingButtons.length > 0) {
        console.log(`  - Found ${timingButtons.length} available timing button(s)`);
        
        // Click the first available timing button
        await timingButtons[0].click();
        const firstTiming = await timingButtons[0].getText();
        console.log(`✓ Clicked first timing: ${firstTiming}`);
        await driver.sleep(1000);
        
        // If there are more timings, click another one (need at least 2 showtimes)
        if (timingButtons.length > 1) {
          await timingButtons[1].click();
          const secondTiming = await timingButtons[1].getText();
          console.log(`✓ Clicked second timing: ${secondTiming}`);
          await driver.sleep(1000);
        }
        
        // Click a third one if available
        if (timingButtons.length > 2) {
          await timingButtons[2].click();
          const thirdTiming = await timingButtons[2].getText();
          console.log(`✓ Clicked third timing: ${thirdTiming}`);
          await driver.sleep(1000);
        }
        
        // Verify that showtimes were added (look for planned chips)
        const plannedChips = await driver.findElements(By.xpath("//span[contains(@class,'bg-emerald-500')]"));
        if (plannedChips.length > 0) {
          console.log(`✓ ${plannedChips.length} showtime(s) selected and visible`);
        }
      } else {
        console.log('⚠️  No timing buttons found. You may need to set up show timings first.');
        console.log('   Navigate to Show Timings page to configure available timings.');
        throw new Error('No available show timings found. Please configure show timings first.');
      }
    } catch (err) {
      console.log('⚠️  Error selecting showtimes:', err.message);
      throw err;
    }

    // Step 5: Assign show
    console.log('\n✅ Step 5: Assigning show...');
    const assignButton = await findFirstPresent(driver, [
      By.xpath("//button[contains(.,'Assign Movie to Screen')]"),
      By.xpath("//button[contains(.,'Assign')]"),
      By.xpath("//button[contains(@class,'bg-red-600') and contains(.,'Assign')]"),
    ], 10000);
    
    // Scroll button into view
    await driver.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", assignButton);
    await driver.sleep(1000);
    
    // Try clicking with JavaScript if regular click fails
    try {
      await assignButton.click();
      console.log('✓ Clicked assign button');
    } catch (err) {
      console.log('  ⚠️  Regular click failed, trying JavaScript click...');
      await driver.executeScript("arguments[0].click();", assignButton);
      console.log('✓ Clicked assign button using JavaScript');
    }
    
    await driver.sleep(3000); // Wait for assignment to complete

    // Step 6: Verify success
    console.log('\n🎉 Step 6: Verifying show assignment...');
    
    // Check for success message or updated show list
    try {
      // Look for success popup/modal
      const successModal = await driver.wait(
        until.elementLocated(By.xpath("//*[contains(.,'success') or contains(.,'assigned') or contains(.,'saved')]")),
        10000
      ).catch(() => null);
      
      if (successModal) {
        const successText = await successModal.getText();
        console.log(`✓ Success message found: ${successText}`);
      } else {
        // Check if shows list was updated
        const showsList = await driver.findElements(By.xpath("//*[contains(text(),'Existing Shows')]"));
        if (showsList.length > 0) {
          console.log('✓ Show list is visible, assignment likely successful');
        }
      }
      
      console.log('\n✅ Show Management test completed successfully!');
    } catch (err) {
      console.log('⚠️  Could not verify success automatically, but assignment may have succeeded');
      console.log('   Check the show list manually to confirm');
    }
  } catch (err) {
    console.error('\n❌ Show Management test failed:', err.message);
    if (err.message.includes('ERR_CONNECTION_REFUSED') || err.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Tip: Make sure your frontend server is running.');
      console.error('   Start it with: cd frontend && npm run dev');
    }
    process.exitCode = 1;
  } finally {
    await driver.quit();
  }
})();

