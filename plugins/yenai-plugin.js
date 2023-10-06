import _ from 'lodash'
import { createRequire } from 'module'
import moment from 'moment'
import os from 'os'
import { Config, Version, Plugin_Name } from '../../yenai-plugin/components/index.js'
import { status } from '../../yenai-plugin/constants/other.js'
import { State, common, puppeteer } from '../../yenai-plugin/model/index.js'
const require = createRequire(import.meta.url)
import Api from '../model/api.js'

let interval = false

/** 劫持原有禁言方法 */
let yenai_plugin = {
    async yenai() {
        const YenaiClass = (await import("../../yenai-plugin/model/GroupAdmin.js")).default
        const cfg = (await import("../../../lib/config/config.js")).default
        /** 保存原有方法 */
        const yenai_old = {
            muteMember: YenaiClass.prototype.muteMember,
            kickMember: YenaiClass.prototype.kickMember,
        }
        /** 踹 */
        YenaiClass.prototype.kickMember = async function (groupId, userId, executor) {
            if (String(groupId).includes("qg_")) {
                try {
                    userId = userId.replace("qg_", "")
                    const ids = groupId.replace("qg_", "").split("-")
                    const [guildID, channels] = ids
                    /** 获取appID */
                    let appID = Bot.qg.guilds[guildID].id || null
                    if (!appID) throw Error('❎ 这个群没有这个人哦~')
                    if (cfg.masterQQ?.includes(userId) && time != 0) throw Error('居然调戏主人！！！哼，坏蛋(ﾉ｀⊿´)ﾉ')

                    if (!Bot.qg.guilds[guildID].admin) throw Error('我连管理员都木有，这种事怎么可能做到的辣！！！')
                    if (cfg.masterQQ?.includes(userId) && time != 0) throw Error('居然调戏主人！！！哼，坏蛋(ﾉ｀⊿´)ﾉ')

                    /** 获取用户身份组 */
                    const user = await Api.guildMember(appID, guildID, userId)
                    if (user.roles.includes("2", "4", "5")) throw Error('这个淫系管理员辣，只有主淫和频道主才可以干ta')
                    await Api.deleteGuildMember(appID, guildID, userId)
                    return '已把这个坏淫踢掉惹！！！'
                } catch (err) {
                    return err
                }
            } else {
                return yenai_old.kickMember.call(this, groupId, userId, executor)
            }
        }
        /** 禁言 */
        YenaiClass.prototype.muteMember = async function (groupId, userId, executor, time = 300, unit = '秒') {
            if (String(groupId).includes("qg_")) {
                try {
                    userId = userId.replace("qg_", "")
                    const ids = groupId.replace("qg_", "").split("-")
                    const [guildID, channels] = ids
                    /** 获取appID */
                    let appID = Bot.qg.guilds[guildID].id || null
                    if (!appID) throw Error('❎ 这个群没有这个人哦~')
                    if (cfg.masterQQ?.includes(userId) && time != 0) throw Error('我连管理员都木有，这种事怎么可能做到的辣！！！')

                    /** 获取用户名称 */
                    const user = await Api.guildMember(appID, guildID, userId)
                    if (user.roles.includes("2", "4", "5")) throw Error('这个淫系管理员辣，只有主淫和频道主才可以干ta')

                    await Api.muteMember(appID, guildID, userId, { seconds: time })
                    return time == 0 ? `✅ 已把「${user.nick}」从小黑屋揪了出来(｡>∀<｡)`
                        : `已把「${user.nick}」扔进了小黑屋( ･_･)ﾉ⌒●~*`
                } catch (err) {
                    return err
                }
            } else {
                return yenai_old.muteMember.call(this, groupId, userId, executor, time, unit)
            }
        }
        /** 椰奶状态pro */
        const NewState = (await import("../../yenai-plugin/apps/state.js")).NewState
        NewState.prototype.state = async (e) => {
            if (e.msg.includes('监控')) {
                return await puppeteer.render('state/monitor', {
                    chartData: JSON.stringify(State.chartData)
                }, {
                    e,
                    scale: 1.4
                })
            }

            if (!/椰奶/.test(e.msg) && !Config.whole.state) return false

            if (!State.si) return e.reply('❎ 没有检测到systeminformation依赖，请运行："pnpm add systeminformation -w"进行安装')

            // 防止多次触发
            if (interval) { return false } else interval = true
            // 系统
            let FastFetch; let HardDisk
            let otherInfo = []
            // 其他信息
            otherInfo.push({
                first: '系统',
                tail: State.osInfo?.distro
            })
            // 网络
            otherInfo.push(State.getnetwork)
            // 插件数量
            otherInfo.push(State.getPluginNum)
            let promiseTaskList = [
                State.getFastFetch(e).then(res => { FastFetch = res }),
                State.getFsSize().then(res => { HardDisk = res })
            ]

            // 网络测试
            let psTest = []
            let { psTestSites, psTestTimeout, backdrop } = Config.state
            State.chartData.backdrop = backdrop
            psTestSites && promiseTaskList.push(...psTestSites?.map(i => State.getNetworkLatency(i.url, psTestTimeout).then(res => psTest.push({
                first: i.name,
                tail: res
            }))))
            // 执行promise任务
            await Promise.all(promiseTaskList)
            // 可视化数据
            let visualData = _.compact(await Promise.all([
                // CPU板块
                State.getCpuInfo(),
                // 内存板块
                State.getMemUsage(),
                // GPU板块
                State.getGPU(),
                // Node板块
                State.getNodeInfo()
            ]))
            const defaultAvatar = `../../../../../plugins/${Plugin_Name}/resources/state/img/default_avatar.jpg`
            // 发
            const sent = await redis.get('Yz:count:sendMsg:total') || 0
            // 图片
            const screenshot = await redis.get('Yz:count:screenshot:total') || 0
            // 机器人名称
            const BotName = Version.name
            // 系统运行时间
            const systime = common.formatTime(os.uptime(), 'dd天hh小时mm分', false)
            // 日历
            const calendar = moment().format('YYYY-MM-DD HH:mm:ss')
            // nodejs版本
            const nodeVersion = process.version
            let BotStatus = ""
            for (const i of e.msg.includes('pro') && Array.isArray(Bot.uin) ? Bot.uin : (Bot.adapter ? Bot.adapter : [e.self_id])) {
                const bot = Bot[i]
                if (!bot?.uin) continue
                // 头像
                const avatar = bot.avatar || (Number(bot.uin) ? `https://q1.qlogo.cn/g?b=qq&s=0&nk=${bot.uin}` : defaultAvatar)
                // 昵称
                const nickname = bot.nickname || "未知"
                // 在线状态
                const onlineStatus = status[bot.status] || "在线"
                // 登录平台版本
                const platform = bot.apk ? `${bot.apk.display} v${bot.apk.version}` : bot.version.version || "未知"
                // 收
                const recv = bot.stat?.recv_msg_cnt || "未知"
                // 好友数
                const friendQuantity = Array.from(bot.fl.values()).length
                // 群数
                const groupQuantity = Array.from(bot.gl.values()).length
                // 运行时间
                const runTime = common.formatTime(Date.now() / 1000 - bot.stat?.start_time, 'dd天hh小时mm分', false)
                // Bot版本
                const botVersion = bot.version ? `${bot.version.name}(${bot.version.id})${bot.apk ? ` ${bot.version.version}` : ""}` : `ICQQ(QQ) v${require('icqq/package.json').version}`
                BotStatus += `<div class="box">
    <div class="tb">
        <div class="avatar">
            <img src="${avatar}"
                onerror="this.src= '${defaultAvatar}'; this.onerror = null;">
        </div>
        <div class="header">
            <h1>${nickname}</h1>
            <hr noshade>
            <p>${onlineStatus}(${platform}) | 收${recv} | 发${sent} | 图片${screenshot} | 好友${friendQuantity} |
                群${groupQuantity}
            </p>
            <p>${BotName} 已运行 ${runTime} | 系统运行 ${systime}</p>
            <p>${calendar} | Nodejs ${nodeVersion} | ${botVersion}</p>
        </div>
    </div>
</div>
`
            }
            // 渲染数据
            let data = {
                BotStatus,
                chartData: JSON.stringify(common.checkIfEmpty(State.chartData, ['echarts_theme', 'cpu', 'ram']) ? undefined : State.chartData),
                // 硬盘内存
                HardDisk,
                // FastFetch
                FastFetch,
                // 硬盘速率
                fsStats: State.DiskSpeed,
                // 可视化数据
                visualData,
                // 其他数据
                otherInfo: _.compact(otherInfo),
                psTest: _.isEmpty(psTest) ? false : psTest
            }

            // 渲染图片
            await puppeteer.render('state/state', {
                ...data
            }, {
                e,
                scale: 1.4
            })

            interval = false
        }
    }
}
export default yenai_plugin