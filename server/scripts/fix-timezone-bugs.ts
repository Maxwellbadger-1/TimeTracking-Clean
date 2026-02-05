import { readFile, writeFile, readdir } from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getAllTypeScriptFiles(dir: string, files: string[] = []): Promise<string[]> {
  const dirents = await readdir(dir, { withFileTypes: true });

  for (const dirent of dirents) {
    const fullPath = path.join(dir, dirent.name);

    if (dirent.isDirectory() && dirent.name !== 'node_modules') {
      await getAllTypeScriptFiles(fullPath, files);
    } else if (dirent.isFile() && dirent.name.endsWith('.ts') && !dirent.name.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function fixTimezoneBugs() {
  console.log('🔍 Starting timezone bug fixes...\n');

  const srcDir = path.join(path.dirname(__dirname), 'src');
  const files = await getAllTypeScriptFiles(srcDir);

  // Filter out timezone.ts itself
  const filesToFix = files.filter(file => !file.endsWith('utils/timezone.ts'));

  let fixedCount = 0;
  const filesFixed: string[] = [];

  for (const fullPath of filesToFix) {
    let content = await readFile(fullPath, 'utf-8');
    const original = content;

    // Pattern 1: new Date().toISOString().split('T')[0]
    content = content.replace(
      /new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]/g,
      "formatDate(getCurrentDate(), 'yyyy-MM-dd')"
    );

    // Pattern 2: variable.toISOString().split('T')[0]
    content = content.replace(
      /(\w+)\.toISOString\(\)\.split\('T'\)\[0\]/g,
      "formatDate($1, 'yyyy-MM-dd')"
    );

    // Pattern 3: expression.toISOString().split('T')[0]
    // Handle cases like: new Date(something).toISOString().split('T')[0]
    content = content.replace(
      /new Date\([^)]+\)\.toISOString\(\)\.split\('T'\)\[0\]/g,
      (match) => {
        const dateExpression = match.replace('.toISOString().split(\'T\')[0]', '');
        return `formatDate(${dateExpression}, 'yyyy-MM-dd')`;
      }
    );

    // Pattern 4: .toISOString().substring(0, X) patterns
    content = content.replace(
      /new Date\(\)\.toISOString\(\)\.substring\(0,\s*10\)/g,
      "formatDate(getCurrentDate(), 'yyyy-MM-dd')"
    );

    content = content.replace(
      /(\w+)\.toISOString\(\)\.substring\(0,\s*10\)/g,
      "formatDate($1, 'yyyy-MM-dd')"
    );

    // Pattern 5: .toISOString().slice(0, 10)
    content = content.replace(
      /new Date\(\)\.toISOString\(\)\.slice\(0,\s*10\)/g,
      "formatDate(getCurrentDate(), 'yyyy-MM-dd')"
    );

    content = content.replace(
      /(\w+)\.toISOString\(\)\.slice\(0,\s*10\)/g,
      "formatDate($1, 'yyyy-MM-dd')"
    );

    if (content !== original) {
      // Check if we need to add imports
      const hasFormatDateImport = content.includes('formatDate') && content.includes('from') && content.includes('timezone');
      const hasGetCurrentDateImport = content.includes('getCurrentDate') && content.includes('from') && content.includes('timezone');
      const needsFormatDate = content.includes('formatDate(') && !hasFormatDateImport;
      const needsGetCurrentDate = content.includes('getCurrentDate()') && !hasGetCurrentDateImport;

      if (needsFormatDate || needsGetCurrentDate) {
        // Find the relative path to timezone.ts
        const relativePath = path.relative(
          path.dirname(fullPath),
          path.join(srcDir, 'utils/timezone')
        ).replace(/\\/g, '/');

        // Build import statement
        const imports: string[] = [];
        if (needsFormatDate) imports.push('formatDate');
        if (needsGetCurrentDate) imports.push('getCurrentDate');

        const importStatement = `import { ${imports.join(', ')} } from '${relativePath.startsWith('.') ? relativePath : './' + relativePath}.js';\n`;

        // Add import after existing imports or at the beginning
        const importRegex = /^(import .* from .*;?\n)+/m;
        if (importRegex.test(content)) {
          content = content.replace(importRegex, (match) => match + importStatement);
        } else {
          // Add at the beginning if no imports exist
          content = importStatement + '\n' + content;
        }
      }

      await writeFile(fullPath, content);
      const relativePath = path.relative(path.dirname(srcDir), fullPath);
      console.log(`✅ Fixed: ${relativePath}`);
      filesFixed.push(relativePath);
      fixedCount++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Files scanned: ${filesToFix.length}`);
  console.log(`   Files fixed: ${fixedCount}`);

  if (fixedCount > 0) {
    console.log(`\n✅ Fixed files:`);
    filesFixed.forEach(file => console.log(`   - ${file}`));
  } else {
    console.log('\n🎉 No timezone bugs found!');
  }
}

// Run the fix
fixTimezoneBugs().catch(console.error);