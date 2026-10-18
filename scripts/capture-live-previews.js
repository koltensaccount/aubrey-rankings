const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

async function capture() {
  const browser = await chromium.launch({ headless: true });
  const outputDir = path.resolve(__dirname, '../public/prototype-previews');
  const artifactDir = '/Users/koltenbendickson/.gemini/antigravity/brain/8591bb2b-8368-419b-9f66-7b4f133406f9';

  const targets = [
    { url: 'http://localhost:3000/prototype/profile', name: 'screen-c' },
    { url: 'http://localhost:3000/prototype', name: 'screen-a' },
    { url: 'http://localhost:3000/prototype/ranking', name: 'screen-b' },
  ];

  for (const target of targets) {
    console.log(`Capturing Desktop (1440x900) for ${target.name} from ${target.url}...`);
    const pageDesk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await pageDesk.goto(target.url, { waitUntil: 'networkidle', timeout: 30000 });
    await pageDesk.waitForTimeout(1000);

    const deskPath = path.join(outputDir, `${target.name}-desktop.png`);
    await pageDesk.screenshot({ path: deskPath, fullPage: false });
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(deskPath, path.join(artifactDir, `${target.name}-desktop.png`));
    }
    if (target.name === 'screen-c') {
      fs.copyFileSync(deskPath, path.join(outputDir, 'profile-desktop.png'));
    }
    await pageDesk.close();

    console.log(`Capturing Mobile (390x844) for ${target.name}...`);
    const pageMobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    await pageMobile.goto(target.url, { waitUntil: 'networkidle', timeout: 30000 });
    await pageMobile.waitForTimeout(1000);

    const mobPath = path.join(outputDir, `${target.name}-mobile.png`);
    await pageMobile.screenshot({ path: mobPath, fullPage: false });
    if (fs.existsSync(artifactDir)) {
      fs.copyFileSync(mobPath, path.join(artifactDir, `${target.name}-mobile.png`));
    }
    if (target.name === 'screen-c') {
      fs.copyFileSync(mobPath, path.join(outputDir, 'profile-mobile.png'));
    }
    await pageMobile.close();
  }

  await browser.close();
  console.log('Capture completed successfully!');
}

capture().catch((err) => {
  console.error('Capture error:', err);
  process.exit(1);
});
