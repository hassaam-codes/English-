// Builds the designed PDF for one chapter of English A or English B from js/book.js.
// Usage (from the repo root):  node tools/make-notes-pdf.cjs b tenses assets/notes/Tenses.pdf     (needs: npm i playwright)
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const [book, id, outArg] = process.argv.slice(2);
if (!book || !id || !outArg) { console.error("Usage: node tools/make-notes-pdf.cjs <a|b> <chapter-id> <output.pdf>"); process.exit(1); }
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };

(async () => {
  const server = http.createServer((req, res) => {
    const file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  }).listen(0);
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(`http://localhost:${server.address().port}/tools/notes-pdf.html?book=${book}&id=${encodeURIComponent(id)}`, { waitUntil: "networkidle" });
  await page.waitForFunction("window.__ready === true");
  const footer = await page.evaluate("window.__footer");
  await page.pdf({
    path: path.resolve(ROOT, outArg), format: "A4", printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate: `<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:7pt;color:#8a8a8f;text-align:center;padding:0 16mm">${footer} &nbsp;|&nbsp; Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
  });
  await browser.close(); server.close();
  console.log("Wrote", outArg);
})();
