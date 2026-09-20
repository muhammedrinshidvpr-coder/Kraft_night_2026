const { chromium } = require('@playwright/test');

async function testRealtimeMembersSync() {
  const browser = await chromium.launch({ headless: true });
  try {
    console.log('=== Step 1: Manager Context ===');
    const managerContext = await browser.newContext();
    const managerPage = await managerContext.newPage();
    managerPage.on('pageerror', err => console.log('MGR ERR:', err));
    await managerPage.goto('http://localhost:3456/');

    // Manager signs up
    await managerPage.click('#nav-signup-btn');
    const mgrName = 'Host_' + Date.now();
    await managerPage.fill('#input-signup-name', mgrName);
    await managerPage.fill('#input-signup-email', mgrName.toLowerCase() + '@sangam.test');
    await managerPage.fill('#input-signup-password', 'pass1234');
    await managerPage.click('#btn-signup-submit');

    // Wait for gateway & create event
    await managerPage.waitForSelector('#view-gateway:not([hidden])');
    await managerPage.fill('#input-event-title', 'Realtime Sync Festival');
    await managerPage.click('#create-event-form button[type="submit"]');
    await managerPage.waitForSelector('#page-dashboard:not([hidden])');

    // Get 6-digit PIN
    const pinText = await managerPage.textContent('#side-event-code');
    const pinMatch = pinText.match(/\d{6}/);
    if (!pinMatch) throw new Error('Could not find PIN on dashboard: ' + pinText);
    const pin = pinMatch[0];
    console.log('✅ Manager created event. PIN:', pin);

    // Navigate to Assign Roles tab on manager's screen to observe roster
    await managerPage.click('[data-workspace-page="assign-roles"]');
    await managerPage.waitForSelector('#page-assign-roles:not([hidden])');

    const initialCount = await managerPage.locator('#joined-people-list .roster-card').count();
    console.log('✅ Initial manager roster count:', initialCount);

    console.log('\n=== Step 2: Volunteer Context Joins via Link ===');
    const volContext = await browser.newContext();
    const volPage = await volContext.newPage();
    volPage.on('pageerror', err => console.log('VOL ERR:', err));
    await volPage.goto('http://localhost:3456/?pin=' + pin);

    // Volunteer signs up
    await volPage.click('#nav-signup-btn');
    const volName = 'Member_' + Date.now();
    await volPage.fill('#input-signup-name', volName);
    await volPage.fill('#input-signup-email', volName.toLowerCase() + '@sangam.test');
    await volPage.fill('#input-signup-password', 'pass1234');
    await volPage.click('#btn-signup-submit');

    // Volunteer lands on dashboard
    await volPage.waitForSelector('#page-dashboard:not([hidden])');
    const volBadgeInitial = await volPage.textContent('#user-role-badge');
    console.log('✅ Volunteer joined dashboard with role badge:', volBadgeInitial.trim());

    console.log('\n=== Step 3: Verify Real-Time Member Arrival on Manager Screen ===');
    // Without refreshing managerPage, the roster count should increase to include the volunteer via Realtime WebSocket
    await managerPage.waitForFunction(
      (expectedName) => {
        const text = document.getElementById('joined-people-list')?.innerText || '';
        return text.includes(expectedName);
      },
      volName,
      { timeout: 15000 }
    );
    console.log('✅ Realtime verification: Manager saw new member appear live in roster without page refresh!');

    console.log('\n=== Step 4: Manager Updates Volunteer Role to Team Leader ===');
    // Find the volunteer card on managerPage and open inline editor
    const volCardLocator = managerPage.locator('.roster-card', { hasText: volName });
    await volCardLocator.locator('.roster-header').click();
    await volCardLocator.locator('.roster-role-input').selectOption('lead');
    await volCardLocator.locator('.roster-save-btn').click();
    console.log('✅ Manager saved role change to Team Leader');

    console.log('\n=== Step 5: Verify Real-Time Role & Badge Elevation on Volunteer Screen ===');
    // Without refreshing volPage, its role badge and profile should update to LEAD via Realtime WebSocket
    await volPage.waitForFunction(
      () => {
        const badge = document.getElementById('user-role-badge')?.textContent || '';
        return badge.includes('LEAD');
      },
      null,
      { timeout: 15000 }
    );
    const updatedBadge = await volPage.textContent('#user-role-badge');
    console.log('✅ Realtime verification: Volunteer role badge instantly updated to:', updatedBadge.trim(), 'without page refresh!');

    console.log('\n=== Step 6: Manager Removes Member ===');
    // Open editor and click Remove Member
    await volCardLocator.locator('.roster-header').click();
    // Accept confirm dialog automatically
    managerPage.once('dialog', dialog => dialog.accept());
    await volCardLocator.locator('.roster-remove-btn').click();

    // Verify member is removed from manager screen
    await managerPage.waitForFunction(
      (removedName) => {
        const text = document.getElementById('joined-people-list')?.innerText || '';
        return !text.includes(removedName);
      },
      volName,
      { timeout: 10000 }
    );
    console.log('✅ Realtime verification: Member successfully removed from roster in real-time!');

    console.log('\n🎉 ALL REALTIME MULTI-DEVICE SYNCHRONIZATION TESTS PASSED PERFECTLY!');
  } finally {
    await browser.close();
  }
}

testRealtimeMembersSync().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
