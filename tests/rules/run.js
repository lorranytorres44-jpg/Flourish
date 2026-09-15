// Sobe o emulador do Firestore, roda os testes de regras e derruba o emulador.
// O emulador exige Java 11+; se JAVA_HOME apontar para um JDK novo, ele é
// colocado na frente do PATH (no Windows é comum um JRE 8 antigo vir primeiro).
import { spawnSync } from 'node:child_process';
import { delimiter, join } from 'node:path';

const env = { ...process.env };
if (env.JAVA_HOME) env.PATH = join(env.JAVA_HOME, 'bin') + delimiter + (env.PATH || '');

const result = spawnSync(
  'npx firebase emulators:exec --only firestore --project demo-flowrish "vitest run tests/rules"',
  { stdio: 'inherit', env, shell: true },
);
if (result.error) console.error(result.error);
process.exit(result.status ?? 1);
