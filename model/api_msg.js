import fs from "fs"
import Api from "./api.js"
import qrcode from "qrcode"
import fetch from "node-fetch"
import { FormData, Blob } from "node-fetch"
import common from "../../../lib/common/common.js"
import puppeteer from "../../../lib/puppeteer/puppeteer.js"


export default new class api_msg {
    /** 处理消息 */
    async message(data, msg, reference) {
        this.id = data.id
        this.reference = reference
        /** 统一为数组 */
        msg = this.formatUnify(msg)
        /** 转为api格式、打印日志、发送 */
        return await this.Api_msg(data, msg)
    }

    /** 将云崽过来的消息全部统一格式存放到数组里面 */
    formatUnify(msg) {
        let newMsg = []
        /** 将格式统一为对象 随后进行转换成api格式 */
        if (msg?.[1]?.data?.type === "test") {
            newMsg.push({ type: "forward", text: msg[0] })
            newMsg.push(...msg[1].msg)
        }
        else if (msg?.data?.type === "test") {
            newMsg.push(...msg.msg)
        }
        else if (Array.isArray(msg)) {
            newMsg = [].concat(...msg.map(i => (
                typeof i === "string" ? [{ type: "text", text: i }] :
                    Array.isArray(i) ? [].concat(...i.map(format => (
                        typeof format === "string" ? [{ type: "text", text: format }] :
                            typeof format === "object" && format !== null ? [format] : []
                    ))) :
                        typeof i === "object" && i !== null ? [i] : []
            )))
        }
        else if (msg instanceof fs.ReadStream) {
            newMsg.push({ type: "image", file: `./${msg.file.path}` })
        }
        else if (msg instanceof Uint8Array) {
            newMsg.push({ type: "image", file: msg })
        }
        else if (typeof msg === "object") {
            newMsg.push(msg)
        }
        else {
            newMsg.push({ type: "text", text: msg })
        }
        return newMsg
    }

    /** 转为api格式 */
    async Api_msg(data, msg) {
        let image = {}
        let content = []
        const data_msg = data.msg
        /** chatgpt-plugin */
        if (msg?.[0].type === "xml") msg = msg?.[0].msg

        for (const i of msg) {
            /** 加个延迟防止过快 */
            await common.sleep(200)
            switch (i.type) {
                case "at":
                    if (i.text === data_msg?.author?.username)
                        content.push(`<@${data_msg?.author?.id}>`)
                    else if (i.qq == 0) {
                        content.push(`<@${String(i.id).replace("qg_", "")}>`)
                    }
                    else {
                        content.push(`<@${String(i.qq).replace("qg_", "")}>`)
                    }
                    break
                case "face":
                    content.push(`<emoji:${i.text}>`)
                    break
                case "text":
                    content.push(await this.urlHandler(data, i.text))
                    break
                case "image":
                    /** 多图片只保留第一个一起发 其他分片发送 */
                    const img = await this.Base64(i)
                    if (Object.keys(image).length > 0) {
                        /** 延迟下... */
                        await common.sleep(200)
                        /** 构建请求参数、打印日志 */
                        const SendMsg = await this.Construct_data(data, img)
                        await this.SendMsg(data, SendMsg)
                    } else {
                        image = img
                    }
                    break
                case "forward":
                    /** 转发消息 */
                    if (Bot.qg.cfg.forwar) {
                        /** 延迟下... */
                        await common.sleep(200)
                        /** 构建请求参数、打印日志 */
                        const SendMsg = await this.Construct_data(data, { content: await this.urlHandler(data, i.text), ...image || null })
                        await this.SendMsg(data, SendMsg)
                    } else {
                        content.push(await this.urlHandler(data, `${i.text}\n\n`))
                    }
                    break
                default:
                    content.push(JSON.stringify(i))
                    break
            }
        }
        
        content = content.join("").replace(/\n{1,2}$/g, '').replace(/\n{3,4}/g, '\n')
        const Api_msg = { content: content, ...image }
        if (!content && content === "" && Object.keys(image).length === 0) return
        const SendMsg = await this.Construct_data(data, Api_msg)
        return await this.SendMsg(data, SendMsg)
    }

    /** 对url进行特殊处理，防止发送失败 */
    async urlHandler(data, msg) {
        /** 延迟下... */
        await new Promise((resolve) => setTimeout(resolve, 500))
        if (typeof msg !== 'string') return msg
        const urls = Bot.qg.cfg.whitelist_Url
        const whiteRegex = new RegExp(`\\b(${urls.map(url => url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
        /** 将url转二维码 */
        if (!msg.match(whiteRegex)) {
            const urlRegex = /(https?:\/\/)?(([0-9a-z.-]+\.[a-z]+)|(([0-9]{1,3}\.){3}[0-9]{1,3}))(:[0-9]+)?(\/[0-9a-z%/.\-_#]*)?(\?[0-9a-z=&%_\-.]*)?(\#[0-9a-z=&%_\-]*)?/ig
            if (urlRegex.test(msg)) {
                /** 将url转二维码 */
                return msg.replace(urlRegex, url => {
                    // try { new URL(url) } catch (error) { return url }
                    logger.info(logger.green(`未通过url白名单，正在转为二维码发送...\n初始URL：${url}`))
                    qrcode.toBuffer(url, {
                        errorCorrectionLevel: 'H',
                        type: 'png',
                        margin: 4,
                        text: url // 添加文本
                    }, async (err, buffer) => {
                        if (err) throw err
                        const Api_msg = { content: null, type: "file_image", image: buffer, log: "[图片：base64://...]" }
                        /** 构建请求参数、打印日志 */
                        const SendMsg = await this.Construct_data(data, Api_msg, false)
                        await this.SendMsg(data, SendMsg)
                    })
                    return "{请扫码查看链接}"
                })
            }
            return msg
        } else {
            return msg
        }
    }

    /** 处理各种牛马格式的图片 返回二进制base64 { type, image: base64, log } TMD */
    async Base64(msg) {
        let log = `[图片：base64://...]`
        let type = "file_image"
        let base64
        /** 米游社公告类 */
        const file = msg.file
        /** 套娃的二进制base64 */
        if (msg.file.type === "Buffer") {
            if (!(msg.file.data instanceof Uint8Array)) {
                base64 = new Uint8Array(msg.file.data)
            } else {
                base64 = msg.file.data
            }
        }
        /** 天知道从哪里蹦出来的... */
        else if (file instanceof fs.ReadStream) {
            base64 = fs.readFileSync(`./${msg.file.path}`)
        }
        /** Uint8Array */
        else if (file instanceof Uint8Array) {
            base64 = file
        }

        /** 检测是否为频道下发图片 复读表情包用... */
        else if (typeof file === "string" && msg.url) {
            base64 = new Uint8Array(await (await fetch(msg.url)).arrayBuffer())
        }
        /** 本地文件转成base64 */
        else if (typeof file === "string" && fs.existsSync(file.replace(/^file:[/]{0,3}/, ""))) {
            base64 = fs.readFileSync(file.replace(/^file:[/]{0,3}/, ""))
        }
        /** 判断url是否为白名单，否则缓存图片转为二进制 */
        else if (typeof file === "string" && /^(https|http):\/\//.test(file)) {
            const urls = Bot.qg.cfg.whitelist_Url
            const whiteRegex = new RegExp(`\\b(${urls.map(url =>
                url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
            if (!file.match(whiteRegex)) {
                /** 下载图片转为base64 */
                base64 = new Uint8Array(await (await fetch(file)).arrayBuffer())
            } else {
                log = `[图片：${file}]`
                type = "url"
                base64 = file
            }
        }
        /** 字符串格式的base64 */
        else if (typeof file === "string") {
            base64 = Buffer.from(file.replace(/^base64:\/\//, ""), "base64")
        } else {
            logger.error("未适配字段，请反馈:", msg)
        }
        return { type, image: base64, log }
    }

    /** 构建请求参数并打印日志 */
    async Construct_data(data, Api_msg) {
        let logs = ""
        let SendMsg = {}
        const { msg } = data
        const { content, type, image, log } = Api_msg
        switch (type) {
            case "file_image":
                logs += log
                SendMsg = new FormData()
                if (msg?.id) SendMsg.set("msg_id", msg.id)
                SendMsg.set("file_image", new Blob([image]))
                break
            case "url":
                logs += Api_msg.log
                /** 引用消息 */
                if (this.reference) {
                    SendMsg.message_reference = {
                        message_id: msg?.id,
                        ignore_get_message_error: true
                    }
                }
                SendMsg.image = image
                if (msg?.id) SendMsg.msg_id = msg.id
                break
            default:
                /** 引用消息 */
                if (this.reference) {
                    SendMsg.message_reference = {
                        message_id: msg?.id,
                        ignore_get_message_error: true
                    }
                }
                if (msg?.id) SendMsg.msg_id = msg.id
                break
        }
        /** 文本 */
        if (content) {
            if (SendMsg instanceof FormData) {
                SendMsg.set("content", content)
            } else {
                SendMsg.content = content
            }
            logs += content

            /** 存一份原始消息，用于后续发送失败渲染图片 */
            data.content = content
        }
        this.log(data, logs)
        return SendMsg
    }

    /** 打印日志 */
    log(data, logs) {
        const { group_name } = data
        const bot = `${Bot[this.id].name} 发送消息：`
        switch (data.eventType) {
            /** 私信 */
            case "DIRECT_MESSAGE_CREATE":
                logger.info(`${bot}[${group_name}] ${logs}`)
                break
            case "MESSAGE_CREATE":
                logger.info(`${bot}[${group_name}] ${logs}`)
                break
            case "AT_MESSAGE_CREATE":
                logger.info(`${bot}[${group_name}] ${logs}`)
                break
            default:
                logger.error("未知场景：", data)
        }
    }

    /** 向API发送消息 */
    async SendMsg(data, SendMsg) {
        const { msg } = data
        const { guild_id, channel_id, id } = msg

        /** 发送消息并储存res */
        let res
        try {
            /** 判断频道还是私聊 */
            data.eventType === "DIRECT_MESSAGE_CREATE"
                ? res = await Api.postDirectMessage(this.id, guild_id, SendMsg)
                : res = await Api.postMessage(this.id, channel_id, SendMsg)
        } catch (error) {
            logger.error(`${Bot[this.id].name} 发送消息错误，正在转成图片重新发送...\n错误信息：`, error)
            /** 转换为图片发送 */
            let image = new FormData()
            if (id) image.set("msg_id", id)

            let content = null
            if (data?.content) content = data?.content?.replace(/\n/g, "\\n")
            image.set("file_image", new Blob([await this.picture_reply(content || "啊咧，图片发不出来", error)]))

            /** 判断频道还是私聊 */
            data.eventType === "DIRECT_MESSAGE_CREATE"
                ? res = await Api.postDirectMessage(this.id, guild_id, image)
                : res = await Api.postMessage(this.id, channel_id, image)
        }
        /** 返回消息id给撤回用？ */
        return {
            seq: res.seq_in_channel,
            rand: 1,
            time: parseInt(Date.parse(res.timestamp) / 1000),
            message_id: res.id
        }
    }

    /** 渲染图片 */
    async picture_reply(content, error) {
        const data = {
            Yz: Bot.qg.YZ,
            error: error,
            guild: Bot.qg.guild.ver,
            msg: content,
            saveId: 'QQGuild-plugin',
            _plugin: 'QQGuild-plugin',
            tplFile: './plugins/QQGuild-plugin/resources/error_msg.html',
        }
        return (await puppeteer.screenshot(`QQGuild-plugin/QQGuild-plugin`, data)).file
    }

}