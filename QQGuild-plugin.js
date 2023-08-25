import fs from "fs"
import imagemin from "imagemin"
import { Yunzai } from "./model/Yunzai.js"
import { FormData, Blob } from "node-fetch"
import imageminJpegtran from "imagemin-jpegtran"
import imageminPngquant from "imagemin-pngquant"
import PluginsLoader from "../../lib/plugins/loader.js"
import { createOpenAPI, createWebsocket } from "qq-guild-bot"

logger.info("QQGuild-plugin初始化...")
logger.info("https://github.com/Zyy955/QQGuild-plugin")
let BotCfg = QQGuild.BotCfg

/** 保存原始方法 */
Bot.QQGuild_Info = Bot.getGroupMemberInfo

export let QQGuild_Bot = {
    /** 从配置文件中加载bot配置 */
    loadBotCfg(bot_cfg) {
        if (!bot_cfg) return
        this.loadBotIntents(bot_cfg)
    },
    /** 将设置完监听事件的配置存入全局变量中 */
    async loadBotIntents(bot_cfg) {
        QQGuild.BotCfg = {
            ...QQGuild.BotCfg,
            ...await this.addBotCfg(bot_cfg)
        }
        BotCfg = QQGuild.BotCfg
        await this.CreateBot(QQGuild.BotCfg)
    },
    /** 设置公域、私域机器人的监听事件 */
    async addBotCfg(bot_cfg) {
        let config = bot_cfg
        for (const id in config) {
            if (config[id].allMsg)
                config[id].intents = [
                    "GUILDS", // bot频道列表、频道资料、列表变化
                    "GUILD_MEMBERS", // 成员资料变化
                    'GUILD_MESSAGES', // 私域
                    "GUILD_MESSAGE_REACTIONS", // 消息表情动态
                    "DIRECT_MESSAGE", // 私信消息
                ]
            else
                config[id].intents = [
                    "GUILDS", // bot频道列表、频道资料、列表变化
                    "GUILD_MEMBERS", // 成员资料变化
                    "GUILD_MESSAGE_REACTIONS", // 消息表情动态
                    "DIRECT_MESSAGE", // 私信消息
                    "PUBLIC_GUILD_MESSAGES", // 公域消息
                ]
        }
        return config
    },
    /** 创建监听消息 */
    async CreateBot(BotCfg) {
        /** 创建对应的机器人配置 */
        for (const appID in BotCfg) {
            /** 创建 client */
            BotCfg[appID].client = createOpenAPI(BotCfg[appID])
            /** 创建 websocket 连接 */
            BotCfg[appID].ws = createWebsocket(BotCfg[appID])

            // 消息监听
            BotCfg[appID].ws.on('READY', (wsdata) => {
                /** 保存机器人名称、id */
                const { user } = wsdata.msg
                QQGuild.BotCfg[appID].id = user.id
                QQGuild.BotCfg[appID].name = user.username
                logger.mark(logger.green(`Bot：${appID} 鉴权成功~`))
            })

            /** 加载机器人所在频道、将对应的子频道信息存入变量中用于后续调用 */
            const meGuilds = (await BotCfg[appID].client.meApi.meGuilds()).data
            for (let channelData of meGuilds) {
                const response = await BotCfg[appID].client.channelApi.channels(channelData.id)
                const channelList = response.data
                const guildInfo = { ...channelData, channels: {} }

                /** 添加群成员列表到Bot.gl中，用于主动发送消息 */
                for (const i of channelList)
                    Bot.gl.set(`${i.guild_id}-${i.id}`, {
                        group_id: `${i.guild_id}-${i.id}`,
                        guild_id: i.guild_id,
                        channel_id: i.id,
                        group_name: i.name,
                    })

                for (let subChannel of channelList) { guildInfo.channels[subChannel.id] = subChannel.name }
                QQGuild.guilds[channelData.id] = guildInfo
                QQGuild.guilds[channelData.id].appID = appID
            }

            /** 建立ws链接 监听bot频道列表、频道资料、列表变化事件 */
            BotCfg[appID].ws.on('GUILDS', (data) => { data.appID = appID, this.log_msg(data) })
            /** 建立ws链接 监听频道成员变化事件 */
            BotCfg[appID].ws.on('GUILD_MEMBERS', (data) => { data.appID = appID, this.log_msg(data) })
            /** 建立ws链接 监听私信消息 */
            BotCfg[appID].ws.on('DIRECT_MESSAGE', (data) => { data.appID = appID, this.log_msg(data) })
            /** 建立ws链接 监听私域事件 */
            BotCfg[appID].ws.on('GUILD_MESSAGES', (data) => { data.appID = appID, this.log_msg(data) })
            /** 建立ws链接 监听公域事件 */
            BotCfg[appID].ws.on('PUBLIC_GUILD_MESSAGES', (data) => { data.appID = appID, this.log_msg(data) })
            /** 建立ws链接 监听表情动态事件 */
            BotCfg[appID].ws.on('GUILD_MESSAGE_REACTIONS', (data) => { data.appID = appID, this.log_msg(data) })
            /** 太快了 太快了！ */
            await new Promise((resolve) => setTimeout(resolve, 1000))
            logger.mark(logger.green(`Bot：${appID} 连接成功~`))
        }
    },
    /** 根据对应的事件进行打印日志和做对应的处理 */
    async log_msg(data) {
        /** 记得修改 通过监听事件类型来获取频道名称和子频道名称 */
        const { appID, msg } = data
        const Bot_name = `${BotCfg[appID].name} `
        const { src_guild_id, guild_id, channel_id, message, op_user_id, op_user } = msg

        /** 频道ID、名称 */
        const GuildId = src_guild_id || guild_id || message.src_guild_id || message.guild_id || msg.id
        const Guild_name = await this.GetGuild_name(GuildId)

        /** 子频道名称 */
        let channel_name = await this.Getchannel_name(GuildId, (channel_id || message?.channel_id)) || ""

        /** 操作人 */
        let op_user_name
        if (GuildId && (op_user_id || op_user?.id))
            op_user_name = (await this.UserName(appID, GuildId, (op_user_id || op_user.id))).nick || ""

        /** 用户名称 */
        const user_name = await this.GetUser_name(appID, msg)

        switch (data.eventType) {
            case "GUILD_CREATE":
                /** 需要添加个频道、子频道列表到全局变量中 */
                logger.info(`${Bot_name}通知：[${msg.name}，操作人:${op_user_name}] Bot已加入频道：${msg.name}`)
                break
            case "GUILD_UPDATE":
                logger.info(`${Bot_name}通知：[${Guild_name}]管理员 ${op_user_name} 更改了频道资料`)
                break
            case "GUILD_DELETE":
                logger.info(`${Bot_name}通知：[${msg.name}]管理员 ${op_user_name} 将 ${BotCfg[appID].name} 从频道 ${msg.name} 中移除了!`)
                break
            case "CHANNEL_CREATE":
                logger.info(`${Bot_name}通知：[${Guild_name}]管理员 ${op_user_name} 已创建子频道：${msg.name}`)
                break
            case "CHANNEL_UPDATE":
                logger.info(`${Bot_name}通知：[${Guild_name}]管理员 ${op_user_name} 已更新子频道 ${msg.name} 的资料`)
                break
            case "CHANNEL_DELETE":
                logger.info(`${Bot_name}通知：[${Guild_name}]管理员 ${op_user_name} 已删除子频道：${msg.name}`)
                break
            case "GUILD_MEMBER_ADD":
                if (msg.user.bot)
                    logger.info(`${Bot_name}通知：[${Guild_name}]管理员 ${op_user_name} 已添加机器人：${msg.nick}`)
                else
                    logger.info(`${Bot_name}通知：[${Guild_name}]成员 ${msg.nick} 加入频道！`)
                break
            case "GUILD_MEMBER_REMOVE":
                if (msg.op_user_id === msg.user.id)
                    logger.info(`${Bot_name}通知：[${Guild_name}]成员 ${msg.nick} 退出频道！`)
                else
                    logger.info(`${Bot_name}通知：[${Guild_name}]管理员 ${op_user_name} 已将 ${msg.nick} 移出频道！`)
                break

            /** 私域消息 */
            case "MESSAGE_CREATE":
                logger.info(`${Bot_name}频道消息：[${Guild_name}-${channel_name}，${user_name}] ${this.guild_msg(msg)}`)
                /** 解除私信 */
                if (msg.content === "#QQ频道解除私信") return this.Sendprivate(data)

                /** 转换消息 交由云崽处理 */
                PluginsLoader.deal(await Yunzai.msg(data))
                break
            case "MESSAGE_DELETE":
                if (msg.op_user.id === message.author.id)
                    logger.info(`${Bot_name}撤回消息：[${Guild_name}-${channel_name}，${user_name}] ${message.id}`)
                else {
                    const op_name = `${op_user_name} 撤回了 ${user_name}`
                    logger.info(`${Bot_name}撤回消息：[${Guild_name}-${channel_name}] ${op_name}的消息：${message.id}`)
                }
                break

            /** 表情动态 */
            case "MESSAGE_REACTION_ADD":
                logger.info(`${Bot_name}表情动态：[${Guild_name}-${channel_name}，${user_name}] 为消息 ${msg.target.id} 添加表情 [emoji:${msg.emoji.id}]`)
                break
            case "MESSAGE_REACTION_REMOVE":
                logger.info(`${Bot_name}表情动态：[${Guild_name}-${channel_name}，${user_name}] 取消了消息 ${msg.target.id} 的表情 [emoji:${msg.emoji.id}]`)
                break

            /** 私信 */
            case "DIRECT_MESSAGE_CREATE":
                logger.info(`${Bot_name}私信：[${Guild_name}-私信，${user_name}] ${this.guild_msg(msg)}`)
                /** 转换消息 交由云崽处理 */
                let e = await Yunzai.msg(data)
                e.message_type = "private"
                e.sub_type = "friend"
                PluginsLoader.deal(e)
                break
            case "DIRECT_MESSAGE_DELETE":
                if (msg.op_user.id === message.author.id)
                    logger.info(`${Bot_name}撤回消息：[${Guild_name}-私信，${user_name}] ${message.id}`)
                else {
                    const op_name = `${op_user_name} 撤回了 ${user_name}`
                    logger.info(`${Bot_name}撤回消息：[${Guild_name}-私信] ${op_name}的消息：${message.id}`)
                }
                break

            /** 公域事件 仅接收@机器人消息 */
            case "AT_MESSAGE_CREATE":
                logger.info(`${Bot_name}频道消息：[${Guild_name}-${channel_name}，${user_name}] ${this.guild_msg(msg)}`)
                /** 解除私信 */
                if (msg.content === "#QQ频道解除私信") return this.Sendprivate(data)

                /** 转换消息 交由云崽处理 */
                PluginsLoader.deal(await Yunzai.msg(data))
                break
            case "PUBLIC_MESSAGE_DELETE":
                if (msg.op_user.id === message.author.id)
                    logger.info(`${Bot_name}撤回消息：[${Guild_name}-${channel_name}，${user_name}] ${message.id}`)
                else {
                    const op_name = `${op_user_name} 撤回了 ${user_name}`
                    logger.info(`${Bot_name}撤回消息：[${Guild_name}-${channel_name}] ${op_name}的消息：${message.id}`)
                }
                break
            default:
                logger.mark(`${Bot_name}[${appID}] 未知事件：`, data)
                break
        }
    },
    /** 转为可视化消息 */
    guild_msg(msg) {
        const { attachments, content } = msg
        const allMsg = []
        attachments && attachments.forEach(i => allMsg.push(`[图片：./data/image/${i.filename}]`))
        content && allMsg.push(content)
        return allMsg.join(" ")
    },

    /**
     * 转换消息为api可接收格式
     * https://bot.q.qq.com/wiki/develop/nodesdk/
     * @param {Object} data - api下发的对象
     * @param {Object|Array|string} allMsg - 回复的消息
     * @param {boolean} reference - 是否回复引用消息
     */
    async reply_msg(data, allMsg, reference) {
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
        let Api_msg = await this.apiMsg(data, reference, newMsg)
        if (!Api_msg) return false
        return await this.postMessage(data, Api_msg, reference)
    },

    /** 转为api格式 */
    async apiMsg(data, reference, newMsg) {
        const msg = data.msg
        let content = ''
        const Api_msg = []

        const type_msg = () => ({
            "text": (i) => i.text,
            "image": async (i) => {
                /** 多个图片直接挨个发 */
                if (Api_msg.length > 0) await this.postMessage(data, [i], reference)
                else Api_msg.push(i)
                return ''
            },
            "face": (i) => `<emoji:${i.text}>`,
            "at": (i) => {
                if (i.text === msg?.author?.username)
                    return `<@${msg?.author?.id}>`
                else if (i.qq === 0 || i.qq) {
                    return `<@${i.id}>`
                } else {
                    return `<@${i.qq}>`
                }
            },
            "forward": async (i) => {
                if (QQGuild.config.分片转发) {
                    const forward_msg = await this.allurl(i.text)
                    await this.postMessage(data, [forward_msg], reference)
                    return ''
                } else {
                    return `${i.text}\n\n`
                }
            },
            "default": (i) => i
        })

        for (const i of newMsg) {
            /** 太快了 太快了！ */
            await new Promise((resolve) => setTimeout(resolve, 300))
            const msg_type = type_msg()
            const handler = msg_type[i.type] || msg_type["default"]
            content += await handler(i)
        }
        content = await this.allurl(content)
        content = content.replace(/\n{1,3}$/g, '').replace(/\n{3,4}/g, '\n\n')
        if (content !== "" && content) Api_msg.push(content)
        return Api_msg
    },
    /** 对url进行特殊处理，防止发送失败 */
    allurl(content) {
        if (typeof content !== 'string') return content
        const urls = QQGuild.config.url白名单
        const whiteRegex = new RegExp(`\\b(${urls.map(url => url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
        /** 如果是包含白名单内链接，则不作任何处理，直接返回 */
        if (content.match(whiteRegex)) return content
        else {
            const urlRegex = /(https?:\/\/)?(([0-9a-z.]+\.[a-z]+)|(([0-9]{1,3}\.){3}[0-9]{1,3}))(:[0-9]+)?(\/[0-9a-z%/.\-_]*)?(\?[0-9a-z=&%_\-]*)?(\#[0-9a-z=&%_\-]*)?/ig
            return content.replace(urlRegex, matchedUrl => matchedUrl.replace(/[./]/g, '_'))
        }
    },
    /** 开始回复消息 */
    async postMessage(data, Api_msg, reference) {
        let log = ""
        let image
        let SendMsg
        const { appID, msg } = data
        const Bot_name = `${BotCfg[appID].name} `
        const user_name = await this.GetUser_name(appID, msg) || ""
        const Guild_name = await this.GetGuild_name(msg.src_guild_id || msg.guild_id)
        const channel_name = await this.Getchannel_name(msg.guild_id, msg.channel_id) || ""

        SendMsg = new FormData()
        if (msg.id) SendMsg.set("msg_id", msg.id)

        for (let reply_msg of Api_msg) {
            /** 文本、AT、表情包、子频道跳转 */
            if (typeof reply_msg === "string") {
                if (reference) {
                    SendMsg = { msg_id: msg.id, content: reply_msg }
                    SendMsg.message_reference = { message_id: msg.id, ignore_get_message_error: true }
                } else {
                    log += reply_msg
                    SendMsg.set("content", reply_msg)
                }
            }
            /** 处理各种牛马格式的图片 转成base64字符串 TMD */
            else if (typeof reply_msg === "object") {
                /** 米游社公告类 */
                if (reply_msg.type === "image") {
                    const file = reply_msg.file
                    let img = "./plugins/QQGuild-plugin/data/image/"
                    /** 套娃的二进制base64 */
                    if (reply_msg.file.type === "Buffer") {
                        log += `[图片：base64://...]`
                        image = Buffer.from(reply_msg.file.data).toString('base64')
                    }
                    /** 字符串格式的base64 */
                    else if (typeof file === "string") {
                        log += `[图片：base64://...]`
                        image = file.replace(/^base64:\/\//, "")
                    }
                    /** 检测是否为频道下发图片 复读表情包用... */
                    else if (reply_msg.url) {
                        img = img + reply_msg.file
                        log += `[图片：${img}]`
                        if (!fs.existsSync(img)) await Yunzai.download_img(`https://${reply_msg.url}`, file)
                        image = Buffer.from(fs.readFileSync(img)).toString('base64')
                    }
                    /** 二进制转字符串 */
                    else if (file instanceof Uint8Array) {
                        log += `[图片：base64://...]`
                        image = Buffer.from(file).toString('base64')
                    }
                    /** 本地文件转成base64 */
                    else if (file.includes("file://")) {
                        log += `[图片：${file}]`
                        image = Buffer.from(fs.readFileSync(file.replace(/^file:(\/\/\/|\/\/)/, ""))).toString('base64')
                    }
                    /** 检测url图片 */
                    else if (/^(https|http):\/\//.test(file)) {
                        /** 判断url是否在白名单中 存在直接发送url */
                        const urls = QQGuild.config.url白名单
                        const whiteRegex = new RegExp(`\\b(${urls.map(url =>
                            url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
                        if (!file.match(whiteRegex)) {
                            img = img + file.split('/').pop()
                            log += `[图片：${img}]`
                            if (!fs.existsSync(img)) await Yunzai.download_img(file, file.split('/').pop())
                            image = Buffer.from(fs.readFileSync(img)).toString('base64')
                        } else {
                            log += `[图片：${file}]`
                            SendMsg.set("image", file)
                        }
                    }

                }
                if (image) { SendMsg.set("file_image", new Blob([Buffer.from(image, "base64")])) }
            }
        }

        switch (data.eventType) {
            /** 私信 */
            case "DIRECT_MESSAGE_CREATE":
                logger.info(`${Bot_name}发送消息：[${Guild_name}-私信，${user_name}] ${log}`)
                break
            case "MESSAGE_CREATE":
                logger.info(`${Bot_name}发送消息：[${Guild_name}-${channel_name}，${user_name}] ${log}`)
                break
            case "AT_MESSAGE_CREATE":
                logger.info(`${Bot_name}发送消息：[${Guild_name}-${channel_name}，${user_name}] ${log}`)
                break
            default:
                logger.error("未知场景：", data)
        }
        return await this.postMsg(data, SendMsg)
    },
    /** 向API回复消息 */
    async postMsg(data, SendMsg) {
        const { msg, appID } = data
        const Bot_name = `${BotCfg[appID].name} `
        /** 发送消息并储存res */
        let res
        try {
            if (data.eventType === "DIRECT_MESSAGE_CREATE") {
                res = await BotCfg[appID].client.directMessageApi.postDirectMessage(msg.guild_id, SendMsg)
            }
            else {
                res = await BotCfg[appID].client.messageApi.postMessage(msg.channel_id, SendMsg)
            }
        } catch (error) {
            /** 图片过大发送失败，进行压缩重新发送... */
            if (error.code === 304020) {
                logger.error(`${Bot_name}：图片发送失败...正在进行压缩...`)
                const newbase64 = await imagemin.buffer(Buffer.from(await SendMsg.get("file_image").arrayBuffer()), {
                    plugins: [imageminJpegtran(), imageminPngquant()]
                })
                logger.mark(`${Bot_name}：压缩完成...正在重新发送...`)
                SendMsg.set("file_image", new Blob([Buffer.from(newbase64)]))
                res = await BotCfg[appID].client.messageApi.postMessage(msg.channel_id, SendMsg)
            } else {
                return logger.error(`${Bot_name} 发送消息错误：`, error)
            }
        }
        /** 返回消息id给撤回用？ */
        return {
            seq: res.data.seq_in_channel,
            rand: 1,
            time: parseInt(Date.parse(res.data.timestamp) / 1000),
            message_id: res.data.id
        }
    },
    /** 发送主动消息 解除私信限制 */
    Sendprivate: async (data) => {
        const { msg, appID } = data
        const newmsg = {
            source_guild_id: msg.guild_id,
            recipient_id: msg.author.id
        }
        const newdata = await BotCfg[appID].client.directMessageApi.createDirectMessage(newmsg)
        await BotCfg[appID].client.directMessageApi
            .postDirectMessage(newdata.data.guild_id, { content: " QQGuild-plugin：你好~" })
    },
    /** 获取频道名称 */
    GetGuild_name(guild_id) {
        return QQGuild.guilds?.[guild_id]?.name
    },

    /** 获取子频道名称 */
    Getchannel_name(guild_id, channel_id) {
        return QQGuild.guilds?.[guild_id]?.channels?.[channel_id]
    },

    /** 获取用户名称 */
    GetUser_name: async (appID, msg) => {
        const { author, message, op_user_id } = msg
        const guild_id = msg?.src_guild_id || message?.src_guild_id || msg?.guild_id || message?.guild_id

        /** 用户名称 */
        let user_name = author?.username || message?.author?.username || ""
        if (!user_name && !op_user_id) {
            const user_id = author?.id || message?.author.id || msg?.user_id
            if (!user_id) return user_name = ""
            user_name = (await this.UserName(appID, guild_id, user_id)).nick
        }
        return user_name
    },

    /** 从api获取用户名称 */
    UserName: async (appID, guild_id, user_id) => {
        const { data } = await BotCfg[appID].client.guildApi.guildMember(guild_id, user_id)
        const nick = data.nick
        const name = data.user.username
        const avatar = data.user.avatar
        const joined_at = data.joined_at.replace(/T|\+08:00/g, " ")
        return { nick, name, avatar, joined_at }
    },
}

/** 加载机器人 */
QQGuild_Bot.loadBotCfg(QQGuild.config.bot)

/** 加载一下插件到主体... */
let ret = await Promise.allSettled([import('./model/Yunzai.js')])
let apps = { Yunzai: ret[0].value[Object.keys(ret[0].value)[0]] }
export { apps }
