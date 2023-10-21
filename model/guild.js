import Api from "./api.js"
import log_msg from "./log.js"
import message from "./message.js"
import QQGuildLoader from "../plugins/loader.js"
import pluginsLoader from "../../../lib/plugins/loader.js"
import { createOpenAPI, createWebsocket } from "qq-guild-bot"

export default class guild {
    /** 创建连接 */
    async monitor(cfg) {
        /** 加载配置 */
        for (let i in cfg) {
            if (i === "default") continue
            /** ID 用于识别是哪个机器人 */
            let id = cfg[i].appID

            if (!cfg[i][id]?.intents) {
                /** 监听事件 */
                const intents = ["GUILDS", "GUILD_MEMBERS", "GUILD_MESSAGE_REACTIONS", "DIRECT_MESSAGE"]
                /** 接收全部消息 */
                if (cfg[i].allMsg) intents.push("GUILD_MESSAGES")
                /** 接收AT消息 */
                else intents.push("PUBLIC_GUILD_MESSAGES")
                /** 添加监听事件 */
                cfg[i].intents = intents
            }

            /** 保存到全局变量中 */
            Bot[id] = cfg[i]
            /** 创建 client */
            Bot[id].client = createOpenAPI(Bot[id])
            /** 创建 websocket 连接 */
            Bot[id].ws = createWebsocket(Bot[id])
            /** 建立ws链接 监听bot频道列表、频道资料、列表变化事件 */
            Bot[id].ws.on('GUILDS', (data) => { data.id = id, this.event(data) })
            /** 建立ws链接 监听频道成员变化事件 */
            Bot[id].ws.on('GUILD_MEMBERS', (data) => { data.id = id, this.event(data) })
            /** 建立ws链接 监听私信消息 */
            Bot[id].ws.on('DIRECT_MESSAGE', (data) => { data.id = id, this.event(data) })
            /** 建立ws链接 监听私域事件 */
            Bot[id].ws.on('GUILD_MESSAGES', (data) => { data.id = id, this.event(data) })
            /** 建立ws链接 监听公域事件 */
            Bot[id].ws.on('PUBLIC_GUILD_MESSAGES', (data) => { data.id = id, this.event(data) })
            /** 建立ws链接 监听表情动态事件 */
            Bot[id].ws.on('GUILD_MESSAGE_REACTIONS', (data) => { data.id = id, this.event(data) })


            /** 保存bot的信息 */
            await this.me(id)
            /** 延迟下 */
            await this.sleep(200)
            /** 获取一些基本信息 */
            await this.guilds(id)
        }
    }

    /** @param ms 毫秒 */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    /** 保存bot的信息 */
    async me(id) {
        const bot = await Api.me(id)
        /** 机器人名称 */
        this.name = bot.username
        /** 机器人的频道id */
        this.guild_id = bot.id

        /** 保存到全局变量中 */
        Bot[id].id = bot.id
        Bot[id].name = bot.username
        Bot[id].avatar = bot.avatar
    }

    /** 获取一些基本信息 */
    async guilds(id) {
        /** 加载机器人所在频道、将对应的子频道信息存入变量中用于后续调用 */
        const meGuilds = await Api.meGuilds(id)

        for (let qg of meGuilds) {
            /** 保存一些初始配置 */
            const guildInfo = { ...qg, channels: {} }
            Bot.qg.guilds[qg.id] = guildInfo
            Bot.qg.guilds[qg.id].id = id

            /** 延迟下 */
            await this.sleep(200)
            /** 判断机器人是否为超级管理员 */
            try {
                const admin = await Api.guildMember(id, qg.id, user.id)
                Bot.qg.guilds[qg.id].admin = admin.roles.includes("2") ? true : false
            } catch (err) {
                Bot.qg.guilds[qg.id].admin = false
            }

            try {
                /** 添加子频道列表到Bot.gl中，用于主动发送消息 */
                const channelList = await Api.channels(id, qg.id)
                for (const i of channelList) {
                    const guild_name = Bot.qg.guilds[i.guild_id]?.name || ""
                    Bot.gl.set(`qg_${i.guild_id}-${i.id}`, {
                        id: id,
                        group_id: `qg_${i.guild_id}-${i.id}`,
                        group_name: guild_name ? `${guild_name}-${i.name}` : "未知",
                        guild_id: i.guild_id,
                        guild_name: guild_name,
                        channel_id: i.id,
                        channel_name: i.name
                    })
                }

                /** 忘了干啥的... */
                for (let subChannel of channelList) {
                    guildInfo.channels[subChannel.id] = subChannel.name
                }
            } catch (err) {
                logger.error(`QQ频道机器人 [${this.name}(${id}) 无权在 [${qg.name}] 获取子频道列表...请在机器人设置-权限设置-频道权限中，给予基础权限...`)
            }
        }

        try {
            /** 米游社主动推送、椰奶状态pro */
            if (!Bot?.adapter) {
                Bot.adapter = [Bot.uin]
                Bot.adapter.push(id)
            } else {
                Bot.adapter.push(id)
                /** 去重防止断连后出现多个重复的id */
                Bot.adapter = Array.from(new Set(Bot.adapter.map(JSON.stringify))).map(JSON.parse)
            }
            Bot[id] = {
                ...Bot[id],
                uin: id,
                [id]: id,
                nickname: this.name.replace("-测试中", ""),
                avatar: Bot[id].avatar,
                stat: { start_time: Date.now() / 1000 },
                apk: { display: Bot.qg.guild.name, version: Bot.qg.guild.ver },
                fl: new Map(),
                gl: new Map(),
                version: { id: "qg", name: "QQ频道Bot", version: Bot.qg.guild.guild_ver },
                pickGroup: (groupId) => {
                    const [guild_id, channel_id] = groupId.replace("qg_", "").split('-')
                    const data = {
                        id: id,
                        msg: {
                            guild_id: guild_id,
                            channel_id: channel_id
                        },
                        eventType: "MESSAGE_CREATE"
                    }
                    return {
                        sendMsg: (reply, reference = false) => {
                            return this.reply(data, reply, reference)
                        },
                        makeForwardMsg: async (forwardMsg) => {
                            return await message.makeForwardMsg(forwardMsg)
                        },
                    }
                }
            }
            logger.mark(`${logger.green(`[QQ频道]${this.name}(${id})连接成功~`)}`)
            /** 检测是否重启 */
            const restart = await redis.get("qg:restart")
            if (restart) if (JSON.parse(restart).appID === id) await this.init(restart)
        } catch (error) {
            logger.error(error)
        }
    }

    /** 根据对应事件进行对应处理 */
    async event(data) {
        switch (data.eventType) {
            /** 私域 */
            case "MESSAGE_CREATE":
                await this.permissions(data)
                break
            /** 私信 */
            case "DIRECT_MESSAGE_CREATE":
                await this.permissions(data, "私信")
                break
            /** 公域事件 仅接收@机器人消息 */
            case "AT_MESSAGE_CREATE":
                await this.permissions(data)
                break
            /** 其他事件不需要给云崽、直接单独处理即可 */
            default:
                await log_msg.event(data)
                break
        }
    }

    async permissions(data, type = "") {
        const cfg = Bot.qg.cfg
        const { guild_id, channel_id } = data.msg

        /** 过频道黑白名单结果 */
        const guild = this.checkBlack(cfg, `qg_${guild_id}`)
        /** 过子频道黑白名单结果 别问为啥一起过...懒 */
        const channel = this.channel_checkBlack(cfg, String(channel_id))

        if (guild && channel) {
            data.checkBlack = true
            return await QQGuildLoader.deal.call(pluginsLoader, await message.msg(data, type))
        } else {
            data.checkBlack = false
            return await message.msg(data, type)
        }
    }

    /** 判断频道黑白名单 */
    checkBlack(cfg, guild_id) {
        /** 过白名单频道 */
        if (Array.isArray(cfg.whitelist) && cfg.whitelist.length > 0) {
            return cfg.whitelist.includes(String(guild_id))
        }
        /** 过黑名单频道 */
        if (Array.isArray(cfg.blacklist) && cfg.blacklist.length > 0) {
            return !cfg.blacklist.includes(String(guild_id))
        }
        return true
    }

    /** 判断子频道黑白名单 */
    channel_checkBlack(cfg, channel_id) {
        /** 过白名单子频道 */
        if (Array.isArray(cfg.channel_whitelist) && cfg.channel_whitelist.length > 0) {
            return cfg.channel_whitelist.includes(String(channel_id))

        }
        /** 过黑名单子频道 */
        if (Array.isArray(cfg.channel_blacklist) && cfg.channel_blacklist.length > 0) {
            return !cfg.channel_blacklist.includes(String(channel_id))
        }
        return true
    }

    /** 处理消息、转换格式 */
    async reply(data, msg, reference) {
        if (msg === "开始执行重启，请稍等...") await this.restart(data)
        /** 处理云崽过来的消息 */
        const SendMsg = (await import("./SendMsg.js")).default
        return await SendMsg.message(data, msg, reference)
    }

    /** 保存重启到redis中 */
    async restart(data) {
        const type = data.eventType === "DIRECT_MESSAGE_CREATE" ? "私信" : "群聊"
        const { id, guild_id, channel_id } = data.msg
        const cfg = JSON.stringify({
            type: type,
            time: new Date().getTime(),
            appID: data.id,
            id: id,
            guild_id: guild_id,
            channel_id: channel_id,
        })
        await redis.set("qg:restart", cfg, { EX: 120 })
    }

    /** 发送主动消息 解除私信限制 */
    Sendprivate = async (data) => {
        const { id, msg } = data
        const new_msg = {
            source_guild_id: msg.guild_id,
            recipient_id: msg.author.id
        }
        const _data = await Api.createDirectMessage(id, new_msg)
        const hi = "QQGuild-plugin：你好~"
        logger.info(`${this.name} 发送私信消息：${hi}`)
        await Api.postDirectMessage(id, _data.data.guild_id, { content: hi })
    }

    /** 重启后发送主动消息 */
    async init(restart) {
        const cfg = JSON.parse(restart)
        const { type, appID, id, guild_id, channel_id } = cfg
        const time = (new Date().getTime() - cfg.time || new Date().getTime()) / 1000
        const msg = `重启成功：耗时${time.toFixed(2)}秒`
        if (type === "私信") {
            await Api.postDirectMessage(appID, guild_id, { content: msg, msg_id: id })
        } else {
            await Api.postMessage(appID, channel_id, { content: msg, msg_id: id })
        }
        redis.del("qg:restart")
    }
}