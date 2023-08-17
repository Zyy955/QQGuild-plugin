import fs from "fs"
import Yaml from "yaml"
import imagemin from "imagemin"
import { createInterface } from "readline"
import { update } from "../other/update.js"
import imageminJpegtran from "imagemin-jpegtran"
import imageminPngquant from "imagemin-pngquant"
import plugin from "../../lib/plugins/plugin.js"
import fetch, { FormData, Blob } from "node-fetch"
import PluginsLoader from "../../lib/plugins/loader.js"
import { createOpenAPI, createWebsocket } from "qq-guild-bot"

logger.info("QQGuild-plugin初始化...")
logger.info("https://github.com/Zyy955/QQGuild-plugin")

/** 保存频道信息 */
let QQGuild = {
    guilds: {},
    BotCfg: {}
}
let _path = process.cwd() + "/plugins/QQGuild-plugin"

/** 加载配置到全局变量中... */
const Cfgfile = _path + "/config.yaml"
if (fs.existsSync(Cfgfile)) {
    let config = Yaml.parse(fs.readFileSync(Cfgfile, 'utf8'))
    for (const id in config) {
        if (config[id].allMsg)
            config[id].intents = ['GUILD_MESSAGES', 'DIRECT_MESSAGE']
        else
            config[id].intents = ['PUBLIC_GUILD_MESSAGES', 'DIRECT_MESSAGE']
    }
    QQGuild.BotCfg = config
}

const BotCfg = QQGuild.BotCfg

/** 创建对应的机器人配置 */
for (const appID in BotCfg) {
    logger.mark(logger.green(await WS_Cfg(appID, BotCfg)))
}

/** 监听消息 */
async function WS_Cfg(appID, BotCfg) {
    /** 劫持转发原始方法 */
    Bot.oldInfo = Bot.getGroupMemberInfo
    /** 创建 client */
    BotCfg[appID].client = createOpenAPI(BotCfg[appID])
    /** 创建 websocket 连接 */
    BotCfg[appID].ws = createWebsocket(BotCfg[appID])

    /** 获取机器人频道列表 */
    let { data } = await BotCfg[appID].client.meApi.meGuilds()
    for (let channelData of data) {
        /** 获取子频道列表 */
        const response = await BotCfg[appID].client.channelApi.channels(channelData.id)
        const channelList = response.data
        const guildInfo = { ...channelData, channels: {} }
        for (let subChannel of channelList) { guildInfo.channels[subChannel.id] = subChannel.name }
        QQGuild.guilds[channelData.id] = guildInfo
    }

    /** 机器人名称、头像 获取 */
    const bot = await BotCfg[appID].client.meApi.me()
    QQGuild.BotCfg[appID].id = bot.data.id
    QQGuild.BotCfg[appID].name = bot.data.username
    QQGuild.BotCfg[appID].avatar = bot.data.avatar

    /** 监听对应的消息事件 */
    async function MapPing(data, type, msgType, appID) {
        if (data.msg.content === "#QQ频道解除私信")
            return await Sendprivate(data, appID)
        if (data.eventType === type) {
            return allMsg(data.msg, appID, msgType, true)
        } else {
            allMsg(data.msg, appID, msgType)
            let e = await sendFriendMsg(data, appID)
            /** 私信将场景更换~ */
            if (msgType === "私信") {
                e.message_type = "private"
                e.sub_type = "friend"
            }
            return await PluginsLoader.deal(e)
        }
    }

    /** 消息事件 */
    BotCfg[appID].ws.on('GUILD_MESSAGES', async (data) => {
        await MapPing(data, "MESSAGE_DELETE", "私域", appID)
    })
    BotCfg[appID].ws.on('DIRECT_MESSAGE', async (data) => {
        await MapPing(data, "DIRECT_MESSAGE_DELETE", "私信", appID)
    })
    BotCfg[appID].ws.on('PUBLIC_GUILD_MESSAGES', async (data) => {
        await MapPing(data, "PUBLIC_MESSAGE_DELETE", "公域", appID)
    })
    return `Bot：${appID} 已连接~`
}


/** 收到消息打印日志 */
function allMsg(msg, appID, mode, delMsg) {
    const { author, guild_id, channel_id, content, attachments, message } = msg
    const user_name = author?.username || message.author.username

    const allMsg = []
    if (attachments)
        for (const i of attachments) allMsg.push(`[图片：./data/image/${i.filename}]`)
    if (content) allMsg.push(content)

    if (mode === "私信") {
        const guild = `[${mode}：${QQGuild.BotCfg[appID].name}-${appID}]`
        if (delMsg) {
            const user = `[用户：${message.author.id}] 撤回消息：${message.id}`
            logger.info(`QQGuild-plugin：${guild}${user}`)
        } else {
            const user = `[用户：${user_name}-${author.id}] ${allMsg.join(' ')}`
            logger.info(`QQGuild-plugin：${guild}${user}`)
        }
    } else {
        if (delMsg) {
            const user = `[用户：${user_name}-${message.author.id}] 撤回消息：${message.id}`
            logger.info(`QQGuild-plugin：[${mode}：${message.guild_id}-${message.channel_id}]${user}`)
        } else {
            const guild_name = QQGuild.guilds?.[guild_id]?.name
            const channel_name = QQGuild.guilds?.[guild_id]?.channels[channel_id]
            logger.info(`QQGuild-plugin：[${mode}：${guild_name}-${channel_name}][用户：${user_name}-${author.id}] ${allMsg.join(' ')}`)
        }
    }
}

/** 构建Yunzai的message */
async function makeeMessage(msg, appID) {
    let message = []
    /** raw_message部分还未完成... */
    let raw_message = ""

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
                if (QQGuild.BotCfg[appID].id === atValue)
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
            const file = "./plugins/QQGuild-plugin/data/image/" + i.filename
            if (!fs.existsSync(file)) {
                const response = await fetch(`https://${i.url}`)
                if (response.ok) {
                    const buffer = await response.arrayBuffer()
                    fs.writeFile(file, Buffer.from(buffer), (error) => {
                        if (error)
                            logger.error(`[QQGuild-plugin]：图片写入文件发生错误 https://${i.url} `, error)
                        else
                            logger.mark(`[QQGuild-plugin]：图片 https://${i.url} 下载完成`)
                    })
                } else
                    logger.error(`[QQGuild-plugin]：下载图片失败 https://${i.url} `, response.statusText)
            }

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
}

/** 消息转换为Yunzai格式 */
async function sendFriendMsg(data, appID) {
    const msg = data.msg
    let time = parseInt(Date.parse(msg.timestamp) / 1000)
    /** 判断是否为管理员2 创建者4 用户 子管5暂未适配 */
    const roles = msg.member.roles
    let role = roles && (roles.includes("4") ? "owner" : roles.includes("2") ? "admin" : "member") || "member"

    /** 构建Yunzai的message */
    let message = await makeeMessage(msg, appID)

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
        group_id: msg.guild_id,
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
        model: "Yunzai-Bot",
        friend: {
            sendMsg: async (reply, reference) => {
                return await sendGroupMsg(data, reply, reference, appID)
            },
            recallMsg: (msg_id) => {
                return BotCfg[appID].client.messageApi.deleteMessage(msg.channel_id, msg_id, false)
            },
            makeForwardMsg: async (forwardMsg) => {
                return await e.group.makeForwardMsg(forwardMsg)
            }
        },
        group: {
            pickMember: (id) => {
                if (id === msg.author.id) {
                    return member
                }
            },
            recallMsg: (msg_id) => {
                return BotCfg[appID].client.messageApi.deleteMessage(msg.channel_id, msg_id, false)
            },
            sendMsg: async (reply, reference) => {
                return await sendGroupMsg(data, reply, reference, appID)
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
                        } else {
                            /** 普通对象 图片 文件 at */
                            newmsg.push(formsg)
                        }
                    } else {
                        /** 日志特殊处理 */
                        if (/^#.*日志$/.test(content)) {
                            let splitMsg
                            for (const i of forwardMsg) {
                                splitMsg = i.message.split("\n[").map(element => {
                                    if (element.length > 250)
                                        element = element.substring(0, 150) + "日志过长..."
                                    return { type: "forward", text: `[${element.trim()}\n` }
                                })
                            }
                            newmsg.push(...splitMsg.slice(0, 40))
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
            return await sendGroupMsg(data, reply, reference, appID)
        },
        toString: () => {
            const NewMsg = msg?.content || msg?.attachments?.[0]?.filename
            return NewMsg
                .replace(new RegExp(`\\<@!${QQGuild.BotCfg[appID].id}>`, "g"), `{at:${Bot.uin}}`)
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
            return Bot.oldInfo(group_id, id)
        }
    }

    return e
}

/** 将消息转成QQGuildApi格式 */
async function sendGroupMsg(data, allMsg, reference, appID) {
    /** https://bot.q.qq.com/wiki/develop/nodesdk/message/post_messages.html#messagetocreate */
    let newMsg = []
    /** 将格式统一为对象 随后进行转换成api格式 */
    if (allMsg?.[1]?.data?.type === "test") {
        newMsg.push({ type: "forward", text: allMsg[0] })
        newMsg.push(...allMsg[1].msg)
    } else if (allMsg?.data?.type === "test") {
        newMsg.push(...allMsg.msg)
    } else if (Array.isArray(allMsg)) {
        newMsg = [].concat(...allMsg.map(i => (
            typeof i === "string" ? [{ type: "text", text: i }] :
                Array.isArray(i) ? [].concat(...i.map(format => (
                    typeof format === "string" ? [{ type: "text", text: format }] :
                        typeof format === "object" && format !== null ? [format] : []
                ))) :
                    typeof i === "object" && i !== null ? [i] : []
        )))
    } else if (typeof allMsg === "object") {
        newMsg.push(allMsg)
    } else {
        newMsg.push({ type: "text", text: allMsg })
    }

    /** 处理AT 表情 文本 */
    let content = apiMsg(data, allMsg, reference, appID, newMsg)
    const NewContent = allurl(content)
    if (NewContent === "") return false
    return await postMessage(data, NewContent, reference, appID)
}

/** 转为api格式 */
function apiMsg(data, msgs, reference, appID, newMsg) {
    let content = ""
    newMsg.forEach(i => {
        switch (i.type) {
            case "text":
                content += i.text
                break
            case "image":
                /** 图片直接发送~ */
                postMessage(data, i, reference, appID)
                break
            case "face":
                content += `<emoji:${i.text}>`
                break
            case "at":
                /** 加个判断，由于yunzai的reply中使用了Number对用户id进行处理，频道id过长导致id不准确 */
                if (i.text === data.msg.author.username)
                    content += `<@${data.msg.author.id}>`
                else if (i.qq === 0 || i.qq) {
                    content += `<@${i.id}>`
                } else {
                    content += `<@${i.qq}>`
                }
                break
            case "forward":
                content += `${i.text}\n\n`
                break
            default:
                content += i.text
                break
        }
    })
    return content.replace(/\n{1,3}$/g, '')
}


/** 对url进行特殊处理，防止发送失败 */
function allurl(content) {
    const urlregex = {
        'www.': 'www_',
        '.com': '_com',
        '.net': '_net',
        '.org': '_org',
        '.gov': '_gov',
        '.edu': '_edu',
        '.co': '_co',
        '.io': '_io',
        '.xyz': '_xyz',
        '.info': '_info',
        '.tech': '_tech',
        '.store': '_store',
        '.app': '_app',
        '.blog': '_blog',
        '.design': '_design',
        '.online': '_online',
        'https://': 'https_',
        'http://': 'http_'
    }

    const regex = new RegExp(Object.keys(urlregex)
        .map(domain => `(?:${domain.replace('.', '\\.')})`).join('|'), 'g')
    return content.replace(regex, match => urlregex[match])
}

/** 开始回复消息 */
async function postMessage(msgBody, msg, reference, appID) {
    const data = msgBody.msg
    let GroupMsg
    let file = msg?.file

    const sceneMap = {
        "DIRECT_MESSAGE_CREATE": "私信",
        "MESSAGE_CREATE": "私域",
        "AT_MESSAGE_CREATE": "公域"
    }
    let reply
    let scene = sceneMap[msgBody.eventType] || "未知场景"
    const user_name = `[用户：${data.author.username}-${data.author.id}]`

    if (scene === "私信") {
        reply = `[回复-${scene}：${data.guild_id}-${data.guild_id}]${user_name}`
    } else {
        const guild_name = QQGuild.guilds[data.guild_id].name
        const channel_name = QQGuild.guilds[data.guild_id].channels[data.channel_id]
        reply = `[回复-${scene}：${guild_name}-${channel_name}]${user_name}`
    }

    /** 文本、at、表情 */
    if (typeof msg === "string") {
        GroupMsg = {
            msg_id: data.id,
            content: msg
        }
        /** 引用消息 */
        if (reference) {
            const reference = {
                message_id: data.id,
                ignore_get_message_error: true
            }
            GroupMsg.message_reference = reference
        }
        if (scene === "私信")
            logger.info(`QQGuild-plugin：${reply} ${msg}`)
        else
            logger.info(`QQGuild-plugin：${reply} ${msg}`)
    } else {
        /** 如果存在url，则说明是下发的图片，需要进行读取本地缓存 */
        let img
        if (/^(https|http)/.test(msg.url)) {
            img = `./plugins/QQGuild-plugin/data/image/${file}`
            const base64 = Buffer.from(fs.readFileSync(img)).toString('base64')
            file = base64
        } else if (file instanceof Uint8Array) {
            /** 转成字符串... */
            file = Buffer.from(file).toString('base64')
        } else if (file.includes("file://")) {
            /** 转成base64 */
            img = file
            file = Buffer.from(fs.readFileSync(file.replace(/^file:(\/\/\/|\/\/)/, ""))).toString('base64')
        }

        GroupMsg = new FormData()
        GroupMsg.set("msg_id", data.id)
        GroupMsg.set("file_image", new Blob([Buffer.from(file.replace(/^base64:\/\//, ""), "base64")]))
        logger.info(`QQGuild-plugin：${reply} 图片：${img || "base64://..."}`)
    }

    /** 响应 */
    let response
    try {
        if (msgBody.eventType === "DIRECT_MESSAGE_CREATE") {
            response = await BotCfg[appID].client.directMessageApi.postDirectMessage(data.guild_id, GroupMsg)
        } else {
            response = await BotCfg[appID].client.messageApi.postMessage(data.channel_id, GroupMsg)
        }
    } catch (error) {
        /** 图片过大发送失败，进行压缩重新发送... */
        if (error.code === 304020) {
            logger.error("QQGuild-plugin：...正在进行压缩...")
            const base64 = file.replace(/^base64:\/\//, "")
            if (base64) {
                const newbase64 = await imagemin.buffer(Buffer.from(base64, 'base64'), {
                    plugins: [imageminJpegtran(), imageminPngquant()]
                })
                logger.mark("QQGuild-plugin：压缩完成...正在重新发送...")
                GroupMsg.set("file_image", new Blob([Buffer.from(newbase64)]))
                response = await BotCfg[appID].client.messageApi.postMessage(data.channel_id, GroupMsg)
            }
        } else {
            return logger.error("QQGuild-plugin：", error)
        }
    }

    /** 返回消息id给撤回用？ */
    return {
        seq: response.data.seq_in_channel,
        rand: 1,
        time: parseInt(Date.parse(response.data.timestamp) / 1000),
        message_id: response.data.id
    }
}

/** 发送主动消息 解除私信限制 */
async function Sendprivate(data, appID) {
    const addMsg = {
        source_guild_id: data.msg.guild_id,
        recipient_id: data.msg.author.id
    }
    const add_data = await BotCfg[appID].client.directMessageApi.createDirectMessage(addMsg)
    await BotCfg[appID].client.directMessageApi
        .postDirectMessage(add_data.data.guild_id, { content: " QQGuild-plugin：你好~" })
}


export class Guild extends plugin {
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
                }
            ]
        })
    }

    async QQGuildCfg(e) {
        const msg = await addBot(e)
        return e.reply(msg)
    }

    async QQGuildAccount(e) {
        if (e.sub_type === "friend") {
            const config = Yaml.parse(fs.readFileSync(Cfgfile, 'utf8'))
            const msg = []
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
}

/** 添加Bot */
async function addBot(e) {
    const cmd = e.msg.replace(/^#QQ频道设置/gi, "")
        .replace(/：/g, ":").trim().split(':')
    // console.log(cmd)

    if (!/^1\d{8}$/.test(cmd[2]))
        return "appID 错误！"

    if (!/^[0-9a-zA-Z]{32}$/.test(cmd[3]))
        return "token 错误！"

    let cfg
    if (!fs.existsSync(Cfgfile)) {
        cfg = {
            [cmd[2]]: {
                appID: cmd[2],
                token: cmd[3],
                sandbox: cmd[0] === "1",
                allMsg: cmd[1] === "1"
            }
        }
    } else {
        cfg = Yaml.parse(fs.readFileSync(Cfgfile, 'utf8'))
        if (cfg[cmd[2]]) {
            delete cfg[cmd[2]]
            fs.writeFileSync(Cfgfile, Yaml.stringify(cfg), 'utf8')
            return `Bot：${cmd[2]} 删除成功...重启后生效...`
        } else {
            cfg[cmd[2]] = {
                appID: cmd[2],
                token: cmd[3],
                sandbox: cmd[0] === "1",
                allMsg: cmd[1] === "1"
            }
        }
    }
    /** 先存入 继续修改~ */
    fs.writeFileSync(Cfgfile, Yaml.stringify(cfg), 'utf8')
    if (cfg[cmd[2]].allMsg)
        cfg[cmd[2]].intents = ['GUILD_MESSAGES', 'DIRECT_MESSAGE']
    else
        cfg[cmd[2]].intents = ['PUBLIC_GUILD_MESSAGES', 'DIRECT_MESSAGE']
    QQGuild.BotCfg[cmd[2]] = cfg[cmd[2]]
    const msg = await WS_Cfg(cmd[2], QQGuild.BotCfg)
    return msg
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