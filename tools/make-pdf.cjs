// Rebuilds assets/English_Papers_2022-2026.pdf from js/data.js.
// Usage (from the repo root):  node tools/make-pdf.cjs      (needs: npm i playwright)
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "assets", "English_Papers_2022-2026.pdf");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

(async () => {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  }).listen(0);
  const port = server.address().port;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/tools/pdf.html`, { waitUntil: "networkidle" });
  await page.waitForFunction("window.__ready === true");
  await page.pdf({
    path: OUT, format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:7pt;color:#8a8a8f;text-align:center;padding:0 16mm">
      9th English — Lahore Board — Q.8 / Q.9 — 2022 to 2026 &nbsp;|&nbsp; Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
  });
  await browser.close();
  server.close();
  console.log("Wrote", OUT);
})();
