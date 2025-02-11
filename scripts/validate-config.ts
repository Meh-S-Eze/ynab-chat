import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

interface ValidationResult {
  passed: boolean;
  errors: string[];
}

class ConfigValidator {
  private errors: string[] = [];

  async validate(): Promise<ValidationResult> {
    await this.checkNodeVersion();
    await this.checkWebpackConfig();
    await this.checkBabelConfig();
    await this.checkPackageJson();

    return {
      passed: this.errors.length === 0,
      errors: this.errors
    };
  }

  private async checkNodeVersion() {
    const version = process.versions.node.split('.').map(Number);
    if (version[0] < 20) {
      this.errors.push(`Node.js version must be >=20.x (current: ${process.version})`);
    }
  }

  private async checkWebpackConfig() {
    const configPath = join(__dirname, '../webpack.config.js');
    const content = await readFile(configPath, 'utf-8');
    
    // Check for ES module syntax
    if (!content.includes('export default')) {
      this.errors.push('Webpack config must use ES module syntax (export default)');
    }

    // Check for proper path resolution
    if (!content.includes('import.meta.url')) {
      this.errors.push('Webpack config must use import.meta.url for path resolution');
    }
  }

  private async checkBabelConfig() {
    const jsonPath = join(__dirname, '../.babelrc.json');
    if (!existsSync(jsonPath)) {
      this.errors.push('Babel configuration must use .babelrc.json format');
    }
  }

  private async checkPackageJson() {
    const pkgPath = join(__dirname, '../package.json');
    const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
    
    if (pkg.type !== 'module') {
      this.errors.push('package.json must have "type": "module"');
    }

    if (!pkg.engines?.node?.match(/>=20/)) {
      this.errors.push('package.json engines.node must specify >=20');
    }
  }
}

// Main execution
(async () => {
  const validator = new ConfigValidator();
  const result = await validator.validate();

  if (result.passed) {
    console.log('✅ All configuration checks passed');
    process.exit(0);
  } else {
    console.error('❌ Configuration validation failed:');
    result.errors.forEach(err => console.error(`- ${err}`));
    process.exit(1);
  }
})().catch(err => {
  console.error('Validation error:', err);
  process.exit(1);
}); 