import { it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
it('updater reports pull/migration failures, pins releases, verifies revision and rolls back failed health', () => {
  for (const mode of ['pull-failure','migration-failure','healthy','bad-health']) {
    const root = mkdtempSync(join(tmpdir(),'aubrey-updater-test-'));
    try {
      const bin = join(root,'bin'); mkdirSync(bin); mkdirSync(join(root,'scripts'));
      writeFileSync(join(root,'docker-compose.yml'),'services: {}');
      const command = (name: string, body: string) => writeFileSync(join(bin,name), '#!/bin/bash\n'+body, {mode:0o755});
      command('flock','exit 0'); command('crontab','cat >/dev/null; exit 0'); command('logger','exit 0'); command('sleep','exit 0');
      command('curl', 'if [ "$TEST_MODE" = bad-health ]; then echo \'{"status":"ok","revision":"old"}\'; else echo \'{"status":"ok","revision":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}\'; fi');
      command('docker', `echo "$*" >> "$APP_DIR/commands"
case "$1" in
pull) [ "$TEST_MODE" != pull-failure ]; exit $?;;
image) if [[ "$*" == *revision* ]]; then echo aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa; else echo sha256:candidate; fi;;
inspect) if [[ "$*" == *revision* ]]; then echo bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb; else echo sha256:previous; fi;;
create) echo helper;;
cp) if [[ "$2" == *backup.sh ]]; then printf '#!/bin/bash\\nexit 0\\n' > "$3"; elif [[ "$2" == *auto-update.sh ]]; then cp "$SOURCE_UPDATER" "$3"; elif [[ "$2" == *install-updater.sh || "$2" == *check-releases.sh ]]; then printf '#!/bin/bash\\nexit 0\\n' > "$3"; else echo 'services: {}' > "$3"; fi;;
compose) if [[ "$*" == *' run '* ]] && [ "$TEST_MODE" = migration-failure ]; then exit 1; fi;;
esac
exit 0`);
      const result = spawnSync('bash',[resolve('scripts/auto-update.sh')], {env:{...process.env, PATH:bin+':'+process.env.PATH, APP_DIR:root, TEST_MODE:mode,SOURCE_UPDATER:resolve('scripts/auto-update.sh')},encoding:'utf8'});
      const commands = readFileSync(join(root,'commands'),'utf8');
      assert.equal(result.status, mode === 'healthy' ? 0 : 1, result.stdout+result.stderr);
      if (mode.endsWith('failure')) assert.equal(commands.includes(' up '),false);
      assert.equal(existsSync(join(root,'logs/last-deployment-error')), mode !== 'healthy');
      if (mode === 'healthy') assert.match(readFileSync(join(root,'logs/deployed-revision'),'utf8'), /^a{40}/);
      if (mode === 'bad-health') assert.equal(commands.match(/ up /g)?.length,2);
      if (!mode.endsWith('failure')) assert.match(commands,/--pull never/);
    } finally { rmSync(root,{recursive:true,force:true}); }
  }
});
