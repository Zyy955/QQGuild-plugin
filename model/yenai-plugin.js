const { api, guilds } = qg

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
                const ids = groupId.replace("qg_", "").split("-")
                const [guildID, channels] = ids
                /** 获取appID */
                let appID = guilds[guildID].appID || null
                if (!appID) throw Error('❎ 这个群没有这个人哦~')
                if (cfg.masterQQ?.includes(userId) && time != 0) throw Error('居然调戏主人！！！哼，坏蛋(ﾉ｀⊿´)ﾉ')

                if (!guilds[guildID].admin) throw Error('居然调戏主人！！！哼，坏蛋(ﾉ｀⊿´)ﾉ')
                if (cfg.masterQQ?.includes(userId) && time != 0) throw Error('我连管理员都木有，这种事怎么可能做到的辣！！！')

                /** 获取用户身份组 */
                const user = await api.guildMember(appID, guildID, userId)
                if (user.roles.includes("2", "4", "5")) throw Error('这个淫系管理员辣，只有主淫和频道主才可以干ta')
                await api.deleteGuildMember(appID, guildID, userId)
                return '已把这个坏淫踢掉惹！！！'
            } else {
                return yenai_old.kickMember.call(this, groupId, userId, executor)
            }
        }
        /** 禁言 */
        YenaiClass.prototype.muteMember = async function (groupId, userId, executor, time = 300, unit = '秒') {
            if (String(groupId).includes("qg_")) {
                const ids = groupId.replace("qg_", "").split("-")
                const [guildID, channels] = ids
                /** 获取appID */
                let appID = guilds[guildID].appID || null
                if (!appID) throw Error('❎ 这个群没有这个人哦~')
                if (cfg.masterQQ?.includes(userId) && time != 0) throw Error('我连管理员都木有，这种事怎么可能做到的辣！！！')

                /** 获取用户名称 */
                const user = await api.guildMember(appID, guildID, userId)
                if (user.roles.includes("2", "4", "5")) throw Error('这个淫系管理员辣，只有主淫和频道主才可以干ta')

                await api.muteMember(appID, guildID, userId, { seconds: time })
                return time == 0 ? `✅ 已把「${user.nick}」从小黑屋揪了出来(｡>∀<｡)`
                    : `已把「${user.nick}」扔进了小黑屋( ･_･)ﾉ⌒●~*`

            } else {
                return yenai_old.muteMember.call(this, groupId, userId, executor, time, unit)
            }
        }
    },
}
export default yenai_plugin