import { runCLI } from 'jest';
import * as path from 'path';

/**
 * Programmatically triggers test suites execution.
 */
export async function runTests() {
  const projectRootPath = path.resolve(__dirname, '../');
  const jestConfigPath = path.resolve(__dirname, '../config/jest.config.ts');

  console.log(`Starting test execution using config: ${jestConfigPath}`);

  // Trigger test suites programmatically
  const { results } = await runCLI(
    {
      config: jestConfigPath,
      // Suppress specific jest argv properties
      _: [],
      $0: '',
    } as any,
    [projectRootPath]
  );

  if (results.success) {
    console.log('All tests passed successfully!');
  } else {
    console.error('Some tests failed.');
  }
  
  return results;
}

// Allow running the engine directly from the command line
if (require.main === module) {
  runTests().catch((error) => {
    console.error('Failed to run tests:', error);
    process.exit(1);
  });
}
