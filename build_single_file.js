const fs = require("fs");
const path = require("path");

const root = __dirname;
const outputFile = path.join(root, "Bisaya Buddy Single File.html");

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const svgIcon = fs.readFileSync(path.join(root, "assets", "icon.svg"), "utf8");

global.window = {};
require(path.join(root, "lesson-data.js"));

const lessonCatalog = window.lessonCatalog || [];
const lessonEntries = (window.lessonEntries || []).map((entry) => {
  const audioPath = path.join(root, entry.audio);
  const audioData = fs.readFileSync(audioPath);
  return {
    ...entry,
    audio: `data:audio/wav;base64,${audioData.toString("base64")}`,
  };
});

const inlineData = [
  "window.BISAYA_BUDDY_SINGLE_FILE = true;",
  `window.lessonCatalog = ${JSON.stringify(lessonCatalog)};`,
  `window.lessonEntries = ${JSON.stringify(lessonEntries)};`,
].join("\n");

const escapeInlineScript = (value) => value.replace(/<\/script>/gi, "<\\/script>");
const iconDataUri = `data:image/svg+xml;base64,${Buffer.from(svgIcon).toString("base64")}`;

let bundled = html
  .replace(/<link rel="manifest"[^>]*>\s*/g, "")
  .replace(/<link rel="icon"[^>]*>\s*/g, "")
  .replace(/<link rel="apple-touch-icon"[^>]*>\s*/g, "")
  .replace(/<link rel="stylesheet" href="styles\.css" \/>\s*/g, "")
  .replace(/<script src="lesson-data\.js" defer><\/script>\s*/g, "")
  .replace(/<script src="app\.js" defer><\/script>\s*/g, "");

bundled = bundled.replace(
  "</title>",
  `</title>\n    <link rel="icon" href="${iconDataUri}" />\n    <style>\n${styles}\n    </style>`
);

bundled = bundled.replace(
  "</body>",
  `    <script>\n${escapeInlineScript(inlineData)}\n    </script>\n    <script>\n${escapeInlineScript(appJs)}\n    </script>\n  </body>`
);

fs.writeFileSync(outputFile, bundled);

console.log(`Built ${outputFile}`);
