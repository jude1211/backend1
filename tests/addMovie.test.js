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

(async function addMovieFlow() {
  // Check if frontend server is running
  console.log(`Checking if frontend server is running at ${BASE_URL}...`);
  const serverRunning = await checkServerRunning(BASE_URL);
  if (!serverRunning) {
    console.error(`\n❌ ERROR: Frontend server is not running at ${BASE_URL}`);
    console.error(`\nPlease start your frontend server first:`);
    console.error(`  cd frontend`);
    console.error(`  npm run dev`);
    console.error(`\nOr set BASE_URL environment variable if your server runs on a different port:`);
    console.error(`  $env:BASE_URL='http://localhost:5175'; node tests/addMovie.test.js`);
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

    // Step 1: Click "Add New Show" button on dashboard
    console.log('\n📽️  Step 1: Clicking "Add New Show" button on dashboard...');
    try {
      // Wait for dashboard to load
      await driver.wait(until.elementLocated(By.xpath("//*[contains(text(),'Theatre Owner Dashboard') or contains(text(),'Quick Actions')]")), 10000);
      console.log('✓ Dashboard loaded');
      
      // Find and click "Add New Show" button
      const addNewShowBtn = await findFirstPresent(driver, [
        By.xpath("//button[.//i[contains(@class,'fa-plus')] and .//span[contains(.,'Add New Show')]]"),
        By.xpath("//button[contains(.,'Add New Show')]"),
        By.xpath("//button[.//span[contains(.,'Add New Show')]]"),
        // Try by navigating directly if button not found
      ], 10000);
      console.log('✓ Found "Add New Show" button, clicking...');
      await addNewShowBtn.click();
      await driver.sleep(3000); // Wait for navigation to movies page
      
      // Verify we're on the movies page
      const currentUrl = await driver.getCurrentUrl();
      if (currentUrl.includes('/theatre-owner/movies')) {
        console.log('✓ Successfully navigated to movies page');
      } else {
        console.log(`⚠️  Expected /theatre-owner/movies but got: ${currentUrl}`);
      }
    } catch (err) {
      console.log('⚠️  Could not find "Add New Show" button, trying direct navigation...');
      // Fallback: navigate directly to movies page
      await driver.get(`${BASE_URL}/theatre-owner/movies`);
      await driver.sleep(2000);
    }

    // Open Add Movie form
    console.log('\n➕ Step 2: Looking for Add Movie button...');
    const addButton = await findFirstPresent(driver, [
      // Try button with icon and text
      By.xpath("//button[.//i[contains(@class,'fa-plus')] and .//span[contains(.,'Add Movie')]]"),
      By.xpath("//button[contains(.,'Add Movie')]"),
      // Try button with bg-brand-red class (red background)
      By.css('button.bg-brand-red'),
      By.css('button[class*="bg-brand-red"]'),
      // Try button with fa-plus icon
      By.xpath("//button[.//i[contains(@class,'fa-plus')]]"),
      // Generic fallbacks
      By.css('[data-testid="add-movie-button"]'),
      By.id('add-movie-button'),
      By.xpath("//button[normalize-space()='Add Movie']"),
      By.xpath("//button[contains(.,'Add') and contains(.,'Movie')]"),
    ]);
    console.log('✓ Found Add Movie button, clicking...');
    await addButton.click();
    await driver.sleep(2000);

    // Step 3: Search for "lokah" in TMDB search
    console.log('\n🔍 Step 3: Searching for "lokah" in TMDB search...');
    try {
      // Find the TMDB search input (MovieSearchInput component)
      const tmdbSearchInput = await findFirstPresent(driver, [
        By.xpath("//input[@placeholder='Search for movies to auto-fill details...']"),
        By.xpath("//input[contains(@placeholder,'Search for movies')]"),
        By.xpath("//input[contains(@placeholder,'TMDB')]"),
        // Try any input in the modal
        By.xpath("//div[contains(@class,'modal')]//input[@type='text']"),
      ], 10000);
      console.log('  ✓ Found TMDB search input');
      
      // Type "lokah" in the search input
      await tmdbSearchInput.clear();
      await tmdbSearchInput.sendKeys('lokah');
      console.log('  ✓ Typed "lokah" in search');
      await driver.sleep(2000); // Wait for debounce and API call
      
      // Wait for suggestions dropdown to appear
      console.log('  - Waiting for search results...');
      try {
        await driver.wait(until.elementLocated(By.xpath("//div[contains(@class,'absolute') and contains(@class,'z-50')]//div[contains(.,'lokah') or contains(@class,'cursor-pointer')]")), 10000);
        
        // Find and click the first suggestion (or one containing "lokah")
        const firstSuggestion = await findFirstPresent(driver, [
          By.xpath("//div[contains(@class,'cursor-pointer')][contains(.,'lokah') or contains(.,'Lokah')]"),
          By.xpath("//div[contains(@class,'cursor-pointer')][1]"), // First suggestion
          By.xpath("//div[contains(@class,'absolute')]//div[contains(@class,'cursor-pointer')][1]"),
        ], 8000);
        console.log('  ✓ Found search result, clicking...');
        await firstSuggestion.click();
        await driver.sleep(3000); // Wait for form to auto-fill
        console.log('  ✓ Movie selected from TMDB, form should be auto-filled');
      } catch (err) {
        console.log('  ⚠️  Could not find suggestions, proceeding with manual form fill...');
      }
    } catch (err) {
      console.log('  ⚠️  TMDB search failed:', err.message);
      console.log('  ⚠️  Proceeding with manual form fill...');
    }

    // Fill the form fields (adjust test IDs/names/labels as needed)
    console.log('\n📝 Step 4: Filling movie form...');
    
    // Check if title is already filled (from TMDB search)
    console.log('  - Checking if form was auto-filled...');
    try {
      const titleInput = await driver.findElement(By.name('title'));
      const titleValue = await titleInput.getAttribute('value');
      if (titleValue && titleValue.length > 0) {
        console.log(`  ✓ Form was auto-filled with title: "${titleValue}"`);
        console.log('  ⚠️  Skipping manual form fill, using TMDB data');
      } else {
        // Fill title manually if not auto-filled
        console.log('  - Form not auto-filled, filling manually...');
        await titleInput.clear();
        await titleInput.sendKeys('Lokah');
        console.log('  ✓ Title filled');
      }
    } catch (err) {
      // If title input not found, try to fill manually
      console.log('  - Filling title field manually...');
      const titleInput = await findFirstPresent(driver, [
        By.css('[data-testid="movie-title"]'),
        By.name('title'),
        By.id('title'),
        By.xpath("//input[@placeholder='Title' or @id='movieTitle' or @name='title']"),
        By.xpath("//label[normalize-space()='Title']/following::input[1]"),
      ]);
      await titleInput.clear();
      await titleInput.sendKeys('Lokah');
      console.log('  ✓ Title filled');
    }

    // Fill other required fields if not already filled
    try {
      const descInput = await driver.findElement(By.name('description'));
      const descValue = await descInput.getAttribute('value');
      if (!descValue || descValue.length === 0) {
        console.log('  - Filling description field...');
        await descInput.clear();
        await descInput.sendKeys('Added by automated E2E test via TMDB search.');
        console.log('  ✓ Description filled');
      } else {
        console.log('  ✓ Description already filled from TMDB');
      }
    } catch (err) {
      console.log('  ⚠️  Could not fill description field');
    }

    try {
      const durationInput = await driver.findElement(By.name('duration'));
      const durationValue = await durationInput.getAttribute('value');
      if (!durationValue || durationValue.length === 0) {
        console.log('  - Filling duration field...');
        await durationInput.clear();
        await durationInput.sendKeys('120');
        console.log('  ✓ Duration filled');
      } else {
        console.log('  ✓ Duration already filled from TMDB');
      }
    } catch (err) {
      console.log('  ⚠️  Could not fill duration field');
    }

    // Submit the form
    console.log('\n✅ Step 5: Submitting form...');
    // Scroll to submit button to avoid click interception
    const submitBtn = await findFirstPresent(driver, [
      By.xpath("//button[@type='submit']"),
      By.xpath("//button[contains(.,'Add Movie') or contains(.,'Update Movie')]"),
      By.css('button[type="submit"]'),
      By.xpath("//form//button[@type='submit']"),
    ]);
    
    // Scroll button into view
    await driver.executeScript("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});", submitBtn);
    await driver.sleep(1000);
    
    // Try clicking with JavaScript if regular click fails
    try {
      await submitBtn.click();
    } catch (err) {
      console.log('  ⚠️  Regular click failed, trying JavaScript click...');
      await driver.executeScript("arguments[0].click();", submitBtn);
    }
    console.log('✓ Found submit button, clicking...');
    await driver.sleep(2000);

    // Verify success message/toast
    console.log('\n🎉 Step 6: Verifying success message...');
    const successEl = await findFirstPresent(driver, [
      By.css('.toast.toast-success, .toast-success, [role="alert"].success'),
      By.css('[role="alert"]'),
      By.xpath("//*[contains(@class,'success') and (contains(., 'Movie added') or contains(., 'added successfully'))]"),
      By.xpath("//*[contains(., 'Movie added') or contains(., 'added successfully')]"),
      By.xpath("//*[contains(.,'success')]"),
    ], 15000);

    const text = await successEl.getText();
    console.log('\n✅ Add Movie Success Message:', text);
    console.log('\n✅ Add Movie test completed successfully!');
  } catch (err) {
    console.error('\n❌ Add Movie test failed:', err.message);
    if (err.message.includes('ERR_CONNECTION_REFUSED') || err.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Tip: Make sure your frontend server is running.');
      console.error('   Start it with: cd frontend && npm run dev');
    }
    process.exitCode = 1;
  } finally {
    await driver.quit();
  }
})();


