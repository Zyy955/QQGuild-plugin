import fs from "fs"
import Yaml from "yaml"
import guild from "./guild.js"

const _path = process.cwd() + "/plugins/QQGuild-plugin/config"


/** 兼容旧配置 */
if (fs.existsSync("./plugins/QQGuild-plugin/config.yaml")) {
    if (!fs.existsSync(_path + "/bot.yaml")) {
        const old = Yaml.parse(fs.readFileSync("./plugins/QQGuild-plugin/config.yaml", "utf8"))
        fs.writeFileSync(_path + "/bot.yaml", Yaml.stringify(old.bot), "utf8")
    }
}

/** 检查配置文件是否存在 */
if (!fs.existsSync(_path + "/config.yaml")) {
    fs.copyFileSync(_path + "/defSet/config.yaml", _path + "/config.yaml")
}

/** 生成默认配置文件 */
if (!fs.existsSync(_path + "/bot.yaml")) {
    fs.writeFileSync(_path + "/bot.yaml", `# 机器人配置 请不要删除default！这是兼容旧配置的！\ndefault: {}`, 'utf8')
}

const cfg = Yaml.parse(fs.readFileSync(_path + "/config.yaml", "utf8"))
const YZ = JSON.parse(fs.readFileSync("./package.json", "utf-8"))
const guilds = JSON.parse(fs.readFileSync("./plugins/QQGuild-plugin/package.json", "utf-8"))

Bot.qg = {
    /** 云崽信息 */
    YZ: {
        name: YZ.name === "miao-yunzai" ? "Miao-Yunzai" : "Yunzai-Bot",
        ver: YZ.version
    },
    /** 插件信息 */
    guild: {
        name: guilds.name,
        ver: guilds.version,
        guild_ver: guilds.dependencies["qq-guild-bot"].replace("^", "")
    },
    /** 基本配置 */
    cfg: cfg,
    /** 配置文件夹路径 */
    _path: _path,
    /** 全部频道列表 */
    guilds: {},
}

/** 检查配置文件是否存在 */
if (fs.existsSync(_path + "/bot.yaml")) {
    const bot = Yaml.parse(fs.readFileSync(_path + "/bot.yaml", "utf8"))
    /** 加载配置 */
    for (const i in bot) {
        if (i === "default") continue
        guild.monitor(bot[i])
    }
}

