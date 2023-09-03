
/** 劫持原有禁言方法 */
let yenai_plugin = {
    async yenai() {
        const YenaiClass = (await import("../../yenai-plugin/model/GroupAdmin.js")).default
        const cfg = (await import("../../../lib/config/config.js")).default
        const yenai_old = {
            muteMember: YenaiClass.muteMember,
            kickMember: YenaiClass.kickMember,
        }
        /** 踹 */
        YenaiClass.prototype.kickMember = async function (groupId, userId, executor) {
            if (groupId.toString().length > 10 || groupId.toString().includes("-")) {
                const ids = groupId.split("-")
                const [guildID, channels] = ids
                /** 获取appID */
                let appID = QQGuild.guilds[guildID].appID || null
                if (!appID) throw Error('❎ 这个群没有这个人哦~')
                if (cfg.masterQQ?.includes(userId) && time != 0) throw Error('居然调戏主人！！！哼，坏蛋(ﾉ｀⊿´)ﾉ')

                if (!QQGuild.guilds[guildID].admin) throw Error('居然调戏主人！！！哼，坏蛋(ﾉ｀⊿´)ﾉ')
                if (cfg.masterQQ?.includes(userId) && time != 0) throw Error('我连管理员都木有，这种事怎么可能做到的辣！！！')

                /** 获取用户身份组 */
                const user = await QQGuild.bot.guildMember(appID, guildID, userId)
                if (user.roles.includes("2", "4", "5")) throw Error('这个淫系管理员辣，只有主淫和频道主才可以干ta')
                await QQGuild.bot.deleteGuildMember(appID, guildID, userId)
                return '已把这个坏淫踢掉惹！！！'
            } else {
                yenai_old.kickMember(groupId, userId, executor)
            }
        }
        /** 禁言 */
        YenaiClass.prototype.muteMember = async function (groupId, userId, executor, time = 300, unit = '秒') {
            if (groupId.toString().length > 10 || groupId.toString().includes("-")) {
                const ids = groupId.split("-")
                const [guildID, channels] = ids
                /** 获取appID */
                let appID = QQGuild.guilds[guildID].appID || null
                if (!appID) throw Error('❎ 这个群没有这个人哦~')
                if (cfg.masterQQ?.includes(userId) && time != 0) throw Error('我连管理员都木有，这种事怎么可能做到的辣！！！')

                /** 获取用户名称 */
                const user = await QQGuild.bot.guildMember(appID, guildID, userId)
                if (user.roles.includes("2", "4", "5")) throw Error('这个淫系管理员辣，只有主淫和频道主才可以干ta')

                await QQGuild.bot.muteMember(appID, guildID, userId, { seconds: time })
                return time == 0 ? `✅ 已把「${user.nick}」从小黑屋揪了出来(｡>∀<｡)`
                    : `已把「${user.nick}」扔进了小黑屋( ･_･)ﾉ⌒●~*`

            } else {
                yenai_old.muteMember(groupId, userId, executor, time = 300, unit = '秒')
            }
        }
    },
}
export default yenai_plugin