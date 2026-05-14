type TestFn = () => void | Promise<void>;

interface TestCase {
  name: string;
  fn: TestFn;
}

const registry: TestCase[] = [];

export function test(name: string, fn: TestFn) {
  registry.push({ name, fn });
}

export function expectApproximatelyEqual(actual: number, expected: number, tolerance: number, label?: string) {
  if (!Number.isFinite(actual) || !Number.isFinite(expected)) {
    throw new Error(label ?? "Значения не являются числами");
  }
  const delta = Math.abs(actual - expected);
  if (delta > tolerance) {
    throw new Error(
      `${label ?? "Отклонение"}: |${actual.toFixed(6)} - ${expected.toFixed(6)}| = ${delta.toFixed(
        6
      )} > ${tolerance.toFixed(6)}`
    );
  }
}

export async function runTests() {
  if (!registry.length) {
    console.warn("Нет тестов для выполнения.");
    return;
  }
  let failures = 0;
  for (const testCase of registry) {
    try {
      await testCase.fn();
      process.stdout.write(`✓ ${testCase.name}\n`);
    } catch (error) {
      failures += 1;
      process.stderr.write(`✗ ${testCase.name}\n`);
      process.stderr.write(`  ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
  if (failures) {
    throw new Error(`Тестов провалено: ${failures}/${registry.length}`);
  }
}
