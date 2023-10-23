console.log("正在迁移QQ频道插件...")
import { execSync } from "child_process"

function exec(cmd) {
  try {
    console.log(`执行命令 [${cmd}]\n`)
    console.log(execSync(cmd).toString())
    return true
  } catch (err) {
    console.error(`错误：执行命令失败：${err}`)
    return false
  }
}

exec("git remote set-url origin https://gitee.com/Zyy955/Lain-plugin")
exec("git fetch origin")
exec("git reset --hard origin/main")
exec(`pnpm config set sharp_binary_host "https://npmmirror.com/mirrors/sharp"`)
exec(`pnpm config set sharp_libvips_binary_host "https://npmmirror.com/mirrors/sharp-libvips"`)
exec("pnpm install -P")

console.log("QQ频道插件迁移成功，可以重新启动了~")