QQ交流群~欢迎加入：`884587317`

使用[NodeJS-SDK](https://github.com/tencent-connect/bot-node-sdk)进行连接

![Visitor Count](https://profile-counter.glitch.me/Zyy955-QQGuild-plugin/count.svg)

<details><summary>咕咕咕~：</summary>
- [√] 基础消息收发
- [√] 撤回消息
- [√] 引用消息
- [√] 消息转发 
    - [ ] 优化消息转发逻辑 主流插件基本已经支持...
    - [√] `xiaoyao-cvs-plugin`插件的`#刷新ck`指令暂未适配...等待pr通过，可正常使用指令
- [√] 根据api返回的状态码对图片进行缩放后重新发送图片...例如`xiaoyao-cvs-plugin`的星铁图鉴
- [√] 替换url中成为链接的字符，使其可以正常发送... 
- [√] 将发送失败状态码和原因通过图片进行回复用户...
- [√] 可控制台执行`#QQ频道设置...`
- [√] 适配`Bot.pickGroup(group_id).sendMsg("QQGuild-plugin：主动消息")`方法
    - 私聊主动消息不打算适配 官方api只允许机器人每天向单个用户推送两条主动消息
- [ ] 适配设置、删除精华 应该不适配主体方法，会由插件自身完成...(再看)
- [√] 适配`设置主人`插件

</details>

#### 可选安装
在`Yunzai`根目录执行，可更改启动命令为`node apps`来跳过登录QQ直接使用微信机器人，不影响原先的`node app`
```
curl -o "./apps.js" "https://gitee.com/Zyy955/Yunzai-Bot-plugin/raw/main/apps.js"
```

## 安装插件

在`Yunzai-Bot`根目录执行，任选其一

Gitee：
```
git clone --depth=1 https://gitee.com/Zyy955/QQGuild-plugin ./plugins/QQGuild-plugin && pnpm install -P
```

Github：
```
git clone --depth=1 https://github.com/Zyy955/QQGuild-plugin ./plugins/QQGuild-plugin && pnpm install -P
```

## 机器人指令配置

<details><summary>展开/收起</summary>

支持在控制台配置机器人，例如输入`#QQ频道设置...`

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
</details>

## 使用例子

<details><summary>展开/收起</summary>

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
</details>

## 可选安装依赖

频道api接口有限制发送图片大小，因该两个依赖安装失败较多，插件默认不安装压缩依赖，如果使用压缩图片功能，请在根目录执行
```
pnpm install
```

## 解除频道私信

解除私信3条后等待回复问题...机器人每天仅可发送两次私信主动消息
```
#QQ频道解除私信
```

## 分片转发

默认关闭

分片转发：对每条转发的内容进行逐一发送
```
#QQ频道设置分片转发开启
#QQ频道设置分片转发关闭
```

## 更新
```
#QQ频道更新
#QQ频道强制更新
```

## 设置主人

- 使用方法
  - 方法1：发送`#设置主人`，随后复制发送控制台的验证码即可成为主人
  - 方法2：发送`#设置主人@用户`，需要你是主人的情况下，指定此用户成为主人

## 爱发电

![爱发电](https://cdn.jsdelivr.net/gh/Zyy955/imgs/img/202308271209508.jpeg)



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
