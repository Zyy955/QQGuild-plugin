import fs from "fs"
import Yaml from "yaml"
import imagemin from 'imagemin'
import imageminJpegtran from 'imagemin-jpegtran'
import imageminPngquant from 'imagemin-pngquant'
import { execSync } from 'child_process'
import { update } from '../other/update.js'
import plugin from '../../lib/plugins/plugin.js'
import fetch, { FormData, Blob } from "node-fetch"
import PluginsLoader from "../../lib/plugins/loader.js"
import { createOpenAPI, createWebsocket } from 'qq-guild-bot'

logger.info("QQGuild-plugin初始化...")
logger.info("https://github.com/Zyy955/QQGuild-plugin")

/** 保存频道信息 */
let QQGuild = {
    guilds: {},
    BotCfg: {}
}
let _path = process.cwd() + '/plugins/QQGuild-plugin'

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
    logger.info(await WS_Cfg(appID, BotCfg))
}

/** 监听消息 */
async function WS_Cfg(appID, BotCfg) {
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
async function makeeMessage(msg) {
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
                const atValue = i.slice(3, -1)
                const name = at_name(atValue)
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
    let message = await makeeMessage(msg)

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
        QQGuild: true,
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
            }
        },
        recall: () => {
            BotCfg[appID].client.messageApi.deleteMessage(msg.channel_id, msg.id, true)
        },
        reply: async (reply, reference) => {
            return await sendGroupMsg(data, reply, reference, appID)
        }
    }
    return e
}

/** 将消息转成QQGuildApi格式 */
async function sendGroupMsg(data, msg, reference, appID) {
    /** https://bot.q.qq.com/wiki/develop/nodesdk/message/post_messages.html#messagetocreate */

    let newMsg = []
    let content = ""

    /** 将格式统一 */
    if (Array.isArray(msg)) {
        newMsg = [].concat(...msg.map(i => (
            typeof i === "string" ? [{ type: "text", text: i }] :
                Array.isArray(i) ? [].concat(...i.map(format => (
                    typeof format === "string" ? [{ type: "text", text: format }] :
                        typeof format === "object" && format !== null ? [format] : []
                ))) :
                    typeof i === "object" && i !== null ? [i] : []
        )))

        newMsg.forEach(msg => {
            switch (msg.type) {
                case "text":
                    content += msg.text
                    break
                case "image":
                    /** 图片直接发送~ */
                    postMessage(data, msg, reference, appID)
                    break
                case "face":
                    content += `<emoji:${msg.text}>`
                    break
                case "at":
                    /** 加个判断，由于yunzai的reply中使用了Number对用户id进行处理，频道id过长导致id不准确 */
                    if (msg.text === data.msg.author.username)
                        content += `<@${data.msg.author.id}>`
                    else
                        content += `<@${msg.qq}>`
                    break
                default:
                    content += msg.text
            }
        })
    } else if (typeof msg === "object") {
        /** 图片直接发送~ */
        postMessage(data, msg, reference, appID)
    } else {
        /** 是字符串直接赋值即可~ */
        content += msg
    }

    /** 对url进行特殊处理，防止发送失败 */
    const NewContent = content.replace(
        /https?:\/\/\S+|www\.\S+|\S+\.\S+/gms,
        match => {
            return match.replace(/[.:]/g, '_')
        }
    ).replace(/Object\./g, 'Object_').replace(/\n\n$/m, '')

    /** 为空禁止发送~ */
    if (NewContent === "") return false

    /** 处理完毕发送... */
    return await postMessage(data, NewContent, reference, appID)
}

/** 开始回复消息 */
async function postMessage(msgBody, msg, reference, appID) {
    const data = msgBody.msg
    let GroupMsg
    let file = msg?.file

    const guild_name = QQGuild.guilds[data.guild_id].name
    const channel_name = QQGuild.guilds[data.guild_id].channels[data.channel_id]
    const user_name = `[用户：${data.author.username}-${data.author.id}]`
    const sceneMap = {
        "DIRECT_MESSAGE_CREATE": "私信",
        "MESSAGE_CREATE": "私域",
        "AT_MESSAGE_CREATE": "公域"
    }
    let scene = sceneMap[msgBody.eventType] || "未知场景"


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
        logger.info(`QQGuild-plugin：[回复-${scene}：${guild_name}-${channel_name}]${user_name} ${msg}`)
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
        }

        GroupMsg = new FormData()
        GroupMsg.set("msg_id", data.id)
        GroupMsg.set("file_image", new Blob([Buffer.from(file.replace(/^base64:\/\//, ""), "base64")]))
        logger.info(`QQGuild-plugin：[回复-${scene}：${guild_name}-${channel_name}]${user_name} 图片：${img || "base64://..."}`)
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
                    reg: /^#QQ频道设置.*$/gi,
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
        const cmd = e.msg.replace(/^#QQ频道设置/gi, "")
            .replace(/：/g, ":").trim().split(':')

        if (!/^1\d{8}$/.test(cmd[2]))
            return e.reply("appID 错误！")

        if (!/^[0-9a-zA-Z]{32}$/.test(cmd[3]))
            return e.reply("token 错误！")

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
                return e.reply(`Bot：${cmd[2]} 删除成功...重启后生效...`)
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
