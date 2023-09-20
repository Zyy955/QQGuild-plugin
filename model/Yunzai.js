import fs from "fs"
import fetch from "node-fetch"
import { ws } from "./ws.js"

const api = qg.api

export let Yunzai = {
    /** 构建Yunzai的message */
    async message(data) {
        let atme = false
        let message = []
        let raw_message = ""
        const { appID, msg } = data
        const BotCfg = qg.ws

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
                    let at_user = i.slice(3, -1)
                    const name = at_name(at_user)
                    if (BotCfg[appID].id === at_user) {
                        at_user = Bot.uin
                        atme = true
                    } else {
                        at_user = `qg_${at_user}`
                    }
                    raw_message += name
                    message.push({ type: "at", text: name, qq: at_user })
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
        const BotCfg = qg.ws
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
                await api.muteMember(appID, msg.guild_id, msg.author.id, options)
            },
            /** 踢 */
            kick: async () => {
                await api.deleteGuildMember(appID, msg.guild_id, msg.author.id)
            }
        }

        let e = {
            atBot: atme,
            adapter: "QQGuild",
            message: [...message],
            raw_message: raw_message,
            appID: appID,
            uin: qg.ws[appID].id,
            author: msg.author,
            mentions: msg.mentions,
            post_type: "message",
            message_id: msg.id,
            user_id: "qg_" + msg.author.id,
            time,
            message_type: "group",
            sub_type: "normal",
            sender: {
                user_id: msg.author.id,
                nickname: msg.author.username,
                card: msg.author.username,
                role,
            },
            group_id: "qg_" + msg.guild_id + "-" + msg.channel_id,
            guild_id: msg.guild_id,
            channel_id: msg.channel_id,
            group_name: `${qg.guilds[msg.guild_id]?.channels[msg.channel_id] || '私信'}`,
            self_id: appID,
            font: "宋体",
            seq: msg.seq,
            atme: atme,
            member,
            friend: {
                sendMsg: async (reply, reference) => {
                    return await ws.reply(data, reply, reference)
                },
                recallMsg: (msg_id) => {
                    logger.info(`${BotCfg[appID].name} 撤回消息：${msg_id}`)
                    return BotCfg[appID].client.messageApi.deleteMessage(msg.channel_id, msg_id, false)
                },
                makeForwardMsg: async (forwardMsg) => {
                    return await Yunzai.makeForwardMsg(forwardMsg, data)
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
                    return await ws.reply(data, reply, reference)
                },
                makeForwardMsg: async (forwardMsg) => {
                    return await Yunzai.makeForwardMsg(forwardMsg, data)
                }
            },
            recall: () => {
                logger.info(`${BotCfg[appID].name} 撤回消息：${msg.id}`)
                return BotCfg[appID].client.messageApi.deleteMessage(msg.channel_id, msg.id, false)
            },
            reply: async (reply, reference) => {
                return await ws.reply(data, reply, reference)
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
            const _reference = (await api.message(appID, msg.channel_id, msg.message_reference.message_id)).message
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
        return e
    },
    makeForwardMsg: async (forwardMsg, data = {}) => {
        const messages = {}
        const newmsg = []

        /** 针对无限套娃的转发进行处理 */
        for (const i_msg of forwardMsg) {
            const for_msg = i_msg.message
            /** 套娃转发 */
            if (typeof for_msg === "object" && (for_msg?.data?.type === "test" || for_msg?.type === "xml")) {
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
            else if (typeof for_msg === "object" && /^#.*日志$/.test(data?.msg?.content)) {
                const splitMsg = for_msg.split("\n").map(i => {
                    if (!i || i.trim() === "") return
                    if (qg.cfg.cfg.分片转发) {
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
        messages.data = { type: "test", text: "forward", app: "com.tencent.multimsg", meta: { detail: { news: [{ text: "1" }] }, resid: "", uniseq: "", summary: "" } }
        return messages
    }
}