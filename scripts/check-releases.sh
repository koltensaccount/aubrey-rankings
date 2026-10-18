#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${APP_DIR:-/home/koltensaccount/aubrey-rankings}"
exec 200>"$APP_DIR/.release-check.lock"
flock -n 200 || exit 0
# Read the token inside the existing container: it never appears in argv or logs.
docker exec aubrey-web node -e '
(async()=>{
 if(!process.env.CRON_SECRET)throw new Error("Dedicated CRON_SECRET is missing");
 const response=await fetch("http://127.0.0.1:3000/api/cron/check-releases",{method:"POST",headers:{authorization:"Bearer "+process.env.CRON_SECRET},signal:AbortSignal.timeout(300000)});
 if(!response.ok)throw new Error("Release scheduler HTTP "+response.status);
 const result=await response.json();
 if(!result.success)throw new Error("Release scheduler failed");
 console.log(new Date().toISOString(),"Release sync:",JSON.stringify(result));
})().catch(error=>{console.error(error.message);process.exitCode=1;});'
