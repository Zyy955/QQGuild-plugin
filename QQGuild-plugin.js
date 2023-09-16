import "./model/loader.js"
import "./model/puppeteer.js"
import "./model/config.js"
import "./model/api.js"
import "./model/ws.js"
import fs from "fs"
import Yaml from "yaml"
import crypto from "crypto"
import { ws } from "./model/ws.js"
import { execSync } from "child_process"
import { createInterface } from "readline"
import { update } from "../other/update.js"

/** 设置主人 */
let user = ""
let sign = {}

export class QQGuildBot extends plugin {
    constructor() {
        super({
            name: "QQ频道插件",
            priority: 1,
            rule: [
                {
                    reg: /^#QQ频道设置.+$/gi,
                    fnc: "QQGuildCfg",
                    permission: "master"
                },
                {
                    reg: /^#QQ频道账号$/gi,
                    fnc: "QQGuildAccount",
                    permission: "master"
                },
                {
                    reg: /^#QQ频道(强制)?更新(日志)?$/gi,
                    fnc: "update",
                    permission: "master"
                },
                {
                    reg: /^#设置主人$/,
                    fnc: 'master'
                },
                {
                    reg: /^#(我的|当前)?(id|信息)$/gi,
                    fnc: 'qg_id'
                }
            ]
        })
    }

    async QQGuildCfg(e) {
        let msg
        if (e.msg.includes("分片转发")) {
            let cfg = Yaml.parse(fs.readFileSync(qg.cfg._path, 'utf8'))
            if (e.msg.includes("开启")) {
                cfg.分片转发 = true
            } else {
                cfg.分片转发 = false
            }
            qg.cfg = cfg
            fs.writeFileSync(qg.cfg._path, Yaml.stringify(cfg), 'utf8')
            msg = `QQGuild-plugin：分片转发已${cfg.分片转发 ? '开启' : '关闭'}`
        } else {
            msg = await app.addBot(e)
        }
        return e.reply(msg)
    }

    async QQGuildAccount(e) {
        if (e.sub_type === "friend") {
            const msg = []
            const config = qg.cfg.cfg.bot
            for (const i in config) {
                const cfg = [
                    config[i].sandbox ? 1 : 0,
                    config[i].allMsg ? 1 : 0,
                    config[i].appID,
                    config[i].token
                ]
                msg.push(`${cfg.join(':')}`)
            }
            return e.reply(`共${msg.length}个账号：\n${msg.join('\n')}`)
        } else
            return e.reply("请私聊查看")
    }

    async update(e) {
        let new_update = new update()
        new_update.e = e
        new_update.reply = this.reply
        const name = "QQGuild-plugin"
        if (e.msg.includes("更新日志")) {
            if (new_update.getPlugin(name)) {
                this.e.reply(await new_update.getLog(name))
            }
        } else {
            if (new_update.getPlugin(name)) {
                if (this.e.msg.includes('强制'))
                    execSync('git reset --hard', { cwd: `${process.cwd()}/plugins/${name}/` })
                await new_update.runUpdate(name)
                if (new_update.isUp)
                    setTimeout(() => new_update.restart(), 2000)
            }
        }
        return
    }

    async master(e) {
        /** 对用户id进行默认赋值 */
        user = e.user_id
        let cfg = fs.readFileSync("./config/config/other.yaml", "utf8")
        if (e.at) {
            /** 存在at检测触发用户是否为主人 */
            if (!e.isMaster) return e.reply(`只有主人才能命令我哦~\n(*/ω＼*)`)
            /** 检测被at的用户是否已经是主人 */
            if (cfg.match(RegExp(`- "?${e.at}"?`)))
                return e.reply([segment.at(e.at), "已经是主人了哦(〃'▽'〃)"])
            user = e.at
            e.reply(app.add_master(e))
        } else {
            /** 检测用户是否已经是主人 */
            if (e.isMaster) return e.reply([segment.at(e.user_id), "已经是主人了哦(〃'▽'〃)"])
            /** 生成验证码 */
            sign[e.user_id] = crypto.randomUUID()
            logger.mark(`设置主人验证码：${logger.green(sign[e.user_id])}`)
            /** 开始上下文 */
            this.setContext('SetAdmin')
            e.reply([segment.at(e.user_id), `请输入控制台的验证码`])
        }
    }

    async qg_id(e) {
        const msg = e?.group_id ? `\n当前群聊ID：${e.group_id}` : ""
        return e.reply([segment.at(e.user_id), `\n您的个人ID：${e.user_id}${msg}`])
    }

    SetAdmin() {
        /** 结束上下文 */
        this.finish('SetAdmin')
        /** 判断验证码是否正确 */
        if (this.e.msg.trim() === sign[this.e.user_id]) {
            this.e.reply(app.add_master(this.e))
        } else {
            return this.reply([segment.at(this.e.user_id), "验证码错误"])
        }
    }
}

let app = {
    /** 设置主人 */
    add_master(e) {
        let cfg = fs.readFileSync("./config/config/other.yaml", "utf8")
        /** 使用正则表达式确认是TRSS还是Miao */
        if (cfg.match(RegExp("master:"))) {
            cfg = cfg.replace(RegExp("masterQQ:"), `masterQQ:\n  - "${user}"`)
            const value = `master:\n  - "${e.self_id}:${user}"`
            cfg = cfg.replace(RegExp("master:"), value)
        } else {
            cfg = cfg.replace(RegExp("masterQQ:"), `masterQQ:\n  - ${user}`)
        }
        fs.writeFileSync("./config/config/other.yaml", cfg, "utf8")
        return [segment.at(user), "新主人好~(*/ω＼*)"]
    },

    /** 添加Bot */
    async addBot(e) {
        const cmd = e.msg.replace(/^#QQ频道设置/gi, "").replace(/：/g, ":").trim().split(':')
        if (!/^1\d{8}$/.test(cmd[2])) return "appID 错误！"
        if (!/^[0-9a-zA-Z]{32}$/.test(cmd[3])) return "token 错误！"

        let cfg = Yaml.parse(fs.readFileSync(qg.cfg._path, 'utf8'))
        if (cfg.bot[cmd[2]]) {
            delete cfg.bot[cmd[2]]
            fs.writeFileSync(qg.cfg._path, Yaml.stringify(cfg), 'utf8')
            return `Bot：${cmd[2]} 删除成功...重启后生效...`
        } else {
            cfg.bot[cmd[2]] = {
                appID: cmd[2],
                token: cmd[3],
                sandbox: cmd[0] === "1",
                allMsg: cmd[1] === "1"
            }
        }

        /** 先存入 继续修改~ */
        qg.cfg.cfg = cfg
        fs.writeFileSync(qg.cfg._path, Yaml.stringify(cfg), 'utf8')
        if (cfg.bot[cmd[2]].allMsg)
            cfg.bot[cmd[2]].intents = [
                "GUILDS", // bot频道列表、频道资料、列表变化
                "GUILD_MEMBERS", // 成员资料变化
                'GUILD_MESSAGES', // 私域
                "GUILD_MESSAGE_REACTIONS", // 消息表情动态
                "DIRECT_MESSAGE", // 私信消息
            ]
        else
            cfg.bot[cmd[2]].intents = [
                "GUILDS", // bot频道列表、频道资料、列表变化
                "GUILD_MEMBERS", // 成员资料变化
                "GUILD_MESSAGE_REACTIONS", // 消息表情动态
                "DIRECT_MESSAGE", // 私信消息
                "PUBLIC_GUILD_MESSAGES", // 公域消息
            ]

        qg.ws[cmd[2]] = cfg.bot[cmd[2]]
        await ws.CreateBot({ [cmd[2]]: cfg.bot[cmd[2]] })
        return `Bot：${cmd[2]} 已连接...`
    }
}

/** 监听控制台输入 */
const rl = createInterface({ input: process.stdin, output: process.stdout })
rl.on('SIGINT', () => { rl.close(); process.exit() })
function getInput() {
    rl.question('', async (input) => {
        const msg = input.trim()
        if (/#QQ频道设置.+/gi.test(msg)) {
            const e = { msg: msg }
            logger.mark(logger.green(await app.addBot(e)))
        }
        getInput()
    })
}
getInput()


/** 加载一下插件到主体... */
// let ret = await Promise.allSettled([import('./model/Yunzai.js')])
// let apps = { Yunzai: ret[0].value[Object.keys(ret[0].value)[0]] }
// export { apps }
