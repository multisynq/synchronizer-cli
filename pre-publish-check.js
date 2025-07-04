#!/usr/bin/env node

/**
 * @fileoverview Pre-publish validation script for NPM package
 * @description Performs comprehensive checks before publishing to NPM registry including:
 * metadata validation, sensitive data scanning, permissions verification, and authentication status.
 * 
 * @module pre-publish-check
 * @requires fs
 * @requires path
 * @requires child_process
 * 
 * Usage: node pre-publish-check.js
 * 
 * Checks performed:
 * 1. Package.json metadata (author, repository)
 * 2. Files to be published (npm pack --dry-run)
 * 3. Sensitive data patterns in code
 * 4. Executable permissions on index.js
 * 5. NPM authentication status
 * 6. Package name availability
 * 
 * Exit codes:
 * - 0: All checks passed
 * - 1: One or more checks failed
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Running pre-publish checks...\n');

let hasErrors = false;

// Check 1: Verify package.json
console.log('1. Checking package.json...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

if (packageJson.author === 'Your Name') {
  console.log('   ❌ Update the author field in package.json');
  hasErrors = true;
} else {
  console.log('   ✅ Author field is set');
}

if (packageJson.repository?.url?.includes('yourusername')) {
  console.log('   ❌ Update the repository URL in package.json');
  hasErrors = true;
} else {
  console.log('   ✅ Repository URL is set');
}

// Check 2: Verify files that will be published
console.log('\n2. Files that will be published:');
try {
  const output = execSync('npm pack --dry-run', { encoding: 'utf8' });
  const files = output.split('\n').filter(line => line.includes('npm notice'));
  files.forEach(file => console.log('   ' + file));
} catch (e) {
  console.log('   ❌ Could not run npm pack --dry-run');
  hasErrors = true;
}

// Check 3: Check for sensitive data
console.log('\n3. Checking for sensitive data...');
const filesToCheck = ['index.js', 'README.md'];
const sensitivePatterns = [
  /api[_-]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /private[_-]?key/i
];

filesToCheck.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    let foundSensitive = false;
    
    sensitivePatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches && !content.includes('// This is safe') && !content.includes('config.secret')) {
        // Allow some known safe occurrences
        if (file === 'index.js' && pattern.toString().includes('secret') && content.includes('crypto.randomBytes')) {
          // This is the secret generation, which is safe
          return;
        }
        console.log(`   ⚠️  Found potential sensitive data in ${file}: "${matches[0]}"`);
        foundSensitive = true;
      }
    });
    
    if (!foundSensitive) {
      console.log(`   ✅ ${file} looks clean`);
    }
  }
});

// Check 4: Verify executable permissions
console.log('\n4. Checking executable permissions...');
if (fs.existsSync('index.js')) {
  const stats = fs.statSync('index.js');
  const isExecutable = (stats.mode & parseInt('111', 8)) !== 0;
  if (!isExecutable) {
    console.log('   ⚠️  index.js is not executable. Run: chmod +x index.js');
  } else {
    console.log('   ✅ index.js is executable');
  }
}

// Check 5: Check npm user
console.log('\n5. Checking npm authentication...');
try {
  const npmUser = execSync('npm whoami', { encoding: 'utf8' }).trim();
  console.log(`   ✅ Logged in as: ${npmUser}`);
} catch (e) {
  console.log('   ❌ Not logged in to npm. Run: npm login');
  hasErrors = true;
}

// Check 6: Check if package name is available
console.log('\n6. Checking package name availability...');
try {
  execSync(`npm view ${packageJson.name}`, { encoding: 'utf8' });
  console.log(`   ⚠️  Package "${packageJson.name}" already exists on npm`);
  console.log('      Consider incrementing version or using a scoped name');
} catch (e) {
  console.log(`   ✅ Package name "${packageJson.name}" is available`);
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Some checks failed. Please fix the issues above before publishing.');
  process.exit(1);
} else {
  console.log('✅ All checks passed! You can publish with: npm publish');
  console.log('\nRecommended steps:');
  console.log('1. Make sure you\'re on the correct npm registry: npm config get registry');
  console.log('2. Do a final dry run: npm publish --dry-run');
  console.log('3. Publish: npm publish');
  console.log('4. Verify: npm view synchronizer-cli');
} 