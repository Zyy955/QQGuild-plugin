import fs from "fs"
import Yaml from "yaml"

const _path = process.cwd() + "/plugins/QQGuild-plugin/config.yaml"

/** 生成默认配置文件 */
if (!fs.existsSync(_path)) {
    fs.writeFileSync(_path, `bot: {}\nurl白名单:\n  - https://www.Zyy955.com\n分片转发: false`, 'utf8')
}

/** 保存基本配置、插件版本、插件名称 */
const cfg = Yaml.parse(fs.readFileSync(_path, 'utf8'))
const QG = JSON.parse(fs.readFileSync("./plugins/QQGuild-plugin/package.json", "utf-8"))
qg.cfg = { ...qg.cfg, cfg: cfg, ver: QG.version, name: QG.name, _path: _path, bot: QG.dependencies["qq-guild-bot"] }