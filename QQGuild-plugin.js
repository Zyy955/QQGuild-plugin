import fs from "fs"
import qrcode from "qrcode"
import { Yunzai } from "./model/Yunzai.js"
import "./model/Api.js"
import { FormData, Blob } from "node-fetch"
import PluginsLoader from "../../lib/plugins/loader.js"
import puppeteer from "../../lib/puppeteer/puppeteer.js"
import { createOpenAPI, createWebsocket } from "qq-guild-bot"

logger.info("QQGuild-plugin初始化...")
logger.info("https://github.com/Zyy955/QQGuild-plugin")
let BotCfg = QQGuild.BotCfg

/** 保存原始方法 */
Bot.QQGuild_Info = Bot.getGroupMemberInfo

export let QQGuild_Bot = {
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
    /** 保存Bot配置到全局变量中 */
    async loadBotIntents(bot_cfg) {
        /** 无配置停止 */
        if (!bot_cfg) return
        QQGuild.BotCfg = {
            /** 加载原有配置 */
            ...BotCfg,
            /** 设置监听的事件 */
            ...await this.addBotCfg(bot_cfg)
        }
        BotCfg = QQGuild.BotCfg
        await this.CreateBot(QQGuild.BotCfg)
    },
    /** 启动机器人并开始监听频道事件消息 */
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
        const { appID, msg } = data
        /** Bot名称 */
        const name = `${BotCfg[appID].name} `
        /** 频道id */
        let GuildId = await QQGuild.bot.GuildId(msg)
        /** 子频道id */
        let channel_id = GuildId ? await QQGuild.bot.channel_id(msg) : null
        /** 操作人id */
        let op_user_id = GuildId ? await QQGuild.bot.op_user_id(msg) : null

        /** 获取频道名称 */
        let Guild_name = GuildId ? QQGuild.guilds?.[GuildId]?.name : null
        /** 获取子频道名称 */
        let channel_name = GuildId && channel_id ? QQGuild.guilds?.[GuildId]?.channels?.[channel_id] : null
        /** 操作人名称 */
        let op_user_name = op_user_id ? (await QQGuild.bot.guildMember(appID, GuildId, op_user_id)).nick : null
        /** 用户名称 */
        let user_name = msg.author?.username || msg.message?.author?.username
        if (!user_name || user_name === "") {
            user_name = (await QQGuild.bot.guildMember(appID, GuildId, msg.author?.id || msg.message?.author.id || msg?.user_id)).nick
        }
        /** 存入响应体中，后续直接调用即可 */
        data.Guild = {
            Bot_name: name,
            GuildId: GuildId,
            channel_id: channel_id,
            op_user_id: op_user_id,
            Guild_name: Guild_name || "",
            channel_name: channel_name || "",
            op_user_name: op_user_name || "",
            user_name: user_name || ""
        }

        switch (data.eventType) {
            case "GUILD_CREATE":
                /** 需要添加个频道、子频道列表到全局变量中 */
                logger.info(`${name}通知：[${msg.name}，操作人:${op_user_name}] Bot已加入频道：${msg.name}`)
                break
            case "GUILD_UPDATE":
                logger.info(`${name}通知：[${Guild_name}]管理员 ${op_user_name} 更改了频道资料`)
                break
            case "GUILD_DELETE":
                logger.info(`${name}通知：[${msg.name}]管理员 ${op_user_name} 将 ${BotCfg[appID].name} 从频道 ${msg.name} 中移除了!`)
                break
            case "CHANNEL_CREATE":
                logger.info(`${name}通知：[${Guild_name}]管理员 ${op_user_name} 已创建子频道：${msg.name}`)
                break
            case "CHANNEL_UPDATE":
                logger.info(`${name}通知：[${Guild_name}]管理员 ${op_user_name} 已更新子频道 ${msg.name} 的资料`)
                break
            case "CHANNEL_DELETE":
                logger.info(`${name}通知：[${Guild_name}]管理员 ${op_user_name} 已删除子频道：${msg.name}`)
                break
            case "GUILD_MEMBER_ADD":
                if (msg.user.bot)
                    logger.info(`${name}通知：[${Guild_name}]管理员 ${op_user_name} 已添加机器人：${msg.nick}`)
                else
                    logger.info(`${name}通知：[${Guild_name}]成员 ${msg.nick} 加入频道！`)
                break
            case "GUILD_MEMBER_REMOVE":
                if (msg.op_user_id === msg.user.id)
                    logger.info(`${name}通知：[${Guild_name}]成员 ${msg.nick} 退出频道！`)
                else
                    logger.info(`${name}通知：[${Guild_name}]管理员 ${op_user_name} 已将 ${msg.nick} 移出频道！`)
                break

            /** 私域消息 */
            case "MESSAGE_CREATE":
                logger.info(`${name}频道消息：[${Guild_name}-${channel_name}，${user_name}] ${this.guild_msg(msg)}`)
                /** 解除私信 */
                if (msg.content === "#QQ频道解除私信") return this.Sendprivate(data)
                /** 转换消息 交由云崽处理 */
                PluginsLoader.deal(await Yunzai.msg(data))
                break
            case "MESSAGE_DELETE":
                if (msg.op_user.id === message.author.id)
                    logger.info(`${name}撤回消息：[${Guild_name}-${channel_name}，${user_name}] ${message.id}`)
                else {
                    const op_name = `${op_user_name} 撤回了 ${user_name}`
                    logger.info(`${name}撤回消息：[${Guild_name}-${channel_name}] ${op_name}的消息：${message.id}`)
                }
                break

            /** 表情动态 */
            case "MESSAGE_REACTION_ADD":
                logger.info(`${name}表情动态：[${Guild_name}-${channel_name}，${user_name}] 为消息 ${msg.target.id} 添加表情 [emoji:${msg.emoji.id}]`)
                break
            case "MESSAGE_REACTION_REMOVE":
                logger.info(`${name}表情动态：[${Guild_name}-${channel_name}，${user_name}] 取消了消息 ${msg.target.id} 的表情 [emoji:${msg.emoji.id}]`)
                break

            /** 私信 */
            case "DIRECT_MESSAGE_CREATE":
                logger.info(`${name}私信：[${Guild_name}-私信，${user_name}] ${this.guild_msg(msg)}`)
                /** 转换消息 交由云崽处理 */
                let e = await Yunzai.msg(data)
                e.message_type = "private"
                e.sub_type = "friend"
                PluginsLoader.deal(e)
                break
            case "DIRECT_MESSAGE_DELETE":
                if (msg.op_user.id === message.author.id)
                    logger.info(`${name}撤回消息：[${Guild_name}-私信，${user_name}] ${message.id}`)
                else {
                    const op_name = `${op_user_name} 撤回了 ${user_name}`
                    logger.info(`${name}撤回消息：[${Guild_name}-私信] ${op_name}的消息：${message.id}`)
                }
                break

            /** 公域事件 仅接收@机器人消息 */
            case "AT_MESSAGE_CREATE":
                logger.info(`${name}频道消息：[${Guild_name}-${channel_name}，${user_name}] ${this.guild_msg(msg)}`)
                /** 解除私信 */
                if (msg.content === "#QQ频道解除私信") return this.Sendprivate(data)
                /** 转换消息 交由云崽处理 */
                PluginsLoader.deal(await Yunzai.msg(data))
                break
            case "PUBLIC_MESSAGE_DELETE":
                if (msg.op_user.id === message.author.id)
                    logger.info(`${name}撤回消息：[${Guild_name}-${channel_name}，${user_name}] ${message.id}`)
                else {
                    const op_name = `${op_user_name} 撤回了 ${user_name}`
                    logger.info(`${name}撤回消息：[${Guild_name}-${channel_name}] ${op_name}的消息：${message.id}`)
                }
                break
            default:
                logger.mark(`${name}[${appID}] 未知事件：`, data)
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
    /** 渲染图片 */
    async picture_reply(old_msg, Api_err) {
        const data = {
            Api_err: Api_err,
            old_msg: old_msg.replace(/\n/g, "\\n"),
            saveId: 'msg_error',
            _plugin: 'msg_error',
            tplFile: './plugins/QQGuild-plugin/resources/error_msg.html',
        }
        return (await puppeteer.screenshot(`msg_error/msg_error`, data)).file
    },

    /**
     * 转换消息为api可接收格式
     * https://bot.q.qq.com/wiki/develop/nodesdk/
     * @param {Object} data - api下发的对象
     * @param {Object|Array|string} msg - 回复的消息
     * @param {boolean} reference - 是否回复引用消息
     */
    async reply_msg(data, msg, reference) {
        /** 引用消息存入响应体中，方便调用 */
        data.reply = { reference: reference }
        /** 统一格式 */
        let newMsg = await this.formatUnify(msg)
        /** 转换为频道api格式 */
        let Api_msg = await this.Api_msg(data, newMsg, reference)
        /** 打印回复消息日志并组装请求参数 */
        return await this.reqConfig(data, Api_msg, reference)
    },
    /** 将云崽过来的消息全部统一格式存放到数组里面 */
    async formatUnify(msg) {
        let newMsg = []
        /** 将格式统一为对象 随后进行转换成api格式 */
        if (msg?.[1]?.data?.type === "test") {
            newMsg.push({ type: "forward", text: msg[0] })
            newMsg.push(...msg[1].msg)
        } else if (msg?.data?.type === "test") {
            newMsg.push(...msg.msg)
        } else if (Array.isArray(msg)) {
            newMsg = [].concat(...msg.map(i => (
                typeof i === "string" ? [{ type: "text", text: i }] :
                    Array.isArray(i) ? [].concat(...i.map(format => (
                        typeof format === "string" ? [{ type: "text", text: format }] :
                            typeof format === "object" && format !== null ? [format] : []
                    ))) :
                        typeof i === "object" && i !== null ? [i] : []
            )))
        } else if (typeof msg === "object") {
            newMsg.push(msg)
        } else {
            newMsg.push({ type: "text", text: msg })
        }
        return newMsg
    },
    /** 转为api格式 */
    async Api_msg(data, newMsg, reference) {
        let image = {}
        let content = ""
        const msg = data.msg

        for (const i of newMsg) {
            /** 太快了 太快了！ */
            await new Promise((resolve) => setTimeout(resolve, 300))
            switch (i.type) {
                case "at":
                    if (i.text === msg?.author?.username)
                        content += `<@${msg?.author?.id}>`
                    else if (i.qq === 0 || i.qq) {
                        content += `<@${i.id}>`
                    } else {
                        content += `<@${i.qq}>`
                    }
                    break
                case "face":
                    content += `<emoji:${i.text}>`
                    break
                case "text":
                    content += await this.urlHandler(data, i.text)
                    break
                case "image":
                    /** 多图片只保留第一个一起发 其他分片发送 */
                    if (Object.keys(image).length > 0) {
                        this.reqConfig(data, await this.imgFormatUniform(i), reference)
                    } else {
                        image = await this.imgFormatUniform(i)
                    }
                    break
                case "forward":
                    /** 转发消息 */
                    if (QQGuild.config.分片转发) {
                        this.reqConfig(data, { content: await this.urlHandler(data, i.text), ...image }, reference)
                    } else {
                        content += await this.urlHandler(data, `${i.text}\n\n`)
                    }
                    break
                default:
                    content += JSON.stringify(i)
                    break
            }
        }

        content = content.replace(/\n{1,2}$/g, '').replace(/\n{3,4}/g, '\n')
        const Api_msg = { content: content, ...image }
        return Api_msg
    },
    /** 对url进行特殊处理，防止发送失败 */
    async urlHandler(data, msg) {
        if (typeof msg !== 'string') return msg
        const urls = QQGuild.config.url白名单
        const whiteRegex = new RegExp(`\\b(${urls.map(url => url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
        /** 如果是包含白名单内链接，则不作任何处理，直接返回 */
        if (msg.match(whiteRegex)) {
            return msg
        } else {
            const urlRegex = /(https?:\/\/)?(([0-9a-z.]+\.[a-z]+)|(([0-9]{1,3}\.){3}[0-9]{1,3}))(:[0-9]+)?(\/[0-9a-z%/.\-_]*)?(\?[0-9a-z=&%_\-]*)?(\#[0-9a-z=&%_\-]*)?/ig
            if (urlRegex.test(msg)) {
                /** 将url转二维码 */
                return msg.replace(urlRegex, url => {
                    qrcode.toBuffer(url, {
                        errorCorrectionLevel: 'H',
                        type: 'png',
                        margin: 4,
                    }, async (err, buffer) => {
                        if (err) throw err
                        const Api_msg = { content: null, type: "file_image", image: buffer, log: "[图片：base64://...]" }
                        this.reqConfig(data, Api_msg, false)
                    })
                    return "{请扫码查看链接}"
                })
            }
            return msg
        }
    },
    /** 处理各种牛马格式的图片 返回二进制base64 { type, image: base64, log } TMD */
    async imgFormatUniform(msg) {
        let log = `[图片：base64://...]`
        let type = "file_image"
        let base64
        /** 米游社公告类 */
        if (msg.type === "image") {
            const file = msg.file
            let img = "./plugins/QQGuild-plugin/data/image/"
            /** 套娃的二进制base64 */
            if (msg.file.type === "Buffer") {
                base64 = msg.file.data
            }
            /** 二进制转字符串 */
            else if (file instanceof Uint8Array) {
                base64 = file
            }
            /** 检测是否为频道下发图片 复读表情包用... */
            else if (typeof file === "string" && msg.url) {
                img = img + msg.file
                log = `[图片：${img}]`
                if (!fs.existsSync(img)) await Yunzai.download_img(`https://${msg.url}`, file)
                base64 = fs.readFileSync(img)
            }
            /** 本地文件转成base64 */
            else if (typeof file === "string" && file.includes("file://")) {
                log = `[图片：${file}]`
                base64 = fs.readFileSync(file.replace(/^file:(\/\/\/|\/\/)/, ""))
            }
            /** 判断url是否为白名单，否则缓存图片转为二进制 */
            else if (typeof file === "string" && /^(https|http):\/\//.test(file)) {
                const urls = QQGuild.config.url白名单
                const whiteRegex = new RegExp(`\\b(${urls.map(url =>
                    url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
                if (!file.match(whiteRegex)) {
                    log = `[图片：${img}]`
                    img = img + file.split('/').pop()
                    if (!fs.existsSync(img)) await Yunzai.download_img(file, file.split('/').pop())
                    base64 = fs.readFileSync(img)
                } else {
                    log = `[图片：${file}]`
                    type = "url"
                    base64 = file
                }
            }
            /** 字符串格式的base64 */
            else if (typeof file === "string") {
                base64 = file.replace(/^base64:\/\//, "")
            } else {
                logger.error("未适配字段，请反馈到仓库:", msg)
            }
        }
        return { type, image: base64, log }
    },
    /** 构建请求参数并打印日志 */
    async reqConfig(data, Api_msg, reference) {
        let logs = ""
        let SendMsg = {}
        const { msg, Guild } = data
        const { content, type, image, log } = Api_msg
        const { Bot_name, Guild_name, channel_name, user_name } = Guild

        /** 判断是否存在base64 引用消息无法实现file_image格式的图片引用 */
        if (type === "file_image") {
            logs += log
            SendMsg = new FormData()
            if (msg?.id) SendMsg.set("msg_id", msg.id)
            /** 文本 */
            if (content) {
                logs += content
                SendMsg.set("content", content)
                /** 存一份原始消息，用于后续发送失败渲染图片 */
                data.Guild.content = content
            }
            SendMsg.set("file_image", new Blob([image]))
        }
        /** url */
        else if (type === "url") {
            logs += Api_msg.log
            /** 引用消息 */
            if (reference) {
                SendMsg.message_reference = { message_id: msg?.id, ignore_get_message_error: true }
            }
            SendMsg.image = image
            if (msg?.id) SendMsg.msg_id = msg.id
            /** 文本 */
            if (content) {
                logs += content
                SendMsg.content = content
                /** 存一份原始消息，用于后续发送失败渲染图片 */
                data.Guild.content = content
            }
        }
        /** 纯文本消息 */
        else {
            logs += content
            /** 引用消息 */
            if (reference) {
                SendMsg.message_reference = { message_id: msg?.id, ignore_get_message_error: true }
            }
            if (msg?.id) SendMsg.msg_id = msg.id
            /** 文本 */
            if (content) {
                logs += content
                SendMsg.content = content
                /** 存一份原始消息，用于后续发送失败渲染图片 */
                data.Guild.content = content
            }
        }

        switch (data.eventType) {
            /** 私信 */
            case "DIRECT_MESSAGE_CREATE":
                logger.info(`${Bot_name}发送消息：[${Guild_name}-私信，${user_name}] ${logs}`)
                break
            case "MESSAGE_CREATE":
                logger.info(`${Bot_name}发送消息：[${Guild_name}-${channel_name}，${user_name}] ${logs}`)
                break
            case "AT_MESSAGE_CREATE":
                logger.info(`${Bot_name}发送消息：[${Guild_name}-${channel_name}，${user_name}] ${logs}`)
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
            /** 判断频道还是私聊 */
            data.eventType === "DIRECT_MESSAGE_CREATE"
                ? res = await BotCfg[appID].client.directMessageApi.postDirectMessage(msg.guild_id, SendMsg)
                : res = await BotCfg[appID].client.messageApi.postMessage(msg.channel_id, SendMsg)
        } catch (error) {
            logger.error(`${Bot_name} 发送消息错误，正在转成图片重新发送...\n错误信息：`, error)
            /** 转换为图片发送 */
            let Resend = new FormData()
            if (msg?.id) Resend.set("msg_id", msg.id)
            Resend.set("file_image", new Blob([await this.picture_reply(data.Guild?.content || "啊咧，图片发不出来呀", error)]))

            /** 判断频道还是私聊 */
            data.eventType === "DIRECT_MESSAGE_CREATE"
                ? res = await BotCfg[appID].client.directMessageApi.postDirectMessage(msg.guild_id, Resend)
                : res = await BotCfg[appID].client.messageApi.postMessage(msg.channel_id, Resend)
        }
        /** 返回消息id给撤回用？ */
        return {
            seq: res.data.seq_in_channel,
            rand: 1,
            time: parseInt(Date.parse(res.data.timestamp) / 1000),
            message_id: res.data.id
        }
    }
}

/** 加载机器人 */
QQGuild_Bot.loadBotIntents(QQGuild.config.bot)

/** 加载一下插件到主体... */
let ret = await Promise.allSettled([import('./model/Yunzai.js')])
let apps = { Yunzai: ret[0].value[Object.keys(ret[0].value)[0]] }
export { apps }
