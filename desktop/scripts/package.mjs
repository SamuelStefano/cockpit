import { packager } from '@electron/packager';
import { flipFuses, FuseV1Options, FuseVersion } from '@electron/fuses';
import { join } from 'node:path';

const [out] = await packager({
  dir: '.',
  out: 'out',
  overwrite: true,
  asar: true,
  name: 'Deck',
  icon: 'assets/icon',
  ignore: [/^\/src/, /^\/scripts/, /^\/out/, /^\/tsconfig/, /^\/node_modules/],
});

const exe = process.platform === 'win32' ? join(out, 'Deck.exe') : join(out, 'Deck');
await flipFuses(exe, {
  version: FuseVersion.V1,
  [FuseV1Options.RunAsNode]: false,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
  [FuseV1Options.EnableNodeCliInspectArguments]: false,
  [FuseV1Options.OnlyLoadAppFromAsar]: true,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
});
console.log(out);
