import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto('http://[::1]:5173');
  
  // Wait for login form
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', 'admin@test.in');
  await page.type('input[type="password"]', 'Test@123');
  await page.click('button[type="submit"]');
  
  // Wait for dashboard to load
  await page.waitForSelector('.nav-btn');
  
  // Click on Users
  const navBtns = await page.$$('.nav-btn');
  let usersBtn = null;
  for (const btn of navBtns) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text.includes('Users')) {
      usersBtn = btn;
      break;
    }
  }
  if (usersBtn) await usersBtn.click();
  
  // Wait for table to load
  await page.waitForTimeout(2000);
  
  // Get all buttons with title="Edit User"
  const editBtns = await page.$$('button[title="Edit User"]');
  if (editBtns.length > 0) {
    const box = await editBtns[0].boundingBox();
    console.log('Edit Button Bounding Box:', box);
    if (box) {
      // Find element at center of bounding box
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      
      const elementInfo = await page.evaluate((x, y) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return null;
        
        let current = el;
        const stack = [];
        while (current && current !== document.body) {
          const style = window.getComputedStyle(current);
          stack.push({
            tag: current.tagName,
            className: current.className,
            id: current.id,
            pointerEvents: style.pointerEvents,
            zIndex: style.zIndex,
            position: style.position
          });
          current = current.parentElement;
        }
        return stack;
      }, cx, cy);
      
      console.log('Element stack at center of Edit button:', JSON.stringify(elementInfo, null, 2));
    }
  } else {
    console.log('No edit buttons found');
  }
  
  await browser.close();
})();
