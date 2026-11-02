import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(__dirname, '..', 'src', 'environments', 'environment.ts');

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NG_APP_SUPABASE_URL ||
  'https://jznddvoxbsrlnvbihyfy.supabase.co';

const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NG_APP_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  '';

if (supabaseAnonKey) {
  const content = `export const environment = {
  production: true,
  supabaseUrl: ${JSON.stringify(supabaseUrl)},
  supabaseAnonKey: ${JSON.stringify(supabaseAnonKey)}
};
`;
  fs.writeFileSync(envFile, content, 'utf8');
  console.log('Injected Supabase environment variables into src/environments/environment.ts');
}

