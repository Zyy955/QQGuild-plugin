<!--
 * @Author: Zyy955 1072411694@qq.com
 * @Date: 2023-08-12 18:20:58
 * @LastEditors: Zyy955 1072411694@qq.com
 * @LastEditTime: 2023-08-12 18:58:14
 * @FilePath: \Miao-Yunzai-new\plugins\QQGuild-plugin\README.md
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
-->
使用[NodeJS-SDK](https://github.com/tencent-connect/bot-node-sdk)进行连接

咕咕咕~：
- [√] 基础消息收发
- [√] 撤回消息
- [√] 引用消息
- [ ] 消息转发 
    - `插件部分已完成...需要更改主体`
- [ ] 根据api返回的状态码对图片进行缩放后重新发送图片...
- [ ] 替换url中成为链接的字符，使其可以正常发送... 
    - `目前暂不清楚什么样的情况会被判定为url，基本的https和http已经完成替换...`
- [ ] 将发送失败状态码和原因进行回复用户...

#### 安装插件

在`Yunzai-Bot`根目录执行，任选其一

Gitee：
```
git clone --depth 1 https://gitee.com/Zyy955/QQGuild-plugin ./plugins/QQGuild-plugin && pnpm install -P
```

Github：
```
git clone --depth 1 https://github.com/Zyy955/QQGuild-plugin ./plugins/QQGuild-plugin && pnpm install -P
```

#### 机器人指令配置

添加机器人：
```
#QQ频道设置 是否沙盒:是否私域:appID:token 是=1 否=0
```

删除机器人：
```
#QQ频道设置 是否沙盒:是否私域:appID:token 是=1 否=0
```

查看机器人：
```
#QQ频道账号
```
#### 使用例子

是否沙盒：`是`

是否私域：`是`

appID：`123456789`

token：`abcdefghijklmnopqrstuvwxyz123456`


添加机器人：
```
#QQ频道设置 1:1:123456789:abcdefghijklmnopqrstuvwxyz123456
```

删除机器人：
```
#QQ频道设置 1:1:123456789:abcdefghijklmnopqrstuvwxyz123456
```

查看机器人：
```
#QQ频道账号
```

## 鸣谢

| 名称 | 作者 | GitHub | Gitee | 备注  | 
|------| ---- | ------ | ----- | ----- | 
| QQ机器人 | ----- | ----- | ----- | [QQ机器人](https://q.qq.com/) |
| QQ机器人文档 | ----- | ----- | ----- | [QQ机器人文档](https://bot.q.qq.com/wiki) |
| NodeJS-SDK | ----- | ----- | ----- | [NodeJS-SDK](https://github.com/tencent-connect/bot-node-sdk) |
| Yunzai-Bot | [@Le-niao](https://gitee.com/Le-niao) | [☞GitHub](https://github.com/Le-niao/Yunzai-Bot) | [☞Gitee](https://gitee.com/Le-niao/Yunzai-Bot) | 原版 Yunzai |
| Yunzai-Bot | [@喵喵](https://gitee.com/yoimiya-kokomi) | [☞GitHub](https://github.com/yoimiya-kokomi/Yunzai-Bot) | [☞Gitee](https://gitee.com/yoimiya-kokomi/Yunzai-Bot) | 喵喵维护版 Yunzai |
| Miao-Yunzai | [@喵喵](https://gitee.com/yoimiya-kokomi) | [☞GitHub](https://github.com/yoimiya-kokomi/Miao-Yunzai) | [☞Gitee](https://gitee.com/yoimiya-kokomi/Miao-Yunzai) | 喵版 Yunzai |
| Yunzai-Bot 索引库 | [@渔火Arcadia](https://gitee.com/yhArcadia) | [☞GitHub](https://github.com/yhArcadia/Yunzai-Bot-plugins-index) | [☞Gitee](https://gitee.com/yhArcadia/Yunzai-Bot-plugins-index) | 云崽相关内容索引库 |

## 免责声明：
使用此插件产生的一切后果与本人均无关

请不要用于任何商业性行为

插件所有资源都来自互联网，侵删
