// Explicitly local, opt-in database integration test. Never accepts a remote URL.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const owner = "d1111111-1111-4111-8111-111111111111";
const event = "d2222222-2222-4222-8222-222222222222";
function sql(statement, onOutput = () => {}) {
  return new Promise((resolve, reject) => {
    const process = spawn("docker", ["exec", "-i", "supabase_db_FinanceOS", "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-qAt"], { windowsHide: true });
    let output = "", error = "";
    process.stdout.on("data", (chunk) => { output += chunk; onOutput(output); });
    process.stderr.on("data", (chunk) => { error += chunk; });
    process.on("error", reject);
    process.on("close", (code) => code === 0 ? resolve(output.trim()) : reject(new Error(error)));
    process.stdin.end(statement);
  });
}
const complete = `public.complete_expected_transaction('${event}','Concurrent actual',42.25,'2026-10-02',null,null,'Concurrency test')`;
try {
  await sql(`insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data) values('${owner}','authenticated','authenticated','concurrency@example.test','','{}','{}');
    insert into public.expected_transactions(id,user_id,title,amount,type,expected_date) values('${event}','${owner}','Concurrent event',42,'expense','2026-10-01');`);
  let signal;
  const locked = new Promise((resolve) => { signal = resolve; });
  const first = sql(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${owner}',true);
    select ${complete}; select 'FIRST_COMPLETED'; select pg_sleep(2); commit;`, (output) => { if (output.includes("FIRST_COMPLETED")) signal(); });
  // Begin the second request while the first holds its completion row lock.
  await Promise.race([locked, first.then(() => { throw new Error("First request finished without overlap barrier"); })]);
  const second = sql(`begin; set local role authenticated; select set_config('request.jwt.claim.sub','${owner}',true); select ${complete}; commit;`);
  const [a, b] = await Promise.all([first, second]);
  const parse = (output) => JSON.parse(output.split(/\r?\n/).find((line) => line.startsWith('{')));
  assert.equal(parse(a).already_completed, false);
  assert.equal(parse(b).already_completed, true);
  assert.equal(parse(a).actual_transaction.id, parse(b).actual_transaction.id);
  assert.equal(await sql(`select count(*) from public.transactions where user_id='${owner}';`), "1");
  assert.equal(await sql(`select status from public.expected_transactions where id='${event}';`), "completed");
  console.log("PASS: overlapping authenticated completion requests produced one actual UUID.");
} finally {
  // Only this local test owner's fixtures; legacy/browser storage is never used.
  await sql(`delete from public.expected_transactions where user_id='${owner}'; delete from auth.users where id='${owner}';`);
}
