import fs from "fs"
import Yaml from "yaml"
import lodash from "lodash"
import crypto from "crypto"
import fetch from "node-fetch"
import { execSync } from "child_process"
import { Group } from "icqq/lib/group.js"
import { createInterface } from "readline"
import { update } from "../../other/update.js"
import common from "../../../lib/common/common.js"
import plugin from "../../../lib/plugins/plugin.js"

/** 设置主人 */
let user = ""
let sign = {}

/** 全局变量QQGuild */
global.QQGuild = {
    BotCfg: {},
    config: {},
    guilds: {},
    oldway: {},
    bot: {}
}

let _path = process.cwd() + "/plugins/QQGuild-plugin/config.yaml"

/** 生成默认配置文件 */
if (!fs.existsSync(_path)) {
    fs.writeFileSync(_path, `bot: {}\nurl白名单:\n  - https://www.Zyy955.com\n分片转发: false`, 'utf8')
}
/** 加载配置文件到全局变量中 */
QQGuild.config = Yaml.parse(fs.readFileSync(_path, 'utf8'))

export let Yunzai = {
    /** 构建Yunzai的message */
    async message(data) {
        let atme = false
        let message = []
        let raw_message = ""
        const { appID, msg } = data
        const BotCfg = QQGuild.BotCfg

        /** at、表情、文本 */
        if (msg.content) {
            const content = msg?.content.match(/<@([^>]+)>|<emoji:([^>]+)>|[^<>]+/g)
            /** 获取at成员的名称 */
            let at_name = (i) => {
                for (let name of msg.mentions) if (name.id === i)
                    return `@${name.username}`
            }

            for (const i of content) {
                if (i.startsWith("<@")) {
                    let atValue = i.slice(3, -1)
                    const name = at_name(atValue)
                    if (BotCfg[appID].id === atValue) {
                        atValue = Bot.uin
                        atme = true
                    }
                    raw_message += name
                    message.push({ type: "at", text: name, qq: atValue })
                } else if (i.startsWith("<emoji:")) {
                    const faceValue = i.slice(7, -1)
                    raw_message += `{emoji:${faceValue}}`
                    message.push({ type: "face", text: faceValue })
                } else {
                    raw_message += i
                    message.push({ type: "text", text: i })
                }
            }
        }

        /** 图片 动画表情 */
        if (msg.attachments) {
            for (const i of msg.attachments) {
                /** 缓存图片至本地以供后续调用 */
                await this.download_img(`https://${i.url}`, i.filename)
                /** 等1s防止发送空图片 */
                await new Promise((resolve) => setTimeout(resolve, 1000))
                const image = {
                    type: "image",
                    file: i.filename,
                    url: `https://${i.url}`,
                    content_type: i.content_type
                }
                raw_message += `{image:${i.filename}}`
                message.push(image)
            }
        }
        return { message, raw_message, atme }
    },
    /** 缓存图片 */
    async download_img(url, name) {
        return new Promise(async (resolve, reject) => {
            const file_name = `./plugins/QQGuild-plugin/data/image/${name}`
            try {
                const res = await fetch(url)
                if (!res.ok) { throw new Error(`HTTP 错误！状态码：${res.status}`) }
                const buffer = await res.arrayBuffer()
                fs.writeFile(file_name, Buffer.from(buffer), (err) => {
                    if (err) reject(logger.error('QQGuild-plugin：写入文件时发生错误：', err))
                    else resolve(logger.mark(`QQGuild-plugin：图片已下载至：${file_name}`))
                })
            } catch (error) {
                logger.error('QQGuild-plugin：下载图片时发生错误：', error)
                reject(error)
            }
        })
    },
    /** 消息转换为Yunzai格式 */
    async msg(data) {
        const { appID, msg } = data
        const BotCfg = QQGuild.BotCfg
        const { QQGuild_Bot } = await import("../QQGuild-plugin.js")
        let time = parseInt(Date.parse(msg.timestamp) / 1000)
        /** 判断是否为管理员2 创建者4 用户 子管5 分管21 暂未适配 */
        const roles = msg.member.roles
        let role = roles && (roles.includes("4") ? "owner" : roles.includes("2") ? "admin" : "member") || "member"

        /** 构建Yunzai的message */
        let { message, raw_message, atme } = await this.message(data)

        /** 构建member */
        let member = {
            info: {
                group_id: msg.channel_id,
                user_id: msg.author.id,
                nickname: msg.author.username,
                last_sent_time: time,
            },
            group_id: msg.guild_id,
            is_admin: role === "owner" || role === "admin",
            is_owner: role === "owner",
            getAvatarUrl: () => {
                return msg.author.avatar
            },
            /** 禁言 */
            mute: async (time) => {
                const options = { seconds: time }
                await QQGuild.bot.muteMember(appID, msg.guild_id, msg.author.id, options)
            },
            /** 踢 */
            kick: async () => {
                await QQGuild.bot.deleteGuildMember(appID, msg.guild_id, msg.author.id)
            }
        }

        let e = {
            message: [...message],
            raw_message: raw_message,
            appID: appID,
            author: msg.author,
            mentions: msg.mentions,
            post_type: "message",
            message_id: msg.id,
            user_id: msg.author.id,
            time,
            message_type: "group",
            sub_type: "normal",
            sender: {
                user_id: msg.author.id,
                nickname: msg.author.username,
                card: msg.author.username,
                role,
            },
            group_id: msg.guild_id + "-" + msg.channel_id,
            guild_id: msg.guild_id,
            channel_id: msg.channel_id,
            group_name: `${QQGuild.guilds[msg.guild_id]?.channels[msg.channel_id] || '私信'}`,
            self_id: appID,
            font: "宋体",
            seq: msg.seq,
            atme: atme,
            member,
            friend: {
                sendMsg: async (reply, reference) => {
                    return await QQGuild_Bot.reply_msg(data, reply, reference)
                },
                recallMsg: (msg_id) => {
                    logger.info(`${BotCfg[appID].name} 撤回消息：${msg_id}`)
                    return BotCfg[appID].client.messageApi.deleteMessage(msg.channel_id, msg_id, false)
                },
                makeForwardMsg: async (forwardMsg) => {
                    return await e.group.makeForwardMsg(forwardMsg)
                },
                getChatHistory: (seq, num) => {
                    return ["message", "test"]
                }
            },
            group: {
                is_admin: role === "owner" || role === "admin",
                is_owner: role === "owner",
                pickMember: (id) => {
                    if (id === msg.author.id) {
                        return member
                    }
                },
                getChatHistory: (seq, num) => {
                    return ["message", "test"]
                },
                recallMsg: (msg_id) => {
                    logger.info(`${BotCfg[appID].name} 撤回消息：${msg_id}`)
                    return BotCfg[appID].client.messageApi.deleteMessage(msg.channel_id, msg_id, false)
                },
                sendMsg: async (reply, reference) => {
                    return await QQGuild_Bot.reply_msg(data, reply, reference)
                },
                makeForwardMsg: async (forwardMsg) => {
                    const messages = {}
                    const newmsg = []

                    /** 针对无限套娃的转发进行处理 */
                    for (const i_msg of forwardMsg) {
                        const for_msg = i_msg.message
                        /** 套娃转发 */
                        if (typeof for_msg === "object" && for_msg?.data?.type === "test") {
                            newmsg.push(...for_msg.msg)
                        }
                        /** 兼容喵崽更新抽卡记录 */
                        else if (Array.isArray(for_msg)) {
                            for_msg.forEach(i => {
                                if (typeof i === "string") {
                                    newmsg.push({ type: "forward", text: i.trim().replace(/^\\n{1,3}|\\n{1,3}$/g, "") })
                                } else {
                                    newmsg.push(i)
                                }
                            })
                        }
                        /** 优先处理日志 */
                        else if (typeof for_msg === "object" && /^#.*日志$/.test(data.msg.content)) {
                            const splitMsg = for_msg.split("\n").map(i => {
                                if (!i || i.trim() === "") return
                                if (QQGuild.config.分片转发) {
                                    return { type: "forward", text: i.substring(0, 1000).trim().replace(/^\\n{1,3}|\\n{1,3}$/g, "") }
                                } else {
                                    return { type: "forward", text: i.substring(0, 100).trim().replace(/^\\n{1,3}|\\n{1,3}$/g, "") }
                                }
                            })
                            newmsg.push(...splitMsg.slice(0, 50))
                        }
                        /** AT 表情包 */
                        else if (typeof for_msg === "object") {
                            newmsg.push(for_msg)
                        }
                        /** 普通文本 */
                        else if (typeof for_msg === "string") {
                            /** 正常文本 */
                            newmsg.push({ type: "forward", text: for_msg.replace(/^\\n{1,3}|\\n{1,3}$/g, "") })
                        }
                        else {
                            logger.error("未知字段，请反馈至作者：", for_msg)
                        }
                    }
                    /** 对一些重复元素进行去重 */
                    messages.msg = Array.from(new Set(newmsg.map(JSON.stringify))).map(JSON.parse)
                    messages.data = { type: "test", text: "forward" }
                    return messages
                }
            },
            recall: () => {
                logger.info(`${BotCfg[appID].name} 撤回消息：${msg.id}`)
                return BotCfg[appID].client.messageApi.deleteMessage(msg.channel_id, msg.id, false)
            },
            reply: async (reply, reference) => {
                return await QQGuild_Bot.reply_msg(data, reply, reference)
            },
            toString: () => {
                const NewMsg = msg?.content || msg?.attachments?.[0]?.filename
                return NewMsg
                    .replace(new RegExp(`\\<@!${BotCfg[appID].id}>`, "g"), `{at:${Bot.uin}}`)
                    .replace(/\<emoji:(\d+)>/g, "{face:$1}")
                    .replace(/\<@!(\d+)>/g, "{at:$1}")
                    .replace(/\{([\w-]+)\}\.\w*/, '{image:$1}')
            }
        }

        /** 引用消息 */
        if (msg?.message_reference?.message_id) {
            const _reference = (await QQGuild.bot.message(appID, msg.channel_id, msg.message_reference.message_id)).message
            let message = []
            if (_reference.attachments) {
                for (let i of _reference.attachments) {
                    message.push({ type: "image", url: `https://${i.url}` })
                }
            }
            if (_reference.content) {
                /** 暂不处理...懒 */
                message.push({ type: "text", text: _reference.content })
            }
            message.push({ type: "at", text: `@${_reference.author.username}`, qq: _reference.author.id })
            e.source = {
                message: message,
                rabd: "",
                seq: _reference.id,
                time: parseInt(Date.parse(_reference.timestamp) / 1000),
                user_id: _reference.author.id
            }
        }

        /** 根据传入的group_id长度决定使用原方法还是自定义方法 */
        Bot.getGroupMemberInfo = async (group_id, id) => {
            if (group_id.toString().length > 10) {
                return {
                    group_id: group_id,
                    user_id: id,
                    nickname: "QQGuild-Bot",
                    card: "",
                    sex: "female",
                    age: 6,
                    join_time: "",
                    last_sent_time: "",
                    level: 1,
                    role: "member",
                    title: "",
                    title_expire_time: "",
                    shutup_time: 0,
                    update_time: "",
                    area: "南极洲",
                    rank: "潜水",
                }
            } else {
                return Bot.QQGuild_Info(group_id, id)
            }
        }
        return e
    },
    /** 添加Bot */
    async addBot(e) {
        const cmd = e.msg.replace(/^#QQ频道设置/gi, "").replace(/：/g, ":").trim().split(':')
        if (!/^1\d{8}$/.test(cmd[2])) return "appID 错误！"
        if (!/^[0-9a-zA-Z]{32}$/.test(cmd[3])) return "token 错误！"

        let cfg = Yaml.parse(fs.readFileSync(_path, 'utf8'))
        if (cfg.bot[cmd[2]]) {
            delete cfg.bot[cmd[2]]
            fs.writeFileSync(_path, Yaml.stringify(cfg), 'utf8')
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
        QQGuild.config = cfg
        fs.writeFileSync(_path, Yaml.stringify(cfg), 'utf8')
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

        QQGuild.BotCfg[cmd[2]] = cfg.bot[cmd[2]]
        const { QQGuild_Bot } = await import("../QQGuild-plugin.js")
        await QQGuild_Bot.CreateBot({ [cmd[2]]: cfg.bot[cmd[2]] })
        return `Bot：${cmd[2]} 已连接...`
    },
    /** 设置主人 */
    add(e) {
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
    /** 新转发消息 */
    async makeForwardMsg(e, msg = [], dec = '', msgsscr = false) {

        if (!Array.isArray(msg)) msg = [msg]

        let name = msgsscr ? e.sender.card || e.user_id : Bot.nickname
        let id = msgsscr ? e.user_id : Bot.uin

        if (e.isGroup) {
            let info = await e.bot.getGroupMemberInfo(e.group_id, id)
            name = info.card || info.nickname
        }

        let userInfo = {
            user_id: id,
            nickname: name
        }

        let forwardMsg = []
        for (const message of msg) {
            if (!message) continue
            forwardMsg.push({
                ...userInfo,
                message: message
            })
        }


        /** 制作转发内容 */
        if (e?.group?.makeForwardMsg) {
            forwardMsg = await e.group.makeForwardMsg(forwardMsg)
        } else if (e?.friend?.makeForwardMsg) {
            forwardMsg = await e.friend.makeForwardMsg(forwardMsg)
        } else {
            return msg.join('\n')
        }

        if (dec) {
            /** 处理描述 */
            if (typeof (forwardMsg.data) === 'object') {
                let detail = forwardMsg.data?.meta?.detail
                if (detail) {
                    detail.news = [{ text: dec }]
                }
            } else {
                forwardMsg.data = forwardMsg.data
                    .replace(/\n/g, '')
                    .replace(/<title color="#777777" size="26">(.+?)<\/title>/g, '___')
                    .replace(/___+/, `<title color="#777777" size="26">${dec}</title>`)
            }
        }

        return forwardMsg
    }
}


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
                    reg: /^#QQ频道(强制)?更新$/gi,
                    fnc: "update",
                    permission: "master"
                },
                {
                    reg: /^#QQ频道更新日志$/gi,
                    fnc: 'update_log',
                },
                {
                    reg: /^#设置主人$/,
                    fnc: 'master'
                }
            ]
        })
    }

    async QQGuildCfg(e) {
        let msg
        if (e.msg.includes("分片转发")) {
            let cfg = Yaml.parse(fs.readFileSync(_path, 'utf8'))
            if (e.msg.includes("开启")) {
                cfg.分片转发 = true
            } else {
                cfg.分片转发 = false
            }
            QQGuild.config = cfg
            fs.writeFileSync(_path, Yaml.stringify(cfg), 'utf8')
            msg = `QQGuild-plugin：分片转发已${cfg.分片转发 ? '开启' : '关闭'}`
        } else {
            msg = await Yunzai.addBot(e)
        }
        return e.reply(msg)
    }

    async QQGuildAccount(e) {
        if (e.sub_type === "friend") {
            const msg = []
            const config = QQGuild.config.bot
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
        if (new_update.getPlugin(name)) {
            if (this.e.msg.includes('强制'))
                execSync('git reset --hard', { cwd: `${process.cwd()}/plugins/${name}/` })
            await new_update.runUpdate(name)
            if (new_update.isUp)
                setTimeout(() => new_update.restart(), 2000)
        }
        return
    }

    async update_log(e) {
        let new_update = new update()
        new_update.e = e
        new_update.reply = this.reply
        const name = "QQGuild-plugin"
        if (new_update.getPlugin(name)) {
            this.e.reply(await new_update.getLog(name))
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
            e.reply(Yunzai.add(e))
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

    SetAdmin() {
        /** 结束上下文 */
        this.finish('SetAdmin')
        /** 判断验证码是否正确 */
        if (this.e.msg.trim() === sign[this.e.user_id]) {
            this.e.reply(Yunzai.add(this.e))
        } else {
            return this.reply([segment.at(this.e.user_id), "验证码错误"])
        }
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
            logger.mark(logger.green(await Yunzai.addBot(e)))
        }
        getInput()
    })
}
getInput()



/** 劫持修改发送消息方法 */
QQGuild.oldway.sendMsg = Group.prototype.sendMsg
Group.prototype.sendMsg = async function (content, source, anony = false) {
    /** 判断是否为频道 */
    const _info = this._info
    if (_info?.guild_id && _info?.channel_id) {
        const guild_id = _info.guild_id
        const channel_id = _info.channel_id

        /** 获取appID */
        const id = QQGuild.guilds[guild_id].appID
        const data = {
            appID: id,
            msg: {
                guild_id: guild_id,
                channel_id: channel_id
            },
            eventType: "MESSAGE_CREATE"
        }
        const { QQGuild_Bot } = await import("../QQGuild-plugin.js")
        return await QQGuild_Bot.reply_msg(data, content, anony)
    } else {
        /** 调用原始的 sendMsg 方法 */
        return QQGuild.oldway.sendMsg.call(this, content, source, anony)
    }
}

/** 对喵云崽的转发进行劫持修改，兼容最新的icqq转发 */
const zai_name = JSON.parse(fs.readFileSync('./package.json', 'utf-8')).name
if (zai_name !== "miao-yunzai") {
    /**
     * 制作转发消息
     * @param e 消息事件
     * @param msg 消息数组
     * @param dec 转发描述
     * @param msgsscr 转发信息是否伪装
     */
    /** common转发 */
    common.makeForwardMsg = async function (e, msg = [], dec = '', msgsscr = false) {
        return await Yunzai.makeForwardMsg(e, msg, dec, msgsscr)
    }
    /** 日志 */
    const sendLog = (await import("../../other/sendLog.js")).sendLog
    sendLog.prototype.makeForwardMsg = async function (title, msg) {
        return await Yunzai.makeForwardMsg(this.e, [title, msg], title, false)
    }

    /** 更新日志 */
    update.prototype.makeForwardMsg = async function (title, msg = [], dec = '', msgsscr = false) {
        return await Yunzai.makeForwardMsg(this.e, [title, msg], title, msgsscr)
    }

    /** 表情列表 */
    const add = (await import("../../system/add.js")).add
    add.prototype.makeForwardMsg = async function (qq, title, msg, end = '') {
        return await Yunzai.makeForwardMsg(this.e, [title, msg], title, false)
    }

    /** 角色别名 */
    const abbrSet = (await import("../../genshin/apps/abbrSet.js")).abbrSet
    abbrSet.prototype.abbrList = async function () {
        let gsCfg = (await import("../../genshin/model/gsCfg.js")).default
        let role = gsCfg.getRole(this.e.msg, '#|别名|昵称')

        if (!role) return false

        let name = gsCfg.getdefSet('role', 'name')[role.roleId]
        let nameUser = gsCfg.getConfig('role', 'name')[role.name] ?? []

        let list = lodash.uniq([...name, ...nameUser])

        let msg = []
        for (let i in list) {
            let num = Number(i) + 1
            msg.push(`${num}.${list[i]}\n`)
        }

        let title = `${role.name}别名，${list.length}个`
        msg = await Yunzai.makeForwardMsg(this.e, msg, title, false)

        await this.e.reply(msg)
    }
}

/** 椰奶椰奶！ */
if (fs.existsSync(process.cwd() + "/plugins/yenai-plugin")) {
    const yenai_plugin = (await import("./yenai-plugin.js")).default
    await yenai_plugin.yenai()
}