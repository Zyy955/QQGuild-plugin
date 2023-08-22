import fs from "fs"
import Yaml from "yaml"
import crypto from 'crypto'
import fetch from "node-fetch"
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
    oldway: {}
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
        let message = []
        /** raw_message部分还未完成... */
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
                    if (BotCfg[appID].id === atValue)
                        atValue = Bot.uin
                    message.push({ type: "at", text: name, qq: atValue })
                } else if (i.startsWith("<emoji:")) {
                    const faceValue = i.slice(7, -1)
                    message.push({ type: "face", text: faceValue })
                } else {
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
                await common.sleep(1000)
                const image = {
                    type: "image",
                    file: i.filename,
                    url: `https://${i.url}`,
                    content_type: i.content_type
                }
                message.push(image)
            }
        }
        return { message, raw_message }
    },
    /** 缓存图片 */
    async download_img(url, name) {
        const file_name = `./plugins/QQGuild-plugin/data/image/${name}`
        try {
            const response = await fetch(url)

            if (!response.ok) {
                throw new Error(`HTTP 错误！状态码：${response.status}`)
            }

            const imageBuffer = await response.arrayBuffer() // 改为使用 arrayBuffer()

            fs.writeFile(file_name, Buffer.from(imageBuffer), (err) => { // 添加回调函数
                if (err) {
                    logger.error('写入文件时发生错误：', err)
                } else {
                    logger.mark(`图片已下载至：${file_name}`)
                }
            })
        } catch (error) {
            logger.error('下载图片时发生错误：', error)
        }
    },
    /** 消息转换为Yunzai格式 */
    async msg(data) {
        const { msg, appID } = data
        const BotCfg = QQGuild.BotCfg
        const { QQGuild_Bot } = await import("../QQGuild-plugin.js")
        let time = parseInt(Date.parse(msg.timestamp) / 1000)
        /** 判断是否为管理员2 创建者4 用户 子管5 分管21 暂未适配 */
        const roles = msg.member.roles
        let role = roles && (roles.includes("4") ? "owner" : roles.includes("2") ? "admin" : "member") || "member"

        /** 构建Yunzai的message */
        let message = await this.message(data)

        /** 判断消息中是否@了机器人 */
        const atBot = msg.mentions?.find(mention => mention.bot) || false

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
        }

        let e = {
            ...message,
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
            source: {
                /** 需要单独请求指定消息 */
                message: "",
                rabd: "",
                seq: msg.message_reference?.message_id || "",
                time: "",
                user_id: ""
            },
            atme: atBot,
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
                    const content = data.msg.content

                    /** 针对无限套娃的转发进行处理 */
                    for (const i_msg of forwardMsg) {
                        /** message -> 对象 -> data.type=test ->套娃转发 */
                        const formsg = i_msg?.message
                        if (formsg && typeof formsg === "object") {
                            /** 套娃转发 */
                            if (formsg?.data?.type === "test") {
                                newmsg.push(...formsg.msg)
                            } else if (Array.isArray(formsg)) {
                                for (const arr of formsg) {
                                    if (typeof arr === "string") newmsg.push({ type: "forward", text: arr })
                                    else newmsg.push(arr)
                                }
                            } else {
                                /** 普通对象 */
                                newmsg.push(formsg)
                            }
                        } else {
                            /** 日志特殊处理 */
                            if (/^#.*日志$/.test(content)) {
                                let splitMsg
                                for (const i of forwardMsg) {
                                    splitMsg = i.message.split("\n[").map(element => {
                                        if (QQGuild.config.分片转发) {
                                            if (element.length > 1000)
                                                element = element.substring(0, 1000) + "日志过长..."
                                            return { type: "forward", text: `[${element.trim()}\n` }
                                        } else {
                                            if (element.length > 100)
                                                element = element.substring(0, 100) + "日志过长..."
                                            return { type: "forward", text: `[${element.trim()}\n` }
                                        }
                                    })
                                }
                                newmsg.push(...splitMsg.slice(0, 50))
                            } else {
                                /** 正常文本 */
                                newmsg.push({ type: "forward", text: formsg })
                            }
                        }
                    }
                    /** 对一些重复元素进行去重 */
                    messages.msg = Array.from(new Set(newmsg.map(JSON.stringify))).map(JSON.parse)
                    messages.data = { type: "test", text: "forward" }
                    return messages
                }
            },
            recall: () => {
                BotCfg[appID].client.messageApi.deleteMessage(msg.channel_id, msg.id, true)
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
            msg = await addBot(e)
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
            e.reply(add(e))
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
            this.e.reply(add(this.e))
        } else {
            return this.reply([segment.at(this.e.user_id), "验证码错误"])
        }
    }
}


/** 添加Bot */
async function addBot(e) {
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
}

/** 监听控制台输入 */
const rl = createInterface({
    input: process.stdin,
    output: process.stdout
})

rl.on('SIGINT', () => {
    rl.close()
    process.exit()
})

getInput()
function getInput() {
    rl.question('', async (input) => {
        const msg = input.trim()
        if (/#QQ频道设置.+/gi.test(msg)) {
            const e = {
                msg: msg
            }
            logger.mark(logger.green(await addBot(e)))
        }
        getInput()
    })
}

/** 设置主人 */
function add(e) {
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
}

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
