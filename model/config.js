import fs from "fs"
import Yaml from "yaml"

/** 全局变量QQGuild */
global.QQGuild = {
    api: {},
    config: {},
    guilds: {},
    oldway: {},
    ws: {},
    Yz: {}
}

let _path = process.cwd() + "/plugins/QQGuild-plugin/config.yaml"

/** 生成默认配置文件 */
if (!fs.existsSync(_path)) {
    fs.writeFileSync(_path, `bot: {}\nurl白名单:\n  - https://www.Zyy955.com\n分片转发: false`, 'utf8')
}
/** 加载配置文件到全局变量中 */
QQGuild.config = Yaml.parse(fs.readFileSync(_path, 'utf8'))

/** 加载Yz名称、版本 名称、版本 */
const Yz = JSON.parse(fs.readFileSync("./package.json", "utf-8"))
const GQ = JSON.parse(fs.readFileSync("./plugins/QQGuild-plugin/package.json", "utf-8"))
QQGuild.Yz = {
    _path: _path,
    name: Yz.name === "miao-yunzai" ? "Miao-Yunzai" : "Yunzai-Bot",
    version: Yz.version,
    GQ_name: GQ.name,
    GQ_version: GQ.version
}

