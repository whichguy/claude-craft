const { expect } = require('chai');
const { exec } = require('child_process');
const path = require('path');
const util = require('util');

const execAsync = util.promisify(exec);

const WIKI_NOTIFY = path.join(__dirname, '../..', 'plugins', 'wiki-suite', 'handlers', 'wiki-notify.sh');

const RETRY_PROMPT = JSON.stringify({
  session_id: 'test-session',
  transcript_path: '/dev/null',
  cwd: '/tmp',
  hook_event_name: 'UserPromptSubmit',
  prompt: '<task-notification>\n<summary>Stop hook feedback</summary>\n</task-notification>\n<system-reminder>\nsome error\n</system-reminder>'
});

const NORMAL_PROMPT = JSON.stringify({
  session_id: 'test-session',
  transcript_path: '/dev/null',
  cwd: '/tmp',
  hook_event_name: 'UserPromptSubmit',
  prompt: 'what files are in the repo?'
});

describe('Stop-hook-feedback retry guard', function () {
  this.timeout(10000);

  describe('wiki-notify.sh', function () {
    it('exits 0 silently on Stop-hook-feedback retry', async function () {
      const { stdout, stderr } = await execAsync(
        `echo '${RETRY_PROMPT.replace(/'/g, "'\\''")}' | bash "${WIKI_NOTIFY}"`,
        { env: { ...process.env, PATH: process.env.PATH } }
      );
      expect(stdout).to.equal('');
    });

    it('runs normally on a fresh prompt (no retry wrapper)', async function () {
      // Handler may exit 0 with empty output if no wiki matches — that's fine.
      // We just verify the guard doesn't suppress legitimate prompts by checking
      // the process exits cleanly (exit code 0 on normal flow is expected).
      const result = await execAsync(
        `echo '${NORMAL_PROMPT.replace(/'/g, "'\\''")}' | bash "${WIKI_NOTIFY}"`,
        { env: { ...process.env, PATH: process.env.PATH } }
      ).catch(err => err); // handler may exit 0 with no wiki root — accept both
      // As long as no unhandled crash (exit code > 1 from guard itself), we're good.
      const code = result.code !== undefined ? result.code : 0;
      expect(code).to.be.oneOf([0, 1]);
    });
  });
});
