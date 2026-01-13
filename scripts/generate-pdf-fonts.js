/**
 * Generate base64-encoded fonts for jsPDF
 */

const fs = require('fs');
const path = require('path');

const fontsDir = path.join(__dirname, '..', 'public', 'fonts');
const outputDir = path.join(__dirname, '..', 'lib', 'pdf-fonts');

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('Converting fonts to base64...');

// Read font files
const regularPath = path.join(fontsDir, 'Montserrat-Regular.ttf');
const boldPath = path.join(fontsDir, 'Montserrat-Bold.ttf');

if (!fs.existsSync(regularPath)) {
  console.error('Error: Montserrat-Regular.ttf not found');
  process.exit(1);
}

if (!fs.existsSync(boldPath)) {
  console.error('Error: Montserrat-Bold.ttf not found');
  process.exit(1);
}

const regularBuffer = fs.readFileSync(regularPath);
const boldBuffer = fs.readFileSync(boldPath);

const regularBase64 = regularBuffer.toString('base64');
const boldBase64 = boldBuffer.toString('base64');

console.log(`Regular font size: ${regularBuffer.length} bytes`);
console.log(`Bold font size: ${boldBuffer.length} bytes`);

// Create TypeScript file
const content = `// Auto-generated Montserrat fonts for jsPDF
// Generated on ${new Date().toISOString()}

export const MontserratRegular = '${regularBase64}';

export const MontserratBold = '${boldBase64}';
`;

const outputPath = path.join(outputDir, 'montserrat.ts');
fs.writeFileSync(outputPath, content);

console.log('✅ Font files generated successfully!');
console.log(`   Output: ${outputPath}`);
console.log(`   Regular base64 length: ${regularBase64.length}`);
console.log(`   Bold base64 length: ${boldBase64.length}`);
