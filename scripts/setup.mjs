import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from 'node:os';
import {execFileSync} from 'node:child_process';
if (fs.existsSync(".env")) {
  console.log(".env exists; preserved.");
} else {
  fs.writeFileSync(
    ".env",
    `APP_ENV=development\nDATABASE_URL=postgresql://zijing:${randomBytes(24).toString("hex")}@127.0.0.1:55439/zijing\nPAYLOAD_SECRET=${randomBytes(32).toString("hex")}\nNEXT_PUBLIC_SERVER_URL=http://localhost:3000\nDB_PUSH=false\nMEDIA_DIR=media\n`,
    { mode: 0o600 },
  );
  console.log(
    "Created local .env with random secrets. No credentials printed.",
  );
}
if(process.platform==='win32')execFileSync('icacls',['.env','/inheritance:r','/grant:r',`${os.userInfo().username}:F`],{windowsHide:true,stdio:'pipe'});
else fs.chmodSync('.env',0o600);
