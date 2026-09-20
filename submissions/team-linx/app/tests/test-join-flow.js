const { chromium } = require('@playwright/test');

async function testJoinFlow() {
  const browser = await chromium.launch({ headless: true });
  try {
    // 1. Manager Context
    const managerContext = await browser.newContext();
    const managerPage = await managerContext.newPage();
    managerPage.on('console', msg => console.log('MGR LOG:', msg.text()));
    managerPage.on('pageerror', err => console.log('MGR ERR:', err));
    await managerPage.goto('http://localhost:3456/');
    
    // Switch to signup
    await managerPage.click('#nav-signup-btn');
    const mgrName = 'Manager_' + Date.now();
    await managerPage.fill('#input-signup-name', mgrName);
    await managerPage.fill('#input-signup-email', mgrName.toLowerCase() + '@sangam.test');
    await managerPage.fill('#input-signup-password', 'pass1234');
    await managerPage.click('#btn-signup-submit');

    // Wait for gateway
    await managerPage.waitForSelector('#view-gateway:not([hidden])');
    console.log('✅ Manager reached Gateway');

    // Create event
    await managerPage.fill('#input-event-title', 'Global AI Summit');
    await managerPage.click('#create-event-form button[type="submit"]');

    // Wait for dashboard
    await managerPage.waitForSelector('#page-dashboard:not([hidden])');
    console.log('✅ Manager created event and reached Dashboard');

    // Get PIN
    const pinText = await managerPage.textContent('#side-event-code');
    const pinMatch = pinText.match(/\d{6}/);
    if (!pinMatch) throw new Error('Could not find 6-digit PIN on dashboard: ' + pinText);
    const pin = pinMatch[0];
    console.log('✅ Generated PIN:', pin);

    // 2. Volunteer Context (New incognito browser context)
    const volContext = await browser.newContext();
    const volPage = await volContext.newPage();
    
    // Visit share link
    console.log('Visiting share link http://localhost:3456/?pin=' + pin);
    await volPage.goto('http://localhost:3456/?pin=' + pin);
    
    // User is unauthenticated, click Sign Up
    await volPage.click('#nav-signup-btn');
    const volName = 'Volunteer_' + Date.now();
    await volPage.fill('#input-signup-name', volName);
    await volPage.fill('#input-signup-email', volName.toLowerCase() + '@sangam.test');
    await volPage.fill('#input-signup-password', 'pass1234');
    await volPage.click('#btn-signup-submit');

    // After signup, handlePendingPinOrGateway seamlessly auto-joins or opens dashboard
    await volPage.waitForSelector('#page-dashboard:not([hidden])', { timeout: 15000 });
    console.log('✅ Volunteer reached dashboard automatically via pending PIN link');

    const volBadge = await volPage.textContent('#user-role-badge');
    console.log('✅ Volunteer role badge:', volBadge.trim());

    const eventTitle = await volPage.textContent('#side-event-title');
    console.log('✅ Volunteer active event title:', eventTitle.trim());

    if (volBadge.trim() !== 'VOLUNTEER') {
      throw new Error('Expected role VOLUNTEER, but got: ' + volBadge);
    }
    if (eventTitle.trim() !== 'Global AI Summit') {
      throw new Error('Expected event title Global AI Summit, but got: ' + eventTitle);
    }

    // 3. Test joining manually via PIN input on Gateway
    console.log('\nTesting manual Gateway PIN entry flow...');
    const vol2Context = await browser.newContext();
    const vol2Page = await vol2Context.newPage();
    await vol2Page.goto('http://localhost:3456/');
    await vol2Page.click('#nav-signup-btn');
    const vol2Name = 'Volunteer2_' + Date.now();
    await vol2Page.fill('#input-signup-name', vol2Name);
    await vol2Page.fill('#input-signup-email', vol2Name.toLowerCase() + '@sangam.test');
    await vol2Page.fill('#input-signup-password', 'pass1234');
    await vol2Page.click('#btn-signup-submit');
    await vol2Page.waitForSelector('#view-gateway:not([hidden])');

    // Fill the 6 pin digits
    const pinDigits = pin.split('');
    const digitInputs = await vol2Page.$$('#find-event-form .pin-digit');
    for (let i = 0; i < 6; i++) {
      await digitInputs[i].fill(pinDigits[i]);
    }
    await vol2Page.click('#find-event-form button[type="submit"]');

    await vol2Page.waitForSelector('#page-dashboard:not([hidden])', { timeout: 15000 });
    const vol2Badge = await vol2Page.textContent('#user-role-badge');
    console.log('✅ Volunteer 2 role badge:', vol2Badge.trim());
    if (vol2Badge.trim() !== 'VOLUNTEER') throw new Error('Expected VOLUNTEER');

    console.log('\n🎉 ALL PLAYWRIGHT E2E EVENT JOIN TESTS PASSED COMPLETELY!');
  } finally {
    await browser.close();
  }
}

testJoinFlow().catch(err => {
  console.error('❌ E2E Test Error:', err);
  process.exit(1);
});
